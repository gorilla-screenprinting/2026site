export default async () => {
  const username = Netlify.env.get("VENDOR_USERNAME"); // account number
  const apiKey   = Netlify.env.get("VENDOR_PASSWORD"); // API key

  if (!username || !apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing env vars" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const auth = btoa(`${username}:${apiKey}`);

  const res = await fetch("https://api.ssactivewear.com/v2/ping", {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json"
    }
  });

  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" }
  });
};
