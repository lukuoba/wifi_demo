// app.js
const userApi = require('./servers/userApi');

App({
  globalData: {
    userInfo: null,
    isRegistered: false
  },

  onLaunch() {
    // 启动会话：本地有双 token 直接复用，没有就走 wx.login 静默登录
    this.loginReady = this.bootstrap();
  },

  /**
   * 冷启动会话恢复
   * - 本地有 auth（accessToken/refreshToken）→ 直接用，不再走 wx.login
   * - 本地没有 → 静默登录一次
   * accessToken 过期由 userApi 在 401 时自动刷新并重放，用户无感
   */
  async bootstrap() {
    const hadSession = !!userApi.getAuth();

    try {
      const session = await userApi.restoreSession();
      let userInfo = session && session.user;

      // 本地只存了 token 没存 user 时，补拉一次资料
      if (!userInfo) {
        userInfo = await userApi.getProfile();
      }

      // 首次登录 / 会话重建时回首页刷新数据；已有会话则保留当前入口页（如分享进入详情页）
      this.handleUserInfo(userInfo, { redirectHome: !hadSession });
      return userInfo;
    } catch (err) {
      console.error('启动登录流程失败:', err);
      return null;
    }
  },

  /**
   * 处理用户信息及跳转逻辑
   */
  handleUserInfo(userInfo, options = {}) {
    if (!userInfo) return;

    if (!userInfo.nickname) {
      console.log('用户资料不完整，引导至注册/设置页');
      wx.reLaunch({
        url: '/pages/edit-profile/edit-profile?mode=register'
      });
      return;
    }

    this.globalData.userInfo = userInfo;
    this.globalData.isRegistered = true;
    wx.setStorageSync('userInfo', userInfo);
    if (userInfo.openid) {
      wx.setStorageSync('openid', userInfo.openid);
    }

    if (options.redirectHome) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  /**
   * 设置用户信息并持久化 (供修改资料后调用)
   */
  setUserInfo(userInfo) {
    // 使用对象合并，防止丢失原有字段（如 openid）
    this.globalData.userInfo = { ...(this.globalData.userInfo || {}), ...userInfo };
    this.globalData.isRegistered = !!this.globalData.userInfo.nickname;
    wx.setStorageSync('userInfo', this.globalData.userInfo);

    // 同步写回 auth，保证会话里的 user 与展示一致
    const auth = userApi.getAuth();
    if (auth) {
      wx.setStorageSync('auth', { ...auth, user: this.globalData.userInfo });
    }
  }
});
