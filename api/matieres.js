const TD_KEY = '5faedc1fa2eb4ad1859d39fc2baaeb95';

const FALLBACK = {
  gold:   { price: 3284,  change: 0 },
  silver: { price: 32.18, change: 0 },
  oil:    { price: 58.84, change: 0 },
  gas:    { price: 3.24,  change: 0 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch(
      `https://api.twelvedata.com/quote?symbol=XAU/USD,XAG/USD,WTI/USD,NATGAS/USD&apikey=${TD_KEY}`
    );
    if (!r.ok) throw new Error('TwelveData HTTP ' + r.status);
    const data = await r.json();

    const toItem = (q, fb) => (q && q.close && q.status !== 'error')
      ? { price: +q.close, change: +q.percent_change }
      : fb;

    res.json({
      gold:   toItem(data['XAU/USD'],    FALLBACK.gold),
      silver: toItem(data['XAG/USD'],    FALLBACK.silver),
      oil:    toItem(data['WTI/USD'],    FALLBACK.oil),
      gas:    toItem(data['NATGAS/USD'], FALLBACK.gas),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
