const API_BASE = "https://crypto-proxy-ten.vercel.app/api/proxy?url=";
const container = document.getElementById("cryptoGrid");
const title = document.createElement("h1");
title.textContent = "RSI Weekly (30 périodes) – Top 200 cryptos";
title.className = "text-center text-3xl font-bold mb-6 text-white";
document.body.prepend(title);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchTopCoins() {
  const url = API_BASE + encodeURIComponent(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=210&page=1"
  );
  const r = await fetch(url);
  const data = await r.json();

  if (!Array.isArray(data)) throw new Error("Invalid data from CoinGecko");

  return data
    .filter(
      (c) =>
        !c.id.includes("wrapped") &&
        !c.id.includes("usd") &&
        !["bitcoin", "ethereum"].includes(c.id)
    )
    .slice(0, 200);
}

async function tryCoinGeckoHistory(id) {
  try {
    const url = API_BASE + encodeURIComponent(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1000&interval=weekly`
    );
    const r = await fetch(url);
    if (!r.ok) throw new Error("CG fail");
    const d = await r.json();
    return d.prices.map((p) => p[1]);
  } catch (e) {
    return null;
  }
}

async function tryBinance(symbol) {
  const pairs = [`${symbol}USDT`, `${symbol}USDC`];
  for (const pair of pairs) {
    try {
      const url = API_BASE + encodeURIComponent(
        `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=1000`
      );
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      if (!Array.isArray(d)) continue;
      return d.map((x) => parseFloat(x[4])); // close price
    } catch (e) {
      continue;
    }
  }
  return null;
}

function computeRSI(prices, period = 30) {
  if (prices.length < period) return null;
  const deltas = [];
  for (let i = 1; i < prices.length; i++) deltas.push(prices[i] - prices[i - 1]);
  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));
  let avgGain =
    gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss =
    losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function saveRSI(id, value) {
  const now = Date.now();
  localStorage.setItem(id, JSON.stringify({ value, time: now }));
}

function getRSIChange(id, newVal) {
  const old = localStorage.getItem(id);
  if (!old) return false;
  const { value, time } = JSON.parse(old);
  const diffH = (Date.now() - time) / 1000 / 3600;
  return value < 50 && newVal > 50 && diffH <= 8;
}

async function updateRSIs() {
  container.innerHTML = "";
  const coins = await fetchTopCoins();

  for (const coin of coins) {
    await sleep(1200); // éviter 429

    const prices =
      (await tryCoinGeckoHistory(coin.id)) ||
      (await tryBinance(coin.symbol.toUpperCase()));

    if (!prices) continue;
    const rsi = computeRSI(prices);
    if (rsi === null) continue;

    const box = document.createElement("div");
    box.className =
      "w-[45px] h-[45px] m-1 flex flex-col justify-center items-center rounded-lg text-[10px] font-semibold text-white shadow-lg";
    box.style.background = rsi >= 50 ? "#16a34a" : "#dc2626";

    const text = document.createElement("div");
    text.textContent = coin.symbol.toUpperCase();
    const val = document.createElement("div");
    val.textContent = Math.round(rsi);

    const changed = getRSIChange(coin.id, rsi);
    saveRSI(coin.id, rsi);

    if (changed) {
      const cross = document.createElement("span");
      cross.textContent = "✚";
      cross.className = "text-white ml-1";
      val.appendChild(cross);
    }

    box.appendChild(text);
    box.appendChild(val);
    container.appendChild(box);
  }
}

document.addEventListener("DOMContentLoaded", updateRSIs);
