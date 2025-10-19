document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("cryptoGrid");
  const btn = document.getElementById("refreshBtn");
  const progress = document.getElementById("progressText");
  const proxyBase = "https://crypto-proxy-ten.vercel.app/api/proxy?url=";
  const STORAGE_KEY = "cryptoRSIStates";

  // Charger / sauvegarder les anciens RSI
  function loadPrevStates() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }

  function saveStates(states) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Top 210 cryptos depuis CoinGecko
  async function fetchTopCoins() {
    const url =
      proxyBase +
      encodeURIComponent(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=210&page=1"
      );

    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur CoinGecko Top Coins");
    const data = await res.json();

    // Exclure BTC, ETH, stablecoins, wrapped
    return data.filter(
      (c) =>
        !/^(bitcoin|ethereum|tether|usd|dai|busd|usdc|wbtc|steth|wrapped)/i.test(
          c.id
        )
    );
  }

  // Calcul RSI 30 périodes
  function computeRSI(prices, period = 30) {
    if (prices.length < period + 1) return null;
    let gains = 0,
      losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

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

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // Récupération des données RSI pour une crypto
  async function fetchCoinRSI(coinId) {
    const url =
      proxyBase +
      encodeURIComponent(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=210&interval=weekly`
      );

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur API CoinGecko pour " + coinId);
      const data = await res.json();
      const prices = data.prices.map((p) => p[1]);
      return computeRSI(prices, 30);
    } catch (e) {
      console.warn("⚠️ Erreur sur", coinId, e.message);
      return null;
    }
  }

  // Mise à jour du grid
  async function updateRSIs() {
    grid.innerHTML = "<p class='text-gray-400'>Chargement des cryptos...</p>";
    if (progress) progress.innerText = "Calcul 0 / 200";

    const coins = await fetchTopCoins();
    grid.innerHTML = "";

    const prevStates = loadPrevStates();
    const newStates = {};

    let count = 0;
    for (const coin of coins.slice(0, 200)) {
      count++;

      const box = document.createElement("div");
      box.className =
        "cryptoBox transition-all duration-500 text-white text-xs rounded-lg flex flex-col items-center justify-center shadow-md";
      box.style.width = "60px";
      box.style.height = "60px";
      box.style.background = "#444";
      box.innerHTML = `<b>${coin.symbol.toUpperCase()}</b><div>--</div>`;
      grid.appendChild(box);

      // Calcul RSI
      const rsi = await fetchCoinRSI(coin.id);
      await sleep(1000);

      let color = "#666";
      let cross = "";

      if (rsi !== null) {
        const prevRSI = prevStates[coin.id]?.rsi;
        const wasBelow50 = prevRSI !== undefined && prevRSI < 50;
        const isAbove50 = rsi >= 50;

        color = isAbove50 ? "#16a34a" : "#dc2626";
        if (wasBelow50 && isAbove50) cross = "✚";

        newStates[coin.id] = { rsi };
      }

      box.style.background = color;
      box.innerHTML = `<b>${coin.symbol.toUpperCase()}</b><div>${rsi ? rsi.toFixed(0) : "--"} ${cross}</div>`;

      if (progress) progress.innerText = `Calcul ${count} / 200`;
      console.log(`${count}/200 ${coin.symbol}: RSI=${rsi?.toFixed(1) ?? "--"} ${cross}`);
    }

    if (progress) progress.innerText = "✅ Terminé";
    saveStates(newStates);
  }

  if (btn) btn.onclick = updateRSIs;
  updateRSIs();
});
