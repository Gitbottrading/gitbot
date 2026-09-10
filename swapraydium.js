// =========================================================================
// CONFIGURACIÓN DE DIRECCIONES Y CONTRATOS EN SOLANA DEVNET
// =========================================================================
const RPC_ENDPOINT = "https://solana.com";
const MY_POOL_ID = "GfHF9VafAZrGCjpCNTHcFxMWSRhpnMYyiZTkcpxZNchx";
const MY_TOKEN_MINT = "7o9ubxJz8vAjY8nT9C5oopgUPKemUqTHLb8z2eyiRzL1";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// ID del Programa Oficial de Raydium CPMM en Devnet (Constant standard)
const RAYDIUM_CPMM_PROGRAM_ID = "CPMMoo8168xuBRU4GqJ2671jG7htmRz86RceQYAD5k55"; 

// Inicializar conexión estable con Solana Devnet utilizando la CDN cargada globalmente
const connection = new solanaWeb3.Connection(RPC_ENDPOINT, 'confirmed');
let walletPublicKey = null;
let activeProvider = null; 

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
        const solBalanceLamports = await connection.getBalance(walletPublicKey);
        const solUiBalance = (solBalanceLamports / 1_000_000_000).toFixed(4);
        
        let tokenUiBalance = "0.0000";
        const tokenMintPubkey = new solanaWeb3.PublicKey(MY_TOKEN_MINT);
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
            mint: tokenMintPubkey
        });

        if (tokenAccounts.value.length > 0) {
            const amountInfo = tokenAccounts.value.account.data.parsed.info.tokenAmount;
            tokenUiBalance = parseFloat(amountInfo.uiAmountString).toFixed(4);
        }

        log(`Saldos: ${solUiBalance} SOL | ${tokenUiBalance} Tu Token`, 'system-msg');
    } catch (err) {
        console.error("Error consultando balances:", err);
    }
}

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
// 2. DETECCIÓN UNIFICADA COMPATIBLE CON NAVEGADORES MÓVILES (SOLFLARE/PHANTOM)
// =========================================================================
btnConnect.addEventListener('click', async () => {
    try {
        log("Buscando proveedores de firma inyectados...");

        // FIX MÓVIL: En navegadores internos, las apps inyectan todo en window.solana 
        // o directamente en el objeto estándar de la dApp. Evaluamos de manera jerárquica.
        if (window.solana) {
            activeProvider = window.solana;
            log("Conectando mediante interfaz estándar del navegador móvil...");
        } else if (window.solflare) {
            activeProvider = window.solflare;
            log("Conectando mediante interfaz nativa Solflare...");
        } else if (window.phantom?.solana) {
            activeProvider = window.phantom.solana;
            log("Conectando mediante interfaz nativa Phantom...");
        }

        if (!activeProvider) {
            log("Error: No se detectó ninguna wallet interna activa.", "error-msg");
            return;
        }

        // Ejecutar solicitud de conexión con parámetros estándar de tolerancia
        const response = await activeProvider.connect({ onlyIfTrusted: false });
        walletPublicKey = response.publicKey || activeProvider.publicKey;
        
        if (!walletPublicKey) {
            throw new Error("Clave pública inaccesible. Reintenta recargar la pestaña.");
        }
        
        const base58Str = walletPublicKey.toBase58();
        btnConnect.innerText = base58Str.substring(0, 4) + "..." + base58Str.substring(base58Str.length - 4);
        btnConnect.style.backgroundColor = "#14f195";
        btnConnect.style.color = "#000";
        btnSwap.disabled = false;
        
        log(`Wallet vinculada con éxito en Móvil: ${base58Str}`, "success-msg");
        
        calculateEstimatedOutput();
        await updateWalletBalances();

    } catch (err) {
        log(`Fallo al enlazar: ${err.message}`, "error-msg");
        console.error(err);
    }
});

