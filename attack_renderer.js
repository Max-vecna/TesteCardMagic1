import { getAspectRatio } from './settings_manager.js';
import { isCombatActive } from './navigation_manager.js';

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

export async function renderFullAttackSheet(attackData, isModal) {
    const sheetContainer = document.getElementById('attack-sheet-container');
    if (!sheetContainer) return '';

    if(isModal)
    {  
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

    let createdObjectUrl = null;
    let imageUrl = 'https://placehold.co/400x400/b91c1c/fecaca?text=Ataque';
    if (attackData.image) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(attackData.image, attackData.imageMimeType));
        imageUrl = createdObjectUrl;
    }
    
    const predominantColor = attackData.predominantColor || { color30: 'rgba(153, 27, 27, 0.3)', color100: 'rgb(153, 27, 27)' };
    const origin = isModal ? "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(0.9);' : '';
    const uniqueId = `attack-${attackData.id}-${Date.now()}`;

    // Modificado para suportar Acerto/Dano Sem Mana em Ataques

    const attackStats = { acerto: 'ATK', critico: 'ATK s/Mana', dano: 'DMG', danoSemMana: 'DMG s/Mana'};
     // Gera HTML para Acerto e Dano (Novo Card)
    const attackStatsHtml = Object.entries(attackStats).map(([stat, label]) => 
    {
        const baseValue = attackData[stat] || 0;
        const content = baseValue || '-';
        const colorStyle =  predominantColor.color30 ; //dano em criatura sem mana


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

    const sheetHtml = `
        <button id="close-attack-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "flex": "none"};">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div id="attack-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center; box-shadow: inset 0px 0px 5px black;">
                <div class="rounded-lg" style="width: 100%; height: calc(100% - 20px); border: 3px solid ${predominantColor.color100}; margin: 10px; box-shadow: inset 0px 0px 5px black, 0px 0px 5px black;"></div>
            </div>
            
            <div class="w-full text-left absolute top-0 line-top pt-[20px] pb-[10px]" style="background-color: ${predominantColor.color30}; text-align: center; --minha-cor: ${predominantColor.color100};">
                <h3 class="font-bold tracking-tight text-white" style="font-size: 1.3rem">${attackData.name}</h3>
            </div>
            
            <div class="mt-auto w-full text-left absolute bottom-0 z-20">                          
                <div class="p-6 pt-3 md:p-6 sheet-card-text-panel line-bottom" style="background-color: ${predominantColor.color30}; --minha-cor: ${predominantColor.color100};">
                    ${attackData.description ? `
                        <div>
                            <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                            <p class="text-gray-300 text-xs leading-relaxed mt-1" style="white-space:pre-line;text-align: justify;">${attackData.description}</p>
                        </div>
                    ` : ''}
                    <div class="flex row mt-2 pt-2" style="justify-content: space-around; border-top: 1px solid ${predominantColor.color100};">
                        ${attackStatsHtml}  
                    </div>
                </div>
            </div>            
        </div>       
    `;

    if (!isModal) return sheetHtml;

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