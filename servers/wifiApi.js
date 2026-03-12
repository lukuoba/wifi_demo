const { WIFI_BY_ID } = require('./wifiData');

function getWifiInfo(wifiId) {
  return new Promise((resolve, reject) => {
    const id = String(wifiId);

    setTimeout(() => {
      const wifiInfo = WIFI_BY_ID[id];
      if (!wifiInfo) {
        const error = new Error('WIFI_NOT_FOUND');
        error.statusCode = 404;
        reject(error);
        return;
      }

      resolve({
        statusCode: 200,
        data: {
          id,
          ...wifiInfo,
        },
      });
    }, 200);
  });
}

module.exports = { getWifiInfo };
