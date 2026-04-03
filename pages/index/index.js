const { getWifiInfo } = require("../../servers/wifiApi");
const userApi = require("../../servers/userApi");

const app = getApp(); // 获取小程序实例

Page({
  data: {
    wifiId:null,
    wifiInfo: {},
    loading: false,
    connectFailed: false,
    versionNum: 0,
    isAndroid: false,
    isDevtools: false,
    showTagModal: false, // 控制标签选择弹窗的显示隐藏
    tags: [],            // 存储获取到的所有标签
    selectedTags: null,    // 存储用户已选择的标签
    currentMode: null,     // 存储当前开局模式
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
      id:'single',
      name:"单人记分局",
      des:"一人记分整局",
      icon:'tidanren'
    },{
      id:'multi',
      name:"多人记分局",
      des:"多人同时记分",
      icon:'duoren'
    },{
      id:'pool',
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

  onShow() {
    if (app.globalData.isRegistered) {
      this.getLatestGameRecord();
    } else {
      console.log('用户未登录或未注册，不加载最新对局记录。');
      this.setData({ currentMode: null });
    }
  },

  async getLatestGameRecord() {
    try {
      const gameList = await userApi.getGameList();
      if (gameList && gameList.length > 0) {
        this.setData({ currentMode: gameList[0] });
      } else {
        this.setData({ currentMode: null });
      }
    } catch (error) {
      this.setData({ currentMode: null });
    }
  },

  selectCard(e){
    const id = e.currentTarget.dataset.name.id
    switch(id){
      case 'single':
        this.setData({
          wifiInfo: {
            SSID: "单人记分局",
            password: "12345678",
          },
        });
        break;
      case 'multi':
        this.showTagSelectionModal('multi');
        break;
      case 'pool':
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

  // 显示标签选择弹窗并获取标签
  async showTagSelectionModal(mode) {
    this.setData({ showTagModal: true, selectedTags: null, currentMode: mode }); // 打开弹窗时清空已选标签，并设置当前模式
    wx.showLoading({ title: '加载标签中...' });
    try {
      const tags = await userApi.getTags();
      this.setData({ tags: tags || [] }); // 假设返回的是标签数组
    } catch (error) {
      console.error('获取标签失败', error);
      wx.showToast({ title: '获取标签失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 关闭标签选择弹窗
  onCancelTagSelection() {
    this.setData({ showTagModal: false, selectedTags: null, currentMode: null });
  },

  async onConfirmTagSelection() {
    const selectedTagId = this.data.selectedTags; // 获取当前选中的tagId (可能是null)
    const mode = this.data.currentMode; // 从data中获取当前开局模式

    // 准备发送给接口的数据
    const requestData = { mode };
    if (selectedTagId) {
      requestData.tagId = selectedTagId;
    }

    wx.showLoading({ title: '开局中...' });
    try {
      const result = await userApi.immediateStart(requestData);
      console.log('立即开局成功', result);
      if(result){
        wx.navigateTo({
          url: '/pages/game-detail/game-detail?gameId=' + result.id,
        });
      }
      wx.showToast({ title: '开局成功', icon: 'success' });
      // TODO: 在这里执行跳转到游戏页面的逻辑，并传递 result
    } catch (error) {
      console.error('立即开局失败', error);
      wx.showToast({ title: error.message || '开局失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ showTagModal: false }); // 无论成功失败，都关闭弹窗
    }
  },

  // 导航到对局详情页
  navigateToGameDetail() {
    if (this.data.currentMode && this.data.currentMode.id) {
      wx.navigateTo({
        url: '/pages/game-detail/game-detail?gameId=' + this.data.currentMode.id,
      });
    } else {
      wx.showToast({ title: '没有最新对局记录', icon: 'none' });
    }
  },

  // 关闭标签选择弹窗
  onCancelTagSelection() {
    const tagId = String(e.currentTarget.dataset.id); // Ensure it's a string
    console.log('点击的标签ID', tagId);
    const newSelectedTags = this.data.selectedTags === tagId ? null : tagId;
    console.log('newSelectedTags', newSelectedTags);
    this.setData({
      selectedTags: newSelectedTags,
      tags: [...this.data.tags] // 创建新数组引用，强制刷新tags数组触发视图更新
    });
  },
});
