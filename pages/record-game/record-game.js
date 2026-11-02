// pages/record-game/record-game.js
const userApi = require("../../servers/userApi");
const app = getApp();

Page({
  data: {
    showFilter: false,
    activeTab: 'all', // all: 全部 / win: 胜局 / loss: 败局
    statusBarHeight: 20,
    navBarHeight: 44,
    summary: {
      total: 0,
      win: 0,
      loss: 0,
      draw: 0,
      totalWin: 0,
      totalLoss: 0,
      netScore: 0,
      winRatio: 0
    },
    gameList: []
  },

  onLoad() {
    this.updateNavBarMetrics();
  },

  onShow() {
    if (app.globalData.isRegistered) {
      this.loadRecords();
    }
  },

  // 计算自定义导航栏高度
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
      console.error('获取胶囊位置失败', error);
    }
    this.setData({ statusBarHeight, navBarHeight });
  },

  // 加载对局列表
  async loadRecords() {
    try {
      const list = await userApi.getGameList();
      const games = Array.isArray(list) ? list : [];

      // 为每条对局补全详情中的玩家数据（列表接口可能不返回 players）
      const gamesWithPlayers = await this.enrichGames(games);

      const mapped = gamesWithPlayers.map((game) => this.mapGame(game));
      this.setData({ gameList: mapped });

      // 根据当前 tab 计算概览（基于用户自身胜率/净得分视角）
      this.computeSummary(mapped);
    } catch (error) {
      console.error('加载对局记录失败', error);
      this.setData({ gameList: [] });
      this.computeSummary([]);
    }
  },

  // 为列表中缺少玩家数据的对局补全详情
  async enrichGames(games) {
    const results = [];
    for (const game of games) {
      if (game.players && game.players.length > 0) {
        results.push(game);
        continue;
      }
      try {
        const detail = await userApi.getGameDetails(game.id);
        results.push({ ...game, ...detail });
      } catch (error) {
        console.warn('补全对局详情失败', game.id, error);
        results.push(game);
      }
    }
    return results;
  },

  // 将原始对局数据映射为页面渲染结构
  mapGame(game) {
    const modeMap = {
      multi: '多人计分桌',
      single: '单人计分桌',
      pool: '分数池桌'
    };
    const avatarColors = ['#059669', '#475569', '#b45309', '#be123c', '#4338ca'];

    const players = (game.players || []).map((player, index) => {
      const score = Number(player.score) || 0;
      const name = player.name || player.nickname || '玩家';
      return {
        id: player.id !== undefined ? player.id : index,
        name,
        avatar: player.avatar || player.avatarUrl || '',
        avatarText: name.slice(0, 1),
        avatarColor: avatarColors[index % avatarColors.length],
        isOwner: !!player.isOwner,
        score,
        scoreText: score > 0 ? `+${score}` : `${score}`,
        scoreClass: score > 0 ? 'is-positive' : score < 0 ? 'is-negative' : 'is-zero',
        isWinner: false
      };
    });

    // 找出正分最高的玩家作为胜者
    const maxScore = players.length ? Math.max(...players.map((p) => p.score)) : 0;
    if (maxScore > 0) {
      players.forEach((p) => {
        if (p.score === maxScore) p.isWinner = true;
      });
    }

    const startTime = game.startTime || game.createTime || '';
    const duration = game.duration || '';
    const metaText =
      game.status === 'finished'
        ? [startTime ? `${startTime} 完局` : '', duration ? `耗时 ${duration}` : '']
            .filter(Boolean)
            .join(' · ')
        : [startTime ? `${startTime} 开始` : '', duration ? `已进行 ${duration}` : '']
            .filter(Boolean)
            .join(' · ') || '暂无对局时间信息';

    return {
      id: game.id,
      modeText: game.name || modeMap[game.mode] || '计分桌',
      status: game.status || 'active',
      players,
      metaText
    };
  },

  // 计算概览统计（基于当前选中 tab 过滤后的列表）
  computeSummary(games) {
    let filtered = games;
    if (this.data.activeTab === 'win') {
      filtered = games.filter((g) => g.status === 'finished' && this.isUserWin(g));
    } else if (this.data.activeTab === 'loss') {
      filtered = games.filter((g) => g.status === 'finished' && this.isUserLoss(g));
    }

    let totalWin = 0;
    let totalLoss = 0;
    let drawCount = 0;
    let winCount = 0;
    let lossCount = 0;

    filtered.forEach((game) => {
      if (game.status !== 'finished') return;
      if (this.isUserWin(game)) {
        winCount += 1;
        totalWin += this.getUserScore(game) > 0 ? this.getUserScore(game) : 0;
      } else if (this.isUserLoss(game)) {
        lossCount += 1;
        const s = this.getUserScore(game);
        totalLoss += s < 0 ? s : 0;
      } else {
        drawCount += 1;
      }
    });

    const totalFinished = winCount + lossCount + drawCount;
    const winRatio =
      totalFinished > 0 ? Math.round((winCount / totalFinished) * 100) : 0;
    const netScore = totalWin + totalLoss;

    this.setData({
      summary: {
        total: filtered.length,
        win: winCount,
        loss: lossCount,
        draw: drawCount,
        totalWin: totalWin,
        totalLoss: totalLoss,
        netScore,
        winRatio
      }
    });
  },

  // 获取当前用户在某对局中的得分（找不到则取最小分玩家）
  getUserScore(game) {
    const userOpenId = wx.getStorageSync('openid');
    const allPlayers = game.players || [];
    const user = allPlayers.find((p) => p.openid === userOpenId || p.userId === userOpenId);
    if (user) return user.score;
    // 没有匹配到自己时，取房主得分（兜底）
    const owner = allPlayers.find((p) => p.isOwner);
    return owner ? owner.score : 0;
  },

  isUserWin(game) {
    const score = this.getUserScore(game);
    return score > 0;
  },

  isUserLoss(game) {
    const score = this.getUserScore(game);
    return score < 0;
  },

  // 分段 tab 切换
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });

    // 重新应用 tab 过滤（列表保留全部，只重新计算概览）
    this.computeSummary(this.data.gameList);
  },

  // 筛选相关
  onFilterTap() {
    this.setData({ showFilter: true });
  },

  onFilterClose() {
    this.setData({ showFilter: false });
  },

  onFilterConfirm(e) {
    const filterData = e.detail || {};
    console.log('筛选条件：', filterData);
    // TODO: 接入后端筛选参数后在此重新拉取
    this.setData({ showFilter: false });
    wx.showToast({
      title: '已应用筛选',
      icon: 'success'
    });
  },

  // 管理按钮
  onManageTap() {
    wx.showActionSheet({
      itemList: ['清空已结束对局', '导出战绩'],
      success: (res) => {
        wx.showToast({ title: '功能开发中', icon: 'none' });
      }
    });
  },

  // 卡片上的操作按钮（避免冒泡触发卡片跳转）
  onCardActions() {
    // 阻止事件冒泡
  },

  // 进入对局详情
  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: '/pages/game-detail/game-detail?gameId=' + id
    });
  },

  // 跳转到战绩榜
  goToRank() {
    wx.navigateTo({
      url: '/pages/rank-list/rank-list'
    });
  }
});
