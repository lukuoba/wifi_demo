// pages/edit-profile/edit-profile.js
const userApi = require('../../servers/userApi');
const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    canSave: false,
    isAgreed: false,
    mode: 'edit' // edit 或 register
  },

  onLoad(options) {
    const mode = options.mode || 'edit';
    this.setData({ mode });
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: mode === 'register' ? '注册' : '修改资料'
    });

    // 如果是编辑模式，初始化现有数据
    if (mode === 'edit' && app.globalData.userInfo) {
      const { nickname, avatar } = app.globalData.userInfo;
      this.setData({ 
        nickname, 
        avatarUrl: avatar || '',
        canSave: nickname.trim().length > 0
      });
    }
  },

  // 统一校验是否可保存
  checkCanSave() {
    const { nickname } = this.data;
    const isNicknameValid = nickname && nickname.trim().length > 0;
    this.setData({
      canSave: isNicknameValid
    });
  },

  // 选择本地头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('本地头像',avatarUrl)
    this.setData({
      avatarUrl
    }, () => {
      this.checkCanSave();
    });
  },

  // 昵称输入监听
  onNicknameInput(e) {
    const value = e.detail.value;
    this.setData({
      nickname: value
    }, () => {
      this.checkCanSave();
    });
  },

  // 协议勾选监听
  onAgreeChange(e) {
    this.setData({
      isAgreed: e.detail.value.length > 0
    });
  },

  // 跳转到用户使用协议
  goToUserAgreement() {
    wx.showToast({ title: '跳转用户协议', icon: 'none' });
    // 实际代码：wx.navigateTo({ url: '/pages/protocol/user-agreement' });
  },

  // 跳转到隐私协议
  goToPrivacyPolicy() {
    wx.showToast({ title: '跳转隐私协议', icon: 'none' });
    // 实际代码：wx.navigateTo({ url: '/pages/protocol/privacy-policy' });
  },

  /**
   * 保存资料 / 完成注册
   */
  async onSave() {
    if (!this.data.canSave) return;
    
    // 如果是注册模式，必须勾选协议
    if (this.data.mode === 'register' && !this.data.isAgreed) {
      wx.showToast({
        title: '请阅读并勾选协议',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: this.data.mode === 'register' ? '注册中...' : '保存中...' });
      
      // 1. 如果头像发生变化（且是小程序临时路径），上传到京东云 OSS
      let finalAvatarUrl = this.data.avatarUrl;
      if (finalAvatarUrl && (finalAvatarUrl.startsWith('http://tmp/') || finalAvatarUrl.startsWith('wxfile://'))) {
        const uploadRes = await userApi.uploadAvatar(finalAvatarUrl);
        finalAvatarUrl = uploadRes.url;
      }
      console.log('finalAvatarUrl', finalAvatarUrl)
      // 2. 同步用户信息到后端
      const res = await userApi.updateProfile({
        nickname: this.data.nickname,
        avatar: finalAvatarUrl
      });

      if (res && (res.id || res.success)) {
        // 3. 更新全局数据与本地缓存
        const newUserInfo = {
          userId: res.id || res.userId,
          nickname: this.data.nickname,
          avatar: finalAvatarUrl
        };
        app.setUserInfo(newUserInfo);

        wx.hideLoading();
        wx.showToast({
          title: this.data.mode === 'register' ? '注册成功' : '保存成功',
          icon: 'success'
        });

        // 4. 跳转逻辑
        setTimeout(() => {
          if (this.data.mode === 'register') {
            // 注册成功进入主页
            wx.reLaunch({ url: '/pages/index/index' });
          } else {
            // 编辑成功返回
            wx.navigateBack();
          }
        }, 1500);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存失败:', err);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  }
})
