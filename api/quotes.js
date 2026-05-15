const SYMBOL_MAP = {
  '^FCHI': '^fchi', '^GSPC': '^spx', '^IXIC': '^ndq', '^GDAXI': '^dax',
  '^FTSE': '^ftse', '^N225': '^nk225', '^HSI': '^hsi',
  'SAF.PA': 'saf.fr', 'SU.PA': 'su.fr', 'AIR.PA': 'air.fr', 'RMS.PA': 'rms.fr',
  'TTE.PA': 'tte.fr', 'BNP.PA': 'bnp.fr', 'MC.PA': 'mc.fr', 'SAN.PA': 'san.fr',
  'AAPL': 'aapl.us', 'MSFT': 'msft.us', 'NVDA': 'nvda.us', 'AMZN': 'amzn.us',
  'GOOGL': 'googl.us', 'TSLA': 'tsla.us', 'META': 'meta.us', 'JPM': 'jpm.us',
  'GC=F': 'gc.f', 'CL=F': 'cl.f', 'SI=F': 'si.f', 'NG=F': 'ng.f',
  'HG=F': 'hg.f', 'ZW=F': 'zw.f',
};

function toStooq(sym) {
  if (SYMBOL_MAP[sym]) return SYMBOL_MAP[sym];
  if (sym.endsWith('.PA')) return sym.replace('.PA', '.fr').toLowerCase();
  if (sym.endsWith('=X')) return sym.replace('=X', '').toLowerCase();
  if (sym.endsWith('=F')) return sym.replace('=F', '.f').toLowerCase();
  if (sym.startsWith('^')) return sym.toLowerCase();
  return sym.toLowerCase() + '.us';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const yahooSyms = (req.query.symbols || '').split(',').filter(Boolean);
  if (!yahooSyms.length) return res.json([]);

  try {
    const stooqSyms = yahooSyms.map(s => encodeURIComponent(toStooq(s))).join(',');
    const r = await fetch(
      `https://stooq.com/q/l/?s=${stooqSyms}&f=sd2t2ohlcv&h&e=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.json();
    const quotes = data?.symbols || [];

    const results = yahooSyms.map((yahooSym, i) => {
      const q = quotes[i];
      if (!q || !q.close || q.close === 'N/D') return null;
      const chg = q.open ? ((q.close - q.open) / q.open) * 100 : 0;
      return {
        symbol: yahooSym,
        price: q.close,
        changesPercentage: +chg.toFixed(2),
        volume: q.volume || 0,
        high: q.high,
        low: q.low
      };
    }).filter(Boolean);

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
