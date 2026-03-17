// pages/game-detail/game-detail.js
Page({
  data: {
    actions: [
      { id: 'invite', name: '邀请', icon: 'duoren' },
      { id: 'detail', name: '明细', icon: 'mark-pen-line' },
      { id: 'exit', name: '退出', icon: 'guanbianniu-copy' },
      { id: 'mute', name: '已关', icon: 'Icon' },
      { id: 'more', name: '更多', icon: 'shanchuanniu' }
    ],
    players: [
      { id: 1, name: '台板', type: '赢', score: 156, avatarColor: '#4cd964', avatarText: '台' },
      { id: 2, name: '钟仁呈的终极克星', type: '赢', score: 13, avatarColor: '#f5f5f5', isOwner: true },
      { id: 3, name: '广西周润发', type: '赢', score: 479, avatarColor: '#f5f5f5' },
      { id: 4, name: '早八贞子爬行', type: '输', score: 760, avatarColor: '#f5f5f5' },
      { id: 5, name: '瓜呱哇', type: '赢', score: 112, avatarColor: '#f5f5f5' }
    ]
  },

  onActionTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: `点击了${id}`,
      icon: 'none'
    });
  },

  giveScore(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({
      title: `给${name}记分`,
      icon: 'none'
    });
  }
})
