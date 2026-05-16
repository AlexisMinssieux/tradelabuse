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
  '^FCHI':'^cac','^GSPC':'^spx','^IXIC':'^ndq','^GDAXI':'^dax',
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

async function yahooV8(symbol) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, changesPercentage: +change.toFixed(2) };
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
        const syms = Object.keys(INDEX_META);
        // Stooq pour tous (^cac fonctionne, ^spx/^ndq/^dax aussi)
        const stooqQuotes = await fetchSymbols(syms);
        // Yahoo v8 en fallback pour ceux que stooq ne retourne pas
        const missing = syms.filter(s => !stooqQuotes.find(q => q.symbol === s));
        const yahooQuotes = await Promise.all(missing.map(async sym => {
          const q = await yahooV8(sym);
          return q ? { symbol: sym, price: q.price, changesPercentage: q.changesPercentage } : null;
        }));
        const allQuotes = [...stooqQuotes, ...yahooQuotes.filter(Boolean)];
        const results = syms.map(sym => {
          const q = allQuotes.find(x => x.symbol === sym);
          return { sym, symbol: sym, ...INDEX_META[sym], price: q?.price || 0, changesPercentage: q?.changesPercentage || 0, open: true };
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

      if (path === '/debug-news') {
        const feeds = [
          'https://www.rfi.fr/fr/rss-economie',
          'https://www.france24.com/fr/rss/economie',
          'https://rss.dw.com/rdf/rss-fr-eco',
          'https://feeds.reuters.com/reuters/frBusinessNews',
        ];
        const out = {};
        for (const url of feeds) {
          try {
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            out[url] = { status: r.status, preview: (await r.text()).substring(0, 200) };
          } catch(e) { out[url] = { error: e.message }; }
        }
        return new Response(JSON.stringify(out, null, 2), { headers: CORS });
      }

      if (path === '/news') {
        const feeds = [
          { url: 'https://www.rfi.fr/fr/rss-economie', source: 'RFI' },
          { url: 'https://www.france24.com/fr/rss/economie', source: 'France 24' },
          { url: 'https://rss.dw.com/rdf/rss-fr-eco', source: 'DW Français' },
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

      if (path === '/debug-sources') {
        const out = {};
        // Yahoo Finance v8 (chart endpoint, different from v7 quote)
        try {
          const r = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EFCHI?interval=1d&range=1d',
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
          out.yahooV8 = { status: r.status };
          if (r.ok) { const d = await r.json(); out.yahooV8.price = d?.chart?.result?.[0]?.meta?.regularMarketPrice; }
          else { out.yahooV8.body = await r.text(); }
        } catch(e) { out.yahooV8 = { error: e.message }; }
        // Stooq ^cac (alternative symbol)
        try {
          const r = await fetch('https://stooq.com/q/l/?s=%5Ecac&f=sd2t2ohlcv&h&e=json',
            { headers: { 'User-Agent': 'Mozilla/5.0' } });
          out.stooqCac = { status: r.status };
          if (r.ok) { const d = await r.json(); out.stooqCac.data = d?.symbols?.[0]; }
        } catch(e) { out.stooqCac = { error: e.message }; }
        // Stooq ^fchi
        try {
          const r = await fetch('https://stooq.com/q/l/?s=%5Efchi&f=sd2t2ohlcv&h&e=json',
            { headers: { 'User-Agent': 'Mozilla/5.0' } });
          out.stooqFchi = { status: r.status };
          if (r.ok) { const d = await r.json(); out.stooqFchi.data = d?.symbols?.[0]; }
        } catch(e) { out.stooqFchi = { error: e.message }; }
        // Alpha Vantage GLOBAL_QUOTE ^FCHI
        try {
          const r = await fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=%5EFCHI&apikey=demo');
          out.alphaVantage = { status: r.status };
          if (r.ok) { out.alphaVantage.data = await r.json(); }
        } catch(e) { out.alphaVantage = { error: e.message }; }
        return new Response(JSON.stringify(out, null, 2), { headers: CORS });
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
