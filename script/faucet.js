// Direcciones de tus contratos en Sepolia
const tokenAddress = "0x0cD82cC8f27E012FE5C13aD4d1323C090CEfc257";
const faucetAddress = "0x1F76256F3977448B0b6056911023DDD102ba18D2";

// ABIs mínimos para interactuar con los contratos
const faucetAbi = ["function requestTokens() external"];
const tokenAbi = ["function balanceOf(address account) external view returns (uint256)"];

let provider, signer, faucetContract, tokenContract;

// Elementos de la interfaz recuperados por ID
const connectBtn = document.getElementById("connectBtn");
const claimBtn = document.getElementById("claimBtn");
const addTokenBtn = document.getElementById("addTokenBtn");
const walletInput = document.getElementById("walletAddress");
const statusDiv = document.getElementById("status");
const faucetBalanceSpan = document.getElementById("faucetBalance");

// Helper seguro para obtener el proveedor de MetaMask ignorando conflictos de otras wallets
function getMetaMaskProvider() {
    return window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
}

// Función global para actualizar dinámicamente el saldo del Faucet
async function updateFaucetBalance() {
    try {
        const metamaskProvider = getMetaMaskProvider();
        if (!metamaskProvider) {
            faucetBalanceSpan.innerText = "MetaMask requerido";
            return;
        }
        
        // Si aún no hay conexión establecida, creamos un proveedor temporal de sólo lectura
        const readProvider = provider || new ethers.BrowserProvider(metamaskProvider);
        const tempTokenContract = new ethers.Contract(tokenAddress, tokenAbi, readProvider);
        
        const balanceWei = await tempTokenContract.balanceOf(faucetAddress);
        const balanceEther = ethers.formatEther(balanceWei);
        faucetBalanceSpan.innerText = `${parseFloat(balanceEther).toFixed(4)} BB88`;
    } catch (error) {
        console.error("Error al obtener el saldo:", error);
        faucetBalanceSpan.innerText = "Error al cargar";
    }
}

// Intenta precargar el saldo al cargar la página si MetaMask está disponible
if (getMetaMaskProvider()) {
    updateFaucetBalance();
}

// 1. Conectar la Billetera (Auto-rellena el campo input al conectarse)
connectBtn.addEventListener("click", async () => {
    const ethereumProvider = getMetaMaskProvider();

    if (ethereumProvider && ethereumProvider.isMetaMask) {
        try {
            await ethereumProvider.request({ method: "eth_requestAccounts" });
            
            provider = new ethers.BrowserProvider(ethereumProvider);
            signer = await provider.getSigner();
            
            faucetContract = new ethers.Contract(faucetAddress, faucetAbi, signer);
            tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

            const userAddress = await signer.getAddress();
            
            // Modificaciones visuales de éxito
            statusDiv.style.borderLeftColor = "#3b82f6";
            statusDiv.innerText = `Billetera enlazada: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
            connectBtn.innerText = "Billetera Conectada";
            connectBtn.style.backgroundColor = "#2563eb";
            claimBtn.disabled = false;

            // Autocompletado inteligente en el input de texto
            if (walletInput) {
                walletInput.value = userAddress;
            }

            await updateFaucetBalance();
        } catch (error) {
            statusDiv.style.borderLeftColor = "#ef4444";
            statusDiv.innerText = "Error de conexión: " + error.message;
        }
    } else {
        statusDiv.style.borderLeftColor = "#ef4444";
        statusDiv.innerText = "Por favor, asegúrate de instalar y activar MetaMask.";
    }
});

// 2. Ejecutar la Transacción de Reclamo (Faucet)
claimBtn.addEventListener("click", async () => {
    const targetAddress = walletInput ? walletInput.value.trim() : "";
    
    // Validamos que el texto ingresado respete la expresión regular de direcciones de Ethereum
    if (targetAddress && !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        statusDiv.style.borderLeftColor = "#ef4444";
        statusDiv.innerText = "Error: La dirección ingresada no tiene un formato válido (0x...).";
        return;
    }

    if (!signer) {
        statusDiv.style.borderLeftColor = "#f59e0b";
        statusDiv.innerText = "Por favor, conecta primero tu MetaMask para firmar la transacción.";
        return;
    }

    try {
        statusDiv.style.borderLeftColor = "#3b82f6";
        statusDiv.innerText = "Iniciando transacción... Por favor aprueba en MetaMask.";
        
        // Ejecución estándar del grifo
        const tx = await faucetContract.requestTokens();
        
        statusDiv.innerText = "Validando reclamo semanal en Sepolia Testnet. Esperando bloque...";
        
        await tx.wait(); // Pausa la ejecución hasta que se mine la transacción en la red
        
        statusDiv.style.borderLeftColor = "#10b981";
        statusDiv.innerText = "¡Éxito total! Tus 0.005 tokens BB88 han sido transferidos en este ciclo.";
        
        await updateFaucetBalance();
    } catch (error) {
        statusDiv.style.borderLeftColor = "#ef4444";
        
        if (error.message && error.message.includes("Ya reclamaste")) {
            statusDiv.innerText = "Error del Contrato: Ya has reclamado tus tokens permitidos para este ciclo.";
        } else if (error.message && error.message.includes("fondos suficientes")) {
            statusDiv.innerText = "Error del Contrato: El Faucet se ha quedado sin fondos momentáneamente.";
        } else {
            statusDiv.innerText = "La transacción falló o fue rechazada en tu billetera.";
            console.error(error);
        }
    }
});

// 3. Registrar de forma automática el Token en el menú de MetaMask
addTokenBtn.addEventListener("click", async () => {
    const ethereumProvider = getMetaMaskProvider();

    if (!ethereumProvider) {
        statusDiv.style.borderLeftColor = "#ef4444";
        statusDiv.innerText = "MetaMask no fue detectado para importar el token de forma automática.";
        return;
    }

    try {
        const wasAdded = await ethereumProvider.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress, 
                    symbol: 'BB88', // Símbolo oficial asignado
                    decimals: 18,  
                    image: '',     // Opcional: Coloca una URL de imagen (png) si quieres que tenga logo
                },
            },
        });

        if (wasAdded) {
            statusDiv.style.borderLeftColor = "#10b981";
            statusDiv.innerText = "¡El token BB88 se añadió correctamente a tu MetaMask!";
        } else {
            statusDiv.innerText = "Importación cancelada por el usuario.";
        }
    } catch (error) {
        console.error(error);
        statusDiv.style.borderLeftColor = "#ef4444";
        statusDiv.innerText = "Error al intentar registrar el token en la interfaz de MetaMask.";
    }
});



