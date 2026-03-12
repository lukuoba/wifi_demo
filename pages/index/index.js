const { getWifiInfo } = require('../../servers/wifiApi');

Page({
  data: {
    wifiInfo: {},
    loading: false,
    connectFailed: false
  },

  onLoad(options) {
    // onLoad 中仅获取参数并请求信息，不直接自动连接
    // 若需要自动连接，可保留原逻辑；若要改为点击后连接，则需注释掉 startWifi 调用
    const wifiId = options.wifiId;
    const {isAndroid} = this.judgePlatform();
    if (wifiId) {
      if(isAndroid){
        this.requestLocationPermission(wifiId);
      }else{
        this.fetchWifiInfo(wifiId);
      }
      
    } else {
      wx.showToast({
        title: '请传入 wifiId',
        icon: 'none',
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
          title: '密码已复制',
          icon: 'success'
        });
      }
    });
  },

  // 请求位置权限
  requestLocationPermission(wifiId) {
    console.log('请求位置权限')
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.fetchWifiInfo(wifiId); // 授权成功后请求 Wi-Fi 信息
            },
            fail: () => {
              wx.showModal({
                title: '位置权限',
                content: '请授权位置信息以连接 Wi-Fi',
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
        console.log('获取到的信息', res)
        if (res.data && res.data.SSID && res.data.password) {
          this.setData({ wifiInfo: res.data });
          // 获取成功后不直接 startWifi，等待用户点击“立即连接”
          this.startWifi(res.data.SSID, res.data.password);
          return;
        }

        wx.showToast({
          title: 'Wi-Fi 信息获取失败',
          icon: 'none',
        });
        this.setData({ loading: false });
      })
      .catch((err) => {
        wx.showToast({
          title: '请求失败',
          icon: 'none',
        });
        this.setData({ loading: false });
        console.error(err);
      });
  },
// 判断手机系统
judgePlatform() {
  const platform = (wx.getDeviceInfo() || wx.getSystemInfoSync()).platform
  const system = wx.getSystemInfoSync().system || ''
  console.log('当前系统', platform,system)
  const isAndroid = platform === 'android'
  const isDevtools = platform === 'devtools'
  return { isAndroid, isDevtools }
},
  // 启动 Wi-Fi 模块并连接 Wi-Fi
  startWifi(SSID, password) {
    // 如果是开发者工具，直接提示并停止 loading
    const { isDevtools } = this.judgePlatform();
    if (isDevtools) {
      wx.showToast({
        title: '开发者工具不支持 Wi-Fi 连接',
        icon: 'none'
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
            title: '启动 Wi-Fi 模块失败',
            icon: 'none',
          });
          this.setData({ loading: false, connectFailed: true }); // 启动失败也视为连接失败，显示复制密码
          console.error(err);
        },
      });
    } catch (error) {
      console.error('startWifi error', error);
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
          wx.showToast({
            title: ' Wi-Fi连接成功',
          });
          this.setData({ loading: false, connectFailed: false });
        },
        fail: (err) => {
          wx.showToast({
            title: '连接失败',
            icon: 'none',
          });
          console.error(err);
          // 连接失败，显示复制密码按钮
          this.setData({ loading: false, connectFailed: true });
        }
      });
    } catch (error) {
      console.error('connectWifi error', error);
      this.setData({ loading: false, connectFailed: true });
    }
  }
})
