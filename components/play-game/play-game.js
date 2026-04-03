// components/play-game/play-game.js
Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {
    currentMode: {
      type: Object,
      value: {},
      observer: '_updateGameModeText'
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    gameModeText: '多人记分局', // 默认显示
    gameStatusText: '进行中' // 默认显示
  },

  /**
   * 组件的方法列表
   */
  methods: {
    _updateGameModeText(newVal) {
      console.log('_updateGameModeText', newVal)
      let text = '未知模式';
      switch (newVal.mode) {
        case 'multi':
          text = '多人记分局';
          break;
        case 'single':
          text = '单人记分局';
          break;
        case 'pool':
          text = '分数池桌';
          break;
      }
      let textStatus = '未知状态';
      switch (newVal.status) {
        case 'active':
          textStatus = '进行中';
          break;
        case 'finished':
          textStatus = '已结束';
          break;
      }
      console.log('_updateGameModeText111111', text, textStatus)
      this.setData({ 
        gameModeText: text,
        gameStatusText: textStatus 
      });
    },
    onCardTap() {
      console.log('this.properties.currentMode.id',this.properties.currentMode.id)
      wx.navigateTo({
        url: '/pages/game-detail/game-detail?gameId='+this.properties.currentMode.id
      });
    }
  }
})
