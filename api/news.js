export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feeds = [
    'https://feeds.reuters.com/reuters/businessNews',
    'https://feeds.reuters.com/reuters/technologyNews'
  ];
  const results = [];
  for (const feedUrl of feeds) {
    try {
      const r = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await r.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items.slice(0, 6)) {
        const c = item[1];
        const title = (c.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
        const link = (c.match(/<link>(.*?)<\/link>/) || [])[1] || '';
        const pubDate = (c.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
        const desc = (c.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
        if (title) results.push({
          title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(),
          link: link.trim(), pubDate: pubDate.trim(),
          desc: desc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim().substring(0,200),
          source: feedUrl.includes('technology') ? 'Reuters Tech' : 'Reuters Business'
        });
      }
    } catch(e) {}
  }
  results.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
  res.json(results.slice(0,12));
}
