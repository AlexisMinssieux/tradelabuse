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

async function yahooFetch(symbols) {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=fr-FR&region=FR`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Origin': 'https://finance.yahoo.com', 'Referer': 'https://finance.yahoo.com' } }
  );
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  return r.json();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {

      if (path === '/indices') {
        const syms = Object.keys(INDEX_META).join(',');
        const data = await yahooFetch(syms);
        const quotes = data?.quoteResponse?.result || [];
        const results = Object.keys(INDEX_META).map(sym => {
          const q = quotes.find(x => x.symbol === sym);
          return { sym, symbol: sym, ...INDEX_META[sym], price: q?.regularMarketPrice || 0, changesPercentage: q?.regularMarketChangePercent || 0, open: q?.marketState === 'REGULAR' };
        });
        return new Response(JSON.stringify(results), { headers: CORS });
      }

      if (path === '/quotes') {
        const symbols = url.searchParams.get('symbols') || '';
        const data = await yahooFetch(symbols);
        const quotes = data?.quoteResponse?.result || [];
        const results = quotes.map(q => ({ symbol: q.symbol, price: q.regularMarketPrice || 0, changesPercentage: q.regularMarketChangePercent || 0, volume: q.regularMarketVolume || 0 }));
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
        const data = await yahooFetch('GC=F,CL=F,SI=F,NG=F');
        const quotes = data?.quoteResponse?.result || [];
        const find = sym => quotes.find(q => q.symbol === sym);
        const toItem = (q, fb) => q ? { price: q.regularMarketPrice, change: q.regularMarketChangePercent } : fb;
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

      return new Response(JSON.stringify({ error: 'Route inconnue' }), { status: 404, headers: CORS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }
};
