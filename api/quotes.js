const AV_KEY = 'VMUI7Z1E2674ZJUE';

async function avQuote(symbol) {
  const r = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`
  );
  const d = await r.json();
  const q = d['Global Quote'];
  if (!q || !q['05. price']) return null;
  return {
    symbol,
    price: parseFloat(q['05. price']),
    changesPercentage: parseFloat(q['10. change percent']?.replace('%','') || 0),
    volume: parseInt(q['06. volume'] || 0)
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols = '' } = req.query;
  const symList = symbols.split(',').filter(Boolean);

  try {
    const results = await Promise.all(symList.map(s => avQuote(s)));
    res.json(results.filter(Boolean));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
