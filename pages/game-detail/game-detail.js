const userApi = require('../../servers/userApi.js');
const io = require('../../lib/socket.io.js');

const SOCKET_URL = 'https://taoyity.cn'; // TODO: 请替换为您的WebSocket服务器地址

Page({
  data: {
    gameId: null, // 当前对局ID
    gameDetails: null, // 对局详情
    actions: [
      { id: 'invite', name: '邀请', icon: 'duoren' },
      { id: 'detail', name: '明细', icon: 'mark-pen-line' },
      { id: 'exit', name: '退出', icon: 'guanbianniu-copy' },
      { id: 'mute', name: '已关', icon: 'Icon' },
      { id: 'more', name: '更多', icon: 'shanchuanniu' }
    ],
    players: [
      { id: 1, name: '台板', type: '赢', score: 156, avatarColor: '#4cd964', avatarText: '台' },
      { id: 2, name: '钟仁呈的终极克星', type: '赢', score: 13, avatarColor: '#f5f5f5', isOwner: true },
      { id: 3, name: '广西周润发', type: '赢', score: 479, avatarColor: '#f5f5f5' },
      { id: 4, name: '早八贞子爬行', type: '输', score: 760, avatarColor: '#f5f5f5' },
      { id: 5, name: '瓜呱哇', type: '赢', score: 112, avatarColor: '#f5f5f5' }
    ]
  },

  onLoad(options) {
    const gameId = options.gameId;
    if (gameId) {
      this.setData({ gameId });
      this.getGameDetails(gameId);
      this.connectSocket(gameId);
    } else {
      wx.showToast({ title: '缺少对局ID', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onUnload() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('Socket disconnected on page unload.');
    }
  },

  // 获取对局详情
  async getGameDetails(gameId) {
    wx.showLoading({ title: '加载对局详情...', mask: true });
    try {
      const res = await userApi.getGameDetails(gameId);
      this.setData({
        gameDetails: res,
        players: res.players || this.data.players // 假设对局详情中包含玩家列表
      });
      wx.hideLoading();
    } catch (error) {
      console.error('获取对局详情失败', error);
      wx.showToast({ title: '获取对局详情失败', icon: 'none' });
      wx.hideLoading();
    }
  },

  // 连接WebSocket
  connectSocket(gameId) {
    this.socket = io(SOCKET_URL);

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.socket.emit('joinGame', gameId); // 加入特定对局的房间
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // 可选：处理重连逻辑或用户提示
    });

    this.socket.on('gameUpdate', (data) => {
      console.log('Received game update:', data);
      // 更新对局详情
      this.setData({
        gameDetails: data,
        players: data.players || this.data.players
      });
      wx.showToast({ title: '对局信息已更新', icon: 'none' });
    });

    this.socket.on('error', (err) => {
      console.error('Socket error:', err);
      wx.showToast({ title: '实时连接错误', icon: 'none' });
    });
  },

  onActionTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: `点击了${id}`,
      icon: 'none'
    });
  },

  giveScore(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({
      title: `给${name}记分`,
      icon: 'none'
    });
  }
})
