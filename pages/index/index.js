Page({
  data: {
    loading: true,
    wifiInfo: {
      ssid: '',
      password: ''
    }
  },

  onLoad(options) {
    // 解析扫码参数
    this.setData({
      wifiInfo: {
        ssid: options.ssid || '',
        password: options.password || ''
      }
    });

    // 先申请权限，再尝试连接
    this.applyPermission().then(() => {
      this.checkWifiStatus().then(() => {
        // WiFi已开启，启动并连接
        this.startWifi(this.data.wifiInfo.ssid, this.data.wifiInfo.password);
      }).catch((err) => {
        // WiFi未开启，引导用户手动打开
        this.guideOpenWifi();
      });
    }).catch((err) => {
      this.setData({ loading: false });
      wx.showToast({ title: '权限申请失败', icon: 'none' });
    });
  },

  // 申请位置权限（WiFi接口依赖）
  applyPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (!res.authSetting['scope.userLocation']) {
            wx.authorize({
              scope: 'scope.userLocation',
              success: resolve,
              fail: () => reject('位置权限申请失败')
            });
          } else {
            resolve();
          }
        },
        fail: (err) => reject(err)
      });
    });
  },

  // 检查WiFi是否开启（核心：解决12005错误）
  checkWifiStatus() {
    // 使用新的接口代替已弃用的 wx.getSystemInfo
    // 直接启动 WiFi 模块并根据结果判断状态
    return new Promise((resolve, reject) => {
      wx.startWifi({
        success: () => {
          // 启动成功 = WiFi 已开启
          resolve();
        },
        fail: (err) => {
          if (err.errCode === 12005) {
            reject('wifi_disable');
          } else {
            reject('start_wifi_fail');
          }
        }
      });
    });
  },

  // 引导用户打开WiFi（关键修复）
  guideOpenWifi() {
    this.setData({ loading: false });
    wx.showModal({
      title: 'WiFi未开启',
      content: '需要打开WiFi才能自动连接「' + this.data.wifiInfo.ssid + '」',
      confirmText: '去开启',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转手机WiFi设置页（用户1次点击即可打开）
          wx.openSetting({
            success: (settingRes) => {
              // 用户打开WiFi后，重新尝试连接
              if (settingRes.authSetting['scope.userLocation']) {
                this.startWifi(this.data.wifiInfo.ssid, this.data.wifiInfo.password);
              }
            }
          });
        }
      }
    });
  },

  // 启动WiFi模块（优化版）
  startWifi(SSID, password) {
    wx.startWifi({
      success: () => {
        this.connectToWifi(SSID, password);
      },
      fail: (err) => {
        this.setData({ loading: false });
        console.error('启动WiFi失败：', err);
        // 再次引导打开WiFi
        if (err.errCode === 12005) {
          this.guideOpenWifi();
        } else {
          wx.showToast({ title: '启动WiFi模块失败', icon: 'none' });
        }
      }
    });
  },

  // 连接WiFi（兼容中文SSID）
  connectToWifi(SSID, password) {
    // 中文SSID编码兼容处理
    let validSSID = encodeURIComponent(SSID).toUpperCase();
    try {
      validSSID = decodeURIComponent(validSSID);
    } catch (e) {}

    wx.connectWifi({
      SSID: validSSID,
      password: password,
      success: () => {
        this.setData({ loading: false });
        wx.showToast({ title: 'WiFi连接成功', icon: 'success' });
      },
      fail: (err) => {
        this.setData({ loading: false });
        console.error('连接失败：', err);
        // 降级引导手动连接
        this.fallbackConnect(SSID, password);
      }
    });
  },

  // 降级方案（自动连接失败时）
  fallbackConnect(SSID, password) {
    const systemInfo = wx.getSystemInfoSync();
    // Android：复制WiFi信息，跳转设置
    if (systemInfo.system.includes('Android')) {
      const wifiText = `WIFI:S:${SSID};T:WPA;P:${password};;`;
      wx.setClipboardData({
        data: wifiText,
        success: () => {
          wx.showModal({
            title: '请手动连接',
            content: '已复制WiFi信息，跳转至设置页一键连接',
            confirmText: '前往设置',
            success: (res) => res.confirm && wx.openSetting()
          });
        }
      });
    }
    // iOS：复制密码，跳转设置
    else {
      wx.setClipboardData({
        data: password,
        success: () => {
          wx.showModal({
            title: '请手动连接',
            content: `WiFi名称：${SSID}\n密码：${password}（已复制）`,
            confirmText: '前往设置',
            success: (res) => res.confirm && wx.openSetting()
          });
        }
      });
    }
  }
});