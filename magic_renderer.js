import { getAspectRatio } from './settings_manager.js';
import { bufferToBlob } from './ui_utils.js';

export async function renderFullSpellSheet(spellData, isModal) {
    const sheetContainer = document.getElementById('spell-sheet-container');
    if (!sheetContainer) return;

    if(isModal) {  
        const index = document.getElementsByClassName('visible').length;
        sheetContainer.style.zIndex = 100000000 + index;
    }

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

    let mainImageUrl;
    let createdMainObjectUrl = null;
    if (spellData.image) {
        createdMainObjectUrl = URL.createObjectURL(bufferToBlob(spellData.image, spellData.imageMimeType));
        mainImageUrl = createdMainObjectUrl;
    } else {
        mainImageUrl = 'https://placehold.co/400x400/00796B/B2DFDB?text=Magia';
    }

    let enhanceImageUrl = null;
    let createdEnhanceObjectUrl = null;
    if (spellData.enhanceImage) {
        createdEnhanceObjectUrl = URL.createObjectURL(bufferToBlob(spellData.enhanceImage, spellData.enhanceImageMimeType));
        enhanceImageUrl = createdEnhanceObjectUrl;
    }

    let trueImageUrl = null;
    let createdTrueObjectUrl = null;
    if (spellData.trueImage) {
        createdTrueObjectUrl = URL.createObjectURL(bufferToBlob(spellData.trueImage, spellData.trueImageMimeType));
        trueImageUrl = createdTrueObjectUrl;
    }

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
            <div class="pt-2 scroll-section" data-bg-type="main">
                <h3 class="text-sm font-semibold flex items-center gap-2">Aumentos</h3>
                <div class="text-gray-300 text-xs leading-relaxed mt-1 space-y-1">
                    ${createList(aumentosFixos, 'Bônus Fixos', 'text-green-300')}
                    ${createList(aumentosTemporarios, 'Bônus Temporários (Informativo)', 'text-blue-300')}
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
                <div><p class="font-bold tracking-wider">EX</p><p class="text-gray-300 truncate">${spellData.execution || '-'}</p></div>
                <div><p class="font-bold tracking-wider">AL</p><p class="text-gray-300 truncate">${spellData.range || '-'}</p></div>
                <div><p class="font-bold tracking-wider">AV</p><p class="text-gray-300 truncate">${spellData.target || '-'}</p></div>
                <div><p class="font-bold tracking-wider">DU</p><p class="text-gray-300 truncate">${spellData.duration || '-'}</p></div>
                <div><p class="font-bold tracking-wider">CD</p><p class="text-gray-300 truncate">${spellData.resistencia || '-'}</p></div>
            </div>
        `;
    }

    const topBarHtml = (spellData.circle > 0 || spellData.manaCost > 0) 
        ? `<p style="font-size: 10px;">${spellData.circle > 0 ? `${spellData.circle}º Círculo` : ''}${spellData.circle > 0 && spellData.manaCost > 0 ? ' - ' : ''}${spellData.manaCost > 0 ? `${spellData.manaCost} PM` : ''}</p>`
        : '';

    const enhanceDataAttr = enhanceImageUrl ? `data-bg-image="${enhanceImageUrl}"` : '';
    const trueDataAttr = trueImageUrl ? `data-bg-image="${trueImageUrl}"` : '';

    // Modificado para suportar Acerto/Dano Sem Mana
    const attackStats = { acerto: 'ATK', critico: 'ATK s/Mana', dano: 'DMG', danoSemMana: 'DMG s/Mana'};
    // Gera HTML para Acerto e Dano (Novo Card)
    const attackStatsHtml = Object.entries(attackStats).map(([stat, label]) => 
    {
        const baseValue = spellData[stat] || 0;
        const content = baseValue || '-';

        const icon = stat === 'acerto' ? 'fa-dice-d20' : //dado
                     stat === 'dano' ? 'fas fa-fire' :  //dano em criatura com mana
                     stat === 'critico' ? 'fa-crosshairs' : //critico
                     stat === 'danoSemMana' ? 'fa-skull' : ""; //dano em criatura sem mana

        return `
            <div style="position: relative; transform: scale(.8); display: ${content === "-" ? 'none' : 'block'}" class="flex flex-col items-center flex">
                <i class="fas ${icon} text-5xl" style="background: ${predominantColor.color100}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-white text-xs pointer-events-none" style="margin: auto;">
                    <div class="text-center text-sm">
                        <span class="font-bold">
                            ${content.split("+")[0] || ""}
                        </span>
                        <hr style="width: 100%;">
                        <span style="bottom: 12px;" class="font-bold">
                            +${content.split("+")[1] || ""}
                        </span>
                    </div>
                </div>
            </div> `;
    }).join('');

    const textLabel = { description: 'Descrição', enhance: 'Aprimorar', true: 'Verdadeiro'};
    const textLabelHtml = Object.entries(textLabel).map(([stat, label]) => 
    {
        const baseValue = spellData[stat] || 0;
        const content = baseValue || '-';

        return `
            <div class="scroll-section" data-bg-type="main" style="${content === '-' ? 'display: none;' : ''}"}>
                <h3 class="text-sm font-semibold flex items-center gap-2">${label}</h3>
                <p class="text-gray-300 text-xs leading-relaxed mt-1" style="white-space: break-spaces;text-align: justify;">${content}</p>
            </div>`;
    }).join('');

    const sheetHtml = `
        <button id="close-spell-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-50 thumb-btn" style="display:${isModal? "block": "none"};">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div id="spell-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white transition-all duration-500" style="${origin}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto; box-shadow: 0 0 20px ${predominantColor.color100}; background-color: #1a1a1a;">        
            
            <div id="spell-bg-1-${uniqueId}" class="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-700 ease-in-out" style="background-image: url('${mainImageUrl}'); z-index: 0; opacity: 1;"></div>
            <div id="spell-bg-2-${uniqueId}" class="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-700 ease-in-out" style="background-image: url('${mainImageUrl}'); z-index: 0; opacity: 0;"></div>

            <div class="absolute inset-0 w-full h-full z-10" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center; pointer-events: none;box-shadow: inset 0px 0px 5px black; ">
                <div class="rounded-lg" style="width: 100%; height: calc(100% - 20px); border: 3px solid ${predominantColor.color100}; margin: 10px;box-shadow: inset 0px 0px 5px black, 0px 0px 5px black;"></div>
            </div>
            
            <div class="w-full text-left absolute top-0 line-top z-20 pt-[20px] pb-[10px]" style="background-color: ${predominantColor.color30}; text-align: center; --minha-cor: ${predominantColor.color100};">
                <h3 class="font-bold tracking-tight text-white" style="font-size: 1.3rem">${spellData.name}</h3>
                ${topBarHtml}
            </div>
             
            <div class="mt-auto  w-full text-left absolute bottom-0 z-20">                              
                <div class="p-6 pt-3 md:p-6 sheet-card-text-panel line-bottom" style="background-color: ${predominantColor.color30}; --minha-cor: ${predominantColor.color100};">                      
                    <div id="spell-scroll-container-${uniqueId}" class="space-y-3 overflow-y-auto custom-scrollbar" style="max-height: 12rem; height: 12rem">                       
                        ${textLabelHtml}
                        
                        ${aumentosHtml}
                    </div>
                    <div class="flex row mt-2 pt-2" style="justify-content: space-around;  border-top: 1px solid ${predominantColor.color100};">
                        ${attackStatsHtml}  
                    </div>
                    ${statsHtml}
                    
                </div>
            </div>            
        </div>
    `;

    if (!isModal) return sheetHtml;

    sheetContainer.innerHTML = sheetHtml;
    sheetContainer.style.backgroundImage = `url(icons/fundo.png)`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    
    sheetContainer.style.transition = 'opacity 0.4s ease-out';
    sheetContainer.style.opacity = '0';
    sheetContainer.classList.remove('hidden');
    
    setTimeout(() => {
        sheetContainer.classList.add('visible');
        sheetContainer.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        const scrollContainer = document.getElementById(`spell-scroll-container-${uniqueId}`);
        const bg1 = document.getElementById(`spell-bg-1-${uniqueId}`);
        const bg2 = document.getElementById(`spell-bg-2-${uniqueId}`);
        
        let currentBgUrl = mainImageUrl;
        let activeLayer = 1;

        if (scrollContainer && bg1 && bg2) {
            scrollContainer.addEventListener('scroll', () => {
                const sections = scrollContainer.querySelectorAll('.scroll-section');
                const containerRect = scrollContainer.getBoundingClientRect();
                const triggerPoint = containerRect.top + (containerRect.height / 3);

                let activeSection = null;
                sections.forEach(section => {
                    const rect = section.getBoundingClientRect();
                    if (rect.top <= triggerPoint && rect.bottom >= triggerPoint) {
                        activeSection = section;
                    }
                });

                if (activeSection) {
                    const bgType = activeSection.dataset.bgType;
                    const sectionImage = activeSection.dataset.bgImage;
                    
                    let targetImage = mainImageUrl;
                    if ((bgType === 'enhance' || bgType === 'true') && sectionImage) {
                        targetImage = sectionImage;
                    }

                    if (targetImage !== currentBgUrl) {
                        currentBgUrl = targetImage;
                        if (activeLayer === 1) {
                            bg2.style.backgroundImage = `url('${targetImage}')`;
                            bg2.style.opacity = '1';
                            bg1.style.opacity = '0';
                            activeLayer = 2;
                        } else {
                            bg1.style.backgroundImage = `url('${targetImage}')`;
                            bg1.style.opacity = '1';
                            bg2.style.opacity = '0';
                            activeLayer = 1;
                        }
                    }
                }
            });
        }
    }, 200);

    const closeSheet = () => {
        sheetContainer.classList.remove('visible');
        sheetContainer.style.opacity = '0'; 
        const handler = () => {
            sheetContainer.classList.add('hidden');
            sheetContainer.innerHTML = '';
            if (createdMainObjectUrl) URL.revokeObjectURL(createdMainObjectUrl);
            if (createdEnhanceObjectUrl) URL.revokeObjectURL(createdEnhanceObjectUrl);
            if (createdTrueObjectUrl) URL.revokeObjectURL(createdTrueObjectUrl);
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