const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramAlert(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi — alert dilewati');
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('[telegram] Gagal mengirim alert:', err.response?.data || err.message);
  }
}

function formatNawalaAlert(domain) {
  return `🛡 <b>Nawala Alert</b>\nDomain <b>${domain.domain}</b> terdeteksi diblokir TrustPositif.\nKategori: ${domain.kategori}`;
}
function formatDomainDownAlert(domain, detail) {
  return `🔴 <b>Domain Down</b>\nDomain <b>${domain.domain}</b> tidak bisa diakses.\nPenyebab: ${detail}`;
}
function formatSslWarningAlert(domain, daysLeft) {
  return `⚠️ <b>SSL Warning</b>\nSertifikat SSL <b>${domain.domain}</b> kedaluwarsa dalam ${daysLeft} hari.`;
}
function formatExpiryReminder(domain, daysLeft, expiryDate) {
  return (
    `📅 <b>Reminder H-10 — Domain Expiry</b>\n` +
    `Domain: <b>${domain.domain}</b>\n` +
    `Pemilik/Group: ${domain.owner || '-'}\n` +
    `Brand: ${domain.brand || '-'}\n` +
    `Registrar: ${domain.registrar || '-'}\n` +
    `Akun registrar: ${domain.registrarAccount || '-'}\n` +
    `Sisa waktu: ${daysLeft} hari\n` +
    `Jadwal expiry: ${new Date(expiryDate).toLocaleDateString('id-ID')}`
  );
}

module.exports = {
  sendTelegramAlert,
  formatNawalaAlert,
  formatDomainDownAlert,
  formatSslWarningAlert,
  formatExpiryReminder
};
