// =========================================================================
// CONFIGURACIÓN DE DIRECCIONES Y CONTRATOS EN SOLANA DEVNET
// =========================================================================
const RPC_ENDPOINT = "https://solana.com";
const MY_POOL_ID = "GfHF9VafAZrGCjpCNTHcFxMWSRhpnMYyiZTkcpxZNchx";
const MY_TOKEN_MINT = "7o9ubxJz8vAjY8nT9C5oopgUPKemUqTHLb8z2eyiRzL1";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Inicializar conexión con Solana Devnet utilizando la CDN cargada globalmente
const connection = new solanaWeb3.Connection(RPC_ENDPOINT, 'confirmed');
let walletPublicKey = null;

// Referencias a los elementos del DOM creados en el HTML
const btnConnect = document.getElementById('btn-connect');
const btnSwap = document.getElementById('btn-swap');
const amountInput = document.getElementById('amount-input');
const tokenOutput = document.getElementById('token-output');
const slippageSelect = document.getElementById('slippage-select');
const statusLogger = document.getElementById('status-logger');

// Función auxiliar para imprimir estados visuales en la consola de la UI
function log(message, type = 'system-msg') {
    const p = document.createElement('p');
    p.className = type;
    p.innerText = `> ${message}`;
    statusLogger.appendChild(p);
    statusLogger.scrollTop = statusLogger.scrollHeight;
}

// =========================================================================
// 1. CONTROL DE BALANCES EN TIEMPO REAL
// =========================================================================
async function updateWalletBalances() {
    if (!walletPublicKey) return;

    try {
        // Consultar balance nativo de SOL
        const solBalanceLamports = await connection.getBalance(walletPublicKey);
        const solUiBalance = (solBalanceLamports / 1_000_000_000).toFixed(4);
        
        // Consultar balance del Token Personalizado (9 decimales)
        let tokenUiBalance = "0.0000";
        const tokenMintPubkey = new solanaWeb3.PublicKey(MY_TOKEN_MINT);
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
            mint: tokenMintPubkey
        });

        if (tokenAccounts.value.length > 0) {
            const amountInfo = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
            tokenUiBalance = parseFloat(amountInfo.uiAmountString).toFixed(4);
        }

        log(`Saldos actualizados: ${solUiBalance} SOL | ${tokenUiBalance} Tu Token`, 'system-msg');
    } catch (err) {
        console.error("Error consultando balances:", err);
    }
}

// Simulación de cotización local proporcional a la curva de liquidez en Devnet
function calculateEstimatedOutput() {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        tokenOutput.value = "0.0";
        return;
    }
    // Tasa fija de prueba para simulación visual rápida en el frontend
    const mockRate = 142.5; 
    tokenOutput.value = (amount * mockRate).toFixed(4);
}

amountInput.addEventListener('input', calculateEstimatedOutput);

// =========================================================================
// 2. CONEXIÓN DE LA BILLETERA (WALLET ADAPTER INTERACTIVO)
// =========================================================================
btnConnect.addEventListener('click', async () => {
    try {
        const provider = window.solana || window.phantom?.solana;
        
        if (!provider) {
            log("Error: No se detectó ninguna wallet. Por favor, instala Phantom o Solflare.", "error-msg");
            window.open("https://phantom.app", "_blank");
            return;
        }

        log("Solicitando conexión a la extensión de tu billetera...");
        const response = await provider.connect();
        walletPublicKey = response.publicKey;
        
        // Modificar estética del botón de conexión
        btnConnect.innerText = walletPublicKey.toBase58().substring(0, 4) + "..." + walletPublicKey.toBase58().substring(walletPublicKey.toBase58().length - 4);
        btnConnect.style.backgroundColor = "#14f195";
        btnConnect.style.color = "#000";
        btnSwap.disabled = false;
        
        log(`Conectado con éxito a: ${walletPublicKey.toBase58()}`, "success-msg");
        
        // Cargar datos iniciales
        calculateEstimatedOutput();
        await updateWalletBalances();

    } catch (err) {
        log(`Error de conexión: ${err.message}`, "error-msg");
    }
});

// =========================================================================
// 3. LOGICA Y ENVÍO DE LA TRANSACCIÓN DE SWAP
// =========================================================================
btnSwap.addEventListener('click', async () => {
    if (!walletPublicKey) return;
    
    btnSwap.disabled = true;
    btnSwap.innerText = "Procesando...";
    log("Iniciando secuencia de intercambio (Swap)...");

    try {
        const provider = window.solana || window.phantom?.solana;
        const rawAmount = parseFloat(amountInput.value);
        
        if (isNaN(rawAmount) || rawAmount <= 0) {
            throw new Error("Ingresa un monto de entrada válido.");
        }

        // Conversión del monto humano a unidades atómicas de Solana (Lamports)
        const lamportsIn = Math.round(rawAmount * 1_000_000_000);

        log("Paso 1: Estructurando instrucciones nativas del Swap...");
        
        // Crear una nueva estructura de transacción estándar compatible con el navegador
        let transaction = new solanaWeb3.Transaction();
        const poolPublicKey = new solanaWeb3.PublicKey(MY_POOL_ID);
        
        // Instrucción para simular la inyección al Pool de liquidez seleccionado en Devnet
        transaction.add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: walletPublicKey,
                toPubkey: poolPublicKey, 
                lamports: lamportsIn,
            })
        );

        // Definir los parámetros de red necesarios para la firma
        transaction.feePayer = walletPublicKey;
        
        log("Paso 2: Consultando estado de los bloques más recientes en Devnet...");
        const latestBlockhashInfo = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhashInfo.blockhash;

        log("Paso 3: Esperando autorización y firma del usuario en la billetera...");
        
        // Enviar la transacción al inyector de la Wallet para interactuar con la interfaz del explorador
        const { signature } = await provider.signAndSendTransaction(transaction);
        
        log(`Transacción firmada. Hash: ${signature}`, "success-msg");
        log("Paso 4: Validando inclusión y confirmación del bloque en el Ledger...");

        // Monitorear y confirmar el procesamiento en los nodos validadores de pruebas
        const confirmation = await connection.confirmTransaction({
            blockhash: latestBlockhashInfo.blockhash,
            lastValidBlockHeight: latestBlockhashInfo.lastValidBlockHeight,
            signature: signature
        }, 'confirmed');
        
        if (confirmation.value.err) {
            log("Error: El contrato inteligente rechazó la transacción en cadena.", "error-msg");
        } else {
            log("¡Swap procesado de manera exitosa en tu Pool! 🎉", "success-msg");
            log(`Explorer Link: https://solana.com{signature}?cluster=devnet`, "success-msg");
            
            // Actualizar balances finales tras procesar el intercambio
            await new Promise(resolve => setTimeout(resolve, 2000));
            await updateWalletBalances();
        }

    } catch (err) {
        log(`Fallo en el flujo de ejecución: ${err.message}`, "error-msg");
        console.error(err);
    } finally {
        btnSwap.disabled = false;
        btnSwap.innerText = "Iniciar Swap";
    }
});

