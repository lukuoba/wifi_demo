// pages/game-detail/game-detail.js
const userApi = require("../../servers/userApi.js");
const io = require("../../lib/socket.io.js");
const { createQRMatrix } = require("../../utils/qrcode.js");

const SOCKET_URL = "https://taoyity.cn";
// 邀请二维码编码的入口链接（配合后台「普通链接二维码打开小程序」配置使用）
const JOIN_URL_BASE = "https://taoyity.cn/g?gameId=";

Page({
  data: {
    gameId: null,
    gameDetails: null,
    gameTitle: "麻将计分神器",
    statusBarHeight: 20,
    navBarHeight: 44,
    tableMode: true, // 台板模式开关
    players: [],

    // 给分弹窗
    showScoreModal: false,
    scoreTarget: null,
    scoreDelta: 0,
    quickScores: [1, 2, 3, 5, 10],

    // 邀请二维码弹窗
    showQrModal: false,
    wxacodeImage: "" // 后端小程序码（base64/URL），为空时用本地 canvas 兜底
  },

  onLoad(options) {
    let gameId = options.gameId;

    // 通过小程序码进入时，参数在 scene 里（格式 "gameId=xxx" 或纯 id）
    if (!gameId && options.scene) {
      gameId = this.parseScene(options.scene);
    }

    this.setData({ gameId });
    this.updateNavBarMetrics();

    if (!gameId) {
      wx.showToast({ title: "缺少对局ID", icon: "none" });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.getGameDetails(gameId);
    this.connectSocket(gameId);

    // 从开局页跳转过来（invite=1）时自动弹出邀请二维码
    if (options.invite === "1") {
      this.setData({ showQrModal: true });
      this.loadWxacode();
    }
  },

  // 解析小程序码 scene 参数
  parseScene(sceneStr) {
    try {
      const scene = decodeURIComponent(sceneStr);
      const match = /gameId=([^&]+)/.exec(scene);
      return match ? match[1] : scene;
    } catch (e) {
      return sceneStr;
    }
  },

  onUnload() {
    if (this.socket) {
      this.socket.disconnect();
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/index/index" }) });
  },

  // 台板模式切换
  onToggleTableMode() {
    this.setData({ tableMode: !this.data.tableMode });
  },

  // 计算导航栏高度
  updateNavBarMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
    const statusBarHeight = windowInfo.statusBarHeight || 20;
    let navBarHeight = 44;
    try {
      const menuButton = wx.getMenuButtonBoundingClientRect();
      if (menuButton && menuButton.height && menuButton.top) {
        navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;
      }
    } catch (error) {
      console.error("获取胶囊位置失败", error);
    }
    this.setData({ statusBarHeight, navBarHeight });
  },

  // 获取对局详情
  async getGameDetails(gameId) {
    wx.showLoading({ title: "加载对局...", mask: true });
    try {
      const res = await userApi.getGameDetails(gameId);
      this.applyGameDetails(res);
      wx.hideLoading();
    } catch (error) {
      console.error("获取对局详情失败", error);
      wx.hideLoading();
      wx.showToast({ title: "获取对局详情失败", icon: "none" });
    }
  },

  // 连接 WebSocket（实时同步）
  connectSocket(gameId) {
    try {
      this.socket = io(SOCKET_URL);
      this.socket.on("connect", () => {
        console.log("Socket connected:", this.socket.id);
        this.socket.emit("joinGame", gameId);
      });

      this.socket.on("gameUpdate", (data) => {
        console.log("Received game update:", data);
        this.applyGameDetails(data);
      });

      this.socket.on("error", (err) => {
        console.error("Socket error:", err);
      });
    } catch (error) {
      console.warn("Socket 初始化失败：离线模式展示", error);
    }
  },

  // 应用对局数据并映射玩家列表
  applyGameDetails(res) {
    if (!res) return;
    this.setData({
      gameDetails: res,
      gameTitle: res.name || res.roomName || "麻将计分神器"
    });

    const rawPlayers = Array.isArray(res.players) ? res.players : [];
    if (!rawPlayers.length) {
      this.setData({ players: [] });
      return;
    }

    const mapped = this.buildPlayers(rawPlayers);
    this.setData({ players: mapped });
  },

  // 将玩家数据映射为页面展示结构，自动识别胜者
  buildPlayers(players) {
    const avatarColors = ["#059669", "#475569", "#b45309", "#be123c", "#4338ca", "#0e7490"];

    // 最大正分作为胜者
    const maxScore = players.reduce((max, p) => {
      const score = Number(p.score) || 0;
      return score > max ? score : max;
    }, 0);

    return players.map((player, index) => {
      const score = Number(player.score) || 0;
      const name = player.name || player.nickname || "玩家";
      const isPositive = score > 0;
      const isWinner = score === maxScore && maxScore > 0;
      return {
        id: player.id !== undefined ? player.id : index,
        name,
        avatar: player.avatar || player.avatarUrl || "",
        avatarText: name.slice(0, 1),
        avatarColor: player.avatarColor || avatarColors[index % avatarColors.length],
        isOwner: !!player.isOwner,
        isWinner,
        score,
        isPositive,
        scoreText: score > 0 ? `+${score}` : `${score}`
      };
    });
  },

  // 顶部快捷操作
  onActionTap(e) {
    const id = e.currentTarget.dataset.id;
    switch (id) {
      case "invite":
        this.onInvite();
        break;
      case "detail":
        this.onDetail();
        break;
      case "rules":
        this.onRules();
        break;
      default:
        wx.showToast({ title: id, icon: "none" });
    }
  },

  // ============ 邀请二维码弹窗 ============

  // 打开邀请弹窗（「邀请」快捷入口）
  onInvite() {
    this.setData({ showQrModal: true });
    this.loadWxacode();
  },

  // 关闭邀请弹窗
  onCloseQrModal() {
    this.setData({ showQrModal: false });
  },

  /**
   * 加载邀请二维码：
   *   优先后端小程序码（微信扫一扫可直接打开小程序进对局）
   *   后端未就绪时回退本地链接二维码（需配置「普通链接二维码打开小程序」）
   */
  async loadWxacode() {
    try {
      const res = await userApi.getWxacode(this.data.gameId);
      const image = this.normalizeWxacode(res);
      if (image) {
        this.setData({ wxacodeImage: image });
        return;
      }
      console.warn("[wxacode] 响应中未识别到图片字段:", res);
      this.renderLocalQr();
    } catch (error) {
      console.warn("[wxacode] 后端小程序码不可用，回退本地二维码:", error.message || error);
      this.renderLocalQr();
    }
  },

  // 归一化后端小程序码响应：支持 { base64 } / { url } / 纯字符串
  normalizeWxacode(res) {
    if (!res) return "";
    let value = "";
    if (typeof res === "string") {
      value = res;
    } else {
      value =
        res.base64 || res.image || res.qrBase64 ||
        res.url || res.imageUrl || res.wxacodeUrl || "";
    }
    if (!value) return "";
    if (value.startsWith("data:image")) return value;          // 已是完整 data URL
    if (/^https?:\/\//i.test(value)) return value;             // 图片 URL
    return `data:image/png;base64,${value}`;                   // 裸 base64
  },

  // 等弹窗渲染完成后再画本地二维码
  renderLocalQr() {
    this.setData({ wxacodeImage: "" });
    setTimeout(() => this.drawLocalQr(), 120);
  },

  // 在 canvas 上绘制本地链接二维码（兜底方案）
  drawLocalQr() {
    wx.createSelectorQuery()
      .in(this)
      .select("#qrCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) return;

        const canvas = item.node;
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
        const cssSize = item.width;
        canvas.width = cssSize * dpr;
        canvas.height = cssSize * dpr;

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);

        try {
          const qr = createQRMatrix(JOIN_URL_BASE + this.data.gameId);
          const quiet = 2; // 四周留白（标准要求 ≥ 4 模块，弹窗里留 2 视觉即可）
          const cell = cssSize / (qr.size + quiet * 2);

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, cssSize, cssSize);
          ctx.fillStyle = "#0f172a";
          for (let r = 0; r < qr.size; r++) {
            for (let c = 0; c < qr.size; c++) {
              if (qr.modules[r][c]) {
                ctx.fillRect(
                  (c + quiet) * cell,
                  (r + quiet) * cell,
                  cell,
                  cell
                );
              }
            }
          }
        } catch (error) {
          console.error("生成邀请二维码失败", error);
          wx.showToast({ title: "二维码生成失败", icon: "none" });
        }
      });
  },

  // 好友转发邀请：分享卡片直达对局详情页
  onShareAppMessage() {
    return {
      title: `「${this.data.gameTitle}」邀请你加入计分`,
      path: `/pages/game-detail/game-detail?gameId=${this.data.gameId}`
    };
  },

  onDetail() {
    // 跳转明细页（待实现）
    wx.showToast({ title: "明细功能开发中", icon: "none" });
  },

  onRules() {
    wx.showModal({
      title: "规则设置",
      content: "支持全国多地计番规则预设自定义，可选择川麻血流成河 / 国标麻将 等规则。",
      confirmText: "知道了",
      confirmColor: "#059669",
      showCancel: false
    });
  },

  // 打开给分弹窗
  giveScore(e) {
    const index = Number(e.currentTarget.dataset.index);
    const player = this.data.players[index];
    if (!player) return;
    this.setData({
      showScoreModal: true,
      scoreTarget: { index, id: player.id, name: player.name, score: player.score },
      scoreDelta: 0
    });
  },

  // 快捷加减
  onQuickScore(e) {
    const value = Number(e.currentTarget.dataset.value) || 0;
    const next = (this.data.scoreDelta || 0) + value;
    this.setData({ scoreDelta: next });
  },

  // 手动输入
  onScoreInput(e) {
    let value = e.detail.value;
    // 允许 - 开头
    if (value === "-" || value === "") {
      this.setData({ scoreDelta: value === "-" ? 0 : 0 });
      return;
    }
    const num = Number(value);
    this.setData({ scoreDelta: Number.isNaN(num) ? 0 : num });
  },

  onCancelScore() {
    this.setData({
      showScoreModal: false,
      scoreTarget: null,
      scoreDelta: 0
    });
  },

  async onConfirmScore() {
    const delta = Number(this.data.scoreDelta) || 0;
    const target = this.data.scoreTarget;
    if (!target || delta === 0) {
      this.setData({ showScoreModal: false });
      return;
    }

    wx.showLoading({ title: "提交中", mask: true });
    try {
      // 乐观更新：先本地更新，成功后提交
      const players = [...this.data.players];
      const player = players[target.index];
      if (player) {
        player.score = player.score + delta;
        this.setData({ players: this.buildPlayers(players) });
      }

      // TODO: 接入后端给分接口
      // await userApi.giveScore({ gameId: this.data.gameId, playerId: player.id, delta });

      // 通过 WebSocket 广播
      if (this.socket) {
        this.socket.emit("giveScore", {
          gameId: this.data.gameId,
          playerId: player.id,
          delta
        });
      }

      wx.hideLoading();
      this.setData({ showScoreModal: false });
      wx.showToast({
        title: `${delta > 0 ? "+" : ""}${delta}`,
        icon: "success"
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: "给分失败", icon: "none" });
    }
  }
});
