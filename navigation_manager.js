/* === ARQUIVO: navigation_manager.js === */
import { populatePericiasCheckboxes, saveCharacterCard, editCard, importCard, getCurrentEditingCardId, exportCard, resetCharacterFormState, populateCharacterSelect } from './character_manager.js';
// *** MODIFICAÇÃO: Importa showImagePreview ***
import { populateSpellAumentosSelect, saveSpellCard, editSpell, importSpell, exportSpell, showImagePreview } from './magic_manager.js';
import { populateItemAumentosSelect, saveItemCard, editItem, importItem, removeItem, exportItem } from './item_manager.js';
import { saveAttackCard, editAttack, removeAttack, exportAttack, importAttack } from './attack_manager.js';
import { renderCategoryScreen, populateCategorySelect } from './category_manager.js';
import { renderGrimoireScreen } from './grimoire_manager.js';
import { renderFullAttackSheet } from './attack_renderer.js';
import { openDatabase, removeData, getData, saveData, exportDatabase, importDatabase, exportImagesAsPng, showProgressModal, hideProgressModal, updateProgress } from './local_db.js';
import { renderFullCharacterSheet, updateStatDisplay } from './card-renderer.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { renderFullItemSheet } from './item_renderer.js';
import { showCustomAlert, showCustomConfirm, showMultiplierPrompt, showTopAlert } from './ui_utils.js';

let renderContent;
const viewCache = {}; // Objeto para armazenar o HTML das seções já renderizadas
let isCombatModeActive = false;
let contentDisplay;
let mainContainer;

/**
 * Retorna se o modo de combate está ativo.
 * @returns {boolean}
 */
export function isCombatActive() {
    return isCombatModeActive;
}

