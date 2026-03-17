const { getWifiInfo } = require("../../servers/wifiApi");

Page({
  data: {
    wifiId:null,
    wifiInfo: {},
    loading: false,
    connectFailed: false,
    versionNum: 0,
    isAndroid: false,
    isDevtools: false,
    currentGame: {
      players: [
        { id: 1, name: '我', score: 850, isOwner: false },
        { id: 2, name: 'Dragunov', score: -240, isOwner: false },
        { id: 3, name: 'Sarah', score: -610, isOwner: false }
      ],
      startTime: '26-03-16 12:00',
      duration: '2小时15分'
    },
    selectCard: [{
      id:1,
      name:"单人记分局",
      des:"一人记分整局",
      icon:'tidanren'
    },{
      id:2,
      name:"多人记分局",
      des:"多人同时记分",
      icon:'duoren'
    },{
      id:3,
      name:"分数池局",
      des:"所有玩家将分数加入分池",
      icon:'rongqi'
    },{
      id:4,
      name:"立即连wifi",
      des:"连接当前 wifi",
      icon:'wifi'
    }]
  },

  onLoad(options) {
    // onLoad 中仅获取参数并请求信息，不直接自动连接
    // 若需要自动连接，可保留原逻辑；若要改为点击后连接，则需注释掉 startWifi 调用
    this.setData({
      wifiId: options.wifiId||null,
    });
  },

  selectCard(e){
    const id = e.currentTarget.dataset.name.id
    switch(id){
      case 1:
        this.setData({
          wifiInfo: {
            SSID: "单人记分局",
            password: "12345678",
          },
        });
        break;
      case 2:
        this.setData({
          wifiInfo: {
            SSID: "多人记分局",
            password: "12345678",
          },
        });
        break;
      case 3:
        this.setData({
          wifiInfo: {
            SSID: "分数池局",
            password: "12345678",
          },
        });
        break;
      case 4:
        this.connectWifiInti()
        break;
    }
  },

  // 链接Wi-Fi逻辑
  connectWifiInti(){
     this.judgePlatform();
    if (this.data.wifiId) {
      if (this.data.isAndroid && this.data.versionNum > 10) {
        this.fetchWifiInfo(this.data.wifiId);
        this.setData({ loading: false, connectFailed: true });
      } else if (this.data.isAndroid && this.data.versionNum <= 10) {
        this.requestLocationPermission(this.data.wifiId);
      } else {
        this.fetchWifiInfo(this.data.wifiId);
      }
    } else {
      wx.showToast({
        title: "当前没有可用wifi或您可以通过二维码扫码链接",
        icon: "none",
      });
    }
  },

  // 复制密码
  copyPassword() {
    const password = this.data.wifiInfo.password;
    if (!password) return;

    wx.setClipboardData({
      data: password,
      success: () => {
        wx.showToast({
          title: "密码已复制",
          icon: "success",
        });
      },
    });
    wx.connectWifi({
      SSID: this.data.wifiInfo.SSID,
      password: this.data.wifiInfo.password,
      maunal: true,
    });
  },

  // 请求位置权限
  requestLocationPermission(wifiId) {
    console.log("请求位置权限");
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting["scope.userLocation"]) {
          wx.authorize({
            scope: "scope.userLocation",
            success: () => {
              this.fetchWifiInfo(wifiId); // 授权成功后请求 Wi-Fi 信息
            },
            fail: () => {
              wx.showModal({
                title: "位置权限",
                content: "请授权位置信息以连接 Wi-Fi",
                showCancel: false,
                success: () => {
                  wx.openSetting(); // 引导用户到设置界面授权
                },
              });
            },
          });
        } else {
          this.fetchWifiInfo(wifiId);
        }
      },
    });
  },
  // 根据 wifiId 从后端获取 Wi-Fi 信息
  fetchWifiInfo(wifiId) {
    getWifiInfo(wifiId)
      .then((res) => {
        console.log("获取到的信息", res);
        if (res.data && res.data.SSID && res.data.password) {
          this.setData({ wifiInfo: res.data });
          // 获取成功后不直接 startWifi，等待用户点击“立即连接”
          if (!this.data.isAndroid) {
            this.startWifi(res.data.SSID, res.data.password);
          }
          return;
        }

        wx.showToast({
          title: "Wi-Fi 信息获取失败",
          icon: "none",
        });
        this.setData({ loading: false });
      })
      .catch((err) => {
        wx.showToast({
          title: "请求失败",
          icon: "none",
        });
        this.setData({ loading: false });
        console.error(err);
      });
  },
  // 判断手机系统
  judgePlatform() {
    const platform = wx.getDeviceInfo().platform;
    const systemStr = wx.getDeviceInfo().system || "";
    const versionMatch = systemStr.match(/\d+/);
    if (versionMatch && versionMatch[0]) {
      this.setData({
        versionNum: parseInt(versionMatch[0], 10),
      });
    }
    const isAndroid = platform === "android";
    const isDevtools = platform === "devtools";
    this.setData({
      isAndroid: isAndroid,
      isDevtools: isDevtools,
    });
  },
  // 启动 Wi-Fi 模块并连接 Wi-Fi
  startWifi(SSID, password) {
    // 如果是开发者工具，直接提示并停止 loading
    if (this.data.isDevtools) {
      wx.showToast({
        title: "开发者工具不支持 Wi-Fi 连接",
        icon: "none",
      });
      this.setData({ loading: false });
      return;
    }

    try {
      wx.startWifi({
        success: () => {
          this.connectToWifi(SSID, password); // Wi-Fi 模块启动成功后连接
        },
        fail: (err) => {
          wx.showToast({
            title: "启动 Wi-Fi 模块失败",
            icon: "none",
          });
          this.setData({ loading: false, connectFailed: true }); // 启动失败也视为连接失败，显示复制密码
          console.error(err);
        },
      });
    } catch (error) {
      console.error("startWifi error", error);
      this.setData({ loading: false, connectFailed: true });
    }
  },

  // 连接到 Wi-Fi
  connectToWifi(SSID, password) {
    try {
      wx.connectWifi({
        SSID: SSID,
        password: password,
        success: () => {
          console.log("初次连接请求发送成功判断详情");
          // 关键：连接请求发送成功后，主动校验实际连接状态
          this.checkWifiConnectStatus(SSID);
        },
        fail: (err) => {
          wx.showToast({
            title: "连接失败",
            icon: "none",
          });
          console.error("是否链接失败", err);
          // 连接失败，显示复制密码按钮
          this.setData({ loading: false, connectFailed: true });
          this.copyPassword();
        },
      });
    } catch (error) {
      console.error("connectWifi error", error);
      this.setData({ loading: false, connectFailed: true });
    }
  },
  // 核心：查询WiFi实际连接状态（验证是否真的连上目标WiFi）
  checkWifiConnectStatus(targetSSID) {
    // 延迟查询（避免连接请求还未完成就校验，导致误判）
    setTimeout(() => {
      wx.getConnectedWifi({
        success: (res) => {
          console.log("res检测", res);
          const connectedSSID = res.wifi.SSID;
          // 校验：当前连接的WiFi是否是目标WiFi（忽略大小写）
          if (connectedSSID.toUpperCase() === targetSSID.toUpperCase()) {
            wx.showToast({
              title: "WiFi连接成功",
              icon: "success",
            });
            this.setData({ loading: false, connectFailed: false });
            // 可选：保存连接状态到本地
            wx.setStorageSync("connected_wifi", connectedSSID);
          } else {
            // 假成功：请求成功但未连上目标WiFi
            wx.showToast({
              title: `已连接其他WiFi：${connectedSSID}`,
              icon: "none",
            });
            this.setData({ loading: false, connectFailed: true });
          }
        },
        fail: (err) => {
          // 未连接任何WiFi/查询失败
          console.error("查询WiFi连接状态失败：", err);
          wx.showToast({
            title: "WiFi连接失败（未检测到连接）",
            icon: "none",
          });
          this.setData({ loading: false, connectFailed: true });
        },
      });
    }, 1500); // 延迟1.5秒：适配不同机型的连接响应速度
  },
});
