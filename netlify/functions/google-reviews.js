const fetch = require("node-fetch");

exports.handler = async () => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return json(500, { ok: false, error: "Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID" });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return json(res.status, { ok: false, error: `Google Places error (${res.status})` });
    }
    const data = await res.json();
    if (data.status && data.status !== "OK") {
      return json(502, { ok: false, error: `Google Places: ${data.status}` });
    }
    const reviews = Array.isArray(data.result?.reviews) ? data.result.reviews : [];
    const filtered = reviews
      .filter((r) => Number(r.rating) >= 5 && r.text)
      .slice(0, 5)
      .map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
        profile: r.profile_photo_url,
      }));

    return json(200, {
      ok: true,
      name: data.result?.name,
      rating: data.result?.rating,
      total: data.result?.user_ratings_total,
      reviews: filtered,
    });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}
