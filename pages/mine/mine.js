// pages/mine/mine.js
Page({
  data: {
    userInfo: {
      nickname: '瓜呱哇',
      avatarUrl: '' // 占位
    },
    menuItems: [
      { id: 'member', name: '我的会员', icon: 'huiyuanjifen', color: '#f1c40f' },
      { id: 'record', name: '我的战绩', icon: 'zhexiantu', color: '#3498db' },
      { id: 'rank', name: '战绩榜', icon: 'jilu', color: '#e67e22' },
      { id: 'customer', name: '人工客服', icon: 'Icon', color: '#2ecc71' },
      { id: 'share', name: '转发分享', icon: 'shanchuanniu', color: '#1abc9c' }
    ]
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
