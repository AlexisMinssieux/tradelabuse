const COMMODITIES = [
  { key: 'gold',   stooq: 'gc.f'  },
  { key: 'silver', stooq: 'si.f'  },
  { key: 'oil',    stooq: 'cl.f'  },
  { key: 'gas',    stooq: 'ng.f'  },
];

const FALLBACK = { gold: { price: 3284, change: 0 }, silver: { price: 32.18, change: 0 }, oil: { price: 58.84, change: 0 }, gas: { price: 3.24, change: 0 } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const stooqSyms = COMMODITIES.map(c => encodeURIComponent(c.stooq)).join(',');
    const r = await fetch(
      `https://stooq.com/q/l/?s=${stooqSyms}&f=sd2t2ohlcv&h&e=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) throw new Error('stooq HTTP ' + r.status);
    const data = await r.json();
    const quotes = data?.symbols || [];

    const result = {};
    COMMODITIES.forEach((c, i) => {
      const q = quotes[i];
      if (q && q.close && q.close !== 'N/D') {
        const chg = q.open ? ((q.close - q.open) / q.open) * 100 : 0;
        result[c.key] = { price: q.close, change: +chg.toFixed(2) };
      } else {
        result[c.key] = FALLBACK[c.key];
      }
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
