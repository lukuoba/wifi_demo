// app.js
const userApi = require('./servers/userApi');

App({
  globalData: {
    userInfo: null,
    isRegistered: false
  },

  onLaunch() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录与注册状态（静默登录流程）
   */
  async checkLoginStatus() {
    try {
      // 1. 检查本地是否有 Token
      const token = wx.getStorageSync('token');
      
      if (!token) {
        // 2. 没有 Token，执行静默登录
        console.log('本地无 Token，执行静默登录...');
        const { code } = await wx.login();
        console.log('获取到的登录凭证:', code);
        const loginRes = await userApi.login(code);
        
        if (loginRes && loginRes.token) {
          // 4. 存储 Token
          wx.setStorageSync('token', loginRes.token);
          wx.setStorageSync('openid', loginRes.user.openid);
          if(loginRes.isNewUser){
            this.handleUserInfo(loginRes.user || loginRes.userInfo);
          } else {
            this.handleUserInfo(loginRes.user || loginRes.userInfo);
          }
        } else {
          throw new Error('登录失败：未返回 Token');
        }
      } else {
        // 5. 有 Token，直接获取/校验用户信息
        console.log('本地有 Token，校验用户信息...');
        const openid = wx.getStorageSync('openid');
        const userInfo = await userApi.getProfile(openid);
        this.handleUserInfo(userInfo);
      }
    } catch (err) {
      console.error('静默登录流程失败:', err);
      // 登录失败可以尝试重新登录或提示
    }
  },

  /**
   * 处理用户信息及跳转逻辑
   */
  handleUserInfo(userInfo) {
    if (!userInfo) return;

    // 判断是否需要完善资料 (nickname 为空则跳转)
    if (!userInfo.nickname || userInfo.nickname === '') {
      console.log('用户资料不完整，引导至注册/设置页');
      wx.reLaunch({
        url: '/pages/edit-profile/edit-profile?mode=register'
      });
    } else {
    // 更新全局数据
      console.log('app.js: globalData.isRegistered set to true');
      console.log('app.js: handleUserInfo setting isRegistered to true');
      this.globalData.userInfo = userInfo;
      this.globalData.isRegistered = true;
      wx.setStorageSync('userInfo', userInfo);
      console.log('app.js: 登录成功，准备进入主页或刷新主页内容');
      console.log('app.js: handleUserInfo about to call wx.reLaunch to /pages/index/index');
      wx.reLaunch({
        url: '/pages/index/index'
      });
      console.log('app.js: wx.reLaunch called in handleUserInfo.');
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
    console.log('全局用户信息已更新:', this.globalData.userInfo);
  }
})
