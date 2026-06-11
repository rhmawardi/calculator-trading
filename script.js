let deferredInstallPrompt = null;
let prevResults = {};

document.addEventListener('DOMContentLoaded', function () {
    setupRiskButtons();
    setupRealTimeCalculation();
    setupInstallButton();
    registerServiceWorker();
    fetchTickerPrices();
    calculatePosition();
});

/* ─── Live Ticker ─── */
async function fetchTickerPrices() {
    const ids = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple'];
    const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
    const priceEls = ids.map((_, i) => ({
        price: document.getElementById(`${symbols[i].toLowerCase()}Price`),
        change: document.getElementById(`${symbols[i].toLowerCase()}Change`),
    }));
    const statusEl = document.getElementById('tickerStatus');

    async function fetchOnce() {
        try {
            const res = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`,
                { signal: AbortSignal.timeout(8000) }
            );
            if (!res.ok) throw new Error('API error');
            const data = await res.json();
            ids.forEach((id, i) => {
                const coin = data[id];
                if (coin) {
                    const price = coin.usd;
                    const change = coin.usd_24h_change;
                    priceEls[i].price.textContent = formatTickerPrice(price);
                    if (change != null) {
                        const cls = change >= 0 ? 'up' : 'down';
                        const sign = change >= 0 ? '+' : '';
                        priceEls[i].change.className = `ticker-change ${cls}`;
                        priceEls[i].change.textContent = `${sign}${change.toFixed(2)}%`;
                    }
                }
            });
            statusEl.style.color = '#22c55e';
        } catch {
            statusEl.style.color = '#ef4444';
            setMockPrices(priceEls);
        }
    }

    function setMockPrices(els) {
        const mockPrices = [68420, 3520, 186.5, 598, 0.62];
        const mockChanges = [2.4, -1.8, 5.2, 0.3, -2.1];
        symbols.forEach((_, i) => {
            els[i].price.textContent = formatTickerPrice(mockPrices[i]);
            const cls = mockChanges[i] >= 0 ? 'up' : 'down';
            const sign = mockChanges[i] >= 0 ? '+' : '';
            els[i].change.className = `ticker-change ${cls}`;
            els[i].change.textContent = `${sign}${mockChanges[i].toFixed(2)}%`;
        });
    }

    await fetchOnce();
    setInterval(fetchOnce, 30000);
}

function formatTickerPrice(price) {
    if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return '$' + price.toFixed(2);
    return '$' + price.toFixed(4);
}

/* ─── Market Stats (Volume & Dominance) ─── */
setTimeout(async function fetchMarketStats() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const d = data.data;
        document.getElementById('volume24h').textContent = '$' + (d.total_volume.usd / 1e12).toFixed(2) + 'T';
        document.getElementById('btcDominance').textContent = d.market_cap_percentage.btc.toFixed(1) + '%';
    } catch {
        document.getElementById('volume24h').textContent = '$2.45T';
        document.getElementById('btcDominance').textContent = '51.3%';
    }
}, 100);

/* ─── Install Button ─── */
function setupInstallButton() {
    const installButton = document.getElementById('installButton');
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.hidden = false;
    });
    installButton.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome !== 'accepted') installButton.hidden = false;
        deferredInstallPrompt = null;
        installButton.hidden = true;
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        installButton.hidden = true;
    });
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

/* ─── Risk Buttons ─── */
function setupRiskButtons() {
    const riskButtons = document.querySelectorAll('.risk-btn');
    const riskInput = document.getElementById('riskPercent');
    riskButtons.forEach(button => {
        button.addEventListener('click', function () {
            riskButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            riskInput.value = this.getAttribute('data-risk');
            calculatePosition();
        });
    });
    riskInput.addEventListener('input', function () {
        const val = this.value;
        let match = false;
        riskButtons.forEach(btn => {
            if (btn.getAttribute('data-risk') === val) {
                btn.classList.add('active');
                match = true;
            } else {
                btn.classList.remove('active');
            }
        });
        if (!match) riskButtons.forEach(btn => btn.classList.remove('active'));
    });
}

function setupRealTimeCalculation() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', function () {
            clearTimeout(this.calcTimeout);
            this.calcTimeout = setTimeout(calculatePosition, 300);
        });
    });
}

/* ─── Core Calculation ─── */
function calculatePosition() {
    try {
        const portfolioSize = parseFloat(document.getElementById('portfolioSize').value) || 0;
        const riskPercent = parseFloat(document.getElementById('riskPercent').value) || 0;
        const leverage = parseFloat(document.getElementById('leverage').value) || 1;
        const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
        const stopLoss = parseFloat(document.getElementById('stopLoss').value) || 0;
        const takeProfit = parseFloat(document.getElementById('takeProfit').value) || 0;

        if (portfolioSize <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLoss <= 0 || leverage <= 0) {
            updateResults({ positionSize: 0, quantity: 0, riskAmount: 0, potentialProfit: 0, riskReward: '1:0', marginRequired: 0 });
            return;
        }

        const riskAmount = portfolioSize * (riskPercent / 100);
        const stopLossDiff = Math.abs(entryPrice - stopLoss);

        if (stopLossDiff === 0) {
            updateResults({ positionSize: 0, quantity: 0, riskAmount, potentialProfit: 0, riskReward: '1:0', marginRequired: 0 });
            return;
        }

        const quantity = riskAmount / stopLossDiff;
        const positionSize = quantity * entryPrice;
        const marginRequired = positionSize / leverage;

        let potentialProfit = 0;
        let riskRewardRatio = '1:0';

        if (takeProfit > 0) {
            const takeProfitDiff = Math.abs(takeProfit - entryPrice);
            potentialProfit = quantity * takeProfitDiff;
            const rewardRatio = takeProfitDiff / stopLossDiff;
            riskRewardRatio = `1:${rewardRatio.toFixed(2)}`;
        }

        updateResults({ positionSize, quantity, riskAmount, potentialProfit, riskReward: riskRewardRatio, marginRequired });
    } catch {
        updateResults({ positionSize: 0, quantity: 0, riskAmount: 0, potentialProfit: 0, riskReward: '1:0', marginRequired: 0 });
    }
}

/* ─── Animated Results Update ─── */
function updateResults(results) {
    const prev = prevResults;
    prevResults = { ...results };

    animateValue('positionSize', prev.positionSize || 0, results.positionSize, formatCurrency, 'positionBar', calcPositionPercent);
    animateValue('quantity', prev.quantity || 0, results.quantity, (v) => formatNumber(v, 6), 'quantityBar', calcQuantityPercent);
    animateValue('riskAmount', prev.riskAmount || 0, results.riskAmount, formatCurrency, 'riskBar', calcRiskPercent);
    animateValue('potentialProfit', prev.potentialProfit || 0, results.potentialProfit, formatCurrency, 'profitBar', calcProfitPercent);
    document.getElementById('riskReward').textContent = results.riskReward;
    updateBar('rrBar', calcRRPercent(results.riskReward));
    animateValue('marginRequired', prev.marginRequired || 0, results.marginRequired, formatCurrency, 'marginBar', calcMarginPercent);

    updateRiskIndicator(results.riskAmount, results.positionSize);

    const container = document.getElementById('results');
    container.style.transform = 'scale(0.98)';
    setTimeout(() => { container.style.transform = 'scale(1)'; }, 100);
}

/* ─── Smooth Number Animation ─── */
function animateValue(elementId, start, end, formatter, barId, barCalc) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 400;
    const startTime = performance.now();
    const diff = end - start;

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + diff * eased;
        el.textContent = formatter(current);
        if (barId) updateBar(barId, barCalc(current, end));
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function updateBar(barId, percent) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const fill = bar.querySelector('.result-bar-fill');
    if (fill) fill.style.width = Math.min(percent, 100) + '%';
}

/* ─── Bar Percentages (normalized against portfolio) ─── */
function calcPositionPercent(val) {
    const p = parseFloat(document.getElementById('portfolioSize').value) || 1;
    return (val / p) * 100;
}

function calcQuantityPercent(val) {
    const maxQ = 100;
    return Math.min((val / maxQ) * 100, 100);
}

function calcRiskPercent(val) {
    const p = parseFloat(document.getElementById('portfolioSize').value) || 1;
    return (val / p) * 100;
}

function calcProfitPercent(val) {
    const p = parseFloat(document.getElementById('portfolioSize').value) || 1;
    return Math.min((val / p) * 100, 100);
}

function calcRRPercent(rr) {
    const ratio = parseFloat(rr.split(':')[1]) || 0;
    return Math.min((ratio / 10) * 100, 100);
}

function calcMarginPercent(val) {
    const p = parseFloat(document.getElementById('portfolioSize').value) || 1;
    return (val / p) * 100;
}

/* ─── Risk Level Indicator ─── */
function updateRiskIndicator(riskAmount, positionSize) {
    const dot = document.getElementById('riskDot');
    const text = document.getElementById('riskLevelText');
    const p = parseFloat(document.getElementById('portfolioSize').value) || 1;
    const percent = (riskAmount / p) * 100;

    if (percent <= 2) {
        dot.className = 'risk-dot safe';
        text.textContent = 'Conservative';
    } else if (percent <= 5) {
        dot.className = 'risk-dot moderate';
        text.textContent = 'Moderate';
    } else {
        dot.className = 'risk-dot high';
        text.textContent = 'Aggressive';
    }
}

/* ─── Formatters ─── */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount);
}

function formatNumber(number, decimals = 2) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
    }).format(number);
}

/* ─── Tooltips ─── */
document.addEventListener('DOMContentLoaded', function () {
    const infoIcons = document.querySelectorAll('.info-icon');
    const tooltips = {
        'Portfolio Size (USD)': 'Total amount of capital you have available for trading',
        'Risk Per Trade (%)': 'Percentage of your portfolio you\'re willing to risk on this trade',
        'Leverage': 'Multiplier that allows you to control larger positions with smaller capital',
        'Entry Price (USD)': 'The price at which you plan to enter the position',
        'Stop-Loss Price (USD)': 'The price at which you\'ll exit to limit losses',
        'Take-Profit Price (USD)': 'The price at which you\'ll exit to secure profits',
    };
    infoIcons.forEach(icon => {
        const label = icon.previousElementSibling.textContent.trim();
        const text = tooltips[label.replace(/\s*\?.*$/, '')];
        if (text) { icon.title = text; icon.style.cursor = 'help'; }
    });
});

/* ─── Keyboard Shortcut ─── */
document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key === 'Enter') calculatePosition();
});

/* ─── Input Validation ─── */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', function () {
            const value = parseFloat(this.value);
            if (this.id === 'portfolioSize' && value < 0) this.value = 0;
            if (this.id === 'riskPercent' && value < 0) this.value = 0;
            if (this.id === 'leverage' && value < 1) this.value = 1;
            if ((this.id === 'entryPrice' || this.id === 'stopLoss' || this.id === 'takeProfit') && value < 0) this.value = 0;
        });
    });
});
