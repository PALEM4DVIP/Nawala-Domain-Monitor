const { updateDomain, deleteDomain, getLogs } = require('../../lib/store');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (req.method === 'PUT') {
    const updated = await updateDomain(id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Domain tidak ditemukan' });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const removed = await deleteDomain(id);
    if (!removed) return res.status(404).json({ error: 'Domain tidak ditemukan' });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const logs = await getLogs(id);
    return res.status(200).json(logs);
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} tidak didukung` });
};
