      // Direcciones de tus contratos en Sepolia
const tokenAddress = "0x0cD82cC8f27E012FE5C13aD4d1323C090CEfc257";
const faucetAddress = "0x1F76256F3977448B0b6056911023DDD102ba18D2";

// ABIs mínimos para interactuar con los contratos
const faucetAbi = ["function requestTokens() external"];
const tokenAbi = ["function balanceOf(address account) external view returns (uint256)"];

let provider, signer, faucetContract, tokenContract;

const connectBtn = document.getElementById("connectBtn");
const claimBtn = document.getElementById("claimBtn");
const statusDiv = document.getElementById("status");
const faucetBalanceSpan = document.getElementById("faucetBalance");

// Función para obtener y actualizar el saldo del Faucet
async function updateFaucetBalance() {
    try {
        const balanceWei = await tokenContract.balanceOf(faucetAddress);
        const balanceEther = ethers.formatEther(balanceWei);
        faucetBalanceSpan.innerText = `${parseFloat(balanceEther).toFixed(4)} Tokens`;
    } catch (error) {
        console.error("Error al obtener el saldo:", error);
        faucetBalanceSpan.innerText = "Error al cargar";
    }
}

// 1. Conectar MetaMask (Resistente a conflictos de otras extensiones)
connectBtn.addEventListener("click", async () => {
    const ethereumProvider = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;

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
    try {
        statusDiv.style.color = "#333";
        statusDiv.innerText = "Iniciando transacción... Confirma en MetaMask.";
        
        const tx = await faucetContract.requestTokens();
        statusDiv.innerText = "Validando reclamo semanal en Sepolia...";
        
        await tx.wait(); // Espera la confirmación del bloque
        statusDiv.style.color = "green";
        statusDiv.innerText = "¡Éxito! Has recibido tus 0.005 tokens de este ciclo.";
        
        await updateFaucetBalance();
    } catch (error) {
        statusDiv.style.color = "red";
        
        if (error.message.includes("Ya reclamaste")) {
            statusDiv.innerText = "Error: Ya has reclamado tus tokens para el ciclo de este viernes.";
        } else if (error.message.includes("fondos suficientes")) {
            statusDiv.innerText = "Error: El grifo no cuenta con fondos suficientes.";
        } else {
            statusDiv.innerText = "La transacción falló o fue cancelada de forma manual.";
            console.error(error);
        }
    }
});

