// settings_manager.js

const DEFAULT_ASPECT_RATIO = 16 / 10;
const ASPECT_RATIO_KEY = 'cardAspectRatio';

/**
 * Gets the saved aspect ratio from localStorage.
 * @returns {number} The aspect ratio.
 */
export function getAspectRatio() {
    const savedRatio = localStorage.getItem(ASPECT_RATIO_KEY);
    // Ensure that if the saved value is invalid, we fall back to the default.
    const parsedRatio = savedRatio ? parseFloat(savedRatio) : DEFAULT_ASPECT_RATIO;
    return !isNaN(parsedRatio) && parsedRatio > 0 ? parsedRatio : DEFAULT_ASPECT_RATIO;
}

/**
 * Saves a new aspect ratio to localStorage.
 * @param {number} ratio - The aspect ratio to save.
 */
function saveAspectRatio(ratio) {
    if (typeof ratio === 'number' && !isNaN(ratio) && ratio > 0) {
        localStorage.setItem(ASPECT_RATIO_KEY, ratio);
        // Dispatch an event so other parts of the app can react
        document.dispatchEvent(new CustomEvent('settingsChanged', { detail: { key: 'aspectRatio' } }));
    }
}

/**
 * Parses a string like "16x9" or "16:9" into a numeric ratio.
 * @param {string} input - The string to parse.
 * @returns {number|null} The calculated ratio or null if invalid.
 */
function parseAspectRatioString(input) {
    if (!input) return null;
    const parts = input.trim().split(/[:x/]/);
    if (parts.length === 2) {
        const width = parseFloat(parts[0]);
        const height = parseFloat(parts[1]);
        if (!isNaN(width) && !isNaN(height) && height > 0 && width > 0) {
            return width / height;
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('aspect-ratio-modal');
    if (!modal) return;

    const openBtns = document.querySelectorAll('#aspect-ratio-btn, #aspect-ratio-btn-mobile');
    const closeBtn = document.getElementById('aspect-ratio-close-btn');
    const optionBtns = document.querySelectorAll('.aspect-ratio-option');
    const customInput = document.getElementById('custom-aspect-ratio');
    const saveBtn = document.getElementById('save-aspect-ratio-btn');

    const openModal = () => {
        const currentRatio = getAspectRatio();
        // Clear previous state
        optionBtns.forEach(btn => btn.classList.remove('bg-indigo-600'));
        customInput.value = '';
        
        // Highlight the current option if it's a preset
        const currentOption = Array.from(optionBtns).find(btn => parseFloat(btn.dataset.aspect).toFixed(4) === currentRatio.toFixed(4));
        if(currentOption) {
            currentOption.classList.add('bg-indigo-600');
        }

        modal.classList.remove('hidden');
    };
    const closeModal = () => modal.classList.add('hidden');

    openBtns.forEach(btn => btn.addEventListener('click', openModal));
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const ratio = parseFloat(btn.dataset.aspect);
            saveAspectRatio(ratio);
            closeModal();
        });
    });

    saveBtn.addEventListener('click', () => {
        const customRatio = parseAspectRatioString(customInput.value);
        if (customRatio) {
            saveAspectRatio(customRatio);
            closeModal();
        } else if (customInput.value.trim() !== '') {
            // Only show alert if user typed something invalid
            alert('Formato inválido. Use "largura x altura" ou "largura:altura", por exemplo "16x9".');
        }
    });
});
