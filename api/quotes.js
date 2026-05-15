const TD_KEY = '5faedc1fa2eb4ad1859d39fc2baaeb95';

function toTD(sym) {
  if (sym.endsWith('.PA')) return sym.replace('.PA', ':XPAR');
  if (sym.endsWith('.DE')) return sym.replace('.DE', ':XETR');
  if (sym.startsWith('^')) return sym.replace('^', '');
  return sym;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const yahooSyms = (req.query.symbols || '').split(',').filter(Boolean);
  if (!yahooSyms.length) return res.json([]);

  try {
    const tdSyms = yahooSyms.map(toTD).join(',');
    const r = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSyms)}&apikey=${TD_KEY}`
    );
    if (!r.ok) throw new Error('TwelveData HTTP ' + r.status);
    const data = await r.json();

    // Single symbol returns object directly, multiple returns { SYM: quote }
    const batch = yahooSyms.length === 1
      ? { [toTD(yahooSyms[0])]: data }
      : data;

    const results = yahooSyms.map(yahooSym => {
      const td = toTD(yahooSym);
      const q = batch[td];
      if (!q || q.status === 'error' || !q.close) return null;
      return {
        symbol: yahooSym,
        price: +q.close,
        changesPercentage: +q.percent_change,
        volume: +q.volume || 0
      };
    }).filter(Boolean);

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
