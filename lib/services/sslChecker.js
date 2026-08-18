const tls = require('tls');

const WARNING_DAYS = 14;
const TIMEOUT_MS = 8000;

function getCertificate(domain) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      443,
      domain,
      { servername: domain, timeout: TIMEOUT_MS, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          reject(new Error('Sertifikat tidak ditemukan'));
        } else {
          resolve(cert);
        }
      }
    );
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('error', (err) => reject(err));
  });
}

async function checkSsl(domain) {
  try {
    const cert = await getCertificate(domain);
    const validTo = new Date(cert.valid_to);
    const daysLeft = Math.ceil((validTo.getTime() - Date.now()) / 86400000);

    if (daysLeft <= 0) return { status: 'expired', daysLeft, validTo: validTo.toISOString() };
    if (daysLeft <= WARNING_DAYS) return { status: 'warning', daysLeft, validTo: validTo.toISOString() };
    return { status: 'ok', daysLeft, validTo: validTo.toISOString() };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

module.exports = { checkSsl };
