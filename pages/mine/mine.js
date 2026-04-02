const app = getApp();

Page({
  data: {
    userInfo: null,
    menuItems: [
      { id: 'member', name: '我的会员', icon: 'huiyuanjifen', color: '#f1c40f' },
      { id: 'record', name: '我的战绩', icon: 'zhexiantu', color: '#3498db' },
      { id: 'rank', name: '战绩榜', icon: 'jilu', color: '#e67e22' },
      { id: 'customer', name: '人工客服', icon: 'Icon', color: '#2ecc71' },
      { id: 'share', name: '转发分享', icon: 'shanchuanniu', color: '#1abc9c' },
      { id: 'mark-pen-line', name: '标签管理', icon: 'mark-pen-line', color: '#e74c3c' },
    ]
  },

  onShow() {
    // 每次进入页面时同步最新的用户信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    console.log('个人中心 onShow，获取用户信息:', userInfo);
    if (userInfo) {
      this.setData({
        userInfo: { ...userInfo } // 创建新引用，强制触发视图更新
      });
    }
  },

  onEditProfile() {
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },

  onMenuTap(e) {
    const item = e.currentTarget.dataset.item;
    wx.showToast({
      title: `点击了${item.name}`,
      icon: 'none'
    });
  }
})
