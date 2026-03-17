// pages/edit-profile/edit-profile.js
Page({
  data: {
    avatarUrl: '',
    nickname: '瓜呱哇',
    canSave: false
  },

  onLoad() {
    // 可以在这里初始化数据，例如从全局或本地缓存读取
  },

  // 获取微信头像和昵称 (wx.getUserProfile)
  getWechatUserInfo() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        console.log('获取用户信息成功', res.userInfo);
        this.setData({
          avatarUrl: res.userInfo.avatarUrl,
          nickname: res.userInfo.nickName,
          canSave: true
        });
        wx.showToast({
          title: '同步微信成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        });
      }
    });
  },

  // 选择本地头像 (使用 open-type="chooseAvatar")
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('选择头像成功', avatarUrl);
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

  // 保存资料
  onSave() {
    if (!this.data.canSave) return;

    wx.showLoading({ title: '保存中...' });
    
    // 模拟接口请求
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }, 1000);
  }
})
