const dns = require('dns').promises;
const https = require('https');
const http = require('http');

const TIMEOUT_MS = 8000;

function httpCheck(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS }, (res) => {
      resolve({ ok: true, statusCode: res.statusCode });
      res.resume();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, reason: 'timeout' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, reason: err.code || 'connection_error' });
    });
  });
}

async function checkDomainStatus(domain) {
  try {
    await dns.resolve4(domain);
  } catch (err) {
    return { status: 'down', reason: 'dns_error', detail: `Domain tidak bisa di-resolve (${err.code})` };
  }

  const httpsResult = await httpCheck(`https://${domain}`);
  if (httpsResult.ok) {
    if (httpsResult.statusCode >= 500) {
      return { status: 'warning', reason: 'http_error', detail: `Server merespons status ${httpsResult.statusCode}` };
    }
    return { status: 'online', reason: null, detail: `HTTP ${httpsResult.statusCode}` };
  }

  const httpResult = await httpCheck(`http://${domain}`);
  if (httpResult.ok) {
    return { status: 'warning', reason: 'https_unavailable', detail: 'HTTPS gagal, HTTP biasa masih merespons' };
  }

  return { status: 'down', reason: httpsResult.reason, detail: `Tidak bisa diakses (${httpsResult.reason})` };
}

module.exports = { checkDomainStatus };
