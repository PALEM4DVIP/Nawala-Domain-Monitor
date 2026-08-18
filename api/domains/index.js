const { getDomains, addDomain, addLog } = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const domains = await getDomains();
    return res.status(200).json(domains);
  }

  if (req.method === 'POST') {
    const { domain, kategori, owner, brand, registrar, registrarAccount } = req.body || {};

    if (!domain) {
      return res.status(400).json({ error: 'Field "domain" wajib diisi' });
    }

    const newDomain = {
      id: Date.now().toString(),
      domain,
      kategori: kategori || 'Umum',
      owner: owner || '',
      brand: brand || '',
      registrar: registrar || '',
      registrarAccount: registrarAccount || '',
      nawalaStatus: 'unknown',
      domainStatus: 'unknown',
      sslStatus: 'unknown',
      expiryDate: null,
      lastCheckedAt: null,
      createdAt: new Date().toISOString()
    };

    await addDomain(newDomain);
    await addLog(newDomain.id, 'system', 'Domain ditambahkan ke monitoring');

    return res.status(201).json(newDomain);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} tidak didukung` });
};
