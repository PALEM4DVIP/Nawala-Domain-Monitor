/**
 * Cek indikasi blokir Nawala/TrustPositif via perbandingan resolusi DNS
 * lintas resolver (bersih vs ISP Indonesia). Ini metode heuristik — tidak
 * ada API resmi Kominfo. Lihat README untuk detail keterbatasannya.
 *
 * CATATAN KHUSUS VERCEL: fungsi ini belum diuji langsung di lingkungan
 * Vercel oleh saya (akses jaringan saya di sandbox ini dibatasi). Resolusi
 * DNS custom lewat UDP:53 umumnya diizinkan di Node.js runtime Vercel,
 * tapi WAJIB kamu uji manual setelah deploy sebelum diandalkan produksi.
 */

const dns = require('dns');

const CLEAN_RESOLVER = (process.env.DNS_RESOLVER_CLEAN || '8.8.8.8').trim();
const ISP_RESOLVERS = (process.env.DNS_RESOLVER_ISP || '202.152.0.2')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const KNOWN_SINKHOLE_IPS = new Set([
  '202.152.240.87',
  '36.86.63.185'
]);

function resolveWith(server, domain) {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers([server]);
    resolver.resolve4(domain, (err, addresses) => {
      if (err) {
        resolve({ server, ok: false, code: err.code, addresses: [] });
      } else {
        resolve({ server, ok: true, addresses });
      }
    });
  });
}

async function checkNawala(domain) {
  const cleanResult = await resolveWith(CLEAN_RESOLVER, domain);

  const ispResults = await Promise.all(
    ISP_RESOLVERS.map((server) => resolveWith(server, domain))
  );

  if (!cleanResult.ok) {
    return {
      status: 'unknown',
      detail: `Domain tidak bisa di-resolve lewat resolver bersih (${cleanResult.code || 'error'})`
    };
  }

  let blockedCount = 0;
  const details = [];

  for (const r of ispResults) {
    if (!r.ok) {
      if (r.code === 'ENOTFOUND' || r.code === 'ENODATA') {
        blockedCount++;
        details.push(`${r.server}: NXDOMAIN (indikasi blokir)`);
      } else {
        details.push(`${r.server}: error ${r.code} (tidak konklusif)`);
      }
      continue;
    }

    const hitSinkhole = r.addresses.some((ip) => KNOWN_SINKHOLE_IPS.has(ip));
    if (hitSinkhole) {
      blockedCount++;
      details.push(`${r.server}: mengarah ke IP sinkhole (${r.addresses.join(', ')})`);
    } else {
      details.push(`${r.server}: OK (${r.addresses.join(', ')})`);
    }
  }

  return {
    status: blockedCount > 0 ? 'terblokir' : 'aman',
    detail: details.join(' | ')
  };
}

module.exports = { checkNawala };
