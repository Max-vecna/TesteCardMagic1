import { saveData, getData } from './local_db.js'; 
import { renderFullItemSheet } from './item_renderer.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { renderFullAttackSheet } from './attack_renderer.js';
import { getAspectRatio } from './settings_manager.js';

const PERICIAS_DATA = {
     "AGILIDADE": [ "Acrobacia", "Iniciativa", "Montaria", "Furtividade", "Pontaria", "Ladinagem", "Reflexos"],
        "CARISMA": ["Adestramento", "Enganação", "Intimidação", "Persuasão"],
        "INTELIGÊNCIA": ["Arcanismo", "História", "Investigação", "Ofício", "Religião", "Tecnologia"],
        "FORÇA": ["Atletismo", "Luta"],
        "SABEDORIA": ["Intuição", "Percepção", "Natureza", "Vontade", "Medicina", "Sobrevivência"],
        "VIGOR": ["Fortitude"]
};

const periciaToAttributeMap = {};
for (const attribute in PERICIAS_DATA) {
    PERICIAS_DATA[attribute].forEach(periciaName => {
        periciaToAttributeMap[periciaName] = attribute;
    });
}


function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

async function populateInventory(container, characterData, uniqueId) {
    const scrollArea = container.querySelector(`#inventory-magic-scroll-area-${uniqueId}`);
    if (!scrollArea) return;

    scrollArea.innerHTML = '<div class="p-4 text-center"><i class="fas fa-spinner fa-spin text-gray-400"></i></div>';

    // --- INVENTÁRIO ---
    let inventoryHtml = `<div><h4 class="font-bold text-amber-300 border-b border-amber-300/30 pb-1 mb-2 px-2">Inventário</h4>`;
    if (characterData.items && characterData.items.length > 0) {
        const itemPromises = characterData.items.map(id => getData('rpgItems', id));
        const items = (await Promise.all(itemPromises)).filter(Boolean);
        if (items.length > 0) {
            inventoryHtml += '<div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2">';
            items.forEach(item => {
                let iconHtml = '';
                if (item.image) {
                    const imageUrl = URL.createObjectURL(bufferToBlob(item.image, item.imageMimeType));
                    iconHtml = `<img src="${imageUrl}" class="w-5 h-5 rounded-full object-cover flex-shrink-0" style="image-rendering: pixelated;">`;
                } else {
                    iconHtml = `<i class="fas fa-box w-5 text-center text-gray-400"></i>`;
                }
                inventoryHtml += `
                    <div class="text-xs p-1 rounded hover:bg-white/10 cursor-pointer flex items-center gap-2 truncate" data-id="${item.id}" data-type="item" title="${item.name}">
                        ${iconHtml}
                        <span class="truncate">${item.name}</span>
                    </div>`;
            });
            inventoryHtml += '</div>';
        } else {
             inventoryHtml += '<p class="text-xs text-gray-400 italic px-2">Vazio</p>';
        }
    } else {
        inventoryHtml += '<p class="text-xs text-gray-400 italic px-2">Vazio</p>';
    }
    inventoryHtml += '</div>';

    // --- MAGIAS E HABILIDADES ---
    let magicsHtml = '';
    let skillsHtml = '';

    if (characterData.spells && characterData.spells.length > 0) {
        const magicPromises = characterData.spells.map(id => getData('rpgSpells', id));
        const magicsAndSkills = (await Promise.all(magicPromises)).filter(Boolean);

        const spells = magicsAndSkills.filter(ms => ms.type === 'magia' || !ms.type);
        const skills = magicsAndSkills.filter(ms => ms.type === 'habilidade');

        // --- MAGIAS ---
        magicsHtml = `<div><h4 class="font-bold text-teal-300 border-b border-teal-300/30 pb-1 mb-2 px-2">Magias</h4>`;
        if (spells.length > 0) {
            magicsHtml += '<div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2">';
            spells.forEach(magic => {
                let iconHtml = '';
                if (magic.image) {
                    const imageUrl = URL.createObjectURL(bufferToBlob(magic.image, magic.imageMimeType));
                    iconHtml = `<img src="${imageUrl}" class="w-5 h-5 rounded-full object-cover flex-shrink-0" style="image-rendering: pixelated;">`;
                } else {
                    iconHtml = `<i class="fas fa-magic w-5 text-center text-gray-400"></i>`;
                }
                magicsHtml += `
                    <div class="text-xs p-1 rounded hover:bg-white/10 cursor-pointer flex items-center gap-2 truncate" data-id="${magic.id}" data-type="spell" title="${magic.name}">
                        ${iconHtml}
                        <span class="truncate">${magic.name}</span>
                    </div>`;
            });
            magicsHtml += '</div>';
        } else {
            magicsHtml += '<p class="text-xs text-gray-400 italic px-2">Nenhuma</p>';
        }
        magicsHtml += '</div>';
        
        // --- HABILIDADES ---
        skillsHtml = `<div><h4 class="font-bold text-cyan-300 border-b border-cyan-300/30 pb-1 mb-2 px-2">Habilidades</h4>`;
        if (skills.length > 0) {
            skillsHtml += '<div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2">';
            skills.forEach(skill => {
                let iconHtml = '';
                if (skill.image) {
                    const imageUrl = URL.createObjectURL(bufferToBlob(skill.image, skill.imageMimeType));
                    iconHtml = `<img src="${imageUrl}" class="w-5 h-5 rounded-full object-cover flex-shrink-0" style="image-rendering: pixelated;">`;
                } else {
                    iconHtml = `<i class="fas fa-fist-raised w-5 text-center text-gray-400"></i>`;
                }
                skillsHtml += `
                    <div class="text-xs p-1 rounded hover:bg-white/10 cursor-pointer flex items-center gap-2 truncate" data-id="${skill.id}" data-type="spell" title="${skill.name}">
                        ${iconHtml}
                        <span class="truncate">${skill.name}</span>
                    </div>`;
            });
            skillsHtml += '</div>';
        } else {
            skillsHtml += '<p class="text-xs text-gray-400 italic px-2">Nenhuma</p>';
        }
        skillsHtml += '</div>';

    } else {
        magicsHtml = `<div><h4 class="font-bold text-teal-300 border-b border-teal-300/30 pb-1 mb-2 px-2">Magias</h4><p class="text-xs text-gray-400 italic px-2">Nenhuma</p></div>`;
        skillsHtml = `<div><h4 class="font-bold text-cyan-300 border-b border-cyan-300/30 pb-1 mb-2 px-2">Habilidades</h4><p class="text-xs text-gray-400 italic px-2">Nenhuma</p></div>`;
    }

    // --- ATAQUES ---
    let attacksHtml = '';
    if (characterData.attacks && characterData.attacks.length > 0) {
        const attackPromises = characterData.attacks.map(id => getData('rpgAttacks', id));
        const attacks = (await Promise.all(attackPromises)).filter(Boolean);

        attacksHtml = `<div><h4 class="font-bold text-red-400 border-b border-red-400/30 pb-1 mb-2 px-2">Ataques</h4>`;
        if (attacks.length > 0) {
            attacksHtml += '<div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2">';
            attacks.forEach(attack => {
                let iconHtml = '';
                if (attack.image) {
                    const imageUrl = URL.createObjectURL(bufferToBlob(attack.image, attack.imageMimeType));
                    iconHtml = `<img src="${imageUrl}" class="w-5 h-5 rounded-full object-cover flex-shrink-0" style="image-rendering: pixelated;">`;
                } else {
                    iconHtml = `<i class="fas fa-khanda w-5 text-center text-gray-400"></i>`;
                }
                attacksHtml += `
                    <div class="text-xs p-1 rounded hover:bg-white/10 cursor-pointer flex items-center gap-2 truncate" data-id="${attack.id}" data-type="attack" title="${attack.name}">
                        ${iconHtml}
                        <span class="truncate">${attack.name}</span>
                    </div>`;
            });
            attacksHtml += '</div>';
        } else {
            attacksHtml += '<p class="text-xs text-gray-400 italic px-2">Nenhum</p>';
        }
        attacksHtml += '</div>';
    } else {
         attacksHtml = `<div><h4 class="font-bold text-red-400 border-b border-red-400/30 pb-1 mb-2 px-2">Ataques</h4><p class="text-xs text-gray-400 italic px-2">Nenhum</p></div>`;
    }

    scrollArea.innerHTML = inventoryHtml + magicsHtml + skillsHtml + attacksHtml;

    scrollArea.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-id][data-type]');
        if (!target) return;

        const { id, type } = target.dataset;
        if (type === 'item') {
            const itemData = await getData('rpgItems', id);
            if (itemData) await renderFullItemSheet(itemData, true);
        } else if (type === 'spell') {
            const spellData = await getData('rpgSpells', id);
            if (spellData) await renderFullSpellSheet(spellData, true);
        } else if (type === 'attack') {
            const attackData = await getData('rpgAttacks', id);
            if (attackData) await renderFullAttackSheet(attackData, true);
        }
    });
}

