// components/filter-drawer/filter-drawer.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    startDate: '',
    endDate: '',
    selectedDateBtn: '',
    selectedWinLoss: 'all',
    selectedMode: 'multi',
    dateQuickBtns: [
      { id: 'today', name: '今天' },
      { id: 'yesterday', name: '昨天' },
      { id: 'thisWeek', name: '本周' },
      { id: 'lastWeek', name: '上周' },
      { id: 'thisMonth', name: '本月' },
      { id: 'lastMonth', name: '上月' }
    ],
    winLossTypes: [
      { id: 'win', name: '赢' },
      { id: 'loss', name: '输' },
      { id: 'draw', name: '不赢不输' }
    ],
    gameModes: [
      { id: 'multi', name: '多人计分' },
      { id: 'single', name: '单人计分' },
      { id: 'pool', name: '分数池' }
    ]
  },

  methods: {
    close() {
      this.triggerEvent('close');
    },

    onStartDateChange(e) {
      this.setData({
        startDate: e.detail.value,
        selectedDateBtn: ''
      });
    },

    onEndDateChange(e) {
      this.setData({
        endDate: e.detail.value,
        selectedDateBtn: ''
      });
    },

    onDateQuickBtnTap(e) {
      const id = e.currentTarget.dataset.id;
      const now = new Date();
      let start = '';
      let end = this.formatDate(now);

      switch (id) {
        case 'today':
          start = end;
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          start = this.formatDate(yesterday);
          end = start;
          break;
        case 'thisWeek':
          const day = now.getDay() || 7;
          const monday = new Date(now);
          monday.setDate(now.getDate() - day + 1);
          start = this.formatDate(monday);
          break;
        case 'lastWeek':
          const lastMonday = new Date(now);
          const lastSunday = new Date(now);
          const currentDay = now.getDay() || 7;
          lastMonday.setDate(now.getDate() - currentDay - 6);
          lastSunday.setDate(now.getDate() - currentDay);
          start = this.formatDate(lastMonday);
          end = this.formatDate(lastSunday);
          break;
        case 'thisMonth':
          start = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
          break;
        case 'lastMonth':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          start = this.formatDate(lastMonth);
          end = this.formatDate(lastMonthEnd);
          break;
      }

      this.setData({
        startDate: start,
        endDate: end,
        selectedDateBtn: id
      });
    },

    clearDates() {
      this.setData({
        startDate: '',
        endDate: '',
        selectedDateBtn: ''
      });
    },

    onWinLossTap(e) {
      this.setData({
        selectedWinLoss: e.currentTarget.dataset.id
      });
    },

    onModeTap(e) {
      this.setData({
        selectedMode: e.currentTarget.dataset.id
      });
    },

    formatDate(date) {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    reset() {
      this.setData({
        startDate: '',
        endDate: '',
        selectedDateBtn: '',
        selectedWinLoss: 'all',
        selectedMode: 'multi'
      });
    },

    confirm() {
      const filterData = {
        startDate: this.data.startDate,
        endDate: this.data.endDate,
        winLossType: this.data.selectedWinLoss,
        gameMode: this.data.selectedMode
      };
      this.triggerEvent('confirm', filterData);
      this.close();
    }
  }
})
