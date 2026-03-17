// pages/record-game/record-game.js
Page({
  data: {
    showFilter: false,
    activeTab: 'all', // all, in_progress, finished
    summary: {
      total: 101,
      win: 42,
      loss: 53,
      draw: 6,
      totalWin: 1647,
      totalLoss: -12361,
      totalSum: -10714
    },
    // 对局数据，复用 play-game 组件，数据可以重复
    gameList: [
      {
        id: 1,
        players: [
          { id: 1, name: '瓜呱哇', score: 0, isOwner: true },
          { id: 2, name: '就爱薯条', score: 0, isOwner: false }
        ],
        startTime: '26-03-15 16:41',
        duration: '18小时42分'
      },
      {
        id: 2,
        players: [
          { id: 1, name: '瓜呱哇', score: 112, isOwner: false },
          { id: 2, name: '钟仁呈...', score: 13, isOwner: true },
          { id: 3, name: '台板', score: 156, isOwner: false },
          { id: 4, name: '广西周...', score: 479, isOwner: false },
          { id: 5, name: '早八贞...', score: -760, isOwner: false }
        ],
        startTime: '26-02-23 16:18',
        duration: '499小时5分'
      },
      {
        id: 3,
        players: [
          { id: 1, name: '瓜呱哇', score: 0, isOwner: false },
          { id: 2, name: '覃达', score: 0, isOwner: true },
          { id: 3, name: '昭昭', score: 0, isOwner: false }
        ],
        startTime: '26-03-16 10:00',
        duration: '1小时30分'
      }
    ]
  },

  onFilterTap() {
    this.setData({ showFilter: true });
  },

  onFilterClose() {
    this.setData({ showFilter: false });
  },

  onFilterConfirm(e) {
    console.log('筛选条件：', e.detail);
    // 这里可以根据筛选条件请求接口或过滤本地数据
    wx.showToast({
      title: '已应用筛选',
      icon: 'success'
    });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  goToRank() {
    wx.navigateTo({
      url: '/pages/rank-list/rank-list'
    });
  }
})

