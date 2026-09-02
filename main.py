import sqlite3
import ccxt
import threading
import time
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse

app = FastAPI(title="Money Bot Web")
bot_corriendo = False

class ApiBotWeb:
    def __init__(self):
        self.exchange_id = "binance"
        self.exchange = None
        self.portfolio = ['BTC/USDT', 'BNB/USDT', 'ETH/USDT', 'SOL/USDT', 'TRX/USDT', 'HBAR/USDT', 'WLFI/USDT']
        self.monto_base_usd = 20.0
        self.gain_target_pct = 0.02
        self._init_db()
        self._cargar_claves_locales()

    def _init_db(self):
        with sqlite3.connect('escalera_trading.db') as conn:
            cursor = conn.cursor()
            cursor.execute('CREATE TABLE IF NOT EXISTS configuracion (exchange TEXT, api_key TEXT, api_secret TEXT)')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cola_trading (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, pair TEXT, monto_usd REAL,
                    precio_compra REAL, cantidad_crypto REAL, status TEXT
                )
            ''')
            conn.commit()

    def _cargar_claves_locales(self):
        try:
            with sqlite3.connect('escalera_trading.db') as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT exchange, api_key, api_secret FROM configuracion LIMIT 1")
                row = cursor.fetchone()
                if row:
                    self.exchange_id, api_key, api_secret = row
                    self.exchange = getattr(ccxt, self.exchange_id)({
                        'apiKey': api_key, 'secret': api_secret,
                        'enableRateLimit': True, 'options': {'defaultType': 'spot'}
                    })
        except Exception as e:
            print(f"Error cargando DB local: {e}")

    def guardar_claves(self, api_key, api_secret, exchange):
        try:
            self.exchange_id = exchange
            self.exchange = getattr(ccxt, exchange)({
                'apiKey': api_key, 'secret': api_secret,
                'enableRateLimit': True, 'options': {'defaultType': 'spot'}
            })
            with sqlite3.connect('escalera_trading.db') as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM configuracion")
                cursor.execute("INSERT INTO configuracion VALUES (?, ?, ?)", (exchange, api_key, api_secret))
                conn.commit()
            return f"✅ API Keys vinculadas a {exchange.upper()}!"
        except Exception as e:
            return f"⚠️ Error: {str(e)}"

    def alternar_bot(self, activar: bool):
        global bot_corriendo
        if activar:
            if not self.exchange:
                return "⚠️ Error: Configura tus API Keys primero."
            try:
                balance = self.exchange.fetch_balance()
                saldo_usdt = balance['total'].get('USDT', 0.0)
                if saldo_usdt < self.monto_base_usd:
                    bot_corriendo = False
                    return f"❌ ACCESO DENEGADO! Saldo USDT insuficiente (${saldo_usdt:.2f})."
                
                if not bot_corriendo:
                    bot_corriendo = True
                    threading.Thread(target=self._bucle_trading, daemon=True).start()
                return f"🚀 MOTOR ENCENDIDO! Saldo verificado: ${saldo_usdt:.2f} USDT."
            except Exception as e:
                bot_corriendo = False
                return f"⚠️ Autenticación Fallida: {str(e)}"
        else:
            bot_corriendo = False
            return "🛑 BOT DETENIDO de forma segura."

    def _bucle_trading(self):
        global bot_corriendo
        while bot_corriendo:
            try:
                with sqlite3.connect('escalera_trading.db') as conn:
                    cursor = conn.cursor()
                    for pair in self.portfolio:
                        if not bot_corriendo: break
                        try:
                            ticker = self.exchange.fetch_ticker(pair)
                            precio_actual = ticker['last']
                            cursor.execute("SELECT id, precio_compra, cantidad_crypto FROM cola_trading WHERE pair=? AND status='ACTIVO' ORDER BY id ASC LIMIT 1", (pair,))
                            primero = cursor.fetchone()
                            
                            if primero is None:
                                cantidad_a_comprar = self.monto_base_usd / precio_actual
                                self.exchange.create_market_buy_order(pair, cantidad_a_comprar)
                                cursor.execute("INSERT INTO cola_trading (pair, monto_usd, precio_compra, cantidad_crypto, status) VALUES (?, ?, ?, ?, 'ACTIVO')", (pair, self.monto_base_usd, precio_actual, cantidad_a_comprar))
                                conn.commit()
                                continue
                            
                            posicion_id, precio_compra, cantidad_crypto = primero
                            precio_objetivo = precio_compra * (1 + self.gain_target_pct)
                            
                            if precio_actual >= precio_objetivo:
                                valor_actual_usd = cantidad_crypto * precio_actual
                                ganancia_usd = valor_actual_usd - self.monto_base_usd
                                cantidad_hold = ganancia_usd / precio_actual
                                cantidad_a_vender = cantidad_crypto - cantidad_hold
                                
                                self.exchange.create_market_sell_order(pair, cantidad_a_vender)
                                cursor.execute("UPDATE cola_trading SET status='CICLADO' WHERE id=?", (posicion_id,))
                                
                                cantidad_nueva = self.monto_base_usd / precio_actual
                                self.exchange.create_market_buy_order(pair, cantidad_nueva)
                                cursor.execute("INSERT INTO cola_trading (pair, monto_usd, precio_compra, cantidad_crypto, status) VALUES (?, ?, ?, ?, 'ACTIVO')", (pair, self.monto_base_usd, precio_actual, cantidad_nueva))
                                conn.commit()
                        except Exception as e:
                            print(f"Error procesando {pair}: {e}")
            except Exception as db_err:
                print(f"Error general de DB: {db_err}")
            time.sleep(3)

bot = ApiBotWeb()

# --- RUTAS DE LA INTERFAZ WEB ---

@app.get("/", response_class=HTMLResponse)
def index():
    estado_bot = "CORRIENDO 🚀" if bot_corriendo else "DETENIDO 🛑"
    return f"""
    <html>
        <head>
            <title>Money Bot Panel</title>
            <style>
                body {{ font-family: Arial, sans-serif; background: #121212; color: white; text-align: center; padding-top: 50px; }}
                .card {{ background: #1e1e1e; padding: 20px; display: inline-block; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.5); margin: 10px; }}
                input, select {{ padding: 10px; margin: 5px; width: 80%; border-radius: 5px; border: none; }}
                button {{ padding: 10px 20px; background: #00e676; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; color: black; }}
                .btn-stop {{ background: #ff1744; color: white; }}
            </style>
        </head>
        <body>
            <h1>💰 MONEY BOT CONTROL PANEL 💰</h1>
            <h3>Estado Actual: <span style="color: {'#00e676' if bot_corriendo else '#ff1744'}">{estado_bot}</span></h3>
            
            <div class="card">
                <h2>🔑 Configurar API Keys</h2>
                <form action="/configurar" method="post">
                    <select name="exchange">
                        <option value="binance">Binance</option>
                    </select><br>
                    <input type="text" name="api_key" placeholder="API Key" required><br>
                    <input type="password" name="api_secret" placeholder="API Secret" required><br>
                    <button type="submit">Guardar Llaves</button>
                </form>
            </div>

            <div class="card">
                <h2>⚡ Control de Motores</h2>
                <form action="/encender" method="post" style="display:inline;">
                    <button type="submit">INICIAR BOT</button>
                </form>
                <form action="/apagar" method="post" style="display:inline;">
                    <button type="submit" class="btn-stop">DETENER BOT</button>
                </form>
            </div>
        </body>
    </html>
    """

@app.post("/configurar")
def configurar(exchange: str = Form(...), api_key: str = Form(...), api_secret: str = Form(...)):
    msg = bot.guardar_claves(api_key, api_secret, exchange)
    return HTMLResponse(content=f"<script>alert('{msg}'); window.location.href='/';</script>")

@app.post("/encender")
def encender():
    msg = bot.alternar_bot(True)
    return HTMLResponse(content=f"<script>alert('{msg}'); window.location.href='/';</script>")

@app.post("/apagar")
def apagar():
    msg = bot.alternar_bot(False)
    return HTMLResponse(content=f"<script>alert('{msg}'); window.location.href='/';</script>")
