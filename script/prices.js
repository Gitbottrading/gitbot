    <script>
        async function fetchTop100() {
            const tbody = document.getElementById('crypto-table-body');
            
            // URL original de CoinMarketCap
            const originalUrl = "https://coinmarketcap.com";
            
            // Agregamos el proxy CORS gratuito por delante para evitar el bloqueo del navegador
            const url = "https://corsproxy.io?" + encodeURIComponent(originalUrl);
            
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.data && result.data.length > 0) {
                    tbody.innerHTML = ""; // Limpiar el estado de carga
                    
                    result.data.forEach(coin => {
                        const rawPrice = coin.quote.USD.price;
                        const formattedPrice = rawPrice < 1 
                            ? rawPrice.toFixed(6) 
                            : rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                        const row = `
                            <tr>
                                <td class="rank">${coin.cmc_rank || '-'}</td>
                                <td>
                                    <span class="coin-name">${coin.name}</span>
                                    <span class="coin-symbol">${coin.symbol}</span>
                                </td>
                                <td class="price">$${formattedPrice}</td>
                            </tr>
                        `;
                        tbody.innerHTML += row;
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="3" class="loading">No se pudieron procesar los datos estructurados de la API.</td></tr>`;
                }
            } catch (error) {
                console.error("Error al obtener los datos:", error);
                tbody.innerHTML = `<tr><td colspan="3" class="loading" style="color: #ff3b30;">Error al conectar con la API. Intenta nuevamente en unos segundos.</td></tr>`;
            }
        }

        // Ejecución automática inicial al abrir la página
        fetchTop100();
    </script>
