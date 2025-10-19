const PROXY_URL = "https://crypto-proxy-ten.vercel.app/api/proxy?url=";
const API_COINGECKO = "https://api.coingecko.com/api/v3";
const grid = document.getElementById("grid");
const updateBtn = document.getElementById("update");

const RSI_PERIOD = 30;
const UPDATE_INTERVAL_HOURS = 8;

function calculateRSI(prices, period = RSI_PERIOD) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  return Math.round(rs * 10) / 10;
}

async function fetchTopCoins() {
  const url = `${PROXY_URL}${encodeURIComponent(`${API_COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=210&page=1`)}`;
  const res = await fetch(url);
  const data = await res.json();
  const filtered = data.filter(c =>
    !["bitcoin", "ethereum"].includes(c.id) &&
    !c.id.includes("wrapped") &&
    !c.symbol.includes("usd") &&
    !c.name.toLowerCase().includes("usd") &&
    !c.symbol.includes("busd") &&
    !c.symbol.includes("usdt")
  );
  return filtered.slice(0, 200);
}

async function fetchWeeklyPrices(id) {
  try {
    const url = `${PROXY_URL}${encodeURIComponent(`${API_COINGECKO}/coins/${id}/market_chart?vs_currency=usd&days=210&interval=weekly`)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.prices) return [];
    return data.prices.map(p => p[1]);
  } catch {
    return [];
  }
}

function createSquare(symbol, rsi, wasRedToGreen) {
  const div = document.createElement("div");
  div.className = "square";
  div.style.background = rsi > 50 ? "#00b36b" : "#b32020";

  div.innerHTML = `
    <div>${symbol}</div>
    <div class="rsi">${rsi ?? "?"}</div>
    ${wasRedToGreen ? `<div class="cross">✚</div>` : ""}
  `;
  return div;
}

async function updateRSIs() {
  grid.innerHTML = "Chargement des données...";
  const coins = await fetchTopCoins();
  grid.innerHTML = "";
  const oldData = JSON.parse(localStorage.getItem("cryptoRSI") || "{}");
  const newData = {};

  for (const coin of coins) {
    const prices = await fetchWeeklyPrices(coin.id);
    const rsi = calculateRSI(prices);
    const old = oldData[coin.symbol]?.rsi ?? null;
    const oldTime = oldData[coin.symbol]?.time ?? 0;
    const now = Date.now();
    const wasRedToGreen = old !== null && old < 50 && rsi > 50 && (now - oldTime) < UPDATE_INTERVAL_HOURS * 3600 * 1000;

    newData[coin.symbol] = { rsi, time: now };
    grid.appendChild(createSquare(coin.symbol, rsi, wasRedToGreen));
  }

  localStorage.setItem("cryptoRSI", JSON.stringify(newData));
}

updateBtn.onclick = updateRSIs;
updateRSIs();
setInterval(updateRSIs, UPDATE_INTERVAL_HOURS * 3600 * 1000);
