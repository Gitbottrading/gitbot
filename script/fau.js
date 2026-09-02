// BLOCKCHAIN SETTINGS (SEPOLIA NET)
const TOKEN_CONTRACT_ADDRESS = "0x0cD82cC8f27E012FE5C13aD4d1323C090CEfc257"; 

// ABI needed to read data and call the Faucet functions
const CONTRACT_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function getLatestBtcPrice() view returns (uint256)",
    "function isFaucetWindowOpen() view returns (bool open, uint256 currentFridayStart)",
    "function claimFaucet(bytes calldata signature) external"
];

// Web3 global variables
let provider;
let signer;
let contract;
let userAddress = null;
let timerInterval;

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const walletAddressDisplay = document.getElementById('wallet-address');
const balanceDisplay = document.getElementById('user-balance');
const tokenSymbolDisplay = document.getElementById('token-symbol');
const claimBtn = document.getElementById('claim-btn');
const timerDisplay = document.getElementById('timer-display');
const countdownDisplay = document.getElementById('countdown');
const messageDisplay = document.getElementById('message');

// Set UI contract reference
if (document.getElementById('token-address-ui')) {
    document.getElementById('token-address-ui').textContent = TOKEN_CONTRACT_ADDRESS;
}

// 1. WEB3 WALLET CONNECTION
async function connectWallet() {
    if (!window.ethereum) {
        showMessage("Please install MetaMask or another Web3 wallet.", "error");
        return;
    }

    try {
        // Initialize Ethers v6 Browser Provider
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // Request account access
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        // Update Wallet UI
        walletAddressDisplay.textContent = `Connected: ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectBtn.textContent = "Wallet Connected";
        connectBtn.disabled = true;

        // Instantiate Smart Contract Object
        contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Fetch balances and symbol from blockchain
        await updateTokenData();
        
        // Start live Friday time check loop
        initTimerSystem();

    } catch (error) {
        console.error(error);
        showMessage("Error establishing wallet connection.", "error");
    }
}

// 2. READ CONTRACT BLOCKCHAIN DATA
async function updateTokenData() {
    try {
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        const rawBalance = await contract.balanceOf(userAddress);
        const btcPriceRaw = await contract.getLatestBtcPrice();
        
        // Formats balance to 18 decimals
        const formattedBalance = ethers.formatUnits(rawBalance, decimals);
        const formattedBtcPrice = ethers.formatUnits(btcPriceRaw, 18);

        tokenSymbolDisplay.textContent = symbol;
        balanceDisplay.textContent = parseFloat(formattedBalance).toFixed(4);
        
        console.log(`Current BTC Price via Oracle: $${parseFloat(formattedBtcPrice).toLocaleString()}`);
    } catch (error) {
        console.error("Error reading contract data:", error);
    }
}

// 3. FAUCET CHRONOGRAM / TIMER LOGIC
function initTimerSystem() {
    clearInterval(timerInterval);
    checkTimeAndStatus();
    timerInterval = setInterval(checkTimeAndStatus, 1000);
}

async function checkTimeAndStatus() {
    if (!contract) return;

    try {
        // We fetch the open state directly from the smart contract clock rules (UTC-based)
        const [isOpen, currentFridayStart] = await contract.isFaucetWindowOpen();

        if (isOpen) {
            claimBtn.disabled = false;
            timerDisplay.classList.add('hidden');
            return;
        }

        // Calculate countdown locally if closed
        claimBtn.disabled = true;
        timerDisplay.classList.remove('hidden');

        const now = new Date();
        let target = new Date();
        
        // target next Friday
        target.setDate(now.getUTCDate() + (5 - now.getUTCDay() + 7) % 7);
        target.setUTCHours(19, 0, 0, 0); // 7:00 PM UTC

        if (now >= target) {
            target.setUTCDate(target.getUTCDate() + 7);
        }

        const difference = target - now;
        if (difference < 0) {
            countdownDisplay.textContent = "--:--:--";
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        countdownDisplay.textContent = `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${segundos.toString().padStart(2, '0')}s`;

    } catch (error) {
        console.error("Timer check failed:", error);
    }
}

// 4. TRIGGER FAUCET CLAIM
async function claimTokens() {
    if (!contract || !userAddress) return;

    try {
        showMessage("Requesting server IP clearance verification...", "");
        claimBtn.disabled = true;

        // === INTEGRATION NOTE FOR REQUIREMENT 5 (IP PROTECTION) ===
        // Here you must fetch the signature from your private backend server API.
        // Example: const response = await fetch(`/api/get-signature?address=${userAddress}`);
        // For temporary frontend testing inside Remix/MetaMask, pass an empty signature "0x" 
        // or a manual signed payload if your ipVerifierSigner matches your wallet.
        
        const mockSignature = "0x"; // Replace with real server signature fetch payload

        showMessage("Sending transaction... Please confirm in your wallet.", "");
        
        // Calling claimFaucet(bytes signature) on Sepolia
        const tx = await contract.claimFaucet(mockSignature);
        showMessage("Tx sent. Waiting for network block confirmation...", "");
        
        await tx.wait();

        showMessage(`Claim successful! Hash: ${tx.hash.substring(0,15)}...`, "success");
        await updateTokenData();

    } catch (error) {
        console.error(error);
        if (error.reason) {
            showMessage(`Contract Reverted: ${error.reason}`, "error");
        } else {
            showMessage("Transaction failed or was rejected.", "error");
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

// Network/Account Change Auto-refresh
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
}

