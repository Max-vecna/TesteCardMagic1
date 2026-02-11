// --- Funções do Rolador de Dados ---

// Estado para armazenar o histórico de rolagens
let rollHistory = [];
const MAX_HISTORY = 15; // Manter no máximo 15 rolagens no histórico

/**
 * Mostra uma notificação de alerta customizada.
 * @param {string} message - A mensagem a ser exibida.
 */
function showDiceAlert(message) {
    const alertId = `dice-alert-${Date.now()}`;
    const alertHtml = `
        <div id="${alertId}" class="fixed top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg text-sm z-[200000]" style="opacity: 0; transform: translateY(-20px); transition: all 0.3s ease;">
            ${message}
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    const alertEl = document.getElementById(alertId);

    // Animação de entrada
    setTimeout(() => {
        alertEl.style.opacity = '1';
        alertEl.style.transform = 'translateY(0) translateX(-50%)';
    }, 10);

    // Remover após 3 segundos
    setTimeout(() => {
        alertEl.style.opacity = '0';
        alertEl.style.transform = 'translateY(-20px) translateX(-50%)';
        alertEl.addEventListener('transitionend', () => alertEl.remove());
    }, 3000);
}


/**
 * Analisa uma notação de dado (ex: "2d6+3") e a rola.
 * @param {string} notation - A notação do dado a ser rolada.
 * @returns {object|null} Um objeto com o resultado ou null se a notação for inválida.
 */
function rollDice(notation) {
    notation = notation.toLowerCase().replace(/\s+/g, '');
    const regex = /^(\d+)?d(\d+)([+-]\d+)?$/;
    const match = notation.match(regex);

    if (!match) {
        showDiceAlert('Formato inválido! Use ex: 2d6+3');
        return null;
    }

    const numDice = match[1] ? parseInt(match[1], 10) : 1;
    const numSides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    if (numDice > 100 || numSides > 1000) {
        showDiceAlert('Valores muito altos! (Máx: 100d1000)');
        return null;
    }
    
    if (numSides === 0) {
        showDiceAlert('Um dado não pode ter 0 lados.');
        return null;
    }

    const rolls = [];
    let total = 0;

    for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * numSides) + 1;
        rolls.push(roll);
        total += roll;
    }

    total += modifier;

    return {
        notation: notation,
        rolls: rolls,
        modifier: modifier,
        total: total
    };
}

/**
 * Atualiza o display principal com o resultado da rolagem.
 * @param {object} result - O objeto de resultado da função rollDice.
 */
function updateResultDisplay(result) {
    const display = document.getElementById('dice-result-display');
    if (!display || !result) return;

    const modifierString = result.modifier > 0 ? ` + ${result.modifier}` : (result.modifier < 0 ? ` - ${Math.abs(result.modifier)}` : '');
    const rollsString = result.rolls.join(', ');

    display.innerHTML = `
        <div class="text-center">
            <p class="text-5xl font-bold text-indigo-300">${result.total}</p>
            <p class="text-sm text-gray-400 mt-1">${result.notation.toUpperCase()}: [${rollsString}]${modifierString}</p>
        </div>
    `;
}

/**
 * Adiciona um resultado ao histórico de rolagens e atualiza a UI.
 * @param {object} result - O objeto de resultado da função rollDice.
 */
function addToHistory(result) {
    if (!result) return;

    rollHistory.unshift(result); // Adiciona no início
    if (rollHistory.length > MAX_HISTORY) {
        rollHistory.pop(); // Remove o mais antigo se exceder o limite
    }

    localStorage.setItem('diceRollHistory', JSON.stringify(rollHistory));
    renderHistory();
}

/**
 * Renderiza a lista de histórico na UI.
 */
function renderHistory() {
    const log = document.getElementById('dice-history-log');
    if (!log) return;

    if (rollHistory.length === 0) {
        log.innerHTML = '<p class="text-center text-gray-500 text-sm italic">Nenhuma rolagem ainda.</p>';
        return;
    }

    log.innerHTML = rollHistory.map(res => `
        <div class="flex justify-between items-center bg-gray-700/50 p-2 rounded-md text-sm">
            <span class="font-semibold text-gray-300">${res.notation.toUpperCase()}</span>
            <span class="font-bold text-lg text-indigo-300">${res.total}</span>
        </div>
    `).join('');
}

/**
 * Carrega o histórico do localStorage.
 */
function loadHistory() {
    const savedHistory = localStorage.getItem('diceRollHistory');
    if (savedHistory) {
        rollHistory = JSON.parse(savedHistory);
    }
    renderHistory();
}

/**
 * Inicializa o rolador de dados, configurando todos os event listeners.
 */
function initializeDiceRoller() {
    const fab = document.querySelectorAll('.dice-roller-fab');
    const modal = document.getElementById('dice-roller-modal');
    const closeModalBtn = document.getElementById('dice-modal-close-btn');
    const diceButtons = document.querySelectorAll('.dice-btn');
    const customRollBtn = document.getElementById('custom-roll-btn');
    const customRollInput = document.getElementById('custom-roll-input');

    if (!fab || !modal) return;

    const toggleModal = (show) => {
        if (show) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('visible'), 10);
            loadHistory(); // Carrega o histórico sempre que o modal é aberto
        } else {
            modal.classList.remove('visible');
            modal.addEventListener('transitionend', () => modal.classList.add('hidden'), { once: true });
        }
    };

    fab.forEach(btn => {
        btn.addEventListener('click', () => toggleModal(true));
        closeModalBtn.addEventListener('click', () => toggleModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });
    });

    fab.forEach(btn => {
        btn.addEventListener('click', () => toggleModal(true));
        closeModalBtn.addEventListener('click', () => toggleModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });
    });

   

    const performRoll = (notation) => {
        const result = rollDice(notation);
        if (result) {
            updateResultDisplay(result);
            addToHistory(result);
        }
    };

    diceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const notation = btn.dataset.dice;
            performRoll(notation);
        });
    });

    customRollBtn.addEventListener('click', () => {
        if (customRollInput.value) {
            performRoll(customRollInput.value);
            customRollInput.value = '';
        }
    });

    customRollInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            customRollBtn.click();
        }
    });
}

// Inicializa o rolador quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', initializeDiceRoller);
