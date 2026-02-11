import { getAspectRatio } from './settings_manager.js';
import { isCombatActive } from './navigation_manager.js';

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

export async function renderFullSpellSheet(spellData, isModal) {
    const sheetContainer = document.getElementById('spell-sheet-container');
    if (!sheetContainer) return;

    if(isModal)
    {  
        const index = document.getElementsByClassName('visible').length;
        console.log('Z-Index for character sheet modal/in-play:', index);
        sheetContainer.style.zIndex = 100000000 + index;
    }

    const aspectRatio = isModal?  getAspectRatio() : 10/16;

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

    let imageUrl;
    let createdObjectUrl = null;
    if (spellData.image) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(spellData.image, spellData.imageMimeType));
        imageUrl = createdObjectUrl;
    } else {
        imageUrl = 'https://placehold.co/400x400/00796B/B2DFDB?text=Magia';
    }
    sheetContainer.style.backgroundImage = `url(icons/fundo.png)`;    
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';

    const predominantColor = spellData.predominantColor || { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' };

    const origin = isModal ?  "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(0.9);' : '';
    
    let aumentosHtml = '';
    if (spellData.aumentos && spellData.aumentos.length > 0) {
        const aumentosFixos = spellData.aumentos.filter(a => a.tipo === 'fixo');
        const aumentosTemporarios = spellData.aumentos.filter(a => a.tipo === 'temporario');

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

    const uniqueId = `spell-${spellData.id}-${Date.now()}`;
    
    const statsFields = ['execution', 'range', 'target', 'duration', 'resistencia'];
    const hasStatsInfo = statsFields.some(field => spellData[field]);
    let statsHtml = '';
    if (hasStatsInfo) {
        statsHtml = `
            <div class="grid grid-cols-5 gap-x-2 text-xs mt-2 text-center text-gray-200">
                <div>
                    <p class="font-bold tracking-wider">EX</p>
                    <p class="text-gray-300 truncate" title="${spellData.execution || '-'}">${spellData.execution || '-'}</p>
                </div>
                <div>
                    <p class="font-bold tracking-wider">AL</p>
                    <p class="text-gray-300 truncate" title="${spellData.range || '-'}">${spellData.range || '-'}</p>
                </div>
                <div>
                    <p class="font-bold tracking-wider">AV</p>
                    <p class="text-gray-300 truncate" title="${spellData.target || '-'}">${spellData.target || '-'}</p>
                </div>
                <div>
                    <p class="font-bold tracking-wider">DU</p>
                    <p class="text-gray-300 truncate" title="${spellData.duration || '-'}">${spellData.duration || '-'}</p>
                </div>
                <div>
                    <p class="font-bold tracking-wider">CD</p>
                    <p class="text-gray-300 truncate" title="${spellData.resistencia || '-'}">${spellData.resistencia || '-'}</p>
                </div>
            </div>
        `;
    }

    const hasTopBarInfo = (spellData.circle && spellData.circle > 0) || (spellData.manaCost && spellData.manaCost > 0);
    let topBarHtml = '';
    if (hasTopBarInfo) {
        const circleText = spellData.circle > 0 ? `${spellData.circle}º Círculo` : '';
        const manaText = spellData.manaCost > 0 ? `${spellData.manaCost} PM` : '';
        const separator = circleText && manaText ? ' - ' : '';
        topBarHtml = `<p class="" style="font-size: 10px;">${circleText}${separator}${manaText}</p>`;
    }

    const hasTemporaryAumentos = spellData.aumentos && spellData.aumentos.some(a => a.tipo === 'temporario');
    const hasManaCost = spellData.manaCost && spellData.manaCost > 0;
    

    const sheetHtml = `
        <button id="close-spell-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "block": "none"};"><i class="fa-solid fa-xmark"></i></button>
        <div id="spell-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 100%; height: calc(100% - 20px); border: 3px solid ${predominantColor.color100}; margin: 10px;"></div>
            </div>
            
            <div class="w-full text-left absolute top-0 line-top" style="background-color: ${predominantColor.color30}; padding-top: 20px; padding-bottom: 10px; text-align: center; --minha-cor: ${predominantColor.color100};">
            <h3 class="font-bold tracking-tight text-white" style="font-size: 1.3rem">${spellData.name}</h3>
                ${topBarHtml}
            </div>

             <!-- CÍRCULO / ALVO INSERIDO AQUI -->
           <div class="circle-container">
                <div class="circle">
                    <div class="icon">🎯</div>
                </div>

                <div class="text" id="circularText"></div>
            </div>
            <!-- FIM DO CÍRCULO -->
            
            <div class="mt-auto p-6 pt-3 md:p-6 w-full text-left absolute bottom-0 line-bottom" style="background-color: ${predominantColor.color30}; --minha-cor: ${predominantColor.color100};">                
                <div class="sheet-card-text-panel">                      
                    <div class="space-y-3 overflow-y-auto pr-2" style="max-height: 12rem; height: 12rem">
                        ${spellData.description ? `
                            <div>
                                <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space: break-spaces;">${spellData.description || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${(spellData.enhance && spellData.type !== 'habilidade') ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Aprimorar</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space: break-spaces;">${spellData.enhance || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${(spellData.true && spellData.type !== 'habilidade') ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Verdadeiro</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space: break-spaces;">${spellData.true || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${aumentosHtml}
                    </div>
                    ${statsHtml}
                </div>
            </div>            
        </div>
    `;

   
    if (!isModal) return sheetHtml;

    sheetContainer.innerHTML = sheetHtml;
    sheetContainer.classList.remove('hidden');
    setTimeout(() => sheetContainer.classList.add('visible'), 10);

    const useBuffBtn = document.getElementById(`use-buff-btn-${uniqueId}`);
    if (useBuffBtn) {
        useBuffBtn.addEventListener('click', () => {
             document.dispatchEvent(new CustomEvent('useAbilityInCombat', { detail: { sourceItem: spellData } }));
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

    const closeSheetBtn = sheetContainer.querySelector(`#close-spell-sheet-btn-${uniqueId}`);
    if (closeSheetBtn) {
        const btn = closeSheetBtn.cloneNode(true);
        closeSheetBtn.parentNode.replaceChild(btn, closeSheetBtn);
        btn.addEventListener('click', closeSheet);
    }

    const overlayHandler = (e) => {
        if (e.target === sheetContainer) {
            closeSheet();
            sheetContainer.removeEventListener('click', overlayHandler);
        }
    };
    sheetContainer.addEventListener('click', overlayHandler);
}
