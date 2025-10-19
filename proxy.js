export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: "Missing ?url parameter" });
  }

  try {
    const response = await fetch(target, {
      headers: { "User-Agent": "CryptoRSIProxy/1.0" },
    });

    const text = await response.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}
