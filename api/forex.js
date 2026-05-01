export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY,CHF,AUD,CAD,NOK,SEK'),
      fetch('https://api.frankfurter.app/latest?from=USD&to=JPY,CHF,CAD'),
      fetch('https://api.frankfurter.app/latest?from=GBP&to=USD')
    ]);
    const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    res.json({ eur: d1.rates, usd: d2.rates, gbp: d3.rates, date: d1.date });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
