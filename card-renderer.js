import { getData, saveData } from './local_db.js';
import { renderFullItemSheet } from './item_renderer.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { renderFullAttackSheet } from './attack_renderer.js';
import { getAspectRatio } from './settings_manager.js';
import { bufferToBlob, showCustomAlert } from './ui_utils.js'; // Importando de ui_utils

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

function calculateBonuses(characterData, inventoryItems, magicItems) {
    const totalFixedBonuses = {
        vida: 0, mana: 0, armadura: 0, esquiva: 0, bloqueio: 0, deslocamento: 0,
        agilidade: 0, carisma: 0, forca: 0, inteligencia: 0, sabedoria: 0, vigor: 0,
        pericias: {}
    };

    [...inventoryItems, ...magicItems].filter(Boolean).forEach(source => {
        if (Array.isArray(source.aumentos)) {
            source.aumentos.forEach(aumento => {
                if (aumento.tipo === 'fixo') {
                    const statName = (aumento.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (totalFixedBonuses.hasOwnProperty(statName)) {
                        totalFixedBonuses[statName] += (aumento.valor || 0);
                    } else {
                        totalFixedBonuses.pericias[aumento.nome] = (totalFixedBonuses.pericias[aumento.nome] || 0) + (aumento.valor || 0);
                    }
                }
            });
        }
    });

    return { totalFixedBonuses };
}

export async function updateStatDisplay(sheetContainer, characterData) {
    if (!sheetContainer || !characterData) return;

    const inventoryItems = characterData.items ? (await Promise.all(characterData.items.map(id => getData('rpgItems', id)))).filter(Boolean) : [];
    const magicItems = characterData.spells ? (await Promise.all(characterData.spells.map(id => getData('rpgSpells', id)))).filter(Boolean) : [];
    const { totalFixedBonuses } = calculateBonuses(characterData, inventoryItems, magicItems);

    const permanentMaxVida = (characterData.attributes.vida || 0) + (totalFixedBonuses.vida || 0);
    const permanentMaxMana = (characterData.attributes.mana || 0) + (totalFixedBonuses.mana || 0);

    const vidaEl = sheetContainer.querySelector('[data-stat-current="vida"]');
    if (vidaEl) vidaEl.textContent = characterData.attributes.vidaAtual || 0;
    
    const vidaMaxContainer = sheetContainer.querySelector('[data-stat-type="vida"]');
    if (vidaMaxContainer) {
        vidaMaxContainer.dataset.statMax = permanentMaxVida;
        const vidaMaxEl = vidaMaxContainer.querySelector('[data-stat-max-display="vida"]');
        if (vidaMaxEl) vidaMaxEl.textContent = permanentMaxVida;
    }

    const manaEl = sheetContainer.querySelector('[data-stat-current="mana"]');
    if (manaEl) manaEl.textContent = characterData.attributes.manaAtual || 0;

    const manaMaxContainer = sheetContainer.querySelector('[data-stat-type="mana"]');
    if (manaMaxContainer) {
        manaMaxContainer.dataset.statMax = permanentMaxMana;
        const manaMaxEl = manaMaxContainer.querySelector('[data-stat-max-display="mana"]');
        if (manaMaxEl) manaMaxEl.textContent = permanentMaxMana;
    }

    const dinheiroEl = sheetContainer.querySelector('[data-stat-current="dinheiro"]');
    if (dinheiroEl) dinheiroEl.textContent = characterData.dinheiro || 0;
    
    // --- ATUALIZADO: Separação de Stats ---
    // Definição das duas listas de stats para busca
    const attackStats = { acerto: 'ATK', dano: 'DMG' };
    const defenseStats = { armadura: 'CA', esquiva: 'ES', bloqueio: 'BL', deslocamento: 'DL' };
    
    // Busca elementos em AMBOS os containers (novo div-attack-stats e div-combat-stats existente)
    const statElements = sheetContainer.querySelectorAll('.div-combat-stats .text-center, .div-attack-stats .text-center');

    if (statElements.length > 0) {
        // Combina as listas para iterar e atualizar tudo de uma vez
        const allStats = { ...attackStats, ...defenseStats };

        Object.entries(allStats).forEach(([stat, label]) => {
            const el = Array.from(statElements).find(e => e.textContent.includes(label));
            if (el) {
                let baseValue = characterData.attributes[stat] || 0;
                
                let content = baseValue;
                let fixedBonusHtml = '';

                // Bonus fixos apenas para stats numéricos de defesa/movimento
                if (['armadura', 'esquiva', 'bloqueio', 'deslocamento'].includes(stat)) {
                    const numVal = parseInt(baseValue) || 0;
                    const fixedBonus = totalFixedBonuses[stat] || 0;
                    fixedBonusHtml = fixedBonus !== 0 ? `<span class="text-green-400 font-bold ml-1">${fixedBonus > 0 ? '+' : ''}${fixedBonus}</span>` : '';
                    const suffix = stat === 'deslocamento' ? 'm' : '';
                    content = `${numVal}${suffix}`;
                } else {
                    // Para Acerto e Dano, exibimos como está (string)
                    content = baseValue || '-';
                }

                // Preserva a cor específica para ATK e DMG
                const colorStyle = stat === 'acerto' ? 'color: #facc15;' : (stat === 'dano' ? 'color: #f87171;' : '');

                // Se houver estilo de cor, aplicamos no span do label, senão herda
                const labelHtml = colorStyle ? `<span style="${colorStyle}">${label}</span>` : label;

                el.innerHTML = `${labelHtml}<br>${content}${fixedBonusHtml}`;
            }
        });
        
        // Atualiza CD (Classe de Dificuldade)
        const sabTotal = (parseInt(characterData.attributes.sabedoria) || 0) + (totalFixedBonuses.sabedoria || 0);
        const cdValue = 10 + (parseInt(characterData.level) || 0) + sabTotal;
        const cdEl = Array.from(statElements).find(e => e.textContent.includes('CD'));
        if(cdEl) cdEl.innerHTML = `CD<br>${cdValue}`;
    }

    const mainAttributes = ['agilidade', 'carisma', 'forca', 'inteligencia', 'sabedoria', 'vigor'];
    const attributeContainers = sheetContainer.querySelectorAll('.mt-2.flex.items-center.space-x-2.text-xs');
    
    const currentAttributeValues = mainAttributes.map(attr => (parseInt(characterData.attributes[attr]) || 0) + (totalFixedBonuses[attr] || 0));
    const maxAttributeValue = Math.max(...currentAttributeValues, 1);

    attributeContainers.forEach(attrContainer => {
        const attrLabelElement = attrContainer.querySelector('span.font-bold.w-8');
        if (!attrLabelElement) return;

        const key = attrLabelElement.getAttribute('title');
        if (!mainAttributes.includes(key)) return;

        const baseValue = parseInt(characterData.attributes[key]) || 0;
        const fixedBonus = totalFixedBonuses[key] || 0;
        const fixedBonusHtml = fixedBonus !== 0 ? ` <span class="text-green-400 font-semibold">${fixedBonus > 0 ? '+ ' : ''}${fixedBonus}</span>` : '';
        const totalValue = baseValue + fixedBonus;
        const percentage = maxAttributeValue > 0 ? (totalValue * 100) / maxAttributeValue : 0;
        
        const barEl = attrContainer.querySelector('.stat-fill');
        if (barEl) barEl.style.width = `${percentage}%`;
        
        const valueEl = attrContainer.querySelector('.text-xs.font-bold.ml-auto');
        if(valueEl) valueEl.innerHTML = `${baseValue}${fixedBonusHtml}`;
    });
}

// Substitua a função setupStatEditor inteira por esta:
// Substitua a função setupStatEditor inteira por esta versão robusta:

function setupStatEditor(characterData, container) {
    const sheetContainer = container || document.querySelector('#nested-sheet-container.visible') || document.querySelector('#character-sheet-container.visible');
    const modal = document.getElementById('stat-editor-modal');
    if (!sheetContainer || !modal) return;

    // Elementos do DOM do Modal Global
    const modalContent = modal.querySelector('#stat-editor-content');
    const titleTextEl = modal.querySelector('#stat-editor-title-text');
    const iconEl = modal.querySelector('#stat-editor-icon');
    const inputEl = modal.querySelector('#stat-editor-value');
    
    // Variáveis de estado locais para esta instância da ficha
    let currentStat = null;
    let statMax = Infinity;

    const STAT_CONFIG = {
        vida: { title: 'Vida', icon: 'fa-heart', color: 'text-red-400', border: 'border-red-500' },
        mana: { title: 'Mana', icon: 'fa-fire', color: 'text-blue-400', border: 'border-blue-500' },
        dinheiro: { title: 'Dinheiro', icon: 'fa-coins', color: 'text-amber-400', border: 'border-amber-500' }
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // Função que configura os botões do modal para ESTE personagem especificamente
    // Ela é chamada toda vez que abrimos o modal, para garantir que o modal "pertença" a esta ficha
    const configureModalButtons = () => {
        const addBtn = modal.querySelector('#stat-editor-add-btn');
        const subtractBtn = modal.querySelector('#stat-editor-subtract-btn');
        const closeBtn = modal.querySelector('#stat-editor-close-btn');

        // Clona para remover listeners antigos (de outros personagens ou instancias anteriores)
        const newAddBtn = addBtn.cloneNode(true);
        const newSubtractBtn = subtractBtn.cloneNode(true);
        const newCloseBtn = closeBtn.cloneNode(true);

        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        subtractBtn.parentNode.replaceChild(newSubtractBtn, subtractBtn);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Lógica de Atualização (Closure capturando o characterData correto)
        const updateStat = (amount) => {
            if (!currentStat || isNaN(amount) || amount === 0) {
                if (amount === 0) closeModal();
                return;
            }

            if (currentStat === 'vida' || currentStat === 'mana') {
                let statCurrent = currentStat === 'vida' ? 'vidaAtual' : 'manaAtual';
                let currentValue = characterData.attributes[statCurrent];

                if (amount < 0) {
                    let remainingDamage = Math.abs(amount);
                    currentValue = Math.max(0, currentValue - remainingDamage);
                    characterData.attributes[statCurrent] = currentValue;
                } else {
                    let newValue = Math.min(statMax, currentValue + amount);
                    characterData.attributes[statCurrent] = newValue;
                }

            } else if (currentStat === 'dinheiro') {
                let currentValue = characterData.dinheiro || 0;
                characterData.dinheiro = Math.max(0, currentValue + amount);
            }

            saveData('rpgCards', characterData).then(async () => {
                await updateStatDisplay(sheetContainer, characterData);
                closeModal();
            }).catch(err => {
                console.error("Failed to save character data:", err);
                closeModal();
            });
        };

        // Adiciona os eventos nos botões recém-limpos
        newAddBtn.addEventListener('click', () => updateStat(Math.abs(parseInt(inputEl.value, 10) || 0)));
        newSubtractBtn.addEventListener('click', () => updateStat(-Math.abs(parseInt(inputEl.value, 10) || 0)));
        newCloseBtn.addEventListener('click', closeModal);
    };

    const openModal = async (type, max) => {
        currentStat = type;
        statMax = max;
        
        // Garante dados frescos
        const freshCharacterData = await getData('rpgCards', characterData.id);
        if (freshCharacterData) Object.assign(characterData, freshCharacterData);

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
        setTimeout(() => modal.classList.add('visible'), 10);
    };

    // Configuração dos gatilhos na ficha (Ícones de Vida/Mana/Dinheiro)
    sheetContainer.querySelectorAll('[data-action="edit-stat"]').forEach(el => {
        // Limpa listeners antigos do ícone
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        
        newEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            const type = newEl.dataset.statType;
            const max = newEl.dataset.statMax ? parseInt(newEl.dataset.statMax, 10) : Infinity;
            
            // --- PASSO CRÍTICO: Reconfigura os botões do modal AGORA ---
            // Isso garante que os botões "Add/Subtract" obedeçam a ESTA ficha, 
            // não importa quantos minicards foram abertos antes.
            configureModalButtons(); 
            // -----------------------------------------------------------

            await openModal(type, max);
        });
    });

    // Listeners globais do modal (Fundo e ESC)
    // Apenas definimos o onclick direto para evitar acúmulo de listeners globais
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') closeModal();
    };
}

