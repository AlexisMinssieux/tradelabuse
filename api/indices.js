const INDICES = [
  { sym: '^FCHI',  stooq: '^fchi',  name: 'CAC 40',     flag: '🇫🇷' },
  { sym: '^GSPC',  stooq: '^spx',   name: 'S&P 500',    flag: '🇺🇸' },
  { sym: '^IXIC',  stooq: '^ndq',   name: 'NASDAQ',     flag: '🇺🇸' },
  { sym: '^GDAXI', stooq: '^dax',   name: 'DAX',        flag: '🇩🇪' },
  { sym: '^FTSE',  stooq: '^ftse',  name: 'FTSE 100',   flag: '🇬🇧' },
  { sym: '^N225',  stooq: '^nk225', name: 'Nikkei 225', flag: '🇯🇵' },
  { sym: '^HSI',   stooq: '^hsi',   name: 'Hang Seng',  flag: '🇭🇰' },
];

async function stooqFetch(sym) {
  try {
    const r = await fetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.json();
    return data?.symbols?.[0] || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const quotes = await Promise.all(INDICES.map(idx => stooqFetch(idx.stooq)));

    const results = INDICES.map((idx, i) => {
      const q = quotes[i];
      const price = (q && q.close && q.close !== 'N/D') ? +q.close : 0;
      const chg = (q && q.open && price) ? ((price - +q.open) / +q.open) * 100 : 0;
      return { ...idx, symbol: idx.sym, price, changesPercentage: +chg.toFixed(2), open: true };
    });

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
