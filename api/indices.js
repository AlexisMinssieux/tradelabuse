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
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=fr-FR&region=FR`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Origin': 'https://finance.yahoo.com', 'Referer': 'https://finance.yahoo.com' } }
    );
    if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
    const data = await r.json();
    const quotes = data?.quoteResponse?.result || [];
    const results = INDICES.map(idx => {
      const q = quotes.find(x => x.symbol === idx.sym);
      return {
        ...idx,
        symbol: idx.sym,
        price: q?.regularMarketPrice || 0,
        changesPercentage: q?.regularMarketChangePercent || 0,
        open: q?.marketState === 'REGULAR'
      };
    });
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
