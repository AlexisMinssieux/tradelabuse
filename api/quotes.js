const FMP_KEY = 'YxH36l0GjVhE7kBl3I2zEWgUBp3yhSJL';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = (req.query.symbols || '').replace(/\^/g, '%5E');
  if (!symbols) return res.json([]);

  try {
    const r = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${FMP_KEY}`
    );
    if (!r.ok) throw new Error('FMP HTTP ' + r.status);
    const data = await r.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
