/**
 * Endpoint ini dipanggil oleh scheduler EKSTERNAL (cron-job.org atau GitHub
 * Actions) tiap 5 menit — bukan oleh Vercel Cron, karena Vercel Cron di
 * plan Hobby cuma bisa jalan 1x/hari.
 *
 * Dilindungi header: Authorization: Bearer <CRON_SECRET>
 * Tanpa header yang benar, request ditolak (401) supaya orang lain
 * tidak bisa memicu scan atau membanjiri kuota fungsi kamu.
 */

const { getDomains, updateDomain, addLog } = require('../../lib/store');
const { checkNawala } = require('../../lib/services/nawalaChecker');
const { checkDomainStatus } = require('../../lib/services/domainMonitor');
const { checkSsl } = require('../../lib/services/sslChecker');
const { checkExpiry } = require('../../lib/services/rdapChecker');
const {
  sendTelegramAlert,
  formatNawalaAlert,
  formatDomainDownAlert,
  formatSslWarningAlert,
  formatExpiryReminder,
  formatDomainSafeAlert // Tambahkan format ini dari telegramBot.js
} = require('../../lib/telegramBot');

async function scanOneDomain(domainRecord) {
  const { domain } = domainRecord;
  const prevNawala = domainRecord.nawalaStatus;
  const prevDomainStatus = domainRecord.domainStatus;

  const [nawalaResult, domainResult, sslResult, expiryResult] = await Promise.all([
    checkNawala(domain).catch((e) => ({ status: 'error', detail: e.message })),
    checkDomainStatus(domain).catch((e) => ({ status: 'error', detail: e.message })),
    checkSsl(domain).catch((e) => ({ status: 'error', detail: e.message })),
    checkExpiry(domain).catch((e) => ({ status: 'error', detail: e.message }))
  ]);

  // Cek apakah ada masalah pada domain
  const isTerblokir = nawalaResult.status === 'terblokir';
  const isDown = domainResult.status === 'down';
  const isSslWarning = sslResult.status === 'warning';
  const isExpiryReminder = expiryResult.status === 'ok' && expiryResult.needsReminder;

  // 1. Notifikasi jika terblokir Nawala
  if (isTerblokir) {
    await sendTelegramAlert(formatNawalaAlert(domainRecord));
    await addLog(domainRecord.id, 'nawala', nawalaResult.detail);
  }

  // 2. Notifikasi jika domain Down
  if (isDown) {
    await sendTelegramAlert(formatDomainDownAlert(domainRecord, domainResult.detail));
    await addLog(domainRecord.id, 'domain_down', domainResult.detail);
  }

  // 3. Notifikasi jika ada SSL Warning
  if (isSslWarning) {
    await sendTelegramAlert(formatSslWarningAlert(domainRecord, sslResult.daysLeft));
    await addLog(domainRecord.id, 'ssl_warning', `Sisa ${sslResult.daysLeft} hari`);
  }

  // 4. Notifikasi jika mendekati tanggal Expiry
  if (isExpiryReminder) {
    await sendTelegramAlert(formatExpiryReminder(domainRecord, expiryResult.daysLeft, expiryResult.expiryDate));
    await addLog(domainRecord.id, 'expiry_reminder', `Sisa ${expiryResult.daysLeft} hari`);
  }

  // 🟢 5. Notifikasi jika DOMAIN AMAN (Tidak terblokir & tidak down)
  if (!isTerblokir && !isDown) {
    // Jika fungsi formatDomainSafeAlert sudah dibuat di telegramBot.js
    if (typeof formatDomainSafeAlert === 'function') {
      await sendTelegramAlert(formatDomainSafeAlert(domainRecord));
    } else {
      // Fallback pesan jika fungsi format belum ada di telegramBot.js
      await sendTelegramAlert(`🟢 <b>Domain Aman</b>\nDomain <b>${domainRecord.domain}</b> dalam kondisi normal & bisa diakses.`);
    }
  }

  await updateDomain(domainRecord.id, {
    nawalaStatus: nawalaResult.status,
    domainStatus: domainResult.status,
    sslStatus: sslResult.status,
    expiryDate: expiryResult.expiryDate || domainRecord.expiryDate,
    lastCheckedAt: new Date().toISOString()
  });
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const domains = await getDomains();
  const results = [];

  for (const domainRecord of domains) {
    try {
      await scanOneDomain(domainRecord);
      results.push({ domain: domainRecord.domain, ok: true });
    } catch (err) {
      console.error(`[scan] Gagal scan ${domainRecord.domain}:`, err.message);
      results.push({ domain: domainRecord.domain, ok: false, error: err.message });
    }
  }

  return res.status(200).json({
    scannedAt: new Date().toISOString(),
    totalDomains: domains.length,
    results
  });
};
