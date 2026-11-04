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
      const err = new Error('无 refreshToken');
      err.statusCode = 401;  // 统一标记为会话失效，让 request() 里的兜底逻辑正确触发 silentLogin
      return Promise.reject(err);
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
 * 冷启动会话恢复（主动刷新模式）：
 *   本地有 refreshToken → 先 POST /app/refresh 换新双 token（避免业务请求先 401）
 *     → refresh 也过期（401） → 清本地 → wx.login → /app/login
 *   本地无 refreshToken → 直接 wx.login → /app/login
 *
 * 好处：用户打开小程序时，会话已经是新鲜的，第一笔业务请求不会 401，体验"直接就进去了"
 */
const restoreSession = async () => {
  const auth = getAuth();

  if (auth && auth.refreshToken) {
    try {
      return await refreshSession();   // ✅ 有 refreshToken 就先刷新一次
    } catch (err) {
      // refreshToken 过期（401）或网络异常 → 静默登录兜底
      console.warn('[restoreSession] refresh 失败，回退 wx.login:', err.message || err);
    }
  }

  // 无 auth、无 refreshToken、或 refresh 失败 → 走 wx.login 换全新会话
  try {
    const fresh = await silentLogin();
    if (fresh) return fresh;
  } catch (loginErr) {
    console.warn('[restoreSession] wx.login 兜底失败:', loginErr.message || loginErr);
  }

  // 彻底没会话了（比如 wx.login 也挂了）
  clearAuth();
  return null;
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
  // 小程序码：后端拿 access_token 调微信 getwxacodeunlimit，返回 { base64 } 或 { url }
  getWxacode: (gameId) => request('/app/game/wxacode', 'GET', { gameId }),

  /**
   * 上传头像到京东云 OSS（后端签名 + 前端 multipart 直传）
   * 流程：
   *   1) 调后端 GET /common/oss/config 拿上传参数（AccessKeyId / Signature / Policy / endpoint 等）
   *   2) wx.uploadFile 以 multipart/form-data 把文件 + 签名表单字段一起 POST 到 endpoint
   *   3) 后端返回 ossUrl（或从 config + key 拼出最终访问地址）
   *
   * 京东云 OSS 表单上传签名字段（以 /common/oss/config 实际返回为准）：
   *   bucket          存储桶名
   *   endpoint        OSS 域名，例如 https://your-bucket.oss-cn-north-1.jdcloud.com
   *   key             对象路径，例如 avatar/xxx.jpg
   *   OSSAccessKeyId  京东云 AccessKeyId
   *   Signature       签名
   *   Policy          base64 编码的上传策略
   *   success_action_status  可选，期望的 OSS 响应码，一般 201 或 200
   *   ossUrl / fileUrl 可选，后端直接拼好的最终访问地址
   */
  uploadAvatar: async (tempFilePath) => {
    if (!tempFilePath) {
      throw new Error('缺少文件路径');
    }

    // 1. 根据文件后缀推断 contentType
    const ext = (tempFilePath.split('.').pop() || 'jpg').toLowerCase();
    const filename = `avatar_${Date.now()}.${ext}`;
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    const contentType = mimeMap[ext] || 'image/jpeg';

    // 2. 向业务后端拿 OSS 上传签名
    //    这里走业务层 request() —— 自动挂 Authorization: Bearer <accessToken>，401 时静默刷新并重放
    //    注意：后端路由挂载在 /common 下，所以路径是 /common/oss/config（不是 /oss/config）
    console.log('[uploadAvatar] step1: GET /common/oss/config, filename=', filename);
    let config = null;
    try {
      config = await request('/common/oss/config', 'GET', { filename, contentType });
    } catch (e) {
      console.warn('[uploadAvatar] /common/oss/config 失败:', e.message || e);
    }
    console.log('[uploadAvatar] step2: OSS config =', config);

    // 模式 A：后端直接返回预签名 URL
    if (config && (config.uploadUrl || config.upload_url || config.presignedUrl)) {
      return uploadPresignedPut(tempFilePath, config, contentType);
    }

    // 模式 B：后端返回完整表单签名（Policy + Signature）
    if (config && (config.Signature || config.signature) && (config.Policy || config.policy)) {
      return uploadFormDirect(tempFilePath, config, filename, contentType);
    }

    // 模式 C：后端只返回 bucket / endpoint / targetFolder / domain
    //         → 再调 /common/oss/presigned-url 换取真正的上传凭证
    console.log('[uploadAvatar] step3: config 无签名材料，继续 GET /common/oss/presigned-url');
    let presign;
    try {
      presign = await request('/common/oss/presigned-url', 'GET', {
        filename,
        contentType,
        folder: (config && config.targetFolder) || '',
        bucket: (config && config.bucket) || ''
      });
    } catch (e) {
      throw new Error(`获取 OSS 预签名 URL 失败: ${e.message || e}`);
    }
    console.log('[uploadAvatar] step4: presign =', presign);

    const uploadUrl = presign && (presign.uploadUrl || presign.upload_url || presign.presignedUrl || presign.putUrl);
    if (!uploadUrl) {
      throw new Error(`预签名接口未返回 uploadUrl，实际字段: ${presign ? Object.keys(presign).join(',') : '空'}`);
    }

    // 最终访问地址：优先后端给的 fileUrl / ossUrl，其次 domain + key 自己拼
    const domain = normalizeOrigin((config && config.domain) || (config && config.endpoint) || '');
    const key = (presign && (presign.key || presign.objectKey || presign.object_key)) ||
      [(config && config.targetFolder), filename].filter(Boolean).join('/');
    const fileUrl = (presign && (presign.fileUrl || presign.file_url || presign.ossUrl || presign.publicUrl)) ||
      (domain ? `${domain}/${String(key).replace(/^\//, '')}` : '');

    if (!fileUrl) {
      throw new Error('无法确定文件访问地址（缺少 fileUrl / domain）');
    }

    return uploadPresignedPut(tempFilePath, { uploadUrl, fileUrl }, contentType);
  }
};

