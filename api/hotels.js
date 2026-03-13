// Vercel Serverless Function — Google Hotels via SerpAPI
// 部署到 Vercel 後，此函式會作為 /api/hotels 路由

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SERP_API_KEY environment variable is not set' });
  }

  const { city, checkin, checkout, adults = '2', currency = 'TWD' } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'Missing required parameter: city' });
  }

  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: `hotels in ${city}`,
    hl: 'zh-tw',
    gl: 'tw',
    currency,
    adults,
    api_key: apiKey,
  });

  if (checkin)  params.set('check_in_date', checkin);
  if (checkout) params.set('check_out_date', checkout);

  try {
    const response = await fetch(`https://serpapi.com/search?${params.toString()}`);
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
