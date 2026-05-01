const AV_KEY = 'VMUI7Z1E2674ZJUE';

async function avQuote(symbol) {
  const r = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`
  );
  const d = await r.json();
  const q = d['Global Quote'];
  if (!q || !q['05. price']) return null;
  return {
    price: parseFloat(q['05. price']),
    changesPercentage: parseFloat(q['10. change percent']?.replace('%','') || 0)
  };
}

const INDICES = [
  { sym: 'SPY',  name: 'S&P 500',    flag: 'ðŸ‡ºðŸ‡¸' },
  { sym: 'QQQ',  name: 'NASDAQ',     flag: 'ðŸ‡ºðŸ‡¸' },
  { sym: 'EWQ',  name: 'CAC 40',     flag: 'ðŸ‡«ðŸ‡·' },
  { sym: 'EWG',  name: 'DAX',        flag: 'ðŸ‡©ðŸ‡ª' },
  { sym: 'EWU',  name: 'FTSE 100',   flag: 'ðŸ‡¬ðŸ‡§' },
  { sym: 'EWJ',  name: 'Nikkei 225', flag: 'ðŸ‡¯ðŸ‡µ' },
  { sym: 'EWH',  name: 'Hang Seng',  flag: 'ðŸ‡­ðŸ‡°' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const results = await Promise.all(INDICES.map(async idx => {
      const data = await avQuote(idx.sym);
      return { ...idx, symbol: idx.sym, price: data?.price || 0, changesPercentage: data?.changesPercentage || 0 };
    }));
    res.json(results);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
