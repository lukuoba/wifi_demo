module.exports = function() {
  var e = this;
  e.ws = null,
  e.uri = null,
  e.onopen = null,
  e.onmessage = null,
  e.onclose = null,
  e.onerror = null,
  e.binaryType = "arraybuffer",
  e.bufferedAmount = 0,
  e.CONNECTING = 0,
  e.OPEN = 1,
  e.CLOSING = 2,
  e.CLOSED = 3,
  e.readyState = e.CLOSED,
  e.extensions = "",
  e.protocol = "",
  e.send = function(o) {
    e.readyState === e.OPEN ? wx.sendSocketMessage({
      data: o,
      fail: function(o) {
        e.onerror && e.onerror(o)
      }
    }) : e.onerror && e.onerror(new Error("WebSocket is not open: readyState " + e.readyState))
  },
  e.close = function(o, s) {
    if (e.readyState === e.CLOSING || e.readyState === e.CLOSED) return;
    e.readyState = e.CLOSING,
    wx.closeSocket({
      code: o,
      reason: s,
      fail: function(o) {
        e.onerror && e.onerror(o)
      }
    })
  },
  Object.defineProperty(e, "url", {
    get: function() {
      return e.uri
    }
  }),
  e.connect = function(o) {
    e.uri = o,
    e.readyState = e.CONNECTING,
    wx.connectSocket({
      url: o,
      success: function() {
        e.readyState = e.OPEN,
        e.onopen && e.onopen()
      },
      fail: function(o) {
        e.onerror && e.onerror(o),
        e.readyState = e.CLOSED
      }
    }),
    wx.onSocketOpen(function(o) {
      e.readyState = e.OPEN,
      e.onopen && e.onopen(o)
    }),
    wx.onSocketMessage(function(o) {
      e.onmessage && e.onmessage(o)
    }),
    wx.onSocketError(function(o) {
      e.onerror && e.onerror(o)
    }),
    wx.onSocketClose(function(o) {
      e.readyState = e.CLOSED,
      e.onclose && e.onclose(o)
    })
  },
  e.connect(arguments[0])
}
