const TD_KEY = '5faedc1fa2eb4ad1859d39fc2baaeb95';

const INDICES = [
  { sym: '^FCHI',  td: 'CAC40:XPAR', name: 'CAC 40',     flag: '🇫🇷' },
  { sym: '^GSPC',  td: 'SPX',        name: 'S&P 500',    flag: '🇺🇸' },
  { sym: '^IXIC',  td: 'IXIC',       name: 'NASDAQ',     flag: '🇺🇸' },
  { sym: '^GDAXI', td: 'DAX',        name: 'DAX',        flag: '🇩🇪' },
  { sym: '^FTSE',  td: 'FTSE100',    name: 'FTSE 100',   flag: '🇬🇧' },
  { sym: '^N225',  td: 'N225',       name: 'Nikkei 225', flag: '🇯🇵' },
  { sym: '^HSI',   td: 'HSI',        name: 'Hang Seng',  flag: '🇭🇰' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const tdSyms = INDICES.map(i => i.td).join(',');
    const r = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSyms)}&apikey=${TD_KEY}`
    );
    if (!r.ok) throw new Error('TwelveData HTTP ' + r.status);
    const data = await r.json();

    const results = INDICES.map(idx => {
      const q = data[idx.td] || data[idx.td.split(':')[0]];
      return {
        ...idx,
        symbol: idx.sym,
        price: q?.close ? +q.close : 0,
        changesPercentage: q?.percent_change ? +q.percent_change : 0,
        open: q?.is_market_open ?? true
      };
    });

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
