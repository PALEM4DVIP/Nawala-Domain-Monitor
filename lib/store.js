/**
 * Storage layer pengganti file JSON (lowdb) yang TIDAK bisa dipakai di Vercel
 * karena filesystem serverless bersifat sementara (hilang tiap fungsi selesai).
 *
 * Pakai Upstash Redis — gratis, dan bisa disambungkan langsung dari
 * Vercel Dashboard > Storage > Marketplace Database Providers > Upstash.
 * Setelah disambungkan, env var UPSTASH_REDIS_REST_URL dan
 * UPSTASH_REDIS_REST_TOKEN otomatis terisi.
 *
 * Semua domain disimpan sebagai satu JSON array di key "nawala:domains".
 * Untuk skala puluhan-ratusan domain ini cukup ringan dan sederhana.
 */

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const DOMAINS_KEY = 'nawala:domains';
const LOGS_KEY = 'nawala:logs';
const MAX_LOGS = 500; // cegah log tumbuh tanpa batas

async function getDomains() {
  const data = await redis.get(DOMAINS_KEY);
  return data || [];
}

async function saveDomains(domains) {
  await redis.set(DOMAINS_KEY, domains);
}

async function addDomain(domain) {
  const domains = await getDomains();
  domains.unshift(domain);
  await saveDomains(domains);
  return domain;
}

async function updateDomain(id, patch) {
  const domains = await getDomains();
  const idx = domains.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  domains[idx] = { ...domains[idx], ...patch };
  await saveDomains(domains);
  return domains[idx];
}

async function deleteDomain(id) {
  const domains = await getDomains();
  const filtered = domains.filter((d) => d.id !== id);
  await saveDomains(filtered);
  return filtered.length !== domains.length;
}

async function addLog(domainId, type, message) {
  const logs = (await redis.get(LOGS_KEY)) || [];
  logs.unshift({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    domainId,
    type,
    message,
    createdAt: new Date().toISOString()
  });
  await redis.set(LOGS_KEY, logs.slice(0, MAX_LOGS));
}

async function getLogs(domainId) {
  const logs = (await redis.get(LOGS_KEY)) || [];
  return domainId ? logs.filter((l) => l.domainId === domainId) : logs;
}

module.exports = {
  getDomains,
  saveDomains,
  addDomain,
  updateDomain,
  deleteDomain,
  addLog,
  getLogs
};
