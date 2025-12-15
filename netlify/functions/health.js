exports.handler = async () => {
  // TEMP: use the known-working "health" function to test S&S auth
  const username = process.env.VENDOR_USERNAME; // your S&S account number
  const password = process.env.VENDOR_PASSWORD; // your API key
  const baseUrl = process.env.VENDOR_BASE_URL || "https://api.ssactivewear.com";

  if (!username || !password) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Missing VENDOR_USERNAME or VENDOR_PASSWORD in .env" }),
    };
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const res = await fetch(`${baseUrl}/v2/ping`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { "content-type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
    };
  }
};
