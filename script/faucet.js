        // Direcciones de tus contratos en Sepolia
const tokenAddress = "0x0cD82cC8f27E012FE5C13aD4d1323C090CEfc257";
const faucetAddress = "0x1F76256F3977448B0b6056911023DDD102ba18D2";

// ABIs mínimos para interactuar con los contratos
const faucetAbi = ["function requestTokens() external"];
const tokenAbi = ["function balanceOf(address account) external view returns (uint256)"];

let provider, signer, faucetContract, tokenContract;

// Elementos de la interfaz (Asegúrate de agregar los nuevos IDs en tu HTML)
const connectBtn = document.getElementById("connectBtn");
const claimBtn = document.getElementById("claimBtn");
const addTokenBtn = document.getElementById("addTokenBtn"); // NUEVO
const walletInput = document.getElementById("walletAddress"); // NUEVO
const statusDiv = document.getElementById("status");
const faucetBalanceSpan = document.getElementById("faucetBalance");

// Función para obtener el proveedor de MetaMask de forma segura
function getMetaMaskProvider() {
    return window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
}

// Función para obtener y actualizar el saldo del Faucet
async function updateFaucetBalance() {
    try {
        // Creamos un proveedor básico de lectura si el usuario no ha conectado su MetaMask aún
        const readProvider = provider || new ethers.BrowserProvider(getMetaMaskProvider());
        const tempTokenContract = new ethers.Contract(tokenAddress, tokenAbi, readProvider);
        
        const balanceWei = await tempTokenContract.balanceOf(faucetAddress);
        const balanceEther = ethers.formatEther(balanceWei);
        faucetBalanceSpan.innerText = `${parseFloat(balanceEther).toFixed(4)} Tokens`;
    } catch (error) {
        console.error("Error al obtener el saldo:", error);
        faucetBalanceSpan.innerText = "Error al cargar";
    }
}

// Cargar saldo del faucet automáticamente al abrir la página si MetaMask está presente
if (getMetaMaskProvider()) {
    updateFaucetBalance();
}

// 1. Conectar MetaMask (Resistente a conflictos de otras extensiones)
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
            statusDiv.innerText = `Conectado: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
            connectBtn.innerText = "Billetera Conectada";
            connectBtn.style.backgroundColor = "#007bff";
            claimBtn.disabled = false;

            // Auto-completar el nuevo campo con la dirección del usuario conectado
            if(walletInput) {
                walletInput.value = userAddress;
            }

            await updateFaucetBalance();
        } catch (error) {
            statusDiv.innerText = "Error de conexión: " + error.message;
        }
    } else {
        statusDiv.innerText = "Por favor, asegúrate de tener MetaMask activo.";
    }
});

// 2. Reclamar Tokens
claimBtn.addEventListener("click", async () => {
    // Validar dirección del campo si el usuario escribió algo
    const targetAddress = walletInput ? walletInput.value.trim() : "";
    
    if (targetAddress && !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        statusDiv.style.color = "red";
        statusDiv.innerText = "Error: Por favor ingresa una dirección de billetera válida (0x...).";
        return;
    }

    if (!signer) {
        statusDiv.style.color = "red";
        statusDiv.innerText = "Por favor, primero conecta tu MetaMask para firmar la transacción.";
        return;
    }

    try {
        statusDiv.style.color = "#333";
        statusDiv.innerText = "Iniciando transacción... Confirma en MetaMask.";
        
        // NOTA: Si tu contrato se modificó para recibir una dirección, cambia la línea de abajo por:
        // const tx = await faucetContract.requestTokens(targetAddress);
        const tx = await faucetContract.requestTokens();
        statusDiv.innerText = "Validando reclamo semanal en Sepolia...";
        
        await tx.wait(); // Espera la confirmación del bloque
        statusDiv.style.color = "green";
        statusDiv.innerText = "¡Éxito! Has recibido tus 0.005 tokens de este ciclo.";
        
        await updateFaucetBalance();
    } catch (error) {
        statusDiv.style.color = "red";
        
        if (error.message && error.message.includes("Ya reclamaste")) {
            statusDiv.innerText = "Error: Ya has reclamado tus tokens para el ciclo de este viernes.";
        } else if (error.message && error.message.includes("fondos suficientes")) {
            statusDiv.innerText = "Error: El grifo no cuenta con fondos suficientes.";
        } else {
            statusDiv.innerText = "La transacción falló o fue cancelada de forma manual.";
            console.error(error);
        }
    }
});

// 3. NUEVO: Agregar el Token Personalizado a MetaMask
addTokenBtn.addEventListener("click", async () => {
    const ethereumProvider = getMetaMaskProvider();

    if (!ethereumProvider) {
        statusDiv.style.color = "red";
        statusDiv.innerText = "MetaMask no detectado para agregar el token automáticamente.";
        return;
    }

    try {
        // Solicita a MetaMask añadir el token ERC20 a la interfaz del usuario
        const wasAdded = await ethereumProvider.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress, // Dirección de tu token
                    symbol: 'TKN',         // Cambia 'TKN' por el Símbolo real de tu Token (ej: GBT, MTK)
                    decimals: 18,          // Decimales estándar ERC20
                    image: '',             // URL opcional de un icono (png/svg) para tu token
                },
            },
        });

        if (wasAdded) {
            statusDiv.style.color = "green";
            statusDiv.innerText = "¡Token añadido exitosamente a tu billetera!";
        } else {
            statusDiv.innerText = "Operación cancelada por el usuario.";
        }
    } catch (error) {
        console.error(error);
        statusDiv.style.color = "red";
        statusDiv.innerText = "Error al intentar registrar el token en MetaMask.";
    }
});


