import { getAspectRatio } from './settings_manager.js';

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

export async function renderFullAttackSheet(attackData, isModal) {
    const sheetContainer = document.getElementById('attack-sheet-container');
    if (!sheetContainer) return '';

    const aspectRatio = isModal?  getAspectRatio() : 10/16;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalWidth, finalHeight;

    if ((windowWidth / aspectRatio) > windowHeight) {
        finalHeight = windowHeight * 0.9;
        finalWidth = finalHeight * aspectRatio;
    } else {
        finalWidth = windowWidth * 0.9;
        finalHeight = finalWidth / aspectRatio;
    }

    let createdObjectUrl = null;
    let imageUrl = 'https://placehold.co/400x400/b91c1c/fecaca?text=Ataque';
    if (attackData.image) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(attackData.image, attackData.imageMimeType));
        imageUrl = createdObjectUrl;
    }
    
    // Usa a cor salva, com um fallback para cards antigos
    const predominantColor = attackData.predominantColor || { color30: 'rgba(153, 27, 27, 0.3)', color100: 'rgb(153, 27, 27)' };
    
    const origin = isModal ? "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(0.9);' : '';
    const uniqueId = `attack-${attackData.id}-${Date.now()}`;

    const sheetHtml = `
        <button id="close-attack-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "block": "none"}"><i class="fa-solid fa-xmark"></i></button>
        <div id="attack-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 96%; height: 96%; border: 3px solid ${predominantColor.color100};"></div>
            </div>
            <div class="mt-auto p-6 md:p-6 w-full text-left absolute bottom-0" style="background-color: ${predominantColor.color30};">
                <div class="sheet-card-text-panel">
                    <div class="flex justify-between items-start">
                        <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-white pr-2">${attackData.name}</h2>
                    </div>
                    
                    <div class="sheet-card-divider"></div>

                    <div class="space-y-3 max-h-40 overflow-y-auto pr-2">
                        ${attackData.description ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space:pre-line;">${attackData.description}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>            
        </div>
    `;

    if (!isModal) {
        return sheetHtml;
    }

    sheetContainer.innerHTML = sheetHtml;
    sheetContainer.style.backgroundImage = `url(icons/fundo.png)`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    sheetContainer.classList.remove('hidden');
    setTimeout(() => sheetContainer.classList.add('visible'), 10);

    const closeSheet = () => {
        sheetContainer.classList.remove('visible');
        const handler = () => {
            sheetContainer.classList.add('hidden');
            sheetContainer.innerHTML = '';
            if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
            sheetContainer.removeEventListener('transitionend', handler);
        };
        sheetContainer.addEventListener('transitionend', handler);
    };

    const closeBtn = sheetContainer.querySelector(`#close-attack-sheet-btn-${uniqueId}`);
    if (closeBtn) {
        const newBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newBtn, closeBtn);
        newBtn.addEventListener('click', closeSheet);
    }
    
    const overlayHandler = (e) => {
        if (e.target === sheetContainer) {
            closeSheet();
            sheetContainer.removeEventListener('click', overlayHandler);
        }
    };
    sheetContainer.addEventListener('click', overlayHandler);
}

