// components/play-game/play-game.js
Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {
    players: {
      type: Array,
      value: []
    },
    startTime: {
      type: String,
      value: ''
    },
    duration: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onCardTap() {
      wx.navigateTo({
        url: '/pages/game-detail/game-detail'
      });
    }
  }
})