/* ------------------------------------------------------------------ */
/* OSS 直传两种模式的具体实现                                            */
/* ------------------------------------------------------------------ */

/** 补齐协议头：后端返回的 endpoint 可能是 s3.cn-south-1.jdcloud-oss.com 这种裸域名 */
function normalizeOrigin(value) {
  if (!value) return '';
  const v = String(value).replace(/\/+$/, '');
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * 模式 A：表单上传签名（/oss/config 返回 Policy/Signature/Key/endpoint）
 * 用 wx.uploadFile → multipart/form-data，文件 + 签名字段一起 POST 到 OSS endpoint
 */
function uploadFormDirect(tempFilePath, config, filename, contentType) {
  // 字段兼容：京东云 OSS 表单签名，字段名大小写以 /common/oss/config 实际返回为准
  const bucket = config.bucket || config.Bucket;
  const endpoint = (config.endpoint || config.Endpoint || '').replace(/\/$/, '');
  const key = config.key || config.Key || config.objectKey || config.object_key;
  const ossAccessKeyId = config.OSSAccessKeyId || config.accessKeyId || config.AccessKeyId || config.access_key_id;
  const signature = config.Signature || config.signature;
  const policy = config.Policy || config.policy;
  const successActionStatus = config.success_action_status || config.successActionStatus || '201';
  const finalUrl = config.ossUrl || config.fileUrl || config.url;

  if (!endpoint || !key || !signature) {
    throw new Error('OSS 配置缺少必要字段 endpoint/key/signature');
  }

  // 组装 multipart formData（OSS 严格要求字段顺序，Key/Policy/Signature 等必须在 file 之前）
  const formData = {};
  if (ossAccessKeyId) formData.OSSAccessKeyId = ossAccessKeyId;
  formData.key = key;
  if (policy) formData.Policy = policy;
  formData.Signature = signature;
  formData.success_action_status = successActionStatus;
  // 如果后端没拼好 fileUrl，自己拼：endpoint（含协议）去掉末尾 / + / + key
  const resolvedUrl = finalUrl || `${endpoint.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;

  console.log('[uploadAvatar] step3: wx.uploadFile →', endpoint, 'key=', key);

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: endpoint,                      // 直传到 OSS endpoint（带 https://）
      name: 'file',                       // OSS 表单上传标准字段名
      filePath: tempFilePath,
      header: {
        // 表单上传不需要自定义 Content-Type，wx.uploadFile 自己会生成 boundary
        'x-oss-meta-filename': filename
      },
      formData,
      success: (res) => {
        console.log('[uploadAvatar] OSS 响应 status=', res.statusCode, 'body=', (res.data || '').slice(0, 200));
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, url: resolvedUrl });
        } else {
          reject(new Error(`OSS 上传失败: status=${res.statusCode}, msg=${(res.data || '').slice(0, 200)}`));
        }
      },
      fail: (err) => {
        console.error('[uploadAvatar] OSS 网络失败', err);
        reject(new Error(`OSS 上传网络失败: ${err.errMsg || err}`));
      }
    });
  });
}

/**
 * 模式 B：预签名 PUT URL（/presigned-url 返回 uploadUrl + fileUrl）
 * wx.request(PUT, data=ArrayBuffer) 直传
 */
function uploadPresignedPut(tempFilePath, config, contentType) {
  const uploadUrl = config.uploadUrl || config.upload_url || config.presignedUrl;
  const finalUrl = config.fileUrl || config.file_url || config.url;

  if (!uploadUrl) throw new Error('OSS 配置缺少 uploadUrl');

  let arrayBuffer;
  try {
    // 第二个参数是 encoding，不传 encoding 时才返回 ArrayBuffer
    // 传 'arraybuffer' 会报 readFileSync:fail Unknown encoding: arraybuffer
    arrayBuffer = wx.getFileSystemManager().readFileSync(tempFilePath);
  } catch (e) {
    throw new Error(`读取本地文件失败: ${e.message || e}`);
  }
  if (typeof arrayBuffer === 'string') {
    throw new Error('读取本地文件失败: 返回了字符串而非 ArrayBuffer');
  }
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('本地文件为空');
  }

  const header = { 'Content-Type': contentType };
  // 预签名 URL 带 x-amz-sdk-checksum-algorithm=CRC32 时，必须回传对应的校验头，否则 OSS 拒绝
  const checksumMatch = /[?&]x-amz-sdk-checksum-algorithm=([A-Za-z0-9]+)/.exec(uploadUrl);
  if (checksumMatch && checksumMatch[1].toUpperCase() === 'CRC32') {
    header['x-amz-checksum-crc32'] = crc32Base64(arrayBuffer);
    console.log('[uploadAvatar] 附加校验头 x-amz-checksum-crc32 =', header['x-amz-checksum-crc32']);
  }

  console.log('[uploadAvatar] step5: PUT →', uploadUrl, 'size=', arrayBuffer.byteLength);
  return new Promise((resolve, reject) => {
    wx.request({
      url: uploadUrl,
      method: 'PUT',
      data: arrayBuffer,
      header,
      success: (ossRes) => {
        console.log('[uploadAvatar] OSS 响应 status=', ossRes.statusCode, 'body=', String(ossRes.data || '').slice(0, 300));
        if (ossRes.statusCode >= 200 && ossRes.statusCode < 300) {
          resolve({ success: true, url: finalUrl });
        } else {
          reject(new Error(`OSS 上传失败: status=${ossRes.statusCode}, msg=${String(ossRes.data || '').slice(0, 300)}`));
        }
      },
      fail: (err) => {
        console.error('[uploadAvatar] OSS 网络失败', err);
        reject(new Error(`OSS 上传网络失败: ${err.errMsg || err}`));
      }
    });
  });
}

/* S3 预签名 URL 的 CRC32 校验值（4 字节大端）转 base64 */
let crc32TableCache = null;
function getCrc32Table() {
  if (crc32TableCache) return crc32TableCache;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crc32TableCache = table;
  return table;
}

function crc32Base64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const table = getCrc32Table();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  }
  crc = (crc ^ 0xFFFFFFFF) >>> 0;

  // 大端序：高位字节在前
  const buf = [(crc >>> 24) & 0xFF, (crc >>> 16) & 0xFF, (crc >>> 8) & 0xFF, crc & 0xFF];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < buf.length; i += 3) {
    const b0 = buf[i];
    const b1 = i + 1 < buf.length ? buf[i + 1] : 0;
    const b2 = i + 2 < buf.length ? buf[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < buf.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < buf.length ? chars[b2 & 63] : '=';
  }
  return out;
}