function setupStatEditor(characterData, container) {
    const sheetContainer = container || document.getElementById('character-sheet-container');
    const modal = document.getElementById('stat-editor-modal');
    if (!sheetContainer || !modal) return;

    const modalContent = modal.querySelector('#stat-editor-content');
    const titleTextEl = modal.querySelector('#stat-editor-title-text');
    const iconEl = modal.querySelector('#stat-editor-icon');
    const inputEl = modal.querySelector('#stat-editor-value');
    const addBtn = modal.querySelector('#stat-editor-add-btn');
    const subtractBtn = modal.querySelector('#stat-editor-subtract-btn');
    const closeBtn = modal.querySelector('#stat-editor-close-btn');

    let currentStat = null;
    let statMax = Infinity;

    const STAT_CONFIG = {
        vida: { title: 'Vida', icon: 'fa-heart', color: 'text-red-400', border: 'border-red-500' },
        mana: { title: 'Mana', icon: 'fa-fire', color: 'text-blue-400', border: 'border-blue-500' },
        dinheiro: { title: 'Dinheiro', icon: 'fa-coins', color: 'text-amber-400', border: 'border-amber-500' }
    };

    const openModal = (type, max) => {
        currentStat = type;
        statMax = max;
        const config = STAT_CONFIG[type] || { title: type, icon: 'fa-edit', color: 'text-gray-400', border: 'border-gray-500' };
        
        Object.values(STAT_CONFIG).forEach(c => {
            modalContent.classList.remove(c.border);
            titleTextEl.parentElement.classList.remove(c.color);
        });

        modalContent.classList.add(config.border);
        titleTextEl.parentElement.classList.add(config.color);
        iconEl.className = `fas ${config.icon}`;
        titleTextEl.textContent = `Editar ${config.title}`;
        inputEl.value = '';
        inputEl.focus();

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };

    const updateStat = (amount) => {
        if (!currentStat || isNaN(amount)) return;
        let currentValue;

        if (currentStat === 'vida') {
            currentValue = characterData.attributes.vidaAtual;
            let newValue = Math.min(statMax, currentValue + amount);
            characterData.attributes.vidaAtual = Math.max(0, newValue);
            sheetContainer.querySelector('[data-stat-current="vida"]').textContent = characterData.attributes.vidaAtual;
        } else if (currentStat === 'mana') {
            currentValue = characterData.attributes.manaAtual;
             let newValue = Math.min(statMax, currentValue + amount);
            characterData.attributes.manaAtual = Math.max(0, newValue);
            sheetContainer.querySelector('[data-stat-current="mana"]').textContent = characterData.attributes.manaAtual;
        } else if (currentStat === 'dinheiro') {
            currentValue = characterData.dinheiro || 0;
            characterData.dinheiro = Math.max(0, currentValue + amount);
            sheetContainer.querySelector('[data-stat-current="dinheiro"]').textContent = characterData.dinheiro;
        }
        
        saveData('rpgCards', characterData);
        closeModal();
    };
    
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    const newSubtractBtn = subtractBtn.cloneNode(true);
    subtractBtn.parentNode.replaceChild(newSubtractBtn, subtractBtn);
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    newAddBtn.addEventListener('click', () => updateStat(Math.abs(parseInt(inputEl.value, 10) || 0)));
    newSubtractBtn.addEventListener('click', () => updateStat(-Math.abs(parseInt(inputEl.value, 10) || 0)));
    newCloseBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            closeModal();
        }
    });
    
    sheetContainer.querySelectorAll('[data-action="edit-stat"]').forEach(el => {
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', () => {
            const type = newEl.dataset.statType;
            const max = newEl.dataset.statMax ? parseInt(newEl.dataset.statMax, 10) : Infinity;
            openModal(type, max);
        });
    });
}


