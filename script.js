// Initialize the calculator
document.addEventListener('DOMContentLoaded', function() {
    // Setup risk button functionality
    setupRiskButtons();
    
    // Setup real-time calculation
    setupRealTimeCalculation();
    
    // Initial calculation
    calculatePosition();
});

function setupRiskButtons() {
    const riskButtons = document.querySelectorAll('.risk-btn');
    const riskInput = document.getElementById('riskPercent');
    
    riskButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            riskButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update input value
            const riskValue = this.getAttribute('data-risk');
            riskInput.value = riskValue;
            
            // Recalculate
            calculatePosition();
        });
    });
    
    // Update button states when input changes
    riskInput.addEventListener('input', function() {
        const currentValue = this.value;
        let matchFound = false;
        
        riskButtons.forEach(button => {
            if (button.getAttribute('data-risk') === currentValue) {
                button.classList.add('active');
                matchFound = true;
            } else {
                button.classList.remove('active');
            }
        });
        
        // If no match found, remove active from all buttons
        if (!matchFound) {
            riskButtons.forEach(btn => btn.classList.remove('active'));
        }
    });
}

function setupRealTimeCalculation() {
    const inputs = document.querySelectorAll('input[type="number"]');
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Add small delay to avoid excessive calculations
            clearTimeout(this.calculateTimeout);
            this.calculateTimeout = setTimeout(calculatePosition, 300);
        });
    });
}

function calculatePosition() {
    try {
        // Get input values
        const portfolioSize = parseFloat(document.getElementById('portfolioSize').value) || 0;
        const riskPercent = parseFloat(document.getElementById('riskPercent').value) || 0;
        const leverage = parseFloat(document.getElementById('leverage').value) || 1;
        const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
        const stopLoss = parseFloat(document.getElementById('stopLoss').value) || 0;
        const takeProfit = parseFloat(document.getElementById('takeProfit').value) || 0;
        
        // Validate inputs
        if (portfolioSize <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLoss <= 0 || leverage <= 0) {
            updateResults({
                positionSize: 0,
                quantity: 0,
                riskAmount: 0,
                potentialProfit: 0,
                riskReward: '1:0',
                marginRequired: 0
            });
            return;
        }
        
        // Calculate risk amount
        const riskAmount = portfolioSize * (riskPercent / 100);
        
        // Calculate price difference for stop loss
        const stopLossDiff = Math.abs(entryPrice - stopLoss);
        
        if (stopLossDiff === 0) {
            updateResults({
                positionSize: 0,
                quantity: 0,
                riskAmount: riskAmount,
                potentialProfit: 0,
                riskReward: '1:0',
                marginRequired: 0
            });
            return;
        }
        
        // Calculate position size based on risk
        const quantity = riskAmount / stopLossDiff;
        const positionSize = quantity * entryPrice;
        
        // Calculate margin required
        const marginRequired = positionSize / leverage;
        
        // Calculate potential profit
        let potentialProfit = 0;
        let riskRewardRatio = '1:0';
        
        if (takeProfit > 0) {
            const takeProfitDiff = Math.abs(takeProfit - entryPrice);
            potentialProfit = quantity * takeProfitDiff;
            
            // Calculate risk/reward ratio
            const rewardRatio = takeProfitDiff / stopLossDiff;
            riskRewardRatio = `1:${rewardRatio.toFixed(2)}`;
        }
        
        // Update results
        updateResults({
            positionSize: positionSize,
            quantity: quantity,
            riskAmount: riskAmount,
            potentialProfit: potentialProfit,
            riskReward: riskRewardRatio,
            marginRequired: marginRequired
        });
        
    } catch (error) {
        console.error('Calculation error:', error);
        updateResults({
            positionSize: 0,
            quantity: 0,
            riskAmount: 0,
            potentialProfit: 0,
            riskReward: '1:0',
            marginRequired: 0
        });
    }
}

function updateResults(results) {
    // Update position size
    document.getElementById('positionSize').textContent = formatCurrency(results.positionSize);
    
    // Update quantity
    document.getElementById('quantity').textContent = formatNumber(results.quantity, 6);
    
    // Update risk amount
    document.getElementById('riskAmount').textContent = formatCurrency(results.riskAmount);
    
    // Update potential profit
    document.getElementById('potentialProfit').textContent = formatCurrency(results.potentialProfit);
    
    // Update risk/reward ratio
    document.getElementById('riskReward').textContent = results.riskReward;
    
    // Update margin required
    document.getElementById('marginRequired').textContent = formatCurrency(results.marginRequired);
    
    // Add visual feedback
    const resultsContainer = document.getElementById('results');
    resultsContainer.style.transform = 'scale(0.98)';
    setTimeout(() => {
        resultsContainer.style.transform = 'scale(1)';
    }, 100);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatNumber(number, decimals = 2) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number);
}

// Add tooltips for info icons
document.addEventListener('DOMContentLoaded', function() {
    const infoIcons = document.querySelectorAll('.info-icon');
    
    const tooltips = {
        'Portfolio Size (USD)': 'Total amount of capital you have available for trading',
        'Risk Per Trade (%)': 'Percentage of your portfolio you\'re willing to risk on this trade',
        'Leverage': 'Multiplier that allows you to control larger positions with smaller capital',
        'Entry Price (USD)': 'The price at which you plan to enter the position',
        'Stop-Loss Price (USD)': 'The price at which you\'ll exit to limit losses',
        'Take-Profit Price (USD)': 'The price at which you\'ll exit to secure profits'
    };
    
    infoIcons.forEach(icon => {
        const label = icon.previousElementSibling.textContent.trim();
        const tooltipText = tooltips[label.replace(/\s*\?.*$/, '')];
        
        if (tooltipText) {
            icon.title = tooltipText;
            icon.style.cursor = 'help';
        }
    });
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        calculatePosition();
    }
});

// Add input validation
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input[type="number"]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            const value = parseFloat(this.value);
            
            // Validate minimum values
            if (this.id === 'portfolioSize' && value < 0) {
                this.value = 0;
            }
            if (this.id === 'riskPercent' && value < 0) {
                this.value = 0;
            }
            if (this.id === 'leverage' && value < 1) {
                this.value = 1;
            }
            if ((this.id === 'entryPrice' || this.id === 'stopLoss' || this.id === 'takeProfit') && value < 0) {
                this.value = 0;
            }
        });
    });
});