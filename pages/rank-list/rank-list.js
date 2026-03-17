// pages/rank-list/rank-list.js
Page({
  data: {
    dateRange: '30', // 30, 90, custom
    ranks: [
      { id: 1, name: '广西周润发', count: 1, totalScore: 479, avatarColor: '#f5f5f5' },
      { id: 2, name: '瓜呱哇', count: 2, totalScore: 112, avatarColor: '#fff1f0', isHighlight: true },
      { id: 3, name: '钟仁呈的终极克星', count: 1, totalScore: 13, avatarColor: '#f5f5f5' },
      { id: 4, name: '就爱薯条', count: 1, totalScore: 0, avatarColor: '#f5f5f5' },
      { id: 5, name: '早八贞子爬行', count: 1, totalScore: -760, avatarColor: '#f5f5f5' }
    ],
    sortType: 'total', // total
    orderType: 'desc' // desc, asc
  },

  onDateChange(e) {
    this.setData({ dateRange: e.currentTarget.dataset.range });
  },

  closeRank() {
    wx.navigateBack();
  }
})
