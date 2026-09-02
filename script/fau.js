// ==========================================
// BLOCKCHAIN SETTINGS (SEPOLIA NETWORK)
// ==========================================
const TOKEN_CONTRACT_ADDRESS = "0x0cD82cC8f27E012FE5C13aD4d1323C090CEfc257"; 
const BACKEND_API_URL = "http://localhost:3000/api/request-claim"; // Cambiar por tu URL de producción en el futuro

// ABI necesario para leer los datos y ejecutar el Faucet
const CONTRACT_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function getLatestBtcPrice() view returns (uint256)",
    "function isFaucetWindowOpen() view returns (bool open, uint256 currentFridayStart)",
    "function claimFaucet(bytes calldata signature) external"
];

// Variables globales de Web3
let provider;
let signer;
let contract;
let userAddress = null;
let timerInterval;

// Elementos del DOM
const connectBtn = document.getElementById('connect-btn');
const addTokenBtn = document.getElementById('add-token-btn');
const walletAddressDisplay = document.getElementById('wallet-address');
const balanceDisplay = document.getElementById('user-balance');
const tokenSymbolDisplay = document.getElementById('token-symbol');
const claimBtn = document.getElementById('claim-btn');
const timerDisplay = document.getElementById('timer-display');
const countdownDisplay = document.getElementById('countdown');
const messageDisplay = document.getElementById('message');

// Configurar dirección del contrato en la interfaz si el elemento existe
if (document.getElementById('token-address-ui')) {
    document.getElementById('token-address-ui').textContent = TOKEN_CONTRACT_ADDRESS;
}

// ==========================================
// 1. CONEXIÓN CON BILLETERA WEB3 (METAMASK)
// ==========================================
async function connectWallet() {
    if (!window.ethereum) {
        showMessage("Por favor instala MetaMask u otra billetera Web3.", "error");
        return;
    }

    try {
        // Inicializar el proveedor de Ethers v6
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // Solicitar acceso a las cuentas del usuario
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        // Actualizar interfaz de la billetera
        walletAddressDisplay.textContent = `Conectado: ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectBtn.textContent = "Billetera Conectada";
        connectBtn.disabled = true;

        // Mostrar el botón para añadir el token bBTC a MetaMask
        if (addTokenBtn) {
            addTokenBtn.style.display = 'inline-flex';
        }

        // Instanciar el objeto del contrato inteligente
        contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Obtener balances, precios y símbolos de la blockchain
        await updateTokenData();
        
        // Iniciar el bucle del temporizador en vivo del Faucet
        initTimerSystem();

    } catch (error) {
        console.error(error);
        showMessage("Error al establecer conexión con la billetera.", "error");
    }
}

// ==========================================
// 2. LEER DATOS DIRECTOS DE LA BLOCKCHAIN
// ==========================================
async function updateTokenData() {
    if (!contract || !userAddress) return;

    try {
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        const rawBalance = await contract.balanceOf(userAddress);
        const btcPriceRaw = await contract.getLatestBtcPrice();
        
        // Formatear los balances usando los decimales del token (18)
        const formattedBalance = ethers.formatUnits(rawBalance, decimals);
        const formattedBtcPrice = ethers.formatUnits(btcPriceRaw, 18);

        tokenSymbolDisplay.textContent = symbol;
        balanceDisplay.textContent = parseFloat(formattedBalance).toFixed(4);
        
        console.log(`Precio actual de BTC mediante Oráculo: $${parseFloat(formattedBtcPrice).toLocaleString()}`);
    } catch (error) {
        console.error("Error al leer datos del contrato:", error);
    }
}

// ==========================================
// 3. LÓGICA DEL CRONOGRAMA Y CUENTA REGRESIVA
// ==========================================
function initTimerSystem() {
    clearInterval(timerInterval);
    checkTimeAndStatus();
    timerInterval = setInterval(checkTimeAndStatus, 1000);
}

async function checkTimeAndStatus() {
    if (!contract) return;

    try {
        // Consultamos el estado de apertura basado en el reloj del contrato (Tiempo UTC)
        const [isOpen, currentFridayStart] = await contract.isFaucetWindowOpen();

        if (isOpen) {
            claimBtn.disabled = false;
            timerDisplay.classList.add('hidden');
            return;
        }

        // Si está cerrado, calculamos la cuenta regresiva localmente usando tiempos UTC estándar
        claimBtn.disabled = true;
        timerDisplay.classList.remove('hidden');

        const now = new Date();
        let target = new Date();
        
        // Calcular los días que faltan para el próximo viernes (5 = Viernes en JavaScript UTC)
        target.setDate(now.getUTCDate() + (5 - now.getUTCDay() + 7) % 7);
        target.setUTCHours(19, 0, 0, 0); // Establecer a las 7:00 PM UTC

        // Si ya pasó el viernes de esta semana, apuntar al de la siguiente semana
        if (now >= target) {
            target.setUTCDate(target.getUTCDate() + 7);
        }

        const difference = target - now;
        if (difference < 0) {
            countdownDisplay.textContent = "00d 00h 00m 00s";
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        countdownDisplay.textContent = `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

    } catch (error) {
        console.error("Error al verificar el temporizador:", error);
    }
}

