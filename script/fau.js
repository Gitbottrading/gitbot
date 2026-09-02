// CONFIGURACIÓN BLOCKCHAIN
const TOKEN_CONTRACT_ADDRESS = "0xTuDireccionDeContratoAqui"; 

// ABI mínimo para interactuar con el ERC-20 y su función Faucet
const CONTRACT_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function claim() external" // Asumiendo que tu contrato tiene la función 'claim'
];

// Variables globales Web3
let provider;
let signer;
let contract;
let userAddress = null;
let timerInterval;

// Elementos del DOM
const connectBtn = document.getElementById('connect-btn');
const walletAddressDisplay = document.getElementById('wallet-address');
const balanceDisplay = document.getElementById('user-balance');
const tokenSymbolDisplay = document.getElementById('token-symbol');
const claimBtn = document.getElementById('claim-btn');
const timerDisplay = document.getElementById('timer-display');
const countdownDisplay = document.getElementById('countdown');
const messageDisplay = document.getElementById('message');
document.getElementById('token-address-ui').textContent = TOKEN_CONTRACT_ADDRESS;

// 1. CONEXIÓN WEB3 (METAMASK)
async function connectWallet() {
    if (!window.ethereum) {
        showMessage("Por favor instala MetaMask u otra billetera Web3.", "error");
        return;
    }

    try {
        // Inicializar Ethers v6
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // Solicitar cuentas
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        // Mostrar billetera conectada
        walletAddressDisplay.textContent = `Conectado: ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectBtn.textContent = "Billetera Conectada";
        connectBtn.disabled = true;

        // Instanciar Contrato Inteligente
        contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Cargar datos
        await updateTokenData();
        
        // Iniciar bucle de verificación de tiempo
        initTimerSystem();

    } catch (error) {
        console.error(error);
        showMessage("Error al conectar la billetera.", "error");
    }
}

// 2. LEER DATOS DEL CONTRATO (Balance y Símbolo)
async function updateTokenData() {
    try {
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        const rawBalance = await contract.balanceOf(userAddress);
        
        // Formatear balance usando los decimales del token
        const formattedBalance = ethers.formatUnits(rawBalance, decimals);

        tokenSymbolDisplay.textContent = symbol;
        balanceDisplay.textContent = parseFloat(formattedBalance).toFixed(4);
    } catch (error) {
        console.error("Error leyendo datos del contrato:", error);
    }
}

// 3. LÓGICA DEL TIEMPO (Viernes 7:00 PM)
function initTimerSystem() {
    clearInterval(timerInterval);
    
    // Ejecutar inmediatamente y luego cada segundo
    checkTimeAndStatus();
    timerInterval = setInterval(checkTimeAndStatus, 1000);
}

function checkTimeAndStatus() {
    const now = new Date();
    
    // Calcular el próximo viernes a las 19:00:00
    let target = new Date();
    target.setDate(now.getDate() + (5 - now.getDay() + 7) % 7); // 5 representa el Viernes
    target.setHours(19, 0, 0, 0); // 19:00 horas

    // Si ya es viernes y pasó de las 7 PM, el próximo objetivo es el viernes de la siguiente semana
    if (now >= target) {
        // En este diseño: Permitimos reclamar todo el viernes después de las 7:00 PM hasta que termine el día
        // Si quieres que el botón se cierre exactamente después de cierto tiempo, puedes ajustar aquí.
        const unDiaDespues = new Date(target);
        unDiaDespues.setHours(23, 59, 59, 999);

        if (now <= unDiaDespues) {
            // ¡Es el momento de reclamar!
            claimBtn.disabled = false;
            timerDisplay.classList.add('hidden');
            return;
        } else {
            // Si ya pasó el viernes por completo, apuntamos al viernes de la otra semana
            target.setDate(target.getDate() + 7);
        }
    }

    // Si no es el momento, calcular la cuenta regresiva
    claimBtn.disabled = true;
    timerDisplay.classList.remove('hidden');

    const difference = target - now; // diferencia en milisegundos

    const dias = Math.floor(difference / (1000 * 60 * 60 * 24));
    const horas = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((difference % (1000 * 60)) / 1000);

    countdownDisplay.textContent = `${dias}d ${horas.toString().padStart(2, '0')}h ${minutos.toString().padStart(2, '0')}m ${segundos.toString().padStart(2, '0')}s`;
}

// 4. EJECUTAR TRANSACCIÓN DE RECLAMO (CLAIM)
async function claimTokens() {
    if (!contract || !userAddress) return;

    try {
        showMessage("Enviando transacción a la blockchain... Confirma en tu billetera.", "");
        claimBtn.disabled = true;

        // Llamar a la función claim() del Smart Contract
        const tx = await contract.claim();
        showMessage("Transacción enviada. Esperando confirmación de la red...", "");
        
        // Esperar a que la transacción se mine
        await tx.wait();

        showMessage(`¡Reclamo exitoso! Revisa tu billetera. Hash: ${tx.hash.substring(0,15)}...`, "success");
        
        // Actualizar el balance reflejado
        await updateTokenData();

    } catch (error) {
        console.error(error);
        // Manejo de errores amigable si el contrato revierte la transacción
        if (error.reason) {
            showMessage(`Error del contrato: ${error.reason}`, "error");
        } else {
            showMessage("La transacción fue cancelada o falló.", "error");
        }
        claimBtn.disabled = false;
    }
}

// Helpers
function showMessage(text, type) {
    messageDisplay.textContent = text;
    messageDisplay.className = `message ${type}`;
}

// Event Listeners
connectBtn.addEventListener('click', connectWallet);
claimBtn.addEventListener('click', claimTokens);

// Escuchar si el usuario cambia de cuenta en MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => {
        window.location.reload();
    });
    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}

