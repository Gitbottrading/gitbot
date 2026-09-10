// =========================================================================
// CONFIGURACIÓN DE DIRECCIONES Y CONTRATOS EN SOLANA DEVNET
// =========================================================================
const RPC_ENDPOINT = "https://api.devnet.solana.com";
const MY_POOL_ID = "GfHF9VafAZrGCjpCNTHcFxMWSRhpnMYyiZTkcpxZNchx";
const MY_TOKEN_MINT = "7o9ubxJz8vAjY8nT9C5oopgUPKemUqTHLb8z2eyiRzL1";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Inicializar conexión con Solana Devnet utilizando la CDN cargada globalmente
const connection = new solanaWeb3.Connection(RPC_ENDPOINT, 'confirmed');
let walletPublicKey = null;
let activeProvider = null; // Guardará el proveedor activo (Phantom o Solflare)

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
            const amountInfo = tokenAccounts.value.account.data.parsed.info.tokenAmount;
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
    const mockRate = 142.5; 
    tokenOutput.value = (amount * mockRate).toFixed(4);
}

amountInput.addEventListener('input', calculateEstimatedOutput);

// =========================================================================
// 2. CONEXIÓN MULTI-WALLET (SOPORTE PARA PHANTOM Y SOLFLARE)
// =========================================================================
btnConnect.addEventListener('click', async () => {
    try {
        // DETECCIÓN INTELIGENTE: Busca primero Solflare y luego Phantom
        if (window.solflare && window.solflare.isSolflare) {
            activeProvider = window.solflare;
            log("Detectado proveedor: Solflare Wallet.");
        } else if (window.solana && (window.solana.isPhantom || window.phantom?.solana)) {
            activeProvider = window.solana || window.phantom?.solana;
            log("Detectado proveedor: Phantom Wallet.");
        }

        if (!activeProvider) {
            log("Error: No se detectó Phantom ni Solflare. Instala una extensión.", "error-msg");
            window.open("https://solflare.com/", "_blank");
            return;
        }

        log("Solicitando aprobación de conexión en la extensión...");
        
        // Solflare y Phantom manejan el método estándar .connect()
        const response = await activeProvider.connect();
        
        // Ciertas versiones de Solflare devuelven la llave directamente o dentro de un objeto
        walletPublicKey = response.publicKey || activeProvider.publicKey;
        
        if (!walletPublicKey) {
            throw new Error("No se pudo extraer la clave pública de la wallet.");
        }
        
        // Modificar estética del botón de conexión
        const base58Str = walletPublicKey.toBase58();
        btnConnect.innerText = base58Str.substring(0, 4) + "..." + base58Str.substring(base58Str.length - 4);
        btnConnect.style.backgroundColor = "#14f195";
        btnConnect.style.color = "#000";
        btnSwap.disabled = false;
        
        log(`Conectado con éxito a: ${base58Str}`, "success-msg");
        
        // Cargar datos iniciales
        calculateEstimatedOutput();
        await updateWalletBalances();

    } catch (err) {
        log(`Error de conexión: ${err.message}`, "error-msg");
        console.error(err);
    }
});

// =========================================================================
// 3. LOGICA Y ENVÍO DE LA TRANSACCIÓN DE SWAP
// =========================================================================
btnSwap.addEventListener('click', async () => {
    if (!walletPublicKey || !activeProvider) return;
    
    btnSwap.disabled = true;
    btnSwap.innerText = "Procesando...";
    log("Iniciando secuencia de intercambio (Swap)...");

    try {
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
        
        // Instrucción para enviar SOL directo a la cuenta del Pool de liquidez
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

        log("Paso 3: Esperando autorización y firma en la billetera conectada...");
        
        // Ejecución de firma transparente (Funciona idéntico en Phantom y Solflare)
        const { signature } = await activeProvider.signAndSendTransaction(transaction);
        
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
            await new Promise(resolve => setTimeout(resolve, 2500));
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