// ==========================================
// 4. EJECUTAR RECLAMO (PROCESO CON ANTIFRAUDE IP)
// ==========================================
async function claimTokens() {
    if (!contract || !userAddress) return;

    try {
        showMessage("Verificando dispositivo e IP con el servidor seguro...", "");
        claimBtn.disabled = true;

        // Requisito 5: Petición HTTP al backend para validar IP y obtener firma criptográfica
        const response = await fetch(BACKEND_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: userAddress })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "El servidor backend denegó el reclamo por IP repetida.");
        }

        const serverSignature = data.signature;

        showMessage("IP verificada. Por favor confirma la transacción en tu billetera...", "");
        
        // Llamada a la función claimFaucet del Smart Contract pasando la firma del servidor
        const tx = await contract.claimFaucet(serverSignature);
        
        showMessage("Transacción enviada. Esperando confirmación de la red Sepolia...", "");
        
        // Esperar a que la transacción se procese en un bloque
        await tx.wait();

        showMessage(`¡Reclamo exitoso! Tus tokens bBTC están en camino. Hash: ${tx.hash.substring(0,15)}...`, "success");
        
        // Actualizar balances en la interfaz
        await updateTokenData();

    } catch (error) {
        console.error(error);
        if (error.reason) {
            showMessage(`Contrato Revertido: ${error.reason}`, "error");
        } else {
            showMessage(error.message || "La transacción falló o fue rechazada.", "error");
        }
        claimBtn.disabled = false;
    }
}

// ==========================================
// 5. SUGERIR ASSET AUTOMÁTICO EN METAMASK
// ==========================================
async function addTokenToMetaMask() {
    if (!window.ethereum) return;

    try {
        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20', 
                options: {
                    address: TOKEN_CONTRACT_ADDRESS,
                    symbol: 'bBTC',                 
                    decimals: 18,                   
                    image: 'https://cryptologos.cc', // Icono visual sugerido
                },
            },
        });

        if (wasAdded) {
            console.log('El token bBTC fue añadido a MetaMask exitosamente.');
        } else {
            console.log('El usuario rechazó añadir el token.');
        }
    } catch (error) {
        console.error('Error al intentar registrar el activo:', error);
    }
}

// Helpers del DOM
function showMessage(text, type) {
    messageDisplay.textContent = text;
    messageDisplay.className = `message ${type}`;
}

// Event Listeners principales
connectBtn.addEventListener('click', connectWallet);
claimBtn.addEventListener('click', claimTokens);
if (addTokenBtn) {
    addTokenBtn.addEventListener('click', addTokenToMetaMask);
}

// Recarga automática si el usuario cambia de cuenta o de red en MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
}
// ==========================================
// 1. CONEXIÓN CON BILLETERA WEB3 (OPTIMIZADA)
// ==========================================
async function connectWallet() {
    if (!window.ethereum) {
        showMessage("Por favor instala MetaMask u otra billetera Web3.", "error");
        return;
    }

    try {
        // 1. Solicitar de inmediato acceso a las cuentas de MetaMask
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length === 0) {
            showMessage("No se encontraron cuentas disponibles.", "error");
            return;
        }
        
        userAddress = accounts[0];

        // 2. Inicializar el proveedor y firmante adaptado a Ethers.js v6
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // 3. Validar si el usuario está conectado a la red correcta (Sepolia Network)
        // El Chain ID hexadecimal de Sepolia es '0xaa36a7' (11155111 en decimal)
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== '0xaa36a7') {
            try {
                // Forzar el cambio automático a la red Sepolia
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }],
                });
            } catch (switchError) {
                showMessage("Por favor cambia la red de tu MetaMask a Sepolia Testnet.", "error");
                return;
            }
        }

        // 4. Actualizar interfaz visual de la billetera
        walletAddressDisplay.textContent = `Conectado: ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectBtn.textContent = "Billetera Conectada";
        connectBtn.disabled = true;

        // Mostrar el botón para añadir el token bBTC si existe en el HTML
        if (addTokenBtn) {
            addTokenBtn.style.display = 'inline-flex';
        }

        // 5. Instanciar el objeto del contrato inteligente en Sepolia
        contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Obtener balances, precios y símbolos de la blockchain
        await updateTokenData();
        
        // Iniciar el bucle del temporizador en vivo del Faucet
        initTimerSystem();

    } catch (error) {
        // Imprime el error real completo en la consola web para depuración (Presiona F12 en tu navegador)
        console.error("Detalle técnico del fallo al conectar:", error);
        
        if (error.code === 4001) {
            showMessage("Conexión rechazada: Has cancelado la solicitud en MetaMask.", "error");
        } else {
            showMessage(`Fallo al conectar: ${error.message || "Revisa la consola (F12)"}`, "error");
        }
    }
}