export async function renderFullCharacterSheet(characterData, isModal, isInPlay, targetContainer) {
    const sheetContainer = targetContainer || document.getElementById('character-sheet-container');
    if (!sheetContainer && (isModal || isInPlay)) return '';

    // If it's a modal or in-play view, we need to make the container visible first
    // to correctly calculate dimensions and apply animations.
    if (isModal || isInPlay) {
        sheetContainer.classList.remove('hidden');
    }

    const inventoryItems = characterData.items ? await Promise.all(characterData.items.map(id => getData('rpgItems', id))) : [];
    const magicItems = characterData.spells ? await Promise.all(characterData.spells.map(id => getData('rpgSpells', id))) : [];
    
    const totalFixedBonuses = {
        vida: 0, mana: 0, armadura: 0, esquiva: 0, bloqueio: 0, deslocamento: 0,
        agilidade: 0, carisma: 0, forca: 0, inteligencia: 0, sabedoria: 0, vigor: 0,
        pericias: {}
    };

    const allBonusSources = [...inventoryItems, ...magicItems].filter(Boolean);

    for (const source of allBonusSources) {
        if (Array.isArray(source.aumentos)) {
            for (const aumento of source.aumentos) {
                if (aumento.tipo === 'fixo') {
                    const statName = aumento.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (totalFixedBonuses.hasOwnProperty(statName)) {
                        totalFixedBonuses[statName] += (aumento.valor || 0);
                    } else {
                        totalFixedBonuses.pericias[aumento.nome] = (totalFixedBonuses.pericias[aumento.nome] || 0) + (aumento.valor || 0);
                    }
                }
            }
        }
    }
    
    let aspectRatio = isModal || isInPlay ? getAspectRatio() : 10/16;
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

    const imageUrl = characterData.image ? URL.createObjectURL(bufferToBlob(characterData.image, characterData.imageMimeType)) : 'https://placehold.co/800x600/4a5568/a0aec0?text=Personagem';
    const imageBack = characterData.backgroundImage ? URL.createObjectURL(bufferToBlob(characterData.backgroundImage, characterData.backgroundMimeType)) : URL.createObjectURL(bufferToBlob(characterData.image, characterData.imageMimeType));
    
    const uniqueId = `char-${characterData.id}-${Date.now()}`;
    // Usa a cor salva, com um fallback para cards antigos
    const predominantColor = characterData.predominantColor || { color100: '#4a5568' };


    const mainAttributes = ['agilidade', 'carisma', 'forca', 'inteligencia', 'sabedoria', 'vigor'];
    characterData.attributes = characterData.attributes || {};

    const attributeValues = mainAttributes.map(attr => (parseInt(characterData.attributes[attr]) || 0) + (totalFixedBonuses[attr] || 0));
    const maxAttributeValue = Math.max(...attributeValues, 1);
    const cdValue = 10 + (parseInt(characterData.level) || 0) + (parseInt(characterData.attributes.sabedoria) || 0) + (totalFixedBonuses.sabedoria || 0);
    const palette = { borderColor: predominantColor.color100 };

    const origin = isModal || isInPlay ? "" : "transform-origin: top left";
    
    const transformProp = (isModal || isInPlay)
    ? 'transform: scale(0.9);'
    : ''; // A escala para thumbnails será calculada e aplicada depois no navigation_manager.js

    
    let periciasHtml = '<p class="text-xs text-gray-400 italic px-2">Nenhuma perícia selecionada.</p>';
    const allPericias = {};
    if (characterData.attributes.pericias) {
        characterData.attributes.pericias.forEach(p => {
            allPericias[p.name] = { base: p.value, bonus: 0 };
        });
    }
    for (const pName in totalFixedBonuses.pericias) {
        if (!allPericias[pName]) {
            allPericias[pName] = { base: 0, bonus: totalFixedBonuses.pericias[pName] };
        } else {
            allPericias[pName].bonus += totalFixedBonuses.pericias[pName];
        }
    }
    const periciasForGrouping = Object.entries(allPericias).map(([name, values]) => ({ name, ...values }));

    if (periciasForGrouping.length > 0) {
        const groupedPericias = periciasForGrouping.reduce((acc, pericia) => {
            const attribute = periciaToAttributeMap[pericia.name] || 'OUTRAS';
            if (!acc[attribute]) acc[attribute] = [];
            acc[attribute].push(pericia);
            return acc;
        }, {});
        
        const sortedAttributes = Object.keys(groupedPericias).sort();
        periciasHtml = sortedAttributes.map(attribute => {
            const periciasList = groupedPericias[attribute].map(p => {
                const bonusHtml = p.bonus > 0 ? ` + ${p.bonus}` : '';
                return `<span class="text-xs text-gray-300">${p.name} ${p.base}<span class="text-green-400 font-semibold">${bonusHtml}</span>;</span>`;
            }).join(' ');
            return `<div class="text-left mt-1"><p class="text-xs font-bold text-gray-200 uppercase" style="font-size: 11px;">${attribute}</p><div class="flex flex-wrap gap-x-2 gap-y-1 mb-1">${periciasList}</div></div>`;
        }).join('');
    }

    const combatStats = { armadura: 'CA', esquiva: 'ES', bloqueio: 'BL', deslocamento: 'DL' };
    const combatStatsHtml = Object.entries(combatStats).map(([stat, label]) => {
        const baseValue = characterData.attributes[stat] || 0;
        const bonus = totalFixedBonuses[stat] || 0;
        const bonusHtml = bonus > 0 ? `<span class="text-green-400 font-bold ml-1">+${bonus}</span>` : '';
        const suffix = stat === 'deslocamento' ? 'm' : '';
        return `<div class="text-center">${label}<br>${baseValue}${suffix}${bonusHtml}</div>`;
    }).join('');
    
    let relationshipsHtml = '';
    if (characterData.relationships && characterData.relationships.length > 0) {
        const relatedCharsData = (await Promise.all(
            characterData.relationships.map(id => getData('rpgCards', id))
        )).filter(Boolean);

        if (relatedCharsData.length > 0) {
            const relationshipCardsHtml = await Promise.all(relatedCharsData.map(async (char) => {
                const miniSheetHtml = await renderFullCharacterSheet(char, false, false);
                return `
                    <div class="related-character-grid-item" data-id="${char.id}">
                        ${miniSheetHtml}
                    </div>
                `;
            }));

            relationshipsHtml = `
                <div id="relationships-grid-${uniqueId}" class="relationships-grid">
                     ${relationshipCardsHtml.join('')}
                </div>
            `;
        }
    }
    
    const sheetHtml = `
            <div class="absolute top-6 right-6 z-20 flex flex-col gap-2">
                 <button id="close-sheet-btn-${uniqueId}" class="bg-red-600 hover:text-white thumb-btn" style="display: ${isModal ? 'flex' : 'none'}"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="character-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">    
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 96%; height: 96%; border: 3px solid ${predominantColor.color100};"></div>
            </div>
            <div class="absolute top-6 right-4 p-2 rounded-full text-center cursor-pointer" data-action="edit-stat" data-stat-type="vida" data-stat-max="${(characterData.attributes.vida || 0) + (totalFixedBonuses.vida || 0)}">
                <i class="fas fa-heart text-red-500 text-5xl"></i>
                <div class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-xs pointer-events-none">
                    <span data-stat-current="vida">${characterData.attributes.vidaAtual || 0}</span>
                    <hr style="width: 15px;">
                    <span>
                        ${characterData.attributes.vida || 0}
                        ${totalFixedBonuses.vida > 0 ? `<span class="text-green-400 font-semibold"> + ${totalFixedBonuses.vida}</span>` : ''}
                    </span>
                </div>
            </div>
            <div class="absolute top-6 left-1/2 -translate-x-1/2 text-center z-10">
                <h3 class="text-2xl font-bold">${characterData.title}</h3>
                <p class="text-md italic text-gray-300">${characterData.subTitle}</p>
            </div>

            <div class="absolute top-6 left-4 p-2 rounded-full text-center cursor-pointer" data-action="edit-stat" data-stat-type="mana" data-stat-max="${(characterData.attributes.mana || 0) + (totalFixedBonuses.mana || 0)}">
                <div class="icon-container mana-icon-container">
                    <i class="fas fa-fire text-blue-500 text-5xl"></i>
                    <div class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-xs pointer-events-none">
                        <span data-stat-current="mana">${characterData.attributes.manaAtual || 0}</span>
                        <hr style="width: 15px;">
                        <span>
                           ${characterData.attributes.mana || 0}${totalFixedBonuses.mana > 0 ? `<span class="text-green-400 font-semibold"> + ${totalFixedBonuses.mana}</span>` : ''}
                        </span>
                    </div>
                </div>
            </div>    
            <div id="lore-icon-${uniqueId}" class="absolute  left-6 rounded-full p-3 bg-black/50 flex items-center justify-center text-lg text-yellow-200 cursor-pointer" data-action="toggle-lore" style="top:90px">
                <i class="fas fa-book" style="font-size: 14px;"></i>
            </div>
            <div class="absolute money-container top-32 left-6 rounded-full p-2 bg-black/50 flex items-center justify-center text-sm text-amber-300 font-bold cursor-pointer" data-action="edit-stat" data-stat-type="dinheiro" title="Alterar Dinheiro" style="writing-mode: vertical-rl; text-orientation: upright; top: 141px;">
                💰$<span data-stat-current="dinheiro">${characterData.dinheiro || 0}</span>
            </div>
            
            <div id="lore-modal-${uniqueId}" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 hidden transition-opacity duration-300">
                <div class="bg-gray-800 p-8 rounded-lg max-w-xl w-full text-white shadow-lg relative">
                    <button id="close-lore-modal-btn-${uniqueId}" class="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full leading-none w-8 h-8 flex items-center justify-center">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <h2 class="text-2xl font-bold mb-4 border-b pb-2">Lore do Personagem</h2>
                    <div id="lore-content" class="text-sm leading-relaxed overflow-y-auto max-h-96">
                        <h4>História</h4>
                        <p class="mb-4">${characterData.lore?.historia || "Nenhuma história definida."}</p>
                        <h4>Personalidade</h4>
                        <p class="mb-4">${characterData.lore?.personalidade || "Nenhuma personalidade definida."}</p>
                        <h4>Motivação</h4>
                        <p>${characterData.lore?.motivacao || "Nenhuma motivação definida."}</p>
                    </div>
                </div>
            </div>

            <div class="absolute bottom-0 w-full p-4">
                <!-- RELATIONSHIPS_BAR -->
                <div class="pb-4 scrollable-content text-sm text-left" style="display: flex; flex-direction: row; overflow-y: scroll;gap: 12px; scroll-snap-type: x mandatory;">
                    <!-- Página 1: Atributos -->
                    <div class="rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; border-color: ${palette.borderColor}; position: relative; z-index: 1; overflow-y: visible; display: flex; flex-direction: column; justify-content: flex-end;padding: 10px;">
                        <div class="grid grid-cols-6 gap-x-4 gap-y-1 text-xs my-2 mb-4">
                            <div class="text-center font-bold" style="color: rgb(0 247 85);">LV<br>${characterData.level || 0}</div>
                            ${combatStatsHtml}
                            <div class="text-center">CD<br>${cdValue}</div>                            
                        </div>
                        ${mainAttributes.map(key => {
                        const baseValue = parseInt(characterData.attributes[key]) || 0;
                        const bonus = totalFixedBonuses[key] || 0;
                        const bonusHtml = bonus > 0 ? ` + ${bonus}` : '';
                        const totalValue = baseValue + bonus;
                        const percentage = maxAttributeValue > 0 ? (totalValue * 100) / maxAttributeValue : 0;
                        return `
                        <div class="mt-2 flex items-center space-x-2 text-xs">
                            <span class="font-bold w-8">${key.slice(0, 3).toUpperCase()}</span>
                            <div class="stat-bar flex-grow rounded-3xl" style="margin-top: 0">
                                <div class="stat-fill h-full rounded-3xl" style="width: ${percentage}%; background: ${palette.borderColor}"></div>
                            </div>
                            <span class="text-xs font-bold ml-auto">${baseValue}<span class="text-green-400 font-semibold">${bonusHtml}</span></span>
                        </div>
                        `;
                        }).join('')}
                    </div>
                    <!-- Página 2: Perícias -->
                    <div class="pb-4 rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; border-color: ${palette.borderColor}; position: relative; z-index: 1; overflow-y: visible; display: flex; flex-direction: column; justify-content: flex-end;">
                        <div class="pericias-scroll-area flex flex-col gap-2 px-2" style="overflow-y: auto; max-height: 170px;">
                            ${periciasHtml}
                        </div>
                    </div>
                    <!-- Página 3: Inventário & Magias -->
                    <div class="pb-4 rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                        <div id="inventory-magic-scroll-area-${uniqueId}" class="space-y-2" style="overflow-y: auto; max-height: 170px;">
                        </div>
                    </div>
                </div>
            </div>
             
        </div>
    `;
    
    const finalHtml = sheetHtml.replace('<!-- RELATIONSHIPS_BAR -->', relationshipsHtml);

    // if (!isModal && !isInPlay) {
    //     const inventoryCount = characterData.items?.length || 0;
    //     const magicCount = characterData.spells?.length || 0;
    //     const attackCount = characterData.attacks?.length || 0;
    //     const thumbnailInventoryHtml = `
    //         <div class="absolute top-20 right-4 flex flex-col items-end text-xs opacity-80 bg-black/50 p-1 rounded">
    //             <div class="flex items-center gap-1"><i class="fas fa-box"></i> ${inventoryCount}</div>
    //             <div class="flex items-center gap-1"><i class="fas fa-magic"></i> ${magicCount}</div>
    //             <div class="flex items-center gap-1"><i class="fas fa-khanda"></i> ${attackCount}</div>
    //         </div>
    //     `;
    //     return finalHtml.replace('<!-- THUMBNAIL_EXTRAS -->', thumbnailInventoryHtml);
    // }
    
    sheetContainer.style.background = `url('${imageBack}')`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    sheetContainer.style.boxShadow = 'inset 0px 0px 10px 0px black';
    sheetContainer.innerHTML = finalHtml;

    if (isInPlay) {
        sheetContainer.classList.add('in-play-animation');
    }
    
    const relationshipsGrid = sheetContainer.querySelector(`#relationships-grid-${uniqueId}`);
    if (relationshipsGrid) {
        relationshipsGrid.addEventListener('click', (e) => {
            // Only toggle if the click is on the grid background itself, not a card item
            if (e.target === relationshipsGrid) {
                relationshipsGrid.classList.toggle('expanded');
            }
        });
    }

    sheetContainer.querySelectorAll('.related-character-grid-item').forEach(card => {
        card.addEventListener('click', async (e) => {
            e.stopPropagation();
            const grid = card.parentElement;

            // If the grid is not expanded, expand it.
            if (!grid.classList.contains('expanded')) {
                grid.classList.add('expanded');
            } else {
            // If it's already expanded, the click means "view character".
                const relatedCharData = await getData('rpgCards', card.dataset.id);
                if (relatedCharData) {
                    const nestedContainer = document.getElementById('nested-sheet-container');
                    await renderFullCharacterSheet(relatedCharData, true, false, nestedContainer);
                }
            }
        });
    });
    
   setTimeout(() => {
    sheetContainer.querySelectorAll('.related-character-grid-item').forEach(item => {
        const charSheet = item.querySelector('[id^="character-sheet-"]');
        if (charSheet) {
            const { width, height } = charSheet.getBoundingClientRect();
            item.style.width = `${width}px`;
            item.style.height = `${height}px`;
        }
    });
}, 50);


    populateInventory(sheetContainer, characterData, uniqueId);

    // A classe 'hidden' já foi removida no início da função para os modais.
    // Agora apenas adicionamos 'visible' para acionar a animação de fade-in.
    if (isModal || isInPlay) {
        setTimeout(() => sheetContainer.classList.add('visible'), 10);
    }

    const loreIcon = sheetContainer.querySelector(`#lore-icon-${uniqueId}`);
    const loreModal = sheetContainer.querySelector(`#lore-modal-${uniqueId}`);
    const closeLoreModalBtn = sheetContainer.querySelector(`#close-lore-modal-btn-${uniqueId}`);
    const closeSheetBtn = sheetContainer.querySelector(`#close-sheet-btn-${uniqueId}`);

    const closeSheet = () => {
        sheetContainer.classList.remove('visible');
        const handler = () => {
            sheetContainer.classList.add('hidden');
            sheetContainer.innerHTML = '';
            if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
            if (imageBack.startsWith('blob:')) URL.revokeObjectURL(imageBack);
            sheetContainer.removeEventListener('transitionend', handler);
        };
        sheetContainer.addEventListener('transitionend', handler);
    };

    if (loreIcon && loreModal && closeLoreModalBtn) {
        loreIcon.addEventListener('click', () => loreModal.classList.remove('hidden'));
        closeLoreModalBtn.addEventListener('click', () => loreModal.classList.add('hidden'));
    }

    if (closeSheetBtn) {
        if (isInPlay) {
            closeSheetBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('navigateHome'));
            });
        } else {
            closeSheetBtn.addEventListener('click', closeSheet);
        }
    }
    
    sheetContainer.addEventListener('click', (e) => {
        if (e.target === sheetContainer && !targetContainer) {
            closeSheet();
        }
    });

    if (isModal || isInPlay) {
        setupStatEditor(characterData, sheetContainer);
    }
    return finalHtml;
}