// Renderiza o inventário na ficha
async function populateInventory(container, characterData, uniqueId) {
    const scrollArea = container.querySelector(`#inventory-magic-scroll-area-${uniqueId}`);
    if (!scrollArea) return;

    scrollArea.innerHTML = '<div class="p-4 text-center"><i class="fas fa-spinner fa-spin text-gray-400"></i></div>';

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

    let magicsHtml = '';
    let skillsHtml = '';

    if (characterData.spells && characterData.spells.length > 0) {
        const magicPromises = characterData.spells.map(id => getData('rpgSpells', id));
        const magicsAndSkills = (await Promise.all(magicPromises)).filter(Boolean);

        const spells = magicsAndSkills.filter(ms => ms.type === 'magia' || !ms.type);
        const skills = magicsAndSkills.filter(ms => ms.type === 'habilidade');

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

    scrollArea.innerHTML =  magicsHtml + skillsHtml + attacksHtml + inventoryHtml;

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


export async function renderFullCharacterSheet(characterData, isModal, isInPlay, targetContainer) {
    const sheetContainer = targetContainer || document.getElementById('character-sheet-container');
    if (!sheetContainer && (isModal || isInPlay)) return '';

    if (isModal) {
        const index = document.getElementsByClassName('visible').length;
        sheetContainer.style.zIndex = 1000 + index;
        sheetContainer.classList.remove('hidden');
    }

    const inventoryItems = characterData.items ? (await Promise.all(characterData.items.map(id => getData('rpgItems', id)))).filter(Boolean) : [];
    const magicItems = characterData.spells ? (await Promise.all(characterData.spells.map(id => getData('rpgSpells', id)))).filter(Boolean) : [];
    const attackItems = characterData.attacks ? (await Promise.all(characterData.attacks.map(id => getData('rpgAttacks', id)))).filter(Boolean) : [];
    
    const { totalFixedBonuses } = calculateBonuses(characterData, inventoryItems, magicItems);

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
    const imageBack = characterData.backgroundImage ? URL.createObjectURL(bufferToBlob(characterData.backgroundImage, characterData.backgroundMimeType)) : imageUrl;

    const uniqueId = `char-${characterData.id}-${Date.now()}`;
    const predominantColor = characterData.predominantColor || { color100: '#4a5568' };

    const mainAttributes = ['agilidade', 'carisma', 'forca', 'inteligencia', 'sabedoria', 'vigor'];
    characterData.attributes = characterData.attributes || {};

    const currentAttributeValues = mainAttributes.map(attr => (parseInt(characterData.attributes[attr]) || 0) + (totalFixedBonuses[attr] || 0));
    const maxAttributeValue = Math.max(...currentAttributeValues, 1);

    const sabTotal = (parseInt(characterData.attributes.sabedoria) || 0) + (totalFixedBonuses.sabedoria || 0);
    const cdValue = 10 + (parseInt(characterData.level) || 0) + sabTotal;
    const palette = { borderColor: predominantColor.colorLight };

    const origin = isModal || isInPlay ? "" : "transform-origin: top left";
    const transformProp = (isModal || isInPlay) ? 'transform: scale(0.9);' : '';

    let periciasHtml = '<p class="text-xs text-gray-400 italic px-2">Nenhuma perícia selecionada.</p>';
    const allPericias = {};
    if (characterData.attributes.pericias) {
        characterData.attributes.pericias.forEach(p => {
            allPericias[p.name] = { base: p.value, bonus: 0 };
        });
    }

    for (const pName in totalFixedBonuses.pericias) {
        if (!allPericias[pName]) allPericias[pName] = { base: 0, bonus: 0 };
        allPericias[pName].bonus += totalFixedBonuses.pericias[pName];
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
            const periciasList = groupedPericias[attribute].sort((a,b) => a.name.localeCompare(b.name)).map(p => {
                const bonusHtml = p.bonus !== 0 ? ` <span class="text-green-400 font-semibold">${p.bonus > 0 ? '+' : ''}${p.bonus}</span>` : '';
                return `<span class="text-xs text-gray-300">${p.name} ${p.base}${bonusHtml};</span>`;
            }).join(' ');
            return `<div class="text-left mt-1"><p class="text-xs font-bold text-gray-200 uppercase" style="font-size: 11px;">${attribute}</p><div class="flex flex-wrap gap-x-2 gap-y-1 mb-1">${periciasList}</div></div>`;
        }).join('');
    }

    // --- SEPARAÇÃO DOS STATS EM DOIS GRUPOS ---
    const attackStats = { acerto: 'ATK', dano: 'DMG' };
    const defenseStats = { armadura: 'CA', esquiva: 'ES', bloqueio: 'BL', deslocamento: 'DL' };

    const hasAcerto = characterData.attributes.acerto && String(characterData.attributes.acerto).trim() !== '';
    const hasDano = characterData.attributes.dano && String(characterData.attributes.dano).trim() !== '';
    const showAttackStats = hasAcerto || hasDano;

   

    // Gera HTML para Acerto e Dano (Novo Card)
    const attackStatsHtml = Object.entries(attackStats).map(([stat, label]) => {
        const baseValue = characterData.attributes[stat] || 0;
        const content = baseValue || '-';
        const colorStyle = stat === 'acerto' ? 'color: #facc15;' : (stat === 'dano' ? 'color: #f87171;' : '');
        return `<div class="text-center font-bold text-sm" style="${stat === 'acerto' ? 'margin-bottom: 20px;' : ''}"><span style="${colorStyle}; writing-mode: vertical-rl; text-orientation: upright;">${content}</div>`;
    }).join('');

    // Gera HTML para Defesa (Card Existente)
    const defenseStatsHtml = Object.entries(defenseStats).map(([stat, label]) => {
        const baseValue = characterData.attributes[stat] || 0;
        let content = baseValue;
        let fixedBonusHtml = '';

        if (['armadura', 'esquiva', 'bloqueio', 'deslocamento'].includes(stat)) {
             const fixedBonus = totalFixedBonuses[stat] || 0;
             fixedBonusHtml = fixedBonus !== 0 ? `<span class="text-green-400 font-bold ml-1">${fixedBonus > 0 ? '+' : ''}${fixedBonus}</span>` : '';
             const suffix = stat === 'deslocamento' ? 'm' : '';
             content = `${baseValue}${suffix}`;
        } else {
             content = baseValue || '-';
        }
        
        return `<div class="text-center"><span>${label}</span><br>${content}${fixedBonusHtml}</div>`;
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
                    <div class="related-character-grid-item" data-id="${char.id}" data-type="character">
                        ${miniSheetHtml}
                    </div>
                `;
            }));

            relationshipsHtml = `
                <div id="relationships-grid-${uniqueId}" class="relationships-grid" style="overflow-y: auto;">
                     ${relationshipCardsHtml.join('')}
                </div>
            `;
        }
    }

    // Separate spells and skills
    const spellsOnly = magicItems.filter(item => item.type === 'magia' || !item.type);
    const skillsOnly = magicItems.filter(item => item.type === 'habilidade');

    let spellsGridHtml = '';
    if (spellsOnly.length > 0) {
        const spellCardsHtml = await Promise.all(spellsOnly.map(async (spell) => {
            const miniSheetHtml = await renderFullSpellSheet(spell, false); 
            return `
                <div class="related-spell-grid-item" data-id="${spell.id}" data-type="spell">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        spellsGridHtml = `
            <div id="spells-grid-${uniqueId}" class="relationships-grid" style="overflow-y: auto;">
                 ${spellCardsHtml.join('')}
            </div>
        `;
    }

    let skillsGridHtml = '';
    if (skillsOnly.length > 0) {
        const skillCardsHtml = await Promise.all(skillsOnly.map(async (skill) => {
            const miniSheetHtml = await renderFullSpellSheet(skill, false);
            return `
                <div class="related-skill-grid-item" data-id="${skill.id}" data-type="skill">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        skillsGridHtml = `
            <div id="skills-grid-${uniqueId}" class="relationships-grid" style="overflow-y: auto;">
                 ${skillCardsHtml.join('')}
            </div>
        `;
    }

    let attacksGridHtml = '';
    if (attackItems.length > 0) {
        const attackCardsHtml = await Promise.all(attackItems.map(async (attack) => {
            const miniSheetHtml = await renderFullAttackSheet(attack, false);
            return `
                <div class="related-attack-grid-item" data-id="${attack.id}" data-type="attack">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        attacksGridHtml = `
            <div id="attacks-grid-${uniqueId}" class="relationships-grid"  style="overflow-y: auto;">
                 ${attackCardsHtml.join('')}
            </div>
        `;
    }

    let itemsGridHtml = '';
    if (inventoryItems.length > 0) {
        const itemCardsHtml = await Promise.all(inventoryItems.map(async (item) => {
            const miniSheetHtml = await renderFullItemSheet(item, false);
            return `
                <div class="related-item-grid-item" data-id="${item.id}" data-type="item">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        itemsGridHtml = `
            <div id="items-grid-${uniqueId}" class="relationships-grid" style="overflow-y: auto;">
                 ${itemCardsHtml.join('')}
            </div>
        `;
    }

    const permanentMaxVida = (characterData.attributes.vida || 0) + (totalFixedBonuses.vida || 0);
    const permanentMaxMana = (characterData.attributes.mana || 0) + (totalFixedBonuses.mana || 0);

    const hasLore = characterData.lore && (characterData.lore.historia || characterData.lore.personalidade || characterData.lore.motivacao);
    
    const loreHistoriaHtml = characterData.lore?.historia
        ? `<h4>História</h4><p class="mb-4">${characterData.lore.historia}</p>`
        : '';
    const lorePersonalidadeHtml = characterData.lore?.personalidade
        ? `<h4>Personalidade</h4><p class="mb-4">${characterData.lore.personalidade}</p>`
        : '';
    const loreMotivacaoHtml = characterData.lore?.motivacao
        ? `<h4>Motivação</h4><p>${characterData.lore.motivacao}</p>`
        : '';

    const hasMoney = (characterData.dinheiro || 0) > 0;
    const hasMana = (characterData.mana) > 0;
    const moneyContainerStyle = hasMoney ? "writing-mode: vertical-rl; text-orientation: upright; top: 141px;" : "display: none;";

    const sheetHtml = `
            <div class="absolute top-6 right-6 z-20 flex flex-col gap-2">
                 <button id="close-sheet-btn-${uniqueId}" class="bg-red-600 hover:text-white thumb-btn" style="display: ${isModal ? 'flex' : 'none'}"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="character-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.colorLight}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">
            <div class="w-full h-full" style="background: linear-gradient(to bottom, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 96%; height: 96%; border: 3px solid ${predominantColor.colorLight};"></div>
            </div>
            
            <div class="absolute top-6 right-4 p-2 rounded-full text-center cursor-pointer flex flex-col items-center justify-center" style="display: flex; justify-content: space-between; flex-direction: column; height: calc(100% - 40px);">
                <div>    
                    <div style="position: relative;" data-action="edit-stat" data-stat-type="vida" data-stat-max="${permanentMaxVida}" class="mb-2">
                        <i class="fa-solid fa-heart text-5xl" style="background:  linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <div class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-xs pointer-events-none" style="margin: auto;">
                            <span data-stat-current="vida">
                                ${characterData.attributes.vidaAtual || 0}
                            </span>
                            <hr style="width: 15px;">
                            <span data-stat-max-display="vida" style="bottom: 12px;">
                                ${permanentMaxVida}
                            </span>
                        </div>
                    </div>                

                    <div style="position: relative;" data-action="edit-stat" data-stat-type="mana" data-stat-max="${permanentMaxMana}" class="mb-2">
                        <i class="fas fa-fire text-blue-500 text-5xl" style="background: linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <div class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-xs pointer-events-none" style="margin: auto;">
                            <span data-stat-current="mana">
                                ${characterData.attributes.manaAtual || 0}
                            </span>
                            <hr style="width: 15px;">
                            <span data-stat-max-display="mana" style="bottom: 12px;">
                            ${permanentMaxMana}
                            </span>
                        </div>
                    </div>  

                    <div class="money-container rounded-full p-2 flex mb-2 items-center justify-center text-sm text-amber-300 font-bold cursor-pointer" data-action="edit-stat" data-stat-type="dinheiro" title="Alterar Dinheiro" style="width: 42px; ${moneyContainerStyle} background: linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100});">
                        💰$<span data-stat-current="dinheiro">${characterData.dinheiro || 0}</span>
                    </div>
                </div>
                <!-- 1. Attack Stats (New Separated Block) -->
                <div class="div-attack-stats grid grid-row-2 gap-y-2 text-xs mb-2" style="display: ${showAttackStats ? 'block' : 'none'}; border-radius: 18px; background: linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100}); padding: 8px; width: 42px; justify-content: center; align-content: space-around;">
                    ${attackStatsHtml}
                </div>
            </div>

            <div id="lore-icon-${uniqueId}" class="absolute top-8 left-1/2 -translate-x-1/2 text-center z-10"  data-action="toggle-lore">
                <h3 class="text-2xl font-bold">${characterData.title}</h3>
                <p class="text-md italic text-gray-300">${characterData.subTitle}</p>
            </div>
            
            <div class="absolute top-6 left-4 p-2 rounded-full text-center cursor-pointer" style="display: flex; justify-content: space-between; flex-direction: column; height: calc(100% - 30px);">
                <!-- 2. Defense/Combat Stats (Renamed, Removed ATK/DMG) -->
                <div class="div-combat-stats grid grid-row-6 gap-x-4 gap-y-2 text-xs mb-2" style="border-radius: 28px; background: linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100}); padding: 10px; width: 42px; justify-content: space-evenly; ">
                    <div class="text-center font-bold" style="color: rgb(0 247 85);">LV<br>${characterData.level || 0}</div>
                    ${defenseStatsHtml}
                    <div class="text-center">CD<br>${cdValue}</div>
                </div>

                <!-- 3. Attributes Stats (Existing) -->
                <div class="grid grid-row-6 gap-x-4 gap-y-2 text-xs mb-4 div-Stats" style="border-radius: 28px; background: linear-gradient(to bottom, ${predominantColor.color30}, ${predominantColor.color100}); padding: 10px; width: 42px;">
                    ${mainAttributes.map(key => {
                    const baseValue = parseInt(characterData.attributes[key]) || 0;
                    const fixedBonus = totalFixedBonuses[key] || 0;
                    const fixedBonusHtml = fixedBonus !== 0 ? ` <span class="text-green-400 font-semibold">${fixedBonus > 0 ? '+' : ''}${fixedBonus}</span>` : '';
                    return `                        
                        <label class="text-center" title="${key}">${key.slice(0, 3).toUpperCase()}<br>${baseValue}${fixedBonusHtml}</label>                                                      
                    `;
                    }).join('')}
                </div>
            </div>

            <div id="lore-modal-${uniqueId}" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 hidden transition-opacity duration-300">
                <div class="bg-gray-800 p-8 rounded-lg max-w-xl w-full text-white shadow-lg relative">
                    <button id="close-lore-modal-btn-${uniqueId}" class="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full leading-none w-8 h-8 flex items-center justify-center">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <h2 class="text-2xl font-bold mb-4 border-b pb-2">Lore do Personagem</h2>
                    <div id="lore-content" class="text-sm leading-relaxed overflow-y-auto max-h-96">
                        ${loreHistoriaHtml}
                        ${lorePersonalidadeHtml}
                        ${loreMotivacaoHtml}
                        ${!hasLore ? '<p class="italic text-gray-400">Nenhuma lore definida.</p>' : ''}
                    </div>
                </div>
            </div>
            
            <div class="absolute bottom-0 w-full p-4" style="display: ${(isModal || isInPlay) ? 'flex' : 'none'}">
                <div class="pb-1 scrollable-content text-sm text-left ml-2 div-miniCards" style="display: flex; flex-direction: row; overflow-y: scroll;gap: 12px; scroll-snap-type: x mandatory; margin-left: 65px;">
                    <div class="rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; border-color: ${palette.borderColor}; position: relative; z-index: 1; overflow-y: visible; display: flex; flex-direction: column; justify-content: flex-end; opacity: 0.6;">
                        <!-- RELATIONSHIPS_BAR -->
                    </div>
                    <div class="pb-4 rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; border-color: ${palette.borderColor}; position: relative; z-index: 1; overflow-y: visible; display: flex; flex-direction: column; justify-content: flex-end;">
                        <div class="pericias-scroll-area flex flex-col gap-2 px-2" style="overflow-y: auto; max-height: 250px;">
                            ${periciasHtml}
                        </div>
                    </div>
                    <div class="pb-4 rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                        <div id="inventory-magic-scroll-area-${uniqueId}" class="space-y-2" style="overflow-y: auto; max-height: 250px;">
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;

    const finalRelationshipsBar = relationshipsHtml + spellsGridHtml + skillsGridHtml + attacksGridHtml + itemsGridHtml;
    const finalHtml = sheetHtml.replace('<!-- RELATIONSHIPS_BAR -->', finalRelationshipsBar);

    sheetContainer.style.background = `url('${imageBack}')`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    sheetContainer.style.boxShadow = 'inset 0px 0px 10px 0px black';
    sheetContainer.innerHTML = finalHtml;

    if (isInPlay) {
        sheetContainer.classList.add('in-play-animation');
    }

    const setupGridExpand = (gridId) => {
        const grid = sheetContainer.querySelector(`#${gridId}`);
        if (grid) {
            grid.addEventListener('click', (e) => {
                if (e.target === grid) grid.classList.toggle('expanded');
            });
        }
    };

    setupGridExpand(`relationships-grid-${uniqueId}`);
    setupGridExpand(`spells-grid-${uniqueId}`);
    setupGridExpand(`skills-grid-${uniqueId}`);
    setupGridExpand(`attacks-grid-${uniqueId}`);
    setupGridExpand(`items-grid-${uniqueId}`);

    // --- NOVO: Clique no centro para recolher os grids ---
    const characterSheetEl = sheetContainer.querySelector(`#character-sheet-${uniqueId}`);
    if (characterSheetEl) {
        characterSheetEl.addEventListener('click', (e) => {
            // Ignora se o clique for no próprio grid para que ele possa se expandir/retrair livremente
            if (e.target.closest('.relationships-grid')) return;
            // Ignora se o clique for nos painéis de interação (Vida, Mana, Dinheiro)
            if (e.target.closest('[data-action="edit-stat"]')) return;
            // Ignora botões genéricos (ex: botão de fechar a ficha)
            if (e.target.closest('button')) return;

            // Recolhe todos os grids expandidos ao clicar em áreas vazias / de fundo / título da ficha
            const expandedGrids = characterSheetEl.querySelectorAll('.relationships-grid.expanded');
            expandedGrids.forEach(grid => grid.classList.remove('expanded'));
        });
    }
    // -----------------------------------------------------

    const addClickHandlers = (selector, getDataFn, renderFn) => {
        sheetContainer.querySelectorAll(selector).forEach(card => {
            card.addEventListener('click', async (e) => {
                e.stopPropagation();
                const grid = card.parentElement;
                if (!grid.classList.contains('expanded')) {
                    grid.classList.add('expanded');
                } else {
                    const data = await getDataFn(card.dataset.id);
                    if (data) {
                        const container = selector.includes('character') ? document.getElementById('nested-sheet-container') : undefined;
                        await renderFn(data, true, false, container);
                    }
                }
            });
        });
    };

    addClickHandlers('.related-character-grid-item', (id) => getData('rpgCards', id), renderFullCharacterSheet);
    addClickHandlers('.related-spell-grid-item', (id) => getData('rpgSpells', id), renderFullSpellSheet);
    addClickHandlers('.related-skill-grid-item', (id) => getData('rpgSpells', id), renderFullSpellSheet);
    addClickHandlers('.related-attack-grid-item', (id) => getData('rpgAttacks', id), renderFullAttackSheet);
    addClickHandlers('.related-item-grid-item', (id) => getData('rpgItems', id), renderFullItemSheet);

   setTimeout(() => {
    const scaleItems = (selector, sheetIdPrefix) => {
        sheetContainer.querySelectorAll(selector).forEach(item => {
            const sheet = item.querySelector(`[id^="${sheetIdPrefix}"]`);
            if (sheet) {
                const sheetWidth = sheet.clientWidth;
                const sheetHeight = sheet.clientHeight;
                 if (sheetWidth > 0 && sheetHeight > 0) {
                     item.style.width = `${sheetWidth * 0.11}px`;
                     item.style.height = `${sheetHeight * 0.11}px`;
                     sheet.style.transform = 'scale(0.11)'; // Aplica visualmente o escalonamento para dentro da div
                }
            }
        });
    };
    scaleItems('.related-character-grid-item', 'character-sheet-');
    scaleItems('.related-spell-grid-item', 'spell-sheet-');
    scaleItems('.related-skill-grid-item', 'spell-sheet-');
    scaleItems('.related-attack-grid-item', 'attack-sheet-');
    scaleItems('.related-item-grid-item', 'item-sheet-');

     // --- LÓGICA DE AJUSTE DE ALTURA ---
    const miniCardsDiv = sheetContainer.querySelector('.div-miniCards');
    const statsDiv = sheetContainer.querySelector('.div-Stats');

    if (miniCardsDiv && statsDiv) {
        const adjustStatsHeight = () => {
            const miniCardsHeight = miniCardsDiv.offsetHeight;
            // Define a altura mínima do statsDiv igual à do miniCardsDiv.
            // Se miniCards for maior, statsDiv cresce.
            // Se miniCards for menor, o min-height será pequeno e o statsDiv manterá seu tamanho natural (comportamento "não fazer nada").
            statsDiv.style.minHeight = `${miniCardsHeight - 10}px`;
            // Opcional: Ajustar o alinhamento do conteúdo para ficar centralizado ou distribuído se esticar muito
            statsDiv.style.display = 'flex';
            statsDiv.style.flexDirection = 'column';
            statsDiv.style.justifyContent = 'space-evenly'; 
        };

        // Executa imediatamente
        adjustStatsHeight();

        // Cria um observador para ajustar caso o inventário carregue depois e mude o tamanho
        const resizeObserver = new ResizeObserver(() => {
            adjustStatsHeight();
        });
        resizeObserver.observe(miniCardsDiv);
        
        // Salva a referência no container para limpar depois
        sheetContainer._statsResizeObserver = resizeObserver;
    }
    // -----------------------------------

}, 100); 

    populateInventory(sheetContainer, characterData, uniqueId);

    if (isModal || isInPlay) {
        setTimeout(() => sheetContainer.classList.add('visible'), 10);
    }

    const loreIcon = sheetContainer.querySelector(`#lore-icon-${uniqueId}`);
    const loreModal = sheetContainer.querySelector(`#lore-modal-${uniqueId}`);
    const closeLoreModalBtn = sheetContainer.querySelector(`#close-lore-modal-btn-${uniqueId}`);
    const closeSheetBtn = sheetContainer.querySelector(`#close-sheet-btn-${uniqueId}`);

    const closeSheet = () => {
         // Limpa o observador se existir
        if (sheetContainer._statsResizeObserver) {
            sheetContainer._statsResizeObserver.disconnect();
            delete sheetContainer._statsResizeObserver;
        }

        sheetContainer.classList.remove('visible');
        const handler = () => {
            sheetContainer.classList.add('hidden');
            sheetContainer.innerHTML = '';
            if (imageUrl && imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
            if (imageBack && imageBack.startsWith('blob:')) URL.revokeObjectURL(imageBack);
            sheetContainer.removeEventListener('transitionend', handler);
        };
        sheetContainer.addEventListener('transitionend', handler);
    };

    if (loreIcon && loreModal && closeLoreModalBtn) {
        if (hasLore) loreIcon.addEventListener('click', () => loreModal.classList.remove('hidden'));
        
        closeLoreModalBtn.addEventListener('click', () => loreModal.classList.add('hidden'));
         loreModal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') loreModal.classList.add('hidden');
        });
         loreModal.addEventListener('click', (e) => {
             if (e.target === loreModal) loreModal.classList.add('hidden');
         });
    }

    if (closeSheetBtn) {
         const newCloseBtn = closeSheetBtn.cloneNode(true);
         closeSheetBtn.parentNode.replaceChild(newCloseBtn, closeSheetBtn);
        if (isInPlay) {
            newCloseBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('navigateHome'));
            });
        } else {
            newCloseBtn.addEventListener('click', closeSheet);
        }
    }

     sheetContainer.addEventListener('click', (e) => {
        if (e.target === sheetContainer && sheetContainer.id === 'character-sheet-container') {
            closeSheet();
        }
    });
     document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sheetContainer.id === 'character-sheet-container' && sheetContainer.classList.contains('visible')) {
            closeSheet();
        }
     });

    if (isModal || isInPlay) {
        setupStatEditor(characterData, sheetContainer);
    }
    return finalHtml;
}