// Configuración de la Faucet
const COOLDOWN_TIME = 5 * 60; // 5 minutos en segundos
const MIN_REWARD = 1;
const MAX_REWARD = 10;

// Elementos del DOM
const balanceDisplay = document.getElementById('user-balance');
const claimBtn = document.getElementById('claim-btn');
const timerDisplay = document.getElementById('timer-display');
const countdownDisplay = document.getElementById('countdown');
const messageDisplay = document.getElementById('message');
const historyList = document.getElementById('history-list');

// Estado de la aplicación
let balance = parseInt(localStorage.getItem('faucet_balance')) || 0;
let nextClaimTime = localStorage.getItem('next_claim_time') || 0;
let countdownInterval;

// Inicializar app
function init() {
    balanceDisplay.textContent = balance;
    updateHistoryDOM();
    checkCooldown();
}

// Comprobar si el usuario tiene que esperar
function checkCooldown() {
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (currentTime < nextClaimTime) {
        const remainingTime = nextClaimTime - currentTime;
        startTimer(remainingTime);
    } else {
        enableClaimButton();
    }
}

// Iniciar contador
function startTimer(duration) {
    claimBtn.disabled = true;
    timerDisplay.classList.remove('hidden');
    
    let timer = duration;
    updateTimerText(timer);

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        timer--;
        updateTimerText(timer);

        if (timer <= 0) {
            clearInterval(countdownInterval);
            enableClaimButton();
        }
    }, 1000);
}

function updateTimerText(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    countdownDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${remSeconds.toString().padStart(2, '0')}`;
}

function enableClaimButton() {
    claimBtn.disabled = false;
    timerDisplay.classList.add('hidden');
    messageDisplay.textContent = '';
}

// Lógica de reclamo
claimBtn.addEventListener('click', () => {
    // 1. Calcular recompensa aleatoria
    const reward = Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD;
    
    // 2. Actualizar balance
    balance += reward;
    localStorage.setItem('faucet_balance', balance);
    balanceDisplay.textContent = balance;

    // 3. Guardar marca de tiempo del próximo reclamo
    const claimTime = Math.floor(Date.now() / 1000);
    nextClaimTime = claimTime + COOLDOWN_TIME;
    localStorage.setItem('next_claim_time', nextClaimTime);

    // 4. Agregar al historial
    saveToHistory(reward);

    // 5. Mostrar feedback al usuario
    messageDisplay.textContent = `¡Felicidades! Has reclamado +${reward} Satoshis.`;
    messageDisplay.className = "message success";

    // 6. Activar bloqueo temporal
    startTimer(COOLDOWN_TIME);
});

// Guardar historial en LocalStorage
function saveToHistory(amount) {
    let history = JSON.parse(localStorage.getItem('faucet_history')) || [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    history.unshift({ amount, time: timeStr }); // Añade al inicio
    if (history.length > 5) history.pop(); // Limita a los últimos 5 reclamos
    
    localStorage.setItem('faucet_history', JSON.stringify(history));
    updateHistoryDOM();
}

// Pintar el historial en pantalla
function updateHistoryDOM() {
    let history = JSON.parse(localStorage.getItem('faucet_history')) || [];
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<li class="history-item">No hay reclamos recientes.</li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `<span>${item.time}</span> <span class="sats-earned">+${item.amount} Sats</span>`;
        historyList.appendChild(li);
    });
}

// Arrancar la app al cargar la página
init();
