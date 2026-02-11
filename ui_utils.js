/**
 * Mostra um modal de confirmação customizado.
 * @param {string} message A mensagem a ser exibida.
 * @returns {Promise<boolean>} Resolve para true se o usuário confirmar, false caso contrário.
 */
export function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="custom-confirm-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" style="z-index: 999999999999999999;">
                <div class="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-sm border border-gray-700" style="z-index: 999999999999;">
                    <p class="text-center text-lg mb-6">${message}</p>
                    <div class="flex justify-end gap-4">
                        <button id="confirm-cancel-btn" class="py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 font-bold">Cancelar</button>
                        <button id="confirm-ok-btn" class="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 font-bold">Excluir</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('custom-confirm-modal');
        const confirmBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        const cleanupAndResolve = (value) => {
            modal.remove();
            resolve(value);
        };

        confirmBtn.onclick = () => cleanupAndResolve(true);
        cancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

/**
 * Mostra um modal de alerta customizado.
 * @param {string} message A mensagem a ser exibida.
 */
export function showCustomAlert(message) {
    const modalId = `custom-alert-modal-${Date.now()}`;
    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" style="z-index: 999999999999999999;">
            <div class="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-sm border border-gray-700" style="z-index: 999999999999;">
                <p class="text-center text-lg mb-4">${message}</p>
                <button class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById(modalId);
    modal.querySelector('button').addEventListener('click', () => {
        modal.remove();
    });
}

/**
 * Mostra um modal para o usuário inserir um multiplicador para uma ação.
 * @param {{title: string, baseCost: number, costType: string}} details - Detalhes para o prompt.
 * @returns {Promise<number|null>} Resolve com o multiplicador inserido ou null se cancelado.
 */
export function showMultiplierPrompt({ title = "Usar Habilidade", baseCost = 0, costType = "PM" }) {
    return new Promise((resolve) => {
        const modalId = `multiplier-prompt-modal-${Date.now()}`;
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" style="z-index: 999999999999999999;">
                <div class="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-sm border border-gray-700" style="z-index: 999999999999;">
                    <h3 class="text-xl font-bold text-center mb-4">${title}</h3>
                    <p class="text-sm text-gray-400 text-center mb-1">Custo base: ${baseCost} ${costType}</p>
                    <div class="my-4">
                        <label for="multiplier-input" class="block text-sm font-semibold mb-2 text-center">Multiplicador (quantas vezes usar?)</label>
                        <input type="number" id="multiplier-input" value="1" min="1" class="w-full text-center text-2xl px-4 py-3 bg-gray-900 text-white rounded-lg border-2 border-gray-600">
                    </div>
                    <p class="text-center font-bold mb-6">Custo Total: <span id="total-cost-span">${baseCost}</span> ${costType}</p>
                    <div class="flex justify-end gap-4">
                        <button id="multiplier-cancel-btn" class="py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 font-bold">Cancelar</button>
                        <button id="multiplier-ok-btn" class="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 font-bold">Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById(modalId);
        const input = document.getElementById('multiplier-input');
        const totalCostSpan = document.getElementById('total-cost-span');
        const confirmBtn = document.getElementById('multiplier-ok-btn');
        const cancelBtn = document.getElementById('multiplier-cancel-btn');

        const updateTotal = () => {
            const multiplier = Math.max(1, parseInt(input.value, 10) || 1);
            totalCostSpan.textContent = baseCost * multiplier;
        };

        input.addEventListener('input', updateTotal);

        const cleanupAndResolve = (value) => {
            modal.remove();
            resolve(value);
        };

        confirmBtn.onclick = () => {
            const multiplier = parseInt(input.value, 10);
            cleanupAndResolve(multiplier > 0 ? multiplier : 1);
        };
        cancelBtn.onclick = () => cleanupAndResolve(null);
    });
}

/**
 * Mostra um alerta temporário no topo da tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {number} [duration=3000] Duração em milissegundos para exibir o alerta.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] O tipo de alerta (afeta a cor).
 */
export function showTopAlert(message, duration = 3000, type = 'info') {
    const container = document.getElementById('top-alert-container');
    if (!container) {
        console.error("Container de alerta superior não encontrado (#top-alert-container).");
        return;
    }

    const alertId = `top-alert-${Date.now()}`;
    const alertElement = document.createElement('div');
    alertElement.id = alertId;
    alertElement.className = `top-alert-message p-3 rounded-lg shadow-md text-sm font-medium flex items-center gap-2`;
    alertElement.style.flexDirection = 'column';

    let bgColor, textColor, iconClass;
    switch (type) {
        case 'success':
            bgColor = 'bg-green-600';
            textColor = 'text-white';
            iconClass = 'fas fa-check-circle';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            textColor = 'text-black';
            iconClass = 'fas fa-exclamation-triangle';
            break;
        case 'error':
            bgColor = 'bg-red-600';
            textColor = 'text-white';
            iconClass = 'fas fa-times-circle';
            break;
        default: // info
            bgColor = 'bg-blue-600';
            textColor = 'text-white';
            iconClass = 'fas fa-info-circle';
    }

    alertElement.classList.add(bgColor, textColor);
    alertElement.innerHTML = `
        <i class="${iconClass}"></i>
        <span style="text-align: center;">${message}</span>
    `;

    container.appendChild(alertElement);

    // Fade in
    requestAnimationFrame(() => {
        alertElement.classList.add('visible');
    });

    // Fade out and remove
    setTimeout(() => {
        alertElement.classList.remove('visible');
        setTimeout(() => {
            alertElement.remove();
        }, 300); // Tempo correspondente à transição CSS
    }, duration);
}
