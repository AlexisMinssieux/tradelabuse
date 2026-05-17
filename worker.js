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
  // More French stocks
  'OR.PA':'or.fr','AI.PA':'ai.fr','GLE.PA':'gle.fr','KER.PA':'ker.fr',
  'DG.PA':'dg.fr','BN.PA':'bn.fr','ORA.PA':'ora.fr','DSY.PA':'dsy.fr',
  'ACA.PA':'aca.fr','VIE.PA':'vie.fr','STM.PA':'stm.fr','ALO.PA':'alo.fr',
  // More US stocks
  'V':'v.us','MA':'ma.us','UNH':'unh.us','WMT':'wmt.us',
  'XOM':'xom.us','BAC':'bac.us','HD':'hd.us','PG':'pg.us',
  'NFLX':'nflx.us','AMD':'amd.us','DIS':'dis.us','CRM':'crm.us',
  // More commodities
  'BZ=F':'bz.f','HG=F':'hg.f','ZW=F':'zw.f','ZC=F':'zc.f',
  // More indices
  '^STOXX50E':'^stoxx50e','^AEX':'^aex','^IBEX':'^ibex',
  '^BSESN':'^bsesn','^KS11':'^ks11','^AXJO':'^axjo','^BVSP':'^bvsp','000001.SS':'000001.cn',
  // More French stocks
  'CS.PA':'cs.fr','ML.PA':'ml.fr','RI.PA':'ri.fr','CA.PA':'ca.fr','EN.PA':'en.fr',
  'LR.PA':'lr.fr','PUB.PA':'pub.fr','RNO.PA':'rno.fr','EDEN.PA':'eden.fr','WLN.PA':'wln.fr',
  // More US stocks
  'KO':'ko.us','PEP':'pep.us','JNJ':'jnj.us','ABBV':'abbv.us','LLY':'lly.us',
  'GS':'gs.us','MS':'ms.us','INTC':'intc.us','ORCL':'orcl.us','BA':'ba.us',
  'CVX':'cvx.us','PFE':'pfe.us','T':'t.us','BRK-B':'brk-b.us','PLTR':'pltr.us',
  // ETFs
  'CW8.PA':'cw8.fr','500.PA':'500.fr','NASD.PA':'nasd.fr','CAC.PA':'cac.fr',
  'C50.PA':'c50.fr','PAEEM.PA':'paeem.fr','IWDA.AS':'iwda.nl','MEUR.PA':'meur.fr',
  'SPY':'spy.us','QQQ':'qqq.us','GLD':'gld.us','VTI':'vti.us','TLT':'tlt.us','VWO':'vwo.us',
  // More commodities
  'PL=F':'pl.f','ALI=F':'ali.f',
};

function toStooq(sym) {
  if (STOOQ_MAP[sym]) return STOOQ_MAP[sym];
  if (sym.endsWith('.PA')) return sym.replace('.PA','.fr').toLowerCase();
  if (sym.startsWith('^')) return sym.toLowerCase();
  return sym.toLowerCase()+'.us';
}

async function yahooV8(symbol) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, changesPercentage: +change.toFixed(2) };
  } catch { return null; }
}

async function stooqOne(sym) {
  try {
    const r = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const q = d?.symbols?.[0];
    if (!q || !q.close || q.close === 'N/D') return null;
    // use open as prev approximation — stooq doesn't give prev_close directly
    const chg = q.open ? ((+q.close - +q.open) / +q.open) * 100 : 0;
    return { price: +q.close, changesPercentage: +chg.toFixed(2), volume: +q.volume || 0 };
  } catch { return null; }
}

