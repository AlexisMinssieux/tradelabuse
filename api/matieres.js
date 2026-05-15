const FMP_KEY = 'YxH36l0GjVhE7kBl3I2zEWgUBp3yhSJL';

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
      `https://financialmodelingprep.com/api/v3/quote/GCUSD,SIUSD,CLUSD,NGUSD?apikey=${FMP_KEY}`
    );
    if (!r.ok) throw new Error('FMP HTTP ' + r.status);
    const data = await r.json();

    const find = sym => data.find(x => x.symbol === sym);
    const toItem = (q, fb) => q ? { price: q.price, change: q.changesPercentage } : fb;

    res.json({
      gold:   toItem(find('GCUSD'),  FALLBACK.gold),
      silver: toItem(find('SIUSD'),  FALLBACK.silver),
      oil:    toItem(find('CLUSD'),  FALLBACK.oil),
      gas:    toItem(find('NGUSD'),  FALLBACK.gas),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
