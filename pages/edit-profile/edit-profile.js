// pages/edit-profile/edit-profile.js
const userApi = require('../../servers/userApi');
const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    canSave: false,
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
      const { nickname, avatarUrl } = app.globalData.userInfo;
      this.setData({ nickname, avatarUrl });
    }
  },

  // 获取微信头像和昵称
  getWechatUserInfo() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          avatarUrl: res.userInfo.avatarUrl,
          nickname: res.userInfo.nickName,
          canSave: true
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
      }
    });
  },

  // 选择本地头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      avatarUrl,
      canSave: true
    });
  },

  // 昵称输入监听
  onNicknameInput(e) {
    const value = e.detail.value;
    this.setData({
      nickname: value,
      canSave: value.trim().length > 0
    });
  },

  /**
   * 保存资料 / 完成注册
   */
  async onSave() {
    if (!this.data.canSave) return;

    try {
      wx.showLoading({ title: this.data.mode === 'register' ? '注册中...' : '保存中...' });
      
      // 1. 如果头像发生变化（且不是网络链接），上传头像
      let finalAvatarUrl = this.data.avatarUrl;
      if (finalAvatarUrl && !finalAvatarUrl.startsWith('http')) {
        const uploadRes = await userApi.uploadAvatar(finalAvatarUrl);
        finalAvatarUrl = uploadRes.url;
      }

      // 2. 同步用户信息到后端
      const res = await userApi.updateProfile({
        nickname: this.data.nickname,
        avatarUrl: finalAvatarUrl
      });

      if (res && (res.id || res.success)) {
        // 3. 更新全局数据与本地缓存
        const newUserInfo = {
          userId: res.id || res.userId,
          nickname: this.data.nickname,
          avatarUrl: finalAvatarUrl
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
