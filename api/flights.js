// Vercel Serverless Function — Google Flights via RapidAPI Sky Scrapper

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';

async function searchAirport(query) {
  const url = `https://${RAPIDAPI_HOST}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=en-US`;
  const res = await fetch(url, {
    headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': RAPIDAPI_HOST },
  });
  const data = await res.json();
  const results = data?.data || [];
  // Prefer AIRPORT entity over CITY entity to avoid searchFlights returning "failure"
  const airport = results.find(x => x.navigation?.entityType === 'AIRPORT') || results[0];
  if (!airport) throw new Error(`找不到機場: ${query}`);
  return { skyId: airport.skyId, entityId: airport.entityId };
}

function normalizeFlights(data) {
  const itineraries = data?.data?.itineraries || [];
  const normalized = itineraries.slice(0, 8).map(itin => {
    const leg = itin.legs?.[0];
    if (!leg) return null;
    const carrier = leg.carriers?.marketing?.[0] || {};
    return {
      flights: (leg.segments || []).map(seg => ({
        departure_airport: {
          id: seg.origin?.displayCode || seg.origin?.id || '',
          time: (seg.departure || '').replace('T', ' ').slice(0, 16),
        },
        arrival_airport: {
          id: seg.destination?.displayCode || seg.destination?.id || '',
          time: (seg.arrival || '').replace('T', ' ').slice(0, 16),
        },
        airline: seg.marketingCarrier?.name || carrier.name || '',
        airline_logo: carrier.logoUrl || '',
        flight_number: (seg.marketingCarrier?.alternateId || '') + (seg.flightNumber || ''),
      })),
      total_duration: leg.durationInMinutes || 0,
      price: itin.price?.raw || 0,
    };
  }).filter(Boolean);

  return {
    best_flights: normalized.slice(0, 3),
    other_flights: normalized.slice(3),
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

  const { from, to, dep, ret, adults = '1', currency = 'TWD' } = req.query;
  if (!from || !to || !dep) {
    return res.status(400).json({ error: 'Missing required parameters: from, to, dep' });
  }

  try {
    // Step 1: Look up airport entity IDs in parallel (2 API calls)
    const [originAirport, destAirport] = await Promise.all([
      searchAirport(from),
      searchAirport(to),
    ]);

    // Step 2: Search flights (1 API call)
    const params = new URLSearchParams({
      originSkyId: originAirport.skyId,
      originEntityId: originAirport.entityId,
      destinationSkyId: destAirport.skyId,
      destinationEntityId: destAirport.entityId,
      date: dep,
      cabinClass: 'economy',
      adults,
      currency,
      market: 'en-US',
      countryCode: 'TW',
      sortBy: 'best',
    });
    if (ret) params.set('returnDate', ret);

    const flightRes = await fetch(
      `https://${RAPIDAPI_HOST}/api/v1/flights/searchFlights?${params}`,
      { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': RAPIDAPI_HOST } }
    );
    if (!flightRes.ok) {
      const errText = await flightRes.text();
      return res.status(flightRes.status).json({ error: errText });
    }
    const flightData = await flightRes.json();
    res.status(200).json(normalizeFlights(flightData));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
