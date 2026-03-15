Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    // 图标名称（如 home、user）
    name: {
      type: String,
      required: true
    },
    // 图标颜色
    color: {
      type: String,
      value: "#333"
    },
    // 图标大小
    size: {
      type: Number,
      value: 16
    }
  }
})
