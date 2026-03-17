// components/navigation-bar/navigation-bar.js
Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {
    active: {
      type: String,
      value: 'home' // 当前选中的项：home, record, mine
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    navItems: [
      { id: 'home', name: '首页', icon: 'a-shouyeshuxing1shouye-xuanze', path: '/pages/index/index' },
      { id: 'record', name: '记录', icon: 'jilu', path: '/pages/record-game/record-game' },
      { id: 'mine', name: '我的', icon: 'tidanren', path: '/pages/icon/icon' }      // 暂时跳到icon页演示
    ]
  },

  /**
   * 组件的方法列表
   */
  methods: {
    switchNav(e) {
      const { id, path } = e.currentTarget.dataset;
      if (id === this.data.active) return;

      // 如果是 tabBar 页面用 switchTab，否则用 redirectTo 或 navigateTo
      // 这里根据实际情况选择，目前先用 redirectTo 模拟切换
      wx.redirectTo({
        url: path,
        fail: () => {
          // 如果 redirectTo 失败（比如是 tabBar 页面），尝试 switchTab
          wx.switchTab({ url: path });
        }
      });
    }
  }
})
