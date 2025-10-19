document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("cryptoGrid");
  const refreshBtn = document.getElementById("refreshBtn");
  const proxyBase = "https://crypto-proxy-ten.vercel.app/api/proxy?url=";

  if (!grid) {
    console.error("⚠️ Élément #cryptoGrid introuvable dans la page HTML");
    return;
  }

  // 💤 Petite pause pour éviter les erreurs 429
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 📊 Récupère le top 210 cryptos sur CoinGecko
  async function fetchTopCoins() {
    const url =
      proxyBase +
      encodeURIComponent(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=210&page=1"
      );

    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur CoinGecko Top Coins");
    const data = await res.json();

    // 🧹 On enlève BTC, ETH, stables, wrapped
    return data.filter(
      (c) =>
        !/^(bitcoin|ethereum|tether|usd|dai|busd|usdc|wbtc|steth|wrapped)/i.test(
          c.id
        )
    );
  }

  // 📈 Récupère les données historiques et calcule le RSI
  async function fetchRSI(coinId) {
    const url =
      proxyBase +
      encodeURIComponent(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=210&interval=weekly`
      );

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur ou limite atteinte");
      const data = await res.json();

      const prices = data.prices.map((p) => p[1]);
      return computeRSI(prices, 30);
    } catch (err) {
      console.warn(`⛔ Erreur pour ${coinId}:`, err.message);
      return null;
    }
  }

  // 🧮 Calcul du RSI (30 périodes)
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

  // 🧠 Met à jour la grille de RSI
  async function updateRSIs() {
    grid.innerHTML = "<p style='color:gray'>Chargement des cryptos...</p>";
    const coins = await fetchTopCoins();

    grid.innerHTML = "";

    let count = 0;
    for (const coin of coins.slice(0, 200)) {
      await sleep(1200); // pause pour éviter le blocage
      const rsi = await fetchRSI(coin.id);

      const box = document.createElement("div");
      box.className =
        "cryptoBox transition-all duration-500 ease-in-out transform hover:scale-105";

      if (rsi === null) {
        box.style.background = "#4b5563"; // gris
        box.textContent = coin.symbol.toUpperCase();
      } else {
        const color =
          rsi < 30 ? "#dc2626" : rsi > 70 ? "#16a34a" : "#3b82f6";
        box.style.background = color;
        box.textContent = `${coin.symbol.toUpperCase()} ${rsi.toFixed(0)}`;
      }

      grid.appendChild(box);
      count++;
      if (count >= 200) break;
    }
  }

  // ⚡ Bouton de rafraîchissement
  if (refreshBtn) refreshBtn.onclick = updateRSIs;

  // 🚀 Lancement automatique
  updateRSIs();
});
