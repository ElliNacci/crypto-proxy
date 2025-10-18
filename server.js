import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// Route de proxy universelle
app.get("/fetch", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: "Missing url" });
  try {
    const response = await fetch(target);
    const contentType = response.headers.get("content-type");
    res.set("content-type", contentType || "text/plain");
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));
