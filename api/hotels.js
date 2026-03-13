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
      total_price: h.total_price ? { extracted_lowest: h.total_price } : null,
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
    // Step 1: Search destination to get entityId (1 API call)
    const destRes = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': RAPIDAPI_HOST } }
    );
    const destData = await destRes.json();
    const dest = destData?.data?.[0];
    const destEntityId = dest?.entityId || dest?.gaiaId;
    if (!destEntityId) throw new Error(`找不到目的地: ${city}`);

    // Step 2: Search hotels (1 API call)
    const params = new URLSearchParams({
      entityId: destEntityId,
      adults,
      currency,
      market: 'en-US',
    });
    if (checkin) params.set('checkin', checkin);
    if (checkout) params.set('checkout', checkout);

    const hotelRes = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/hotels/searchHotels?${params}`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': RAPIDAPI_HOST } }
    );
    if (!hotelRes.ok) {
      const errText = await hotelRes.text();
      return res.status(hotelRes.status).json({ error: errText });
    }
    const hotelData = await hotelRes.json();
    res.status(200).json(normalizeHotels(hotelData));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
