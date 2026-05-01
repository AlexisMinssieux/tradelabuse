const AV_KEY = 'VMUI7Z1E2674ZJUE';

async function avQuote(symbol) {
  const r = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`
  );
  const d = await r.json();
  const q = d['Global Quote'];
  if (!q || !q['05. price']) return null;
  return { price: parseFloat(q['05. price']), change: parseFloat(q['10. change percent']?.replace('%','') || 0) };
}

async function avForex(from, to) {
  const r = await fetch(
    `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${AV_KEY}`
  );
  const d = await r.json();
  const rate = d['Realtime Currency Exchange Rate'];
  if (!rate) return null;
  return { price: parseFloat(rate['5. Exchange Rate']), change: 0 };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [gold, silver, oil, gas] = await Promise.all([
      avForex('XAU', 'USD'),
      avForex('XAG', 'USD'),
      avQuote('USO'),
      avQuote('UNG')
    ]);
    res.json({
      gold:   gold   || { price: 3284, change: 0 },
      silver: silver || { price: 32.18, change: 0 },
      oil:    oil    || { price: 58.84, change: 0 },
      gas:    gas    || { price: 3.24, change: 0 }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
