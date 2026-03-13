// Vercel Serverless Function — Google Flights via SerpAPI
// 部署到 Vercel 後，此函式會作為 /api/flights 路由

export default async function handler(req, res) {
  // Allow cross-origin requests from your frontend
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

  const { from, to, dep, ret, adults = '1', currency = 'TWD' } = req.query;

  if (!from || !to || !dep) {
    return res.status(400).json({ error: 'Missing required parameters: from, to, dep' });
  }

  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: from,
    arrival_id: to,
    outbound_date: dep,
    adults,
    currency,
    hl: 'zh-tw',
    gl: 'tw',
    api_key: apiKey,
  });

  // Round trip vs one-way
  if (ret) {
    params.set('return_date', ret);
    params.set('type', '1'); // 1 = round trip
  } else {
    params.set('type', '2'); // 2 = one way
  }

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
