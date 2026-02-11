import { getAspectRatio } from './settings_manager.js';
import { isCombatActive } from './navigation_manager.js';

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

export async function renderFullItemSheet(itemData, isModal) {
    const sheetContainer = document.getElementById('item-sheet-container');
    if (!sheetContainer) return '';

    const aspectRatio = isModal?  getAspectRatio() : 10/16;

    if(isModal)
    {  
        const index = document.getElementsByClassName('visible').length;
        console.log('Z-Index for character sheet modal/in-play:', index);
        sheetContainer.style.zIndex = 100000000 + index;
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalWidth;
    let finalHeight;

    if ((windowWidth / aspectRatio) > windowHeight) {
        finalHeight = windowHeight * 0.9;
        finalWidth = finalHeight * aspectRatio;
    } else {
        finalWidth = windowWidth * 0.9;
        finalHeight = finalWidth / aspectRatio;
    }

    let createdObjectUrl = null;
    let imageUrl = 'https://placehold.co/400x400/a0522d/ffffff?text=Item';
    if (itemData.image) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(itemData.image, itemData.imageMimeType));
        imageUrl = createdObjectUrl;
    }
    sheetContainer.style.backgroundImage = `url(icons/fundo.png)`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    
    const predominantColor = itemData.predominantColor || { color30: 'rgba(217, 119, 6, 0.3)', color100: 'rgb(217, 119, 6)' };
    
    const origin = isModal ? "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(.9);' : '';
    const uniqueId = `item-${itemData.id}-${Date.now()}`;

    const details = [
        { label: 'Tipo', value: itemData.type },
        { label: 'Dano', value: itemData.damage },
        { label: 'Carga', value: itemData.charge },
        { label: 'Pré-requisito', value: itemData.prerequisite }
    ].filter(d => d.value);

    let detailsHtml = '';
    if (details.length > 0) {
        detailsHtml = `
            <div class="pt-2">
                <h3 class="text-sm font-semibold flex items-center gap-2">Detalhes</h3>
                <div class="text-gray-300 text-xs leading-relaxed mt-1 pl-6 space-y-1" style="white-space: break-spaces;">
                    <ul class="list-disc list-inside">
                        ${details.map(d => `<li><span class="font-semibold">${d.label}:</span> ${d.value}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    let aumentosHtml = '';
    const hasTemporaryAumentos = itemData.aumentos && itemData.aumentos.some(a => a.tipo === 'temporario');
    if (itemData.aumentos && itemData.aumentos.length > 0) {
        const aumentosFixos = itemData.aumentos.filter(a => a.tipo === 'fixo');
        const aumentosTemporarios = itemData.aumentos.filter(a => a.tipo === 'temporario');

        const createList = (list, title, color) => {
            if (list.length === 0) return '';
            const items = list.map(a => `<li><span class="font-semibold">${a.nome}:</span> ${a.valor > 0 ? '+' : ''}${a.valor}</li>`).join('');
            return `<div class="mb-2"><h5 class="font-bold text-sm ${color}">${title}</h5><ul class="list-disc list-inside text-xs">${items}</ul></div>`;
        };
        
        aumentosHtml = `
            <div class="pt-2">
                <h3 class="text-sm font-semibold flex items-center gap-2">Aumentos</h3>
                <div class="text-gray-300 text-xs leading-relaxed mt-1 pl-6 space-y-1">
                    ${createList(aumentosFixos, 'Bônus Fixos', 'text-green-300')}
                    ${createList(aumentosTemporarios, 'Bônus Temporários', 'text-blue-300')}
                </div>
            </div>
        `;
    }

    const useBuffButtonHtml = isCombatActive() && hasTemporaryAumentos ? `
        <button id="use-buff-btn-${uniqueId}" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors z-20">
            Usar
        </button>
    ` : '';

    const sheetHtml = `
        <button id="close-item-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "block": "none"}"><i class="fa-solid fa-xmark"></i></button>
        <div id="item-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            ${useBuffButtonHtml}
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 96%; height: 96%; border: 3px solid ${predominantColor.color100};"></div>
            </div>
            <div class="mt-auto p-6 md:p-6 w-full text-left absolute bottom-0" style="background-color: ${predominantColor.color30};">
                <div class="sheet-card-text-panel">
                    <div class="flex justify-between items-start">
                        <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-white pr-2">${itemData.name}</h2>
                    </div>
                    
                    <div class="sheet-card-divider"></div>

                    <div class="space-y-3 max-h-40 overflow-y-auto pr-2">
                        ${itemData.effect ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space:pre-line;">${itemData.effect}</p>
                            </div>
                        ` : ''}
                        
                        ${detailsHtml}
                        ${aumentosHtml}
                    </div>
                </div>
            </div>            
        </div>
    `;

    if (!isModal) {
        return sheetHtml;
    }

    sheetContainer.innerHTML = sheetHtml;
    sheetContainer.classList.remove('hidden');
    setTimeout(() => sheetContainer.classList.add('visible'), 10);

    const useBuffBtn = document.getElementById(`use-buff-btn-${uniqueId}`);
    if (useBuffBtn) {
        useBuffBtn.addEventListener('click', () => {
             document.dispatchEvent(new CustomEvent('useAbilityInCombat', { detail: { sourceItem: itemData } }));
        });
    }

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

    const closeBtn = sheetContainer.querySelector(`#close-item-sheet-btn-${uniqueId}`);
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