async function renderCharacterInGame() {
    const allCharacters = await getData('rpgCards');
    const characterInPlay = allCharacters.find(char => char.inPlay);

    contentDisplay.innerHTML = '';
    contentDisplay.style.background = '';
    contentDisplay.style.boxShadow = '';
    if (mainContainer) mainContainer.style.overflowY = 'hidden';
    contentDisplay.style.overflowY = 'visible';
    contentDisplay.classList.add('justify-center'); // Centraliza o card em jogo

    if (characterInPlay) {

        // *** NOVO: Restaura o estado de combate do personagem ***
        if (characterInPlay.isInCombat) {
            isCombatModeActive = true;
        } else {
            isCombatModeActive = false;
        }
        // *** FIM DA MODIFICAÇÃO ***

        // A chamada completa só acontece na carga inicial da aba
        await renderFullCharacterSheet(characterInPlay, false, true, contentDisplay);

        const combatButton = document.createElement('button');
        combatButton.id = 'combat-mode-btn';
        combatButton.className = 'absolute top-4 left-4 z-20 rounded-full font-bold text-white transition-colors shadow-lg btnBatalha hidden';
        if (isCombatModeActive) {
            combatButton.innerHTML = '<i class="fa-solid fa-khanda"></i>';
            combatButton.classList.add('bg-red-600', 'hover:bg-red-700');
        } else {
            combatButton.innerHTML = '<i class="fa-solid fa-khanda"></i>';
            combatButton.classList.add('bg-green-600', 'hover:bg-green-700');
        }

        combatButton.addEventListener('click', async () => { // *** TORNADO ASSÍNCRONO ***
            if (isCombatModeActive) {
                endCombat(); // Esta função já é assíncrona
            } else {
                isCombatModeActive = true;

                // *** NOVO: Salva o estado de combate no DB ***
                if (characterInPlay) {
                    characterInPlay.isInCombat = true;
                    await saveData('rpgCards', characterInPlay);
                }
                // *** FIM DA MODIFICAÇÃO ***

                // MODIFICAÇÃO: Apenas atualiza o botão, não recarrega a ficha
                combatButton.innerHTML = '<i class="fa-solid fa-khanda"></i>';
                combatButton.classList.remove('bg-green-600', 'hover:bg-green-700');
                combatButton.classList.add('bg-red-600', 'hover:bg-red-700');
            }
        });

        const sheetElement = contentDisplay.querySelector('[id^="character-sheet-"]');
        if(sheetElement) {
            // Garante que o botão seja filho direto do contentDisplay para não ser removido em updates parciais
             contentDisplay.appendChild(combatButton);
             // Ajusta posicionamento relativo ao contentDisplay se necessário
             combatButton.style.position = 'fixed'; // Ou absolute se contentDisplay for relative
        } else {
             contentDisplay.appendChild(combatButton);
        }


    } else {
        contentDisplay.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center">
                <button id="select-character-btn" class="add-card-button p-10">
                    <i class="fas fa-dice-d20 text-4xl mb-2"></i>
                    <span class="text-lg font-semibold">Selecionar Personagem em Jogo</span>
                </button>
            </div>
        `;
    }
}

/**
 * Aplica os bônus temporários de um item/magia ao personagem em jogo.
 * @param {object} sourceItem - O item ou magia que concede os bônus.
 */
async function useAbilityInCombat(sourceItem) {
    if (!sourceItem) return;

    // Busca os dados MAIS RECENTES do personagem
    const characterInPlay = (await getData('rpgCards')).find(char => char.inPlay);
    if (!characterInPlay) {
        showCustomAlert("Nenhum personagem está em jogo para usar habilidades.");
        return;
    }

    let multiplier = 1;
    const baseManaCost = sourceItem.manaCost || 0;

    if (baseManaCost > 0) {
        const result = await showMultiplierPrompt({
            title: `Usar ${sourceItem.name}`,
            baseCost: baseManaCost,
            costType: "PM"
        });

        if (result === null) return; // O usuário cancelou
        multiplier = result;
    }

    const totalManaCost = baseManaCost * multiplier;

    // Verifica mana ANTES de aplicar qualquer efeito
    if (characterInPlay.attributes.manaAtual < totalManaCost) {
        showCustomAlert("Mana insuficiente!");
        return;
    }

    // Deduz a mana
    characterInPlay.attributes.manaAtual -= totalManaCost;

    // Aplica os bônus
    let hasInstantEffect = false;
    const lingeringBuffs = [];

    if (sourceItem.aumentos && sourceItem.aumentos.length > 0) {
        const tempBuffs = sourceItem.aumentos.filter(a => a.tipo === 'temporario');

        tempBuffs.forEach(buff => {
            if (buff.nome && typeof buff.valor === 'number') { // Validação extra
                const totalValue = buff.valor * multiplier;
                // Adiciona o buff à lista de buffs persistentes
                lingeringBuffs.push({ ...buff, valor: totalValue });
                hasInstantEffect = true; // Marca que um buff foi aplicado
            } else {
                console.warn("Buff inválido encontrado:", buff, "em", sourceItem.name);
            }
        });
    }

    if (lingeringBuffs.length > 0) {
        if (!characterInPlay.activeBuffs) {
            characterInPlay.activeBuffs = [];
        }
        // Adiciona a nova fonte de buff
        characterInPlay.activeBuffs.push({
            sourceId: `${sourceItem.id}-${Date.now()}`,
            sourceName: `${sourceItem.name} (x${multiplier})`,
            buffs: lingeringBuffs
        });
        hasInstantEffect = true;
    }

    // Salva os dados ATUALIZADOS do personagem (com mana deduzida e buffs adicionados)
    await saveData('rpgCards', characterInPlay);

    // --- MODIFICAÇÃO ---
    // Recarrega a tela inteira "Em Jogo" para garantir que os bônus temporários apareçam
    await renderCharacterInGame();

    let alertMessage = `Custo: ${totalManaCost} PM.`;
    if (hasInstantEffect) {
        alertMessage = `Habilidade ${sourceItem.name} (x${multiplier}) usada. ${alertMessage}`;
    }
    // *** MODIFICAÇÃO: Usar showTopAlert ***
    showTopAlert(alertMessage, 5000); // Mostra por 5 segundos
    // O modal da habilidade usada NÃO é fechado aqui.
}


/**
 * Encerra o modo de combate, removendo todos os bônus temporários.
 */
async function endCombat() {
    const characterInPlay = (await getData('rpgCards')).find(char => char.inPlay);
    let updated = false;
    if (characterInPlay) { // *** Verificação simplificada ***
        if (characterInPlay.activeBuffs && characterInPlay.activeBuffs.length > 0) { // Verifica se há buffs para limpar
            characterInPlay.activeBuffs = []; // Limpa todos os buffs
            updated = true;
        }

        // *** NOVO: Limpa o estado de combate no DB ***
        if (characterInPlay.isInCombat) {
            characterInPlay.isInCombat = false;
            updated = true;
        }
        // *** FIM DA MODIFICAÇÃO ***

        if (updated) {
            await saveData('rpgCards', characterInPlay);
        }
    }
    isCombatModeActive = false; // Define a variável local

    // --- MODIFICAÇÃO ---
    // Recarrega a tela inteira "Em Jogo" para garantir que os bônus sejam removidos da UI
    await renderCharacterInGame();
    // --- FIM DA MODIFICAÇÃO ---

    // *** MODIFICAÇÃO: Usar showTopAlert em vez de showCustomAlert ***
    showTopAlert("Combate encerrado. Bônus temporários removidos.");
}


/**
 * Invalida (limpa) o cache para uma seção específica.
 * @param {string} target - O nome da seção a ser invalidada (ex: 'personagem').
 */
function invalidateCache(target) {
    if (viewCache[target]) {
        delete viewCache[target];
    }
}


function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

/**
 * Aplica a escala correta aos thumbnails de cards dentro de um contêiner.
 * @param {HTMLElement} container - O elemento que contém os thumbnails.
 */
function applyThumbnailScaling(container) {
    requestAnimationFrame(() => {
        container.querySelectorAll('.rpg-thumbnail').forEach(thumbnail => {
            const innerSheet = thumbnail.querySelector('.miniCard > div[style*="width"]'); // Alvo mais específico
            if (innerSheet) {
                const sheetWidth = parseFloat(innerSheet.style.width);
                const sheetHeight = parseFloat(innerSheet.style.height);

                if (sheetWidth > 0 && sheetHeight > 0) {
                    // Define o aspect-ratio do contêiner do thumbnail para corresponder ao da ficha
                    thumbnail.style.aspectRatio = `${sheetWidth} / ${sheetHeight}`;

                    const thumbWidth = thumbnail.offsetWidth;
                     // Usa offsetHeight GERALMENTE funciona, mas se o elemento pai tiver altura flexível, pode ser 0.
                     // Fallback para calcular altura baseada na largura e aspect ratio
                    const thumbHeight = thumbnail.offsetHeight || (thumbWidth * (sheetHeight / sheetWidth));


                    // Calcula a escala baseada na dimensão que mais restringe
                    const scaleX = thumbWidth > 0 ? thumbWidth / sheetWidth : 1; // Evita divisão por zero
                    const scaleY = thumbHeight > 0 ? thumbHeight / sheetHeight : 1;
                    const scale = Math.min(scaleX, scaleY);

                    innerSheet.style.transformOrigin = 'top left';
                    innerSheet.style.transform = `scale(${scale})`;
                }
            }
        });

        // Aplica a animação de visibilidade após o dimensionamento
        const thumbnails = container.querySelectorAll('.rpg-thumbnail');
        thumbnails.forEach((cardWrapper, index) => {
            setTimeout(() => {
                cardWrapper.classList.add('visible');
            }, index * 50);
        });
    });
}


export async function openCharacterSelectionForRelationship() {
    const selectCharacterModal = document.getElementById('select-character-modal');
    const selectCharacterList = document.getElementById('select-character-list');
    const modalTitleEl = selectCharacterModal.querySelector('h3');

    modalTitleEl.textContent = 'Adicionar Relacionamento';
    selectCharacterList.innerHTML = '';
    const allCharacters = await getData('rpgCards');
    const currentCharacterId = getCurrentEditingCardId();

    const charactersToShow = allCharacters.filter(c => c.id !== currentCharacterId);

    if (charactersToShow.length === 0) {
        selectCharacterList.innerHTML = '<p class="text-gray-400 text-center p-4">Não há outros personagens para relacionar.</p>';
    } else {
        charactersToShow.forEach(char => {
            const charItem = document.createElement('button');
            charItem.className = 'w-full text-left p-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-3';

            let iconHtml = '';
             if (char.image) {
                const imageUrl = URL.createObjectURL(bufferToBlob(char.image, char.imageMimeType));
                iconHtml = `<img src="${imageUrl}" class="w-8 h-8 rounded-full object-cover flex-shrink-0">`;
            } else {
                iconHtml = `<div class="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user"></i></div>`;
            }

            charItem.innerHTML = `${iconHtml}<span>${char.title}</span>`;
            charItem.dataset.characterId = char.id;

            charItem.addEventListener('click', async () => {
                const selectedChar = await getData('rpgCards', char.id);
                if (selectedChar) {
                    document.dispatchEvent(new CustomEvent('addRelationshipToCharacter', { detail: { data: selectedChar } }));
                    selectCharacterModal.classList.add('hidden');
                }
            });
            selectCharacterList.appendChild(charItem);
        });
    }
    selectCharacterModal.classList.remove('hidden');
}

export async function openSelectionModal(type) {
    const selectionModal = document.getElementById('selection-modal');
    const selectionModalTitle = document.getElementById('selection-modal-title');
    const selectionModalList = document.getElementById('selection-modal-list');

    selectionModalList.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>';
    selectionModal.classList.remove('hidden');

    const isItem = type === 'item';
    let storeName;
    switch(type) {
        case 'item': storeName = 'rpgItems'; break;
        case 'magic': storeName = 'rpgSpells'; break;
        case 'relationship': storeName = 'rpgCards'; break;
        case 'attack': storeName = 'rpgAttacks'; break;
        default: storeName = 'rpgSpells';
    }

    const title = isItem ? 'Selecionar Item' : (type === 'magic' ? 'Selecionar Magia/Habilidade' : (type === 'attack' ? 'Selecionar Ataque' : 'Selecionar Relacionamento'));
    let color = 'text-gray-300';
    if (isItem) color = 'text-amber-300';
    if (type === 'magic') color = 'text-teal-300';
    if (type === 'relationship') color = 'text-purple-300';
    if (type === 'attack') color = 'text-red-400';

    selectionModalTitle.className = `text-xl font-bold ${color}`;
    selectionModalTitle.textContent = title;

    if (type !== 'relationship') {
        const filterHtml = `
            <div class="mb-4">
                <label for="selection-modal-filter" class="text-sm font-semibold mr-2">Filtrar por Personagem:</label>
                <select id="selection-modal-filter" class="px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-600 text-sm w-full mt-1">
                </select>
            </div>
        `;
        selectionModalList.innerHTML = filterHtml;
    } else {
        selectionModalList.innerHTML = '';
    }

    const listContainer = document.createElement('div');
    listContainer.className = 'space-y-2';
    selectionModalList.appendChild(listContainer);

    const renderList = async (characterId) => {
        listContainer.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>';

        let data = await getData(storeName);

        if (type === 'relationship') {
            const currentCharacterId = getCurrentEditingCardId();
            if (data && Array.isArray(data)) {
                data = data.filter(c => c.id !== currentCharacterId);
            }
        } else if (characterId && characterId !== 'all') {
             // Filtra por ID do personagem E também remove itens do tipo errado (magia vs habilidade)
             data = data.filter(item => {
                const characterMatch = item.characterId === characterId;
                if (storeName === 'rpgSpells') {
                    const typeMatch = (type === 'magic' && item.type !== 'habilidade') || (type !== 'magic' && item.type === 'habilidade');
                    return characterMatch && typeMatch;
                }
                return characterMatch;
            });
        } else if (storeName === 'rpgSpells' && type === 'magic') {
            // Se 'Todos', ainda filtra para mostrar só magias
            data = data.filter(item => item.type !== 'habilidade');
        } else if (storeName === 'rpgSpells' && type !== 'magic') {
             // Se 'Todos', ainda filtra para mostrar só habilidades (assumindo type='habilidade' ou similar)
             data = data.filter(item => item.type === 'habilidade');
        }


        listContainer.innerHTML = '';

        if (!data || data.length === 0) {
            let contentType = 'conteúdo';
            if(isItem) contentType = 'item';
            else if (type === 'magic') contentType = 'magia/habilidade';
            else if (type === 'relationship') contentType = 'personagem';
            else if (type === 'attack') contentType = 'ataque';
            listContainer.innerHTML = `<p class="text-gray-400 text-center p-4">Nenhum ${contentType} encontrado.</p>`;
            return;
        }

        data.forEach(item => {
            const el = document.createElement('button');
            el.className = 'w-full text-left p-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-3';

            let iconHtml = '';
            if (item.image) {
                const imageUrl = URL.createObjectURL(bufferToBlob(item.image, item.imageMimeType));
                iconHtml = `<img src="${imageUrl}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" style="image-rendering: pixelated;">`;
            } else {
                let iconClass;
                switch(type) {
                    case 'item': iconClass = 'fa-box'; break;
                    case 'magic': iconClass = item.type === 'habilidade' ? 'fa-fist-raised' : 'fa-magic'; break; // Icon based on item type
                    case 'relationship': iconClass = 'fa-user'; break;
                    case 'attack': iconClass = 'fa-khanda'; break;
                    default: iconClass = 'fa-question-circle';
                }
                iconHtml = `<i class="fas ${iconClass} w-8 text-center text-xl text-gray-400"></i>`;
            }

            el.innerHTML = `
                ${iconHtml}
                <div>
                    <p class="font-semibold">${item.name || item.title}</p>
                    ${type === 'magic' && item.type ? `<p class="text-xs text-gray-400 capitalize">${item.type}</p>` : ''}
                </div>
            `;

            el.addEventListener('click', () => {
                let eventType = 'addItemToCharacter';
                 // Passa o tipo correto ('item', 'magic', 'attack') para o evento
                let detail = { data: item, type: type === 'relationship' ? 'relationship' : (storeName === 'rpgItems' ? 'item' : (storeName === 'rpgSpells' ? 'magic' : 'attack')) };

                if (type === 'relationship') {
                    eventType = 'addRelationshipToCharacter';
                    // detail.type = 'relationship'; // Already set correctly by switch logic? Redundant.
                }

                document.dispatchEvent(new CustomEvent(eventType, { detail }));
                selectionModal.classList.add('hidden');
            });
            listContainer.appendChild(el);
        });
    };

    if (type !== 'relationship') {
        const filterSelect = document.getElementById('selection-modal-filter');
        const allCharacters = await getData('rpgCards');
        let optionsHtml = '<option value="all">Todos</option><option value="">Nenhum</option>';
        if (allCharacters) {
            allCharacters.sort((a,b) => a.title.localeCompare(b.title)).forEach(char => {
                optionsHtml += `<option value="${char.id}">${char.title}</option>`;
            });
        }
        filterSelect.innerHTML = optionsHtml;

        const currentCharacterId = getCurrentEditingCardId();
        filterSelect.value = currentCharacterId || 'all';

        filterSelect.addEventListener('change', () => {
            renderList(filterSelect.value);
        });

        renderList(filterSelect.value);
    } else {
        renderList(null);
    }
}

async function createItemGrid(items, type, renderSheetFunction) {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid gap-4 w-full justify-items-center grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

    if (items.length === 0) return gridContainer;

    const cardElements = await Promise.all(items.map(async (item) => {
        const sheetHtml = await renderSheetFunction(item, false);
        const cardWrapper = document.createElement('div');
        let cardType = type; // e.g., 'magias', 'habilidades', 'itens', 'ataques'

        // Normalize type for data-attribute consistency
        if (type === 'magias' || type === 'habilidades') {
            cardType = 'spell';
        } else if (type === 'itens') {
            cardType = 'item';
        } else if (type === 'ataques') {
            cardType = 'attack';
        }


        cardWrapper.className = 'rpg-thumbnail bg-cover bg-center relative';
        cardWrapper.dataset.action = "view";
        cardWrapper.dataset.type = cardType;
        cardWrapper.dataset.id = item.id;
        cardWrapper.innerHTML = `
            <div class="miniCard absolute inset-0 text-white">
                ${sheetHtml}
            </div>
            <div class="thumbnail-actions absolute z-10">
                <button class="thumb-btn thumb-btn-menu"><i class="fas fa-ellipsis-v"></i></button>
                <div class="thumbnail-menu" data-type="${cardType}">
                    <button class="menu-item" data-action="edit" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="menu-item" data-action="remove" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                    <button class="menu-item" data-action="export-json" data-id="${item.id}"><i class="fas fa-file-download"></i></button>
                </div>
            </div>
        `;
        return cardWrapper;
    }));

    cardElements.forEach(el => gridContainer.appendChild(el));
    return gridContainer;
}


async function renderGroupedList({
    type,
    storeName,
    buttonText,
        buttonAction,
        importBtnId,
        importInputId,
        importTitle,
        importFunction,
        themeColor,
        renderSheetFunction,
        unassignedTitle
}) {
    contentDisplay.innerHTML = '';

    const allItems = await getData(storeName);
    const allCharacters = await getData('rpgCards');
    const allCategories = (await getData('rpgCategories')) || []; // Default to empty array

    const charactersById = allCharacters.reduce((acc, char) => { acc[char.id] = char; return acc; }, {});
    const categoriesById = allCategories.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {});

    const itemsByCharacter = {};
    const unassignedItems = [];

    allItems.forEach(item => {
        if (type === 'magias' && item.type === 'habilidade') return;
        if (type === 'habilidades' && item.type !== 'habilidade') return;

        const charId = item.characterId;
        if (charId && charactersById[charId]) {
            if (!itemsByCharacter[charId]) {
                itemsByCharacter[charId] = { character: charactersById[charId], items: [] };
            }
            itemsByCharacter[charId].items.push(item);
        } else {
            unassignedItems.push(item);
        }
    });

    const pageContainer = document.createElement('div');
    pageContainer.className = 'w-full p-6 space-y-8';

    const addGrid = document.createElement('div');
    addGrid.className = 'grid gap-4 w-full justify-items-center grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    const addButtonWrapper = document.createElement('div');
    addButtonWrapper.className = 'relative w-full h-full';
    addButtonWrapper.style.aspectRatio = '120 / 160'; // Mantém proporção
    addButtonWrapper.innerHTML = `
        <button class="add-card-button absolute inset-0" data-action="${buttonAction}">
            <i class="fas fa-plus text-2xl mb-2"></i>
            <span class="text-sm font-semibold">${buttonText}</span>
        </button>
        <div class="absolute -bottom-3 w-full flex justify-center gap-2">
            <button class="thumb-btn bg-indigo-200 hover:bg-indigo-600 rounded-full w-8 h-8 flex items-center justify-center"
                    id="${importBtnId}" title="${importTitle}">
                <i class="fas fa-upload text-xs"></i>
            </button>
            <input type="file" id="${importInputId}" accept=".json" class="hidden">
        </div>
    `;
    addGrid.appendChild(addButtonWrapper);
    pageContainer.appendChild(addGrid);

    const renderCharacterItems = async (characterName, items, container) => {
        const itemsByCategory = items.reduce((acc, item) => {
            const catId = item.categoryId || 'unassigned';
            if (!acc[catId]) acc[catId] = [];
            acc[catId].push(item);
            return acc;
        }, {});

        const section = document.createElement('section');
        section.className = 'character-section pt-4';
        section.innerHTML = `<h2 class="text-xl font-bold ${themeColor} mb-4 border-b-2 border-gray-700 pb-2">${characterName}</h2>`;

        const categoryIds = Object.keys(itemsByCategory).sort((a,b) => {
            if (a === 'unassigned') return 1;
            if (b === 'unassigned') return -1;
            const catA = categoriesById[a];
            const catB = categoriesById[b];
            if (!catA || !catA.name) return 1; // Put categories without names last (after unassigned)
            if (!catB || !catB.name) return -1;
            return catA.name.localeCompare(catB.name);
        });



        for(const catId of categoryIds) {
            const category = categoriesById[catId];
            const categoryName = catId === 'unassigned' ? 'Sem Categoria' : (category?.name || 'Categoria Inválida');
            const categoryDesc = catId === 'unassigned' ? '' : (category?.description || ''); // No description for invalid category

            const subSection = document.createElement('div');
            subSection.className = 'mb-6';

            // Tooltip only if description exists
             const tooltipHtml = categoryDesc ? ` data-tooltip="${categoryDesc}"` : '';
             subSection.innerHTML = `<h3 class="category-title text-lg font-semibold text-gray-300 mb-3 relative inline-block cursor-help"${tooltipHtml}>
                                        ${categoryName}
                                     </h3>`;

            const grid = await createItemGrid(itemsByCategory[catId], type, renderSheetFunction);
            subSection.appendChild(grid);
            section.appendChild(subSection);
        }
        container.appendChild(section);
    };

    const characterIds = Object.keys(itemsByCharacter).sort((a, b) => itemsByCharacter[a].character.title.localeCompare(itemsByCharacter[b].character.title));

    for (const charId of characterIds) {
        const group = itemsByCharacter[charId];
        await renderCharacterItems(group.character.title, group.items, pageContainer);
    }

    if (unassignedItems.length > 0) {
        await renderCharacterItems(unassignedTitle, unassignedItems, pageContainer);
    }

    contentDisplay.appendChild(pageContainer);
    applyThumbnailScaling(pageContainer); // Apply scaling after adding all elements

     // Add tooltip listeners AFTER rendering everything
    pageContainer.querySelectorAll('.category-title[data-tooltip]').forEach(title => {
        let tooltipElement = null;
        title.addEventListener('mouseenter', (e) => {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'category-tooltip';
            tooltipElement.textContent = title.dataset.tooltip;
            document.body.appendChild(tooltipElement);

            const rect = title.getBoundingClientRect();
            tooltipElement.style.left = `${rect.left + window.scrollX}px`;
            tooltipElement.style.top = `${rect.bottom + window.scrollY + 5}px`; // Position below the title
        });
        title.addEventListener('mouseleave', () => {
            if (tooltipElement) {
                tooltipElement.remove();
                tooltipElement = null;
            }
        });
    });


    document.getElementById(importBtnId).addEventListener('click', () => {
        document.getElementById(importInputId).click();
    });

    document.getElementById(importInputId).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try { // Add try-catch for import errors
                await importFunction(file, type);
                renderContent(type, true); // Force rerender after import
             } catch (error) {
                 showCustomAlert(`Erro ao importar ${type}: ${error.message}`);
                 console.error("Import error:", error);
             } finally {
                 e.target.value = ''; // Reset input
             }
        }
    });
}



async function renderCharacterList() {
    const allCharacters = await getData('rpgCards');

    const container = document.createElement('div');
    container.className = 'grid gap-4 w-full justify-items-center grid-cols-3 md:grid-cols-4 lg:grid-cols-5 p-6';

    const addButtonWrapper = document.createElement('div');
    addButtonWrapper.className = 'relative w-full h-full aspect-square';
    addButtonWrapper.style.aspectRatio = '120 / 160'; // Mantém proporção
    addButtonWrapper.innerHTML = `
        <button class="add-card-button absolute inset-0" data-action="add-character">
            <i class="fas fa-plus text-2xl mb-2"></i>
            <span class="text-sm font-semibold">Adicionar Personagem</span>
        </button>
        <div class="absolute -bottom-3 w-full flex justify-center gap-2">
             <button class="thumb-btn bg-indigo-200 hover:bg-indigo-600 rounded-full w-8 h-8 flex items-center justify-center" id="import-cards-btn" title="Importar Personagem (JSON)">
                <i class="fas fa-upload text-xs"></i>
            </button>
            <input type="file" id="import-json-input" accept=".json" class="hidden">
        </div>
    `;
    container.appendChild(addButtonWrapper);

    const cardElements = await Promise.all(allCharacters.map(async (char) => {
        const characterSheetHtml = await renderFullCharacterSheet(char, false, false);
        // Background image handled internally by renderFullCharacterSheet

        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'rpg-thumbnail bg-cover bg-center relative'; // Keep relative for actions positioning
        cardWrapper.dataset.action = "view";
        cardWrapper.dataset.type = "character";
        cardWrapper.dataset.id = char.id;

        cardWrapper.innerHTML = `
            <div class="miniCard absolute inset-0 text-white">
                ${characterSheetHtml}
            </div>
            <div class="thumbnail-actions absolute z-10">
                <button class="thumb-btn thumb-btn-menu">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="thumbnail-menu" data-type="character">
                    <button class="menu-item" data-action="edit" data-id="${char.id}"><i class="fas fa-edit"></i></button>
                    <button class="menu-item" data-action="remove" data-id="${char.id}"><i class="fas fa-trash-alt"></i></button>
                    <button class="menu-item" data-action="export-json" data-id="${char.id}"><i class="fas fa-file-download"></i></button>
                    ${char.inPlay
                        ? `<button class="menu-item" data-action="remove-from-play" data-id="${char.id}"><i class="fas fa-sign-out-alt"></i></button>`
                        : `<button class="menu-item" data-action="set-in-play" data-id="${char.id}"><i class="fas fa-play-circle"></i></button>`}
                </div>
            </div>
        `;
        return cardWrapper;
    }));

    cardElements.forEach(el => container.appendChild(el));
    contentDisplay.appendChild(container);

    applyThumbnailScaling(container); // Apply scaling after adding all elements

    document.getElementById('import-cards-btn').addEventListener('click', () => {
        document.getElementById('import-json-input').click();
    });

    document.getElementById('import-json-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
             try {
                await importCard(file);
                renderContent('personagem', true); // Force rerender
            } catch (error) {
                showCustomAlert(`Erro ao importar personagem: ${error.message}`);
                console.error("Import error:", error);
            } finally {
                e.target.value = ''; // Reset input
            }
        }
    });
}

async function renderSpellList(type = 'magias') {
    const isHabilidade = type === 'habilidades';
    await renderGroupedList({
        type: type,
        storeName: 'rpgSpells',
        buttonText: isHabilidade ? 'Adicionar Habilidade' : 'Adicionar Magia',
        buttonAction: isHabilidade ? 'add-habilidade' : 'add-spell',
        importBtnId: isHabilidade ? 'import-habilidade-btn' : 'import-spell-btn',
        importInputId: isHabilidade ? 'import-habilidade-json-input' : 'import-spell-json-input',
        importTitle: isHabilidade ? 'Importar Habilidade (JSON)' : 'Importar Magia (JSON)',
        importFunction: importSpell,
        themeColor: 'text-teal-300',
        renderSheetFunction: renderFullSpellSheet,
        unassignedTitle: isHabilidade ? 'Habilidades Sem Dono' : 'Magias Sem Dono'
    });
}

async function renderItemList() {
    await renderGroupedList({
        type: 'itens',
        storeName: 'rpgItems',
        buttonText: 'Adicionar Item',
        buttonAction: 'add-item',
        importBtnId: 'import-item-btn',
        importInputId: 'import-item-json-input',
        importTitle: 'Importar Item (JSON)',
        importFunction: importItem,
        themeColor: 'text-amber-300',
        renderSheetFunction: renderFullItemSheet,
        unassignedTitle: 'Itens Sem Dono'
    });
}

async function renderAttackList() {
    await renderGroupedList({
        type: 'ataques',
        storeName: 'rpgAttacks',
        buttonText: 'Adicionar Ataque',
        buttonAction: 'add-attack',
        importBtnId: 'import-attack-btn',
        importInputId: 'import-attack-json-input',
        importTitle: 'Importar Ataque (JSON)',
        importFunction: importAttack,
        themeColor: 'text-red-400',
        renderSheetFunction: renderFullAttackSheet,
        unassignedTitle: 'Ataques Sem Dono'
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    const style = document.createElement('style');
     // Adiciona estilos para tooltip de categoria
    style.innerHTML = `
        .rpg-thumbnail {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            transition: opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s ease-in-out;
            will-change: transform, opacity; /* Otimização */
        }
        .rpg-thumbnail.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .category-tooltip {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            white-space: pre-wrap; /* Permite quebras de linha */
            z-index: 1000;
            max-width: 250px;
            pointer-events: none; /* Não interfere com o mouse */
            border: 1px solid #4a5568;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .category-title[data-tooltip]::after { /* Seta opcional */
            /* content: ''; */
            /* position: absolute; */
            /* bottom: 100%; */
            /* left: 50%; */
            /* margin-left: -5px; */
            /* border-width: 5px; */
            /* border-style: solid; */
            /* border-color: transparent transparent rgba(0, 0, 0, 0.85) transparent; */
        }

    `;
    document.head.appendChild(style);

    const contentLoader = document.getElementById('content-loader');
    const navButtons = document.querySelectorAll('[data-target]');
    contentDisplay = document.getElementById('content-display');
    mainContainer = document.querySelector('main.max-w-6xl');
    const creationSection = document.getElementById('creation-section');
    const spellCreationSection = document.getElementById('spell-creation-section');
    const itemCreationSection = document.getElementById('item-creation-section');
    const attackCreationSection = document.getElementById('attack-creation-section');
    const selectCharacterModal = document.getElementById('select-character-modal');
    const selectCharacterList = document.getElementById('select-character-list');

    const selectCharacterCloseBtn = document.getElementById('select-character-close-btn');
    const closeFormBtn = document.getElementById('close-form-btn');
    const closeSpellFormBtn = document.getElementById('close-spell-form-btn');
    const closeItemFormBtn = document.getElementById('close-item-form-btn');
    const closeAttackFormBtn = document.getElementById('close-attack-form-btn');

    const cardForm = document.getElementById('cardForm');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submitButton');

    const spellForm = document.getElementById('spellForm');
    const spellFormTitle = document.getElementById('spell-form-title');
    const spellSubmitButton = document.getElementById('spellSubmitButton');
    const enhanceWrapper = document.getElementById('enhance-wrapper');
    const trueWrapper = document.getElementById('true-wrapper');

    const itemForm = document.getElementById('itemForm');
    const itemFormTitle = document.getElementById('item-form-title');
    const itemSubmitButton = document.getElementById('itemSubmitButton');

    const attackForm = document.getElementById('attackForm');
    const attackFormTitle = document.getElementById('attack-form-title');
    const attackSubmitButton = document.getElementById('attackSubmitButton');

    const selectionModal = document.getElementById('selection-modal');
    const selectionModalCloseBtn = document.getElementById('selection-modal-close-btn');

    const importDbBtn = document.getElementById('import-db-btn');
    const exportDbBtn = document.getElementById('export-db-btn');
    const importDbInput = document.getElementById('import-db-input');
    const importDbBtnMobile = document.getElementById('import-db-btn-mobile');
    const exportDbBtnMobile = document.getElementById('export-db-btn-mobile');
    const exportImagesBtn = document.getElementById('export-images-btn');
    const exportImagesBtnMobile = document.getElementById('export-images-btn-mobile');

    renderContent = async (target, force = false) => {
        contentDisplay.classList.remove('justify-center');
        contentDisplay.removeAttribute('style'); // Limpa estilos para corrigir o bug do background

        // Telas complexas com múltiplos event listeners e estado não devem usar cache de HTML.
        const complexScreens = ['personagem-em-jogo', 'grimorio'];

        // Se a view estiver em cache e não for uma tela complexa, use o cache.
        if (!force && viewCache[target] && !complexScreens.includes(target)) {
            contentDisplay.innerHTML = viewCache[target];
            applyThumbnailScaling(contentDisplay); // Reapply scaling on cached content
            return;
        }

        contentDisplay.innerHTML = ''; // Limpa antes de renderizar
        creationSection.classList.add('hidden');
        spellCreationSection.classList.add('hidden');
        itemCreationSection.classList.add('hidden');
        attackCreationSection.classList.add('hidden');

        if (target !== 'personagem-em-jogo') {
            contentDisplay.style.background = '';
            contentDisplay.style.boxShadow = '';
            if (mainContainer) mainContainer.style.overflowY = 'auto';
            contentDisplay.style.overflowY = 'scroll';
        }
        invalidateCache(target);// Invalida o cache antes de renderizar (caso force=true)

        if (target === 'personagem') await renderCharacterList();
        else if (target === 'magias') await renderSpellList('magias');
        else if (target === 'habilidades') await renderSpellList('habilidades');
        else if (target === 'itens') await renderItemList();
        else if (target === 'ataques') await renderAttackList();
        else if (target === 'categorias') await renderCategoryScreen();
        else if (target === 'grimorio') await renderGrimoireScreen();
        else if (target === 'personagem-em-jogo') await renderCharacterInGame();

        // Não salva telas complexas no cache por serem muito dinâmicas
        if (target && !complexScreens.includes(target)) {
            viewCache[target] = contentDisplay.innerHTML;
            applyThumbnailScaling(contentDisplay); // Apply scaling after fresh render too
        } else if (target === 'personagem-em-jogo') {
            // Se for a tela em jogo, não precisa de scaling de thumbnail, mas pode precisar de outra lógica pós-render
        } else {
             applyThumbnailScaling(contentDisplay); // Aplica scaling mesmo para telas complexas se tiverem thumbnails
        }
    };

    function showView(section, isEditing, setupFunction) {
        section.classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
         // Esconde a barra de navegação desktop também
        const desktopNav = document.getElementById('desktop-sidebar');
        if (desktopNav) desktopNav.classList.add('hidden');
        // Esconde a barra de navegação mobile
        const mobileNav = document.querySelector('nav.md\\:hidden');
        if (mobileNav) mobileNav.classList.add('hidden');

        if (setupFunction) setupFunction();
    }

    const showCharacterSelectionModalForPlay = async () => {
        const modalTitleEl = selectCharacterModal.querySelector('h3');
        modalTitleEl.textContent = 'Selecionar Personagem em Jogo';
        selectCharacterList.innerHTML = '';
        const allCharacters = await getData('rpgCards');

        if (!allCharacters || allCharacters.length === 0) { // Check if undefined or empty
            selectCharacterList.innerHTML = '<p class="text-gray-400">Nenhum personagem disponível.</p>';
        } else {
            allCharacters.forEach(char => {
                const charItem = document.createElement('button');
                charItem.className = 'w-full text-left p-2 rounded-lg hover:bg-gray-700 transition-colors';
                charItem.textContent = char.title;
                charItem.dataset.characterId = char.id;
                charItem.addEventListener('click', async () => {
                    const selectedChar = await getData('rpgCards', char.id);
                    if (selectedChar) {
                        await Promise.all(allCharacters.map(c => {
                            if (c.id !== selectedChar.id && c.inPlay) {
                                c.inPlay = false;
                                return saveData('rpgCards', c);
                            }
                            return Promise.resolve();
                        }));
                        selectedChar.inPlay = true;
                        await saveData('rpgCards', selectedChar);
                        renderContent('personagem-em-jogo', true); // Force rerender
                        selectCharacterModal.classList.add('hidden');
                    }
                });
                selectCharacterList.appendChild(charItem);
            });
        }
        selectCharacterModal.classList.remove('hidden');
    };

    navButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const target = event.currentTarget.dataset.target;
            if (!target) return;

            // Close mobile sidebars on navigation
            const sidebar = document.getElementById('actions-sidebar');
            const sidebar1 = document.getElementById('actions-sidebar-1');
            if (sidebar) sidebar.classList.remove('active');
            if (sidebar1) sidebar1.classList.remove('active');

            navButtons.forEach(btn => btn.classList.remove('active'));

            document.querySelectorAll(`[data-target="${target}"]`).forEach(b => b.classList.add('active'));

            renderContent(target);
        });
    });

    // The listener above handles closing for navigation buttons ([data-target]).
    // This adds the same closing behavior to the other action buttons in the sidebars.
    const actionButtons = document.querySelectorAll('#actions-sidebar button:not([data-target]), #actions-sidebar-1 button:not([data-target])');

    actionButtons.forEach(button => {
        // Exclude toggle buttons which have their own logic in sidebar_manager.js
        if (button.id !== 'sidebar-toggle' && button.id !== 'sidebar-toggle-1') {
            button.addEventListener('click', () => {
                const sidebar = document.getElementById('actions-sidebar');
                const sidebar1 = document.getElementById('actions-sidebar-1');
                if (sidebar) sidebar.classList.remove('active');
                if (sidebar1) sidebar1.classList.remove('active');
            });
        }
    });

    document.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        if (action === "add-character") showView(creationSection, false, () => {
            resetCharacterFormState();
            formTitle.textContent = 'Novo Personagem';
            submitButton.textContent = 'Criar Cartão';
            document.getElementById('form-inventory-section').classList.remove('hidden');
        });
         if (action === "add-spell" || action === "add-habilidade") showView(spellCreationSection, false, async () => {
            const isHabilidade = action === "add-habilidade";
            spellForm.reset();
            spellForm.dataset.type = isHabilidade ? 'habilidade' : 'magia';
            spellFormTitle.textContent = isHabilidade ? 'Nova Habilidade' : 'Nova Magia';
            spellSubmitButton.textContent = isHabilidade ? 'Criar Habilidade' : 'Criar Magia';
            document.getElementById('mana-cost-wrapper').classList.toggle('hidden', isHabilidade); // Esconde círculo e custo
            enhanceWrapper.classList.toggle('hidden', isHabilidade);
            trueWrapper.classList.toggle('hidden', isHabilidade);
            populateSpellAumentosSelect(); // Garante que aumentos sejam populados
             document.getElementById('spell-aumentos-list').innerHTML = ''; // Limpa lista de aumentos
             showImagePreview(document.getElementById('spellImagePreview'), null, true); // Limpa preview
            await populateCharacterSelect('spellCharacterOwner');
            await populateCategorySelect('spell-category-select', isHabilidade ? 'habilidade' : 'magia');
        });
        if (action === "add-item") showView(itemCreationSection, false, async () => {
            itemForm.reset();
            itemFormTitle.textContent = 'Novo Item';
            itemSubmitButton.textContent = 'Criar Item';
            populateItemAumentosSelect(); // Garante que aumentos sejam populados
            document.getElementById('item-aumentos-list').innerHTML = ''; // Limpa lista de aumentos
            showImagePreview(document.getElementById('itemImagePreview'), null, true); // Limpa preview
            await populateCharacterSelect('itemCharacterOwner');
            await populateCategorySelect('item-category-select', 'item');
        });
        if (action === "add-attack") showView(attackCreationSection, false, async () => {
            attackForm.reset();
            attackFormTitle.textContent = 'Novo Ataque';
            attackSubmitButton.textContent = 'Criar Ataque';
            showImagePreview(document.getElementById('attackImagePreview'), null, true); // Limpa preview
            await populateCharacterSelect('attackCharacterOwner');
            await populateCategorySelect('attack-category-select', 'ataque');
        });
        if (e.target.closest('#select-character-btn')) showCharacterSelectionModalForPlay();
    });

    const closeForm = (section) => {
        if (section.id === 'creation-section') {
            resetCharacterFormState(); // Reset specific to character form
        } else if (section.id === 'spell-creation-section') {
             // *** MODIFICAÇÃO: Usa a função importada ***
             showImagePreview(document.getElementById('spellImagePreview'), null, true);
             document.getElementById('spell-aumentos-list').innerHTML = '';
        } else if (section.id === 'item-creation-section') {
             // *** MODIFICAÇÃO: Usa a função importada ***
             showImagePreview(document.getElementById('itemImagePreview'), null, true);
             document.getElementById('item-aumentos-list').innerHTML = '';
        } else if (section.id === 'attack-creation-section') {
             // *** MODIFICAÇÃO: Usa a função importada ***
             showImagePreview(document.getElementById('attackImagePreview'), null, true);
        }

        section.classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
         // *** CORREÇÃO: Linha removida para não mostrar a sidebar desktop incondicionalmente ***
        // Mostra a barra de navegação mobile novamente
        const mobileNav = document.querySelector('nav.md\\:hidden');
        if (mobileNav) mobileNav.classList.remove('hidden');
    };


    closeFormBtn.addEventListener('click', () => closeForm(creationSection));
    closeSpellFormBtn.addEventListener('click', () => closeForm(spellCreationSection));
    closeItemFormBtn.addEventListener('click', () => closeForm(itemCreationSection));
    closeAttackFormBtn.addEventListener('click', () => closeForm(attackCreationSection));

    selectCharacterCloseBtn.addEventListener('click', () => selectCharacterModal.classList.add('hidden'));
     // Add listener to close modal on overlay click
    selectCharacterModal.addEventListener('click', (e) => {
        if (e.target === selectCharacterModal) {
            selectCharacterModal.classList.add('hidden');
        }
    });


    cardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCharacterCard(cardForm);
        closeForm(creationSection);
    });

    spellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = e.currentTarget.dataset.type || 'magia';
        await saveSpellCard(spellForm, type);
        closeForm(spellCreationSection);
    });

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveItemCard(itemForm);
        closeForm(itemCreationSection);
    });

    attackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAttackCard(attackForm);
        closeForm(attackCreationSection);
    });

    document.getElementById('add-relationship-btn').addEventListener('click', () => {
        openSelectionModal('relationship');
    });

    document.getElementById('add-magic-to-char-btn').addEventListener('click', () => openSelectionModal('magic'));
    document.getElementById('add-attack-to-char-btn').addEventListener('click', () => openSelectionModal('attack'));
    selectionModalCloseBtn.addEventListener('click', () => selectionModal.classList.add('hidden'));
    // Add listener to close modal on overlay click
    selectionModal.addEventListener('click', (e) => {
        if (e.target === selectionModal) {
             selectionModal.classList.add('hidden');
        }
    });


    document.addEventListener('openItemSelectionModal', () => openSelectionModal('item'));

    document.addEventListener('navigateHome', () => {
        const charactersButton = document.querySelector('[data-target="personagem"]');
        if (charactersButton) {
            charactersButton.click();
        }
    });

    await openDatabase();

    const emJogoButtons = document.querySelectorAll('[data-target="personagem-em-jogo"]');
    emJogoButtons.forEach(btn => btn.classList.add('active'));
    renderContent('personagem-em-jogo');

    const exportHandler = async () => {
        showProgressModal("Exportando Banco de Dados...");
        try {
            await exportDatabase(updateProgress);
            showCustomAlert("Banco de dados exportado com sucesso!");
        } catch (error) {
            console.error("Erro ao exportar banco de dados:", error);
            showCustomAlert("Ocorreu um erro ao exportar.");
        } finally {
            hideProgressModal();
        }
    };

    const importHandler = () => {
        importDbInput.click();
    };

    const exportImagesHandler = async () => {
        showProgressModal("Exportando Imagens...");
        try {
            await exportImagesAsPng(updateProgress);
            // showCustomAlert("Imagens exportadas com sucesso!"); // Removed success alert for less interruption
        } catch (error) {
            console.error("Erro ao exportar imagens:", error);
            showCustomAlert("Ocorreu um erro ao exportar as imagens.");
        } finally {
            hideProgressModal();
        }
    };

    exportDbBtn.addEventListener('click', exportHandler);
    importDbBtn.addEventListener('click', importHandler);
    exportDbBtnMobile.addEventListener('click', exportHandler);
    importDbBtnMobile.addEventListener('click', importHandler);
    if (exportImagesBtn) exportImagesBtn.addEventListener('click', exportImagesHandler);
    if (exportImagesBtnMobile) exportImagesBtnMobile.addEventListener('click', exportImagesHandler);


    importDbInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (await showCustomConfirm('Isso substituirá TODOS os dados atuais. Deseja continuar?')) {
                showProgressModal("Importando Banco de Dados...");
                try {
                    await importDatabase(file, updateProgress);
                    showCustomAlert("Banco de dados importado com sucesso!");
                    Object.keys(viewCache).forEach(key => delete viewCache[key]); // Limpa todo o cache
                    const activeNav = document.querySelector('.nav-button.active, .desktop-nav-button.active')?.dataset.target || 'personagem-em-jogo';
                    renderContent(activeNav, true); // Força o recarregamento
                } catch (error) {
                    console.error("Erro ao importar banco de dados:", error);
                    showCustomAlert("Erro ao importar. Verifique se o arquivo é válido.");
                } finally {
                    hideProgressModal();
                    importDbInput.value = '';
                }
            } else {
                 importDbInput.value = ''; // Reset input if cancelled
            }
        }
    });

    document.addEventListener('settingsChanged', (e) => {
        if (e.detail.key === 'aspectRatio') {
            Object.keys(viewCache).forEach(key => invalidateCache(key));
            const activeNav = document.querySelector('.nav-button.active, .desktop-nav-button.active')?.dataset.target || 'personagem-em-jogo';
            renderContent(activeNav, true);
        }
    });

     // Listener simplificado para dataChanged
     document.addEventListener('dataChanged', (e) => {
        // Sempre invalida todo o cache quando os dados mudam
        Object.keys(viewCache).forEach(key => invalidateCache(key));

        // Obtém a aba ativa e força o recarregamento dela
        const activeNav = document.querySelector('.nav-button.active, .desktop-nav-button.active')?.dataset.target;
        if (activeNav) {
            renderContent(activeNav, true); // Force = true
        }
    });


    document.addEventListener('click', async (e) => {
        const thumbCard = e.target.closest('.rpg-thumbnail');
        const menuBtn = e.target.closest('.thumb-btn-menu');
        const menuItem = e.target.closest('.thumbnail-menu .menu-item');

        // Click no card (fora do menu) -> Abrir ficha completa
        if (thumbCard && !menuBtn && !menuItem) {
            const cardId = thumbCard.dataset.id;
            const cardType = thumbCard.dataset.type;
            if (cardType === 'character') await renderFullCharacterSheet(await getData('rpgCards', cardId), true, false);
            if (cardType === 'spell') await renderFullSpellSheet(await getData('rpgSpells', cardId), true);
            if (cardType === 'item') await renderFullItemSheet(await getData('rpgItems', cardId), true);
            if (cardType === 'attack') await renderFullAttackSheet(await getData('rpgAttacks', cardId), true);
            return;
        }

        // Click no botão de menu (...) -> Abrir/Fechar menu
       if (menuBtn) {
            e.preventDefault();
            e.stopPropagation();
            const menu = menuBtn.nextElementSibling;
            const parentThumbnail = menuBtn.closest('.rpg-thumbnail');

            // Fecha outros menus abertos
            document.querySelectorAll('.rpg-thumbnail.menu-active').forEach(activeThumb => {
                if (activeThumb !== parentThumbnail) {
                    activeThumb.classList.remove('menu-active');
                    activeThumb.style.zIndex = '';
                    const activeMenu = activeThumb.querySelector('.thumbnail-menu');
                    if (activeMenu) {
                        activeMenu.classList.remove('active', 'menu-left');
                    }
                }
            });
            
            // Alterna o menu atual
            const isActive = menu.classList.toggle('active');
            parentThumbnail.classList.toggle('menu-active', isActive);

            // Ajusta z-index e posição (esquerda/direita)
           /* if (isActive) {
                parentThumbnail.style.zIndex = '100'; 
                const parentRect = parentThumbnail.getBoundingClientRect();
                const viewportMidpoint = window.innerWidth / 2;
                // Abre para a esquerda se o card estiver mais à direita da metade da tela
                if ((parentRect.left + parentRect.width / 2) > viewportMidpoint) {
                    menu.classList.add('menu-left');
                } else {
                    menu.classList.remove('menu-left');
                }
            } else {
                 parentThumbnail.style.zIndex = ''; 
                 menu.classList.remove('menu-left');
            }*/

            return;
        }

        // Click em um item do menu -> Executar ação
        if (menuItem) {
            e.preventDefault();
            e.stopPropagation();
            const action = menuItem.dataset.action;
            const cardId = menuItem.dataset.id;
            const cardType = menuItem.closest('[data-type]').dataset.type; // Pega o tipo do menu pai
            const activeNav = document.querySelector('.nav-button.active, .desktop-nav-button.active').dataset.target;

            // Fecha o menu ANTES de executar a ação
            const parentThumbnail = menuItem.closest('.rpg-thumbnail');
            if(parentThumbnail){
                parentThumbnail.classList.remove('menu-active');
                 parentThumbnail.style.zIndex = ''; // Reset z-index
            }
            const parentMenu = menuItem.closest('.thumbnail-menu');
            if(parentMenu){
                parentMenu.classList.remove('active', 'menu-left');
            }

            // --- Executa a ação ---
            if (action === 'edit') {
                if (cardType === 'character') {
                    showView(creationSection, true);
                    await editCard(cardId);
                } else if (cardType === 'spell') {
                    const spellData = await getData('rpgSpells', cardId);
                    if (spellData) {
                        const isHabilidade = spellData.type === 'habilidade';
                        spellForm.dataset.type = spellData.type || 'magia';
                        spellFormTitle.textContent = isHabilidade ? 'Editando Habilidade' : 'Editando Magia';
                        spellSubmitButton.textContent = isHabilidade ? 'Salvar Habilidade' : 'Salvar Magia';
                         document.getElementById('mana-cost-wrapper').classList.toggle('hidden', isHabilidade);
                        enhanceWrapper.classList.toggle('hidden', isHabilidade);
                        trueWrapper.classList.toggle('hidden', isHabilidade);

                        showView(spellCreationSection, true);
                        await editSpell(cardId); // editSpell preencherá os campos corretos
                    }
                } else if (cardType === 'item') {
                    itemFormTitle.textContent = 'Editando Item';
                    itemSubmitButton.textContent = 'Salvar Item';
                    showView(itemCreationSection, true);
                    await editItem(cardId);
                } else if (cardType === 'attack') {
                    attackFormTitle.textContent = 'Editando Ataque';
                    attackSubmitButton.textContent = 'Salvar Ataque';
                    showView(attackCreationSection, true);
                    await editAttack(cardId);
                }
            } else if (action === 'remove' || action === 'delete') {
                if (await showCustomConfirm('Tem certeza que deseja excluir?')) {
                    let storeName;
                    let eventType = activeNav; // Assume o tipo da navegação atual

                    if(cardType === 'character') { storeName = 'rpgCards'; eventType = 'personagem'; }
                    else if (cardType === 'spell') { storeName = 'rpgSpells'; eventType = (await getData('rpgSpells', cardId))?.type === 'habilidade' ? 'habilidades' : 'magias'; } // Determina tipo correto
                    else if (cardType === 'item') { storeName = 'rpgItems'; eventType = 'itens'; }
                    else if (cardType === 'attack') { storeName = 'rpgAttacks'; eventType = 'ataques'; }

                    if(storeName) {
                        await removeData(storeName, cardId);
                        // Dispara evento para forçar recarregamento da aba atual
                        document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: eventType } }));
                    }
                }
            } else if (action === 'export-json') {
                 if (cardType === 'character') await exportCard(cardId);
                 if (cardType === 'spell') await exportSpell(cardId);
                 if (cardType === 'item') await exportItem(cardId);
                 if (cardType === 'attack') await exportAttack(cardId);
            } else if (action === 'set-in-play' || action === 'remove-from-play') {
                const isSettingInPlay = action === 'set-in-play';
                const allCharacters = await getData('rpgCards');
                // Desmarca qualquer outro personagem em jogo ao marcar um novo
                if (isSettingInPlay) {
                    await Promise.all(allCharacters.map(c => {
                        if (c.inPlay) {
                            c.inPlay = false;
                            c.isInCombat = false; // *** NOVO: Limpa o combate do personagem antigo ***
                            return saveData('rpgCards', c);
                        }
                        return null;
                    }));
                }
                // Atualiza o personagem clicado
                const charToUpdate = allCharacters.find(c => c.id === cardId);
                if (charToUpdate) {
                    charToUpdate.inPlay = isSettingInPlay;
                    if (!isSettingInPlay) { // Se estiver removendo de jogo
                        charToUpdate.isInCombat = false; // *** NOVO: Limpa o combate ***
                    }
                    await saveData('rpgCards', charToUpdate);
                }
                 // Dispara evento para forçar recarregamento da aba atual (Personagens)
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'personagem' } }));
            }

            return; // Impede que o clique no item do menu feche outros menus
        }

        // Click fora de qualquer menu -> Fechar todos os menus
        if (!e.target.closest('.thumbnail-menu') && !e.target.closest('.thumb-btn-menu')) {
            document.querySelectorAll('.rpg-thumbnail.menu-active').forEach(activeThumb => {
                activeThumb.classList.remove('menu-active');
                 activeThumb.style.zIndex = ''; // Reset z-index
                const activeMenu = activeThumb.querySelector('.thumbnail-menu');
                if (activeMenu) {
                    activeMenu.classList.remove('active', 'menu-left');
                }
            });
        }
    });

    // Listener para o evento de usar habilidade/item em combate
    document.addEventListener('useAbilityInCombat', (e) => {
        useAbilityInCombat(e.detail.sourceItem);
    });
});

