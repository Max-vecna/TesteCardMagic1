import { getAspectRatio } from './settings_manager.js';

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

export async function renderFullSpellSheet(spellData, isModal) {
    const sheetContainer = document.getElementById('spell-sheet-container');
    if (!sheetContainer) return;

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

    // Usa a cor salva, com um fallback para cards antigos
    const predominantColor = spellData.predominantColor || { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' };

    const origin = isModal ?  "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(0.9);' : '';
    
    // Processar aumentos
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
    
    // Verifica se há dados para a barra de estatísticas
    const statsFields = ['execution', 'range', 'target', 'duration', 'resistencia'];
    const hasStatsInfo = statsFields.some(field => spellData[field]);
    let statsHtml = '';
    if (hasStatsInfo) {
        statsHtml = `
            <div class="grid grid-cols-5 gap-x-2 text-xs my-2 text-center text-gray-200">
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

    // Verifica se há dados para a barra do topo (círculo/mana)
    const hasTopBarInfo = (spellData.circle && spellData.circle > 0) || (spellData.manaCost && spellData.manaCost > 0);
    let topBarHtml = '';
    if (hasTopBarInfo) {
        const circleText = spellData.circle > 0 ? `${spellData.circle}º Círculo` : '';
        const manaText = spellData.manaCost > 0 ? `${spellData.manaCost} PM` : '';
        const separator = circleText && manaText ? ' - ' : '';
        topBarHtml = `<p class="text-sm font-medium">${circleText}${separator}${manaText}</p>`;
    }


    const sheetHtml = `
        <button id="close-spell-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "block": "none"};"><i class="fa-solid fa-xmark"></i></button>
        <div id="spell-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 96%; height: 96%; border: 3px solid ${predominantColor.color100};"></div>
            </div>
            
            <div class="mt-auto p-6 md:p-6 w-full text-left absolute bottom-0" style="background-color: ${predominantColor.color30}">
                <div class="sheet-card-text-panel">
                    ${topBarHtml}
                    <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-white">${spellData.name}</h2>
                
                    ${hasTopBarInfo || hasStatsInfo ? '<div class="sheet-card-divider"></div>' : ''}
                    ${statsHtml}
                    <div class="space-y-3 max-h-32 overflow-y-auto pr-2">
                        ${spellData.description ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6">${spellData.description || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${(spellData.enhance && spellData.type !== 'habilidade') ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Aprimorar</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6">${spellData.enhance || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${(spellData.true && spellData.type !== 'habilidade') ? `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">Verdadeiro</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6">${spellData.true || 'Nenhuma descrição.'}</p>
                            </div>
                        ` : ''}
                        ${aumentosHtml}
                    </div>
                </div>
            </div>            
        </div>
    `;

   
    if (!isModal) return sheetHtml;

    sheetContainer.innerHTML = sheetHtml;
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

