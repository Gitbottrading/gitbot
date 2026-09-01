// ==========================================
// 1. FONDO DINÁMICO DE ESTRELLAS (CANVAS)
// ==========================================
const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');
let stars = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
}

function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5,
      alpha: Math.random(),
      speed: 0.01 + Math.random() * 0.02
    });
  }
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  stars.forEach(star => {
    star.alpha += star.speed;
    if (star.alpha > 1 || star.alpha < 0) star.speed = -star.speed;
    ctx.globalAlpha = Math.abs(star.alpha);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(drawStars);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawStars();


// ==========================================
// 2. SISTEMA FLUIDO DE PRECIOS CRIPTO
// ==========================================
const cryptoData = {
  BTC:  { price: 77427.38, upProb: 0.75, maxUp: 250,    maxDown: 45 },
  ETH:  { price: 2406.98,  upProb: 0.72, maxUp: 12,     maxDown: 3.2 },
  SOL:  { price: 100.04,   upProb: 0.74, maxUp: 0.95,   maxDown: 0.22 },
  BNB:  { price: 680.29,   upProb: 0.70, maxUp: 3.5,    maxDown: 0.9 },
  TRX:  { price: 0.3250,   upProb: 0.68, maxUp: 0.004,  maxDown: 0.001 },
  WLFI: { price: 0.0574,   upProb: 0.65, maxUp: 0.002,  maxDown: 0.0005 },
  USDT: { price: 0.9995,   upProb: 0.50, maxUp: 0.0003, maxDown: 0.0003 }
};

const tickerContainer = document.getElementById('ticker-content');

function generateTickerHTML() {
  return Object.keys(cryptoData).map(symbol => {
    let displayPrice = cryptoData[symbol].price.toLocaleString('en-US', {
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: (symbol === 'WLFI' || symbol === 'USDT' || symbol === 'TRX') ? 4 : 2
    });
    return `
      <div class="crypto-item">
        <span class="symbol">🔹 ${symbol}/USD:</span>
        <span class="value" id="val-${symbol}">${displayPrice}</span>
      </div>
    `;
  }).join('');
}

// Inyección triplicada para asegurar el carrusel infinito responsivo sin huecos vacíos
const tickerSet = generateTickerHTML();
tickerContainer.innerHTML = tickerSet + tickerSet + tickerSet;

function updateMarketTicks() {
  Object.keys(cryptoData).forEach(symbol => {
    const coin = cryptoData[symbol];
    const isUp = Math.random() < coin.upProb;
    const delta = isUp ? (Math.random() * coin.maxUp) : -(Math.random() * coin.maxDown);
    coin.price += delta;

    if (symbol === 'USDT') {
      if (coin.price > 1.0002) coin.price = 1.0001;
      if (coin.price < 0.9996) coin.price = 0.9998;
    }

    let formatted = coin.price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: (symbol === 'WLFI' || symbol === 'USDT' || symbol === 'TRX') ? 4 : 2
    });

    const elementInstances = document.querySelectorAll(`#val-${symbol}`);
    elementInstances.forEach(el => { el.innerText = formatted; });

    if (symbol === 'BTC') {
      const mainPriceNode = document.getElementById('live-price');
      mainPriceNode.innerText = formatted;

      if (isUp && delta > 120) {
        mainPriceNode.classList.add('price-pump-flash');
        setTimeout(() => mainPriceNode.classList.remove('price-pump-flash'), 120);
      }
    }
  });
}

// Inicializar el intervalo a 1 tick por segundo
setInterval(updateMarketTicks, 1000);
