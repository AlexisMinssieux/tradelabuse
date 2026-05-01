export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pairs = [
    {sym:'BTCUSDT',name:'Bitcoin',id:'bitcoin',rank:1},
    {sym:'ETHUSDT',name:'Ethereum',id:'ethereum',rank:2},
    {sym:'BNBUSDT',name:'BNB',id:'binancecoin',rank:3},
    {sym:'SOLUSDT',name:'Solana',id:'solana',rank:4},
    {sym:'XRPUSDT',name:'XRP',id:'xrp',rank:5},
    {sym:'DOGEUSDT',name:'Dogecoin',id:'dogecoin',rank:6},
    {sym:'ADAUSDT',name:'Cardano',id:'cardano',rank:7},
    {sym:'AVAXUSDT',name:'Avalanche',id:'avalanche',rank:8},
    {sym:'LINKUSDT',name:'Chainlink',id:'chainlink',rank:9},
    {sym:'DOTUSDT',name:'Polkadot',id:'polkadot',rank:10},
    {sym:'MATICUSDT',name:'Polygon',id:'matic',rank:11},
    {sym:'UNIUSDT',name:'Uniswap',id:'uniswap',rank:12},
    {sym:'LTCUSDT',name:'Litecoin',id:'litecoin',rank:13},
    {sym:'TRXUSDT',name:'TRON',id:'tron',rank:14},
    {sym:'SHIBUSDT',name:'Shiba Inu',id:'shiba-inu',rank:15},
    {sym:'SUIUSDT',name:'Sui',id:'sui',rank:16},
    {sym:'ATOMUSDT',name:'Cosmos',id:'cosmos',rank:17},
    {sym:'NEARUSDT',name:'NEAR',id:'near',rank:18},
    {sym:'FILUSDT',name:'Filecoin',id:'filecoin',rank:19},
    {sym:'APTUSDT',name:'Aptos',id:'aptos',rank:20}
  ];

  try {
    const symbols = JSON.stringify(pairs.map(p => p.sym));
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`);
    if (!r.ok) throw new Error('Binance ' + r.status);
    const tickers = await r.json();
    const formatted = pairs.map(p => {
      const t = tickers.find(x => x.symbol === p.sym);
      const price = t ? parseFloat(t.lastPrice) : 0;
      const change = t ? parseFloat(t.priceChangePercent) : 0;
      return { id: p.id, symbol: p.sym.replace('USDT',''), name: p.name, current_price: price, price_change_percentage_24h: change, market_cap: price * parseFloat(t?.volume || 0), market_cap_rank: p.rank };
    });
    res.json(formatted);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