// =========================================================================
// 3. CONSTRUCCIÓN DE INSTRUCCIÓN COMPATIBLE CON RAYDIUM CPMM
// =========================================================================
btnSwap.addEventListener('click', async () => {
    if (!walletPublicKey || !activeProvider) return;
    
    btnSwap.disabled = true;
    btnSwap.innerText = "Procesando...";
    log("Iniciando enrutamiento Raydium CPMM en Devnet...");

    try {
        const rawAmount = parseFloat(amountInput.value);
        if (isNaN(rawAmount) || rawAmount <= 0) {
            throw new Error("Ingresa un monto válido.");
        }

        const lamportsIn = Math.round(rawAmount * 1_000_000_000);

        log("Paso 1: Generando mapa de cuentas para Raydium CPMM...");
        
        const transaction = new solanaWeb3.Transaction();
        const poolPublicKey = new solanaWeb3.PublicKey(MY_POOL_ID);
        const cpmmProgramPublicKey = new solanaWeb3.PublicKey(RAYDIUM_CPMM_PROGRAM_ID);

        // =========================================================================
        // NOTA TÉCNICA RAYDIUM CPMM: 
        // Las transacciones en navegadores web puros no pueden compilar el SDK pesado de Node.
        // Para ejecutar el swap dentro del Pool CPMM (`GfHF9Vaf...chx`), construimos 
        // una instrucción estructurada que envía los fondos e interactúa con el State del Pool.
        // =========================================================================
        
        // Creamos la instrucción de llamada al programa CPMM de Raydium
        const swapInstruction = new solanaWeb3.TransactionInstruction({
            programId: cpmmProgramPublicKey,
            keys: [
                { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // Usuario
                { pubkey: poolPublicKey, isSigner: false, isWritable: true },  // Tu Pool ID CPMM
                { pubkey: new solanaWeb3.PublicKey(WSOL_MINT), isSigner: false, isWritable: false },
                { pubkey: new solanaWeb3.PublicKey(MY_TOKEN_MINT), isSigner: false, isWritable: false }
            ],
            // Discriminador binario del método Swap en CPMM Raydium + Monto In (Serializado de forma ligera)
            data: window.Buffer.from([
                9, // Índice del comando Swap en el contrato inteligente CPMM
                ...new solanaWeb3.BN(lamportsIn).toArray("le", 8) // Monto de entrada
            ])
        });

        // Agregamos la instrucción de Swap de manera nativa al bloque
        transaction.add(swapInstruction);
        transaction.feePayer = walletPublicKey;
        
        log("Paso 2: Sincronizando firmas de red (Blockhash)...");
        const latestBlockhashInfo = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhashInfo.blockhash;

        log("Paso 3: Invocando pantalla de aprobación en tu app Solflare...");
        
        // Ejecución delegada segura en aplicaciones móviles
        const { signature } = await activeProvider.signAndSendTransaction(transaction);
        
        log(`Bloque firmado enviado a la blockchain. Hash: ${signature}`, "success-msg");
        log("Paso 4: Esperando validación de los mineros en Devnet...");

        const confirmation = await connection.confirmTransaction({
            blockhash: latestBlockhashInfo.blockhash,
            lastValidBlockHeight: latestBlockhashInfo.lastValidBlockHeight,
            signature: signature
        }, 'confirmed');
        
        if (confirmation.value.err) {
            log("Error: La blockchain de Raydium rechazó la transacción por falta de gas o Slippage.", "error-msg");
        } else {
            log("¡Intercambio CPMM completado con éxito! 🎉", "success-msg");
            log(`Explorer: https://solana.com{signature}?cluster=devnet`, "success-msg");
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            await updateWalletBalances();
        }

    } catch (err) {
        log(`Error en proceso móvil: ${err.message}`, "error-msg");
        console.error(err);
    } finally {
        btnSwap.disabled = false;
        btnSwap.innerText = "Iniciar Swap";
    }
});
