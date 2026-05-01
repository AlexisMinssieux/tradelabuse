export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot,matic-network,uniswap,litecoin,tron,shiba-inu,sui,cosmos,near,filecoin,aptos';
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    const data = await r.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
