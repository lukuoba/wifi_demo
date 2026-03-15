// components/play-game/play-game.js
Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {
    players: [
      { id: 1, name: '瓜呱哇', score: 112, isOwner: false },
      { id: 2, name: '钟仁呈...', score: 13, isOwner: true },
      { id: 3, name: '台板', score: 156, isOwner: false },
      { id: 4, name: '广西周...', score: 479, isOwner: false },
      { id: 5, name: '早八贞...', score: -760, isOwner: false }
    ],
    startTime: '26-02-23 16:18',
    duration: '481小时42分'
  },

  /**
   * 组件的方法列表
   */
  methods: {

  }
})
