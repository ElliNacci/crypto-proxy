const proxyBase = "https://crypto-proxy-ten.vercel.app/api/proxy?url=";
const progressText = document.getElementById("progress-text");
const container = document.getElementById("crypto-container");
const refreshBtn = document.getElementById("refresh");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(proxyBase + encodeURIComponent(url));
    if (res.status === 429) {
      console.warn("⚠️ Trop de requêtes, pause 5s...");
      await sleep(5000);
      continue;
    }
    if (!res.ok) throw new Error(`Erreur API ${res.status}`);
    return res.json();
  }
  throw new Error("Erreur API après plusieurs tentatives");
}

async function fetchTopCoins() {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=210&page=1";
  const res = await fetch(proxyBase + encodeURIComponent(url));
  if (!res.ok) throw new Error("Erreur CoinGecko Top Coins");
  const data = await res.json();
  return data
    .filter(
      (c) =>
        !c.id.includes("tether") &&
        !c.id.includes("usd") &&
        !c.id.includes("wrapped") &&
        !c.id.includes("staked") &&
        !["bitcoin", "ethereum"].includes(c.id)
    )
    .slice(0, 200);
}

function calculateRSI(prices, period = 30) {
  if (prices.length < period + 1) return null;
  let gains = 0,
    losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i][1] - prices[i - 1][1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function createCard(symbol, rsi, color, crossUp) {
  const card = document.createElement("div");
  card.className = `w-[60px] h-[60px] rounded-2xl flex flex-col items-center justify-center text-sm font-semibold shadow-md transition-all duration-300`;
  card.style.background = color;
  const cross = document.createElement("div");
  cross.textContent = crossUp ? "✚" : "";
  cross.className = "text-white text-lg";
  const text = document.createElement("div");
  text.textContent = rsi ? Math.round(rsi) : "--";
  text.className = "text-white text-sm";
  card.appendChild(cross);
  card.appendChild(text);
  return card;
}

async function updateRSIs() {
  container.innerHTML = "";
  progressText.textContent = "Chargement...";
  const coins = await fetchTopCoins();
  let index = 0;

  for (const coin of coins) {
    index++;
    progressText.textContent = `${index}/${coins.length} en cours...`;
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=210&interval=weekly`;
      const data = await fetchWithRetry(url);
      const rsi = calculateRSI(data.prices);
      const crossUp =
        data.prices.length > 2 &&
        data.prices[data.prices.length - 1][1] >
          data.prices[data.prices.length - 2][1];
      const color =
        rsi > 70
          ? "#e74c3c"
          : rsi < 30
          ? "#2ecc71"
          : "rgba(255,255,255,0.15)";
      const card = createCard(coin.symbol.toUpperCase(), rsi, color, crossUp);
      container.appendChild(card);
    } catch (e) {
      console.warn(`⚠️ Erreur sur ${coin.id}`, e.message);
      const card = createCard(coin.symbol.toUpperCase(), null, "gray", false);
      container.appendChild(card);
    }
    await sleep(3000); // 1 appel toutes les 3s pour éviter 429
  }
  progressText.textContent = "✅ Terminé";
}

refreshBtn.onclick = updateRSIs;
