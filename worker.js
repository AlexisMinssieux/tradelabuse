const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const INDEX_META = {
  '^FCHI':  { name: 'CAC 40',     flag: '🇫🇷' },
  '^GSPC':  { name: 'S&P 500',    flag: '🇺🇸' },
  '^IXIC':  { name: 'NASDAQ',     flag: '🇺🇸' },
  '^GDAXI': { name: 'DAX',        flag: '🇩🇪' },
  '^FTSE':  { name: 'FTSE 100',   flag: '🇬🇧' },
  '^N225':  { name: 'Nikkei 225', flag: '🇯🇵' },
  '^HSI':   { name: 'Hang Seng',  flag: '🇭🇰' },
};

const STOOQ_MAP = {
  '^FCHI':'^fchi','^GSPC':'^spx','^IXIC':'^ndq','^GDAXI':'^dax',
  '^FTSE':'^ftse','^N225':'^nk225','^HSI':'^hsi',
  'SAF.PA':'saf.fr','SU.PA':'su.fr','AIR.PA':'air.fr','RMS.PA':'rms.fr',
  'TTE.PA':'tte.fr','BNP.PA':'bnp.fr','MC.PA':'mc.fr','SAN.PA':'san.fr',
  'AAPL':'aapl.us','MSFT':'msft.us','NVDA':'nvda.us','AMZN':'amzn.us',
  'GOOGL':'googl.us','TSLA':'tsla.us','META':'meta.us','JPM':'jpm.us',
  'GC=F':'gc.f','CL=F':'cl.f','SI=F':'si.f','NG=F':'ng.f',
};

function toStooq(sym) {
  if (STOOQ_MAP[sym]) return STOOQ_MAP[sym];
  if (sym.endsWith('.PA')) return sym.replace('.PA','.fr').toLowerCase();
  if (sym.startsWith('^')) return sym.toLowerCase();
  return sym.toLowerCase()+'.us';
}

async function stooqOne(sym) {
  try {
    const r = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    return d?.symbols?.[0] || null;
  } catch { return null; }
}

async function fetchSymbols(yahooSymsList) {
  const results = await Promise.all(yahooSymsList.map(async sym => {
    const q = await stooqOne(toStooq(sym));
    if (!q || !q.close || q.close === 'N/D') return null;
    const chg = q.open ? ((+q.close - +q.open) / +q.open) * 100 : 0;
    return { symbol: sym, price: +q.close, changesPercentage: +chg.toFixed(2), volume: +q.volume || 0 };
  }));
  return results.filter(Boolean);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {

      if (path === '/indices') {
        const TD_KEY = '5faedc1fa2eb4ad1859d39fc2baaeb95';
        const TD_SYMS = { 'CAC40': '^FCHI', 'FTSE100': '^FTSE', 'N225': '^N225', 'HSI': '^HSI' };
        const syms = Object.keys(INDEX_META);

        // stooq pour S&P, NASDAQ, DAX
        const stooqQuotes = await fetchSymbols(['^GSPC', '^IXIC', '^GDAXI']);

        // Twelve Data avec cache 5 min pour économiser les crédits
        const cache = caches.default;
        const tdCacheKey = new Request('https://cache.internal/td-indices-v1');
        let tdData = {};
        const cached = await cache.match(tdCacheKey);
        if (cached) {
          tdData = await cached.json();
        } else {
          const tdR = await fetch(`https://api.twelvedata.com/quote?symbol=CAC40,FTSE100,N225,HSI&apikey=${TD_KEY}`);
          if (tdR.ok) {
            tdData = await tdR.json();
            if (!tdData.code) { // pas d'erreur
              const cacheResp = new Response(JSON.stringify(tdData), { headers: { 'Cache-Control': 'max-age=300', 'Content-Type': 'application/json' } });
              await cache.put(tdCacheKey, cacheResp);
            }
          }
        }

        const results = syms.map(sym => {
          const stooqQ = stooqQuotes.find(x => x.symbol === sym);
          if (stooqQ) return { sym, symbol: sym, ...INDEX_META[sym], price: stooqQ.price, changesPercentage: stooqQ.changesPercentage, open: true };
          const tdKey = Object.keys(TD_SYMS).find(k => TD_SYMS[k] === sym);
          const tdQ = tdKey ? tdData[tdKey] : null;
          return { sym, symbol: sym, ...INDEX_META[sym], price: tdQ?.close ? +tdQ.close : 0, changesPercentage: tdQ?.percent_change ? +tdQ.percent_change : 0, open: true };
        });
        return new Response(JSON.stringify(results), { headers: CORS });
      }

      if (path === '/quotes') {
        const syms = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
        const results = await fetchSymbols(syms);
        return new Response(JSON.stringify(results), { headers: CORS });
      }

      if (path === '/forex') {
        const [r1, r2, r3] = await Promise.all([
          fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP,JPY,CHF,AUD,CAD,NOK,SEK'),
          fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=JPY,CHF,CAD'),
          fetch('https://api.frankfurter.dev/v1/latest?from=GBP&to=USD')
        ]);
        const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
        return new Response(JSON.stringify({ eur: d1.rates, usd: d2.rates, gbp: d3.rates, date: d1.date }), { headers: CORS });
      }

      if (path === '/matieres') {
        const quotes = await fetchSymbols(['GC=F','SI=F','CL=F','NG=F']);
        const find = sym => quotes.find(q => q.symbol === sym);
        const toItem = (q, fb) => q ? { price: q.price, change: q.changesPercentage } : fb;
        return new Response(JSON.stringify({
          gold:   toItem(find('GC=F'),  { price: 3284,  change: 0 }),
          silver: toItem(find('SI=F'),  { price: 32.18, change: 0 }),
          oil:    toItem(find('CL=F'),  { price: 58.84, change: 0 }),
          gas:    toItem(find('NG=F'),  { price: 3.24,  change: 0 })
        }), { headers: CORS });
      }

      if (path === '/crypto') {
        const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,sui,chainlink,avalanche-2,polkadot,tron,shiba-inu,toncoin,bitcoin-cash,stellar,monero,okb,uniswap,litecoin';
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`);
        const data = await r.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      if (path === '/feargreed') {
        const r = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await r.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      if (path === '/news') {
        const feeds = [
          { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
          { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC Markets' },
        ];
        const results = [];
        for (const feed of feeds) {
          try {
            const r = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const xml = await r.text();
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            for (const item of items.slice(0, 6)) {
              const c = item[1];
              const title = (c.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
              const link  = (c.match(/<link[^>]*>(.*?)<\/link>/) || [])[1] || '';
              const pubDate = (c.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
              const desc  = (c.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
              if (title) results.push({ title: title.replace(/&amp;/g,'&').trim(), link: link.trim(), pubDate: pubDate.trim(), desc: desc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim().substring(0,200), source: feed.source });
            }
          } catch(e) {}
        }
        results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        return new Response(JSON.stringify(results.slice(0, 12)), { headers: CORS });
      }

      if (path === '/debug-td') {
        const TD_KEY = '5faedc1fa2eb4ad1859d39fc2baaeb95';
        const r = await fetch(`https://api.twelvedata.com/quote?symbol=CAC40,FTSE100,N225,HSI&apikey=${TD_KEY}`);
        const text = await r.text();
        return new Response(text, { headers: CORS });
      }

      return new Response(JSON.stringify({ error: 'Route inconnue' }), { status: 404, headers: CORS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }
};
