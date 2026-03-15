Page({
  data: {
    // 👇 已从你的 CSS 自动提取全部图标名称
    icons: [
      "jilu",
      "shanchuanniu",
      "huiyuanjifen",
      "wodedangxuan",
      "duoren",
      "tidanren",
      "rongqi",
      "zhexiantu",
      "wode",
      "Icon",
      "a-shouyeshuxing1shouye-xuanze",
      "guanbianniu-copy",
      "mark-pen-line",
      "wifi"
    ]
  },

  // 点击复制图标名
  copyIcon(e) {
    const name = e.currentTarget.dataset.name
    wx.setClipboardData({
      data: `<icon name="${name}" size="{{40}}" color="#fff"/>`,
      success() {
        wx.showToast({
          title: '已复制：icon-' + name,
          icon: 'none',
          duration: 1000
        })
      }
    })
  }
})