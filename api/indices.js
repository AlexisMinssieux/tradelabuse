const FMP_KEY = 'YxH36l0GjVhE7kBl3I2zEWgUBp3yhSJL';

const INDICES = [
  { sym: '^FCHI',  name: 'CAC 40',     flag: '🇫🇷' },
  { sym: '^GSPC',  name: 'S&P 500',    flag: '🇺🇸' },
  { sym: '^IXIC',  name: 'NASDAQ',     flag: '🇺🇸' },
  { sym: '^GDAXI', name: 'DAX',        flag: '🇩🇪' },
  { sym: '^FTSE',  name: 'FTSE 100',   flag: '🇬🇧' },
  { sym: '^N225',  name: 'Nikkei 225', flag: '🇯🇵' },
  { sym: '^HSI',   name: 'Hang Seng',  flag: '🇭🇰' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const symbols = INDICES.map(i => i.sym).join(',');
    const r = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbols)}?apikey=${FMP_KEY}`
    );
    if (!r.ok) throw new Error('FMP HTTP ' + r.status);
    const quotes = await r.json();

    const results = INDICES.map(idx => {
      const q = quotes.find(x => x.symbol === idx.sym);
      return {
        ...idx,
        symbol: idx.sym,
        price: q?.price || 0,
        changesPercentage: q?.changesPercentage || 0,
        open: true
      };
    });

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