// Yahoo as primary, stooq as fallback for stocks/commodities
async function fetchSymbols(yahooSymsList) {
  const results = await Promise.all(yahooSymsList.map(async sym => {
    const yq = await yahooV8(sym);
    if (yq) return { symbol: sym, price: yq.price, changesPercentage: yq.changesPercentage, volume: 0 };
    const sq = await stooqOne(toStooq(sym));
    if (sq) return { symbol: sym, price: sq.price, changesPercentage: sq.changesPercentage, volume: sq.volume };
    return null;
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
        const quotes = await Promise.all(syms.map(async sym => {
          const q = await yahooV8(sym);
          if (q) return { symbol: sym, price: q.price, changesPercentage: q.changesPercentage };
          // fallback stooq
          const sq = await stooqOne(toStooq(sym));
          if (sq) return { symbol: sym, price: sq.price, changesPercentage: sq.changesPercentage };
          return { symbol: sym, price: 0, changesPercentage: 0 };
        }));
        const results = syms.map(sym => {
          const q = quotes.find(x => x.symbol === sym);
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
        const syms = ['GC=F','SI=F','CL=F','NG=F'];
        const quotes = await Promise.all(syms.map(async sym => {
          const q = await yahooV8(sym);
          return q ? { symbol: sym, price: q.price, change: q.changesPercentage } : null;
        }));
        const find = sym => quotes.find(q => q?.symbol === sym);
        const toItem = (q, fb) => q ? { price: q.price, change: q.change } : fb;
        return new Response(JSON.stringify({
          gold:   toItem(find('GC=F'),  { price: 3284,  change: 0 }),
          silver: toItem(find('SI=F'),  { price: 32.18, change: 0 }),
          oil:    toItem(find('CL=F'),  { price: 58.84, change: 0 }),
          gas:    toItem(find('NG=F'),  { price: 3.24,  change: 0 })
        }), { headers: CORS });
      }

      if (path === '/crypto') {
        const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,sui,chainlink,avalanche-2,polkadot,tron,shiba-inu,toncoin,bitcoin-cash,stellar,monero,okb,uniswap,litecoin';
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`, {
          headers: { 'User-Agent': 'TradeLabuse/1.0 (financial dashboard; contact@tradelabuse.fr)', 'Accept': 'application/json' }
        });
        const data = await r.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      if (path === '/analysis') {
        const assets = [
          {sym:'^FCHI',  name:'CAC 40',         flag:'🇫🇷', type:'Indice'},
          {sym:'^GSPC',  name:'S&P 500',         flag:'🇺🇸', type:'Indice'},
          {sym:'^IXIC',  name:'NASDAQ',          flag:'🇺🇸', type:'Indice'},
          {sym:'^GDAXI', name:'DAX',             flag:'🇩🇪', type:'Indice'},
          {sym:'NVDA',   name:'Nvidia',          flag:'🇺🇸', type:'Tech'},
          {sym:'AAPL',   name:'Apple',           flag:'🇺🇸', type:'Tech'},
          {sym:'MC.PA',  name:'LVMH',            flag:'🇫🇷', type:'Luxe'},
          {sym:'TTE.PA', name:'TotalEnergies',   flag:'🇫🇷', type:'Énergie'},
          {sym:'BTC-USD',name:'Bitcoin',         flag:'₿',   type:'Crypto'},
          {sym:'ETH-USD',name:'Ethereum',        flag:'Ξ',   type:'Crypto'},
          {sym:'GC=F',   name:'Or',              flag:'🥇',  type:'Matière 1ère'},
          {sym:'CL=F',   name:'Pétrole WTI',     flag:'🛢️',  type:'Matière 1ère'},
        ];
        const quotes = await Promise.all(assets.map(async a => {
          const q = await yahooV8(a.sym);
          return { ...a, price: q?.price || 0, chg: q?.changesPercentage || 0 };
        }));
        return new Response(JSON.stringify(quotes), { headers: CORS });
      }

      if (path === '/feargreed') {
        const r = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await r.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      if (path === '/news') {
        const feeds = [
          'https://news.google.com/rss/search?q=bourse+cac40+actions+france&hl=fr&gl=FR&ceid=FR:fr',
          'https://news.google.com/rss/search?q=%C3%A9conomie+march%C3%A9s+financiers+inflation&hl=fr&gl=FR&ceid=FR:fr',
        ];
        const seen = new Set();
        const results = [];
        for (const url of feeds) {
          try {
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,text/xml' } });
            if (!r.ok) continue;
            const xml = await r.text();
            const re = /<item>([\s\S]*?)<\/item>/g;
            let m;
            while ((m = re.exec(xml)) !== null) {
              const c = m[1];
              const title = (/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(c)||[])[1]||'';
              const link  = (/<link>([\s\S]*?)<\/link>/.exec(c)||[])[1]||'';
              const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(c)||[])[1]||'';
              const source = (/<source[^>]*>([\s\S]*?)<\/source>/.exec(c)||[])[1]||'Google News';
              const clean = title.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
              if (clean && !seen.has(clean)) {
                seen.add(clean);
                results.push({ title: clean, link: link.trim(), pubDate: pubDate.trim(), desc: '', source: source.trim() });
              }
            }
          } catch(e) {}
        }
        results.sort((a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
        return new Response(JSON.stringify(results.slice(0, 14)), { headers: CORS });
      }

      if (path === '/history') {
        const sym = url.searchParams.get('sym');
        if (!sym) return new Response(JSON.stringify({error:'sym requis'}),{status:400,headers:CORS});
        const r = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=6mo`,
          {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}
        );
        if (!r.ok) return new Response(JSON.stringify({error:'Yahoo '+r.status}),{status:502,headers:CORS});
        const d = await r.json();
        const res = d?.chart?.result?.[0];
        if (!res) return new Response(JSON.stringify({error:'Pas de données'}),{status:404,headers:CORS});
        const raw = res.indicators?.quote?.[0]?.close || [];
        const ts  = res.timestamp || [];
        const pairs = ts.map((t,i)=>({t,c:raw[i]})).filter(x=>x.c!=null&&!isNaN(x.c));
        return new Response(JSON.stringify({
          closes: pairs.map(x=>+x.c.toFixed(6)),
          dates:  pairs.map(x=>new Date(x.t*1000).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})),
          price:  res.meta?.regularMarketPrice,
          currency: res.meta?.currency||''
        }),{headers:CORS});
      }

      if (path === '/debug') {
        const tests = await Promise.all([
          yahooV8('^FCHI').then(r => ({ sym: '^FCHI', ...r })),
          yahooV8('^GSPC').then(r => ({ sym: '^GSPC', ...r })),
          yahooV8('GC=F').then(r => ({ sym: 'GC=F', ...r })),
          stooqOne('^cac').then(r => ({ sym: '^cac (stooq)', ...r })),
        ]);
        return new Response(JSON.stringify(tests, null, 2), { headers: CORS });
      }

      return new Response(JSON.stringify({ error: 'Route inconnue' }), { status: 404, headers: CORS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }
};
