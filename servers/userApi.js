// servers/userApi.js

// const BASE_URL = 'http://127.0.0.1:3000';
const BASE_URL = 'https://taoyity.cn';

/**
 * 通用请求工具函数
 */
const request = (url, method = 'GET', data = {}, contentType = 'application/json') => {
  const token = wx.getStorageSync('token');
  const header = {
    'content-type': contentType
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 适配后端返回的 { code: 200, message: "...", data: { ... } } 结构
          // 如果有 data 字段，直接解构出来返回，方便页面直接使用
          if (res.data && res.data.data !== undefined) {
            resolve(res.data.data);
          } else {
            resolve(res.data);
          }
        } else if (res.statusCode === 401) {
          // Token 失效处理：清空本地并提示
          wx.removeStorageSync('token');
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(res.data.message || '请求失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

module.exports = {
  // 1. 静默登录 (POST /app/login) - 使用 x-www-form-urlencoded
  login: (code) => {
    return request('/app/login', 'POST', { code }, 'application/x-www-form-urlencoded');
  },

  // 2. 获取用户资料 (GET /app/profile)
  getProfile: () => {
    return request('/app/profile', 'GET');
  },

  // 3. 更新用户资料 (PUT /app/profile)
  updateProfile: (data) => {
    return request('/app/profile', 'PUT', data);
  }
};
