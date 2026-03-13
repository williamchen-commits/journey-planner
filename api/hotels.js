// Vercel Serverless Function — Google Hotels via RapidAPI Sky Scrapper


const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';


function normalizeHotels(data) {
  const hotels = data?.data?.hotels || data?.data?.data?.hotels || [];
  return {
    properties: hotels.slice(0, 8).map(h => ({
      name: h.name || h.hotel_name || '',
      hotel_class: h.stars ? `${h.stars}-star hotel` : (h.hotel_class || ''),
      overall_rating: h.rating ?? h.review_score ?? null,
      reviews: h.reviews_count || h.review_count || null,
      rate_per_night: h.price ? { extracted_lowest: h.price } : null,
      total_rate: h.total_price ? { extracted_lowest: h.total_price } : null,
      link: h.deeplink || h.url || null,
    })),
  };
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }


  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY environment variable is not set' });
  }


  const { city, checkin, checkout, adults = '1', currency = 'TWD' } = req.query;
  if (!city) {
    return res.status(400).json({ error: 'Missing required parameter: city' });
  }


  try {
