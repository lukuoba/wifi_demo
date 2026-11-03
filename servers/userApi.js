// servers/userApi.js

const BASE_URL = 'https://jifen.taoyity.cn';
// const BASE_URL = 'http://127.0.0.1:3000';

const AUTH_KEY = 'auth';
const LOGIN_PATH = '/app/login';
const REFRESH_PATH = '/app/refresh';

// 单飞锁：并发的 401 / 刷新 / 登录共用同一个 Promise，避免重复换 token
let refreshPromise = null;
let loginPromise = null;

/* ------------------------------------------------------------------ */
/* 会话存储                                                            */
/* ------------------------------------------------------------------ */

const getAuth = () => {
  const auth = wx.getStorageSync(AUTH_KEY);
  return auth && auth.accessToken ? auth : null;
};

/**
 * 落地双 token：accessToken(2h) + refreshToken(7d)
 * 存成 { accessToken, refreshToken, expiresIn, user }，关掉小程序重开不丢
 */
const setAuth = (payload) => {
  const prev = getAuth();
  const auth = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresIn: Number(payload.expiresIn) || 7200,
    user: payload.user || (prev && prev.user) || null
  };

  wx.setStorageSync(AUTH_KEY, auth);

  // 兼容旧页面读取方式
  if (auth.user) {
    wx.setStorageSync('userInfo', auth.user);
    if (auth.user.openid) {
      wx.setStorageSync('openid', auth.user.openid);
    }
  }
  return auth;
};

const clearAuth = () => {
  wx.removeStorageSync(AUTH_KEY);
  wx.removeStorageSync('userInfo');
};

/* ------------------------------------------------------------------ */
/* 基础请求（不带鉴权，不处理 401，供登录/刷新使用）                      */
/* ------------------------------------------------------------------ */

const rawRequest = (path, method = 'GET', data = {}, contentType = 'application/json') => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header: { 'content-type': contentType },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 适配 { code: 200, message, data } 结构
          resolve(res.data && res.data.data !== undefined ? res.data.data : res.data);
        } else {
          const error = new Error((res.data && res.data.message) || '请求失败');
          error.statusCode = res.statusCode;
          reject(error);
        }
      },
      fail: reject
    });
  });
};

/* ------------------------------------------------------------------ */
/* 登录 / 刷新                                                         */
/* ------------------------------------------------------------------ */

/**
 * 静默登录：wx.login → code → /white/user/login
 * 后端换 openid → 查/建 AppUser → 签发双 token
 */
const silentLogin = () => {
  if (loginPromise) return loginPromise;

  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success: async ({ code }) => {
        if (!code) {
          reject(new Error('获取登录凭证失败'));
          return;
        }
        try {
          const data = await rawRequest(LOGIN_PATH, 'POST', { code }, 'application/x-www-form-urlencoded');
          if (!data || !data.accessToken) {
            reject(new Error('登录失败：未返回 accessToken'));
            return;
          }
          resolve(setAuth(data));
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  }).then(
    (auth) => {
      loginPromise = null;
      return auth;
    },
    (error) => {
      loginPromise = null;
      throw error;
    }
  );

  return loginPromise;
};

/**
 * 刷新会话：/white/user/refresh 带 refreshToken
 * 后端 rotateSession：旧双 token 作废，签发新双 token
 */
const refreshSession = () => {
  if (refreshPromise) return refreshPromise;

  const auth = getAuth();
  if (!auth || !auth.refreshToken) {
    return Promise.reject(new Error('无 refreshToken'));
  }

  refreshPromise = rawRequest(REFRESH_PATH, 'POST', { refreshToken: auth.refreshToken }).then(
    (data) => {
      refreshPromise = null;
      if (!data || !data.accessToken) {
        throw new Error('刷新失败：未返回 accessToken');
      }
      return setAuth(data);
    },
    (error) => {
      refreshPromise = null;
      throw error;
    }
  );

  return refreshPromise;
};

/**
 * 拿到可用会话：有本地会话直接用，没有就静默登录
 */
const restoreSession = async () => {
  const auth = getAuth();
  if (auth) return auth;
  return silentLogin();
};

/* ------------------------------------------------------------------ */
/* 业务请求：自动挂 Authorization，401 时静默换 token 并重放原请求          */
/* ------------------------------------------------------------------ */

const request = (path, method = 'GET', data = {}, contentType = 'application/json', retried = false) => {
  const auth = getAuth();
  const header = { 'content-type': contentType };
  if (auth) {
    header.Authorization = `Bearer ${auth.accessToken}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header,
      success: async (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data && res.data.data !== undefined ? res.data.data : res.data);
          return;
        }

        if (res.statusCode === 401) {
          // 已经重放过仍然 401，说明会话彻底失效
          if (retried) {
            clearAuth();
            reject(new Error('登录已过期'));
            return;
          }

          try {
            // 1. 有 refreshToken 先静默刷新
            if (auth && auth.refreshToken) {
              await refreshSession();
            } else {
              // 2. 连 refreshToken 都没有，直接静默登录
              await silentLogin();
            }
            // 3. 用新 token 重放原请求
            const replayed = await request(path, method, data, contentType, true);
            resolve(replayed);
          } catch (error) {
            // 刷新返回 401 = refreshToken 也过期：清本地 → 静默登录 → 再重放
            if (!error || error.statusCode !== 401) {
              // 网络抖动等临时失败，保留本地会话，直接抛错
              reject(error);
              return;
            }

            clearAuth();
            try {
              await silentLogin();
              const replayed = await request(path, method, data, contentType, true);
              resolve(replayed);
            } catch (loginError) {
              reject(new Error('登录已过期'));
            }
          }
          return;
        }

        reject(new Error((res.data && res.data.message) || '请求失败'));
      },
      fail: reject
    });
  });
};

module.exports = {
  getAuth,
  clearAuth,
  restoreSession,
  silentLogin,
  refreshSession,

  // 用户资料
  getProfile: () => request('/app/user/profile', 'GET'),
  updateProfile: (data) => request('/app/user/profile', 'PUT', data),

  // 标签
  getTags: () => request('/app/tag', 'GET'),

  // 对局
  immediateStart: (data) => request('/app/game/create', 'POST', data),
  getGameDetails: (gameId) => request(`/app/game/${gameId}`, 'GET'),
  getGameList: () => request('/app/game/list', 'GET'),

  /**
   * 上传头像到京东云 OSS
   * @param {string} tempFilePath 小程序临时文件路径
   */
  uploadAvatar: async (tempFilePath) => {
    try {
      const ext = tempFilePath.split('.').pop() || 'jpg';
      const filename = `avatar_${Date.now()}.${ext}`;
      const contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;

      const res = await request('/common/oss/presigned-url', 'GET', {
        filename,
        contentType
      });

      const { uploadUrl, fileUrl } = res;

      return new Promise((resolve, reject) => {
        wx.request({
          url: uploadUrl,
          method: 'PUT',
          data: wx.getFileSystemManager().readFileSync(tempFilePath),
          header: { 'Content-Type': contentType },
          success: (ossRes) => {
            if (ossRes.statusCode === 200) {
              resolve({ success: true, url: fileUrl });
            } else {
              reject(new Error('OSS 上传失败'));
            }
          },
          fail: reject
        });
      });
    } catch (err) {
      console.error('获取预签名 URL 失败:', err);
      throw err;
    }
  }
};
