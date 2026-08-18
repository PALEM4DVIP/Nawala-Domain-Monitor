const axios = require('axios');

async function checkExpiry(domain) {
  try {
    const res = await axios.get(`https://rdap.org/domain/${domain}`, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (res.status !== 200 || !res.data) {
      return { status: 'error', detail: `RDAP merespons status ${res.status}` };
    }

    const events = res.data.events || [];
    const expiryEvent = events.find((e) => e.eventAction === 'expiration' || e.eventAction === 'expiry');

    if (!expiryEvent) {
      return { status: 'error', detail: 'Tanggal expiry tidak ditemukan di data RDAP' };
    }

    const expiryDate = new Date(expiryEvent.eventDate);
    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);

    return {
      status: 'ok',
      expiryDate: expiryDate.toISOString(),
      daysLeft,
      needsReminder: daysLeft <= 10
    };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

module.exports = { checkExpiry };
