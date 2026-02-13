import { saveData, getData } from './local_db.js';
import { renderInventoryForForm } from './item_manager.js';
import { openSelectionModal as openItemSelectionModal } from './navigation_manager.js';
import { readFileAsArrayBuffer, bufferToBlob, arrayBufferToBase64, base64ToArrayBuffer, showImagePreview, calculateColor } from './ui_utils.js';

const PERICIAS_DATA = {
    "AGILIDADE": { "Acrobacia": "...", "Iniciativa": "...", "Montaria": "...", "Furtividade": "...", "Pontaria": "...", "Ladinagem": "...", "Reflexos": "..." },
    "CARISMA": { "Adestramento": "...", "Enganação": "...", "Intimidação": "...", "Persuasão": "..." },
    "INTELIGÊNCIA": { "Arcanismo": "...", "História": "...", "Investigação": "...", "Ofício": "...", "Religião": "...", "Tecnologia": "..." },
    "FORÇA": { "Atletismo": "...", "Luta": "..." },
    "SABEDORIA": { "Intuição": "...", "Percepção": "...", "Medicina": "...", "Natureza": "...", "Sobrevivência": "...", "Vontade": "..." },
    "VIGOR": { "Fortitude": "..." }
};

let currentEditingCardId = null;
let characterImageFile = null;
let backgroundImageFile = null;
let currentCharacterItems = [];

export function resetCharacterFormState() {
    currentEditingCardId = null;
    characterImageFile = null;
    backgroundImageFile = null;
    currentCharacterItems = [];
    
    const cardForm = document.getElementById('cardForm');
    if (cardForm) cardForm.reset();

    document.getElementById('selected-magics-container').innerHTML = '';
    document.getElementById('selected-skills-container').innerHTML = '';
    document.getElementById('selected-attacks-container').innerHTML = '';
    document.getElementById('selected-relationships-container').innerHTML = '';
    document.getElementById('form-inventory-section').classList.add('hidden');
    
    showImagePreview(document.getElementById('characterImagePreview'), null, true);
    showImagePreview(document.getElementById('backgroundImagePreview'), null, false);
    
    populatePericiasCheckboxes();
    renderInventoryForForm([], 0);
}

// Função exportada para permitir que o navigation_manager acesse os itens atuais
export function getCharacterItems() {
    return currentCharacterItems;
}

function getCustomPericias() {
    return JSON.parse(localStorage.getItem('customPericias')) || {};
}

function saveCustomPericia(attribute, periciaName, periciaDescription) {
    const customPericias = getCustomPericias();
    if (!customPericias[attribute]) {
        customPericias[attribute] = {};
    }
    customPericias[attribute][periciaName] = periciaDescription || `Descrição para ${periciaName}.`;
    localStorage.setItem('customPericias', JSON.stringify(customPericias));
}

function getMergedPericiasData() {
    const customPericias = getCustomPericias();
    const merged = JSON.parse(JSON.stringify(PERICIAS_DATA)); 
    for (const attr in customPericias) {
        if (!merged[attr]) merged[attr] = {};
        Object.assign(merged[attr], customPericias[attr]);
    }
    return merged;
}

export function getAumentosData() {
    const mergedPericias = getMergedPericiasData();
    const aumentosData = {
        "Status": ["Vida", "Mana", "Armadura", "Esquiva", "Bloqueio", "Deslocamento"],
        "Atributos": ["Agilidade", "Carisma", "Força", "Inteligência", "Sabedoria", "Vigor"],
        "Perícias": {}
    };

    for (const attr in mergedPericias) {
        const capitalizedAttr = attr.toUpperCase();
        if (!aumentosData.Perícias[capitalizedAttr]) aumentosData.Perícias[capitalizedAttr] = [];
        aumentosData.Perícias[capitalizedAttr].push(...Object.keys(mergedPericias[attr]));
    }
    return aumentosData;
}

export async function populateCharacterSelect(selectId, includeNoneOption = true, noneOptionText = 'Nenhum') {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    selectElement.innerHTML = ''; 

    if (includeNoneOption) {
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = noneOptionText;
        selectElement.appendChild(noneOption);
    }

    const characters = await getData('rpgCards');
    if (characters) {
        characters.sort((a, b) => a.title.localeCompare(b.title)).forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = char.title;
            selectElement.appendChild(option);
        });
    }
}

/**
 * Cria e renderiza um elemento selecionado (magia, habilidade, ataque ou relacionamento)
 * em seu respectivo container no formulário.
 * * @param {object} data - O objeto com os dados do item.
 * @param {string} type - O tipo do item ('magic', 'skill', 'attack', 'relationship', 'item').
 */
function createSelectedElement(data, type) {
    let containerId;
    let iconClass;
    let isImageRound = false;

    // Mapeamento de tipo para Container e Ícone
    if (type === 'magic') {
        containerId = 'selected-magics-container';
        iconClass = 'fa-magic';
        isImageRound = true;
    } else if (type === 'skill') {
        containerId = 'selected-skills-container';
        iconClass = 'fa-fist-raised';
        isImageRound = true;
    } else if (type === 'attack') {
        containerId = 'selected-attacks-container';
        iconClass = 'fa-khanda';
        isImageRound = true;
    } else if (type === 'relationship') {
        containerId = 'selected-relationships-container';
        iconClass = 'fa-user';
        isImageRound = true;
    } else if (type === 'item') {
        // Itens são tratados separadamente no inventário, mas se precisarmos de uma lista visual simples:
        containerId = 'selected-items-container';
        iconClass = 'fa-box';
    } else {
        return;
    }

    const container = document.getElementById(containerId);
    
    // Verifica duplicidade visual
    if (!container || container.querySelector(`[data-id="${data.id}"]`)) return;

    const itemElement = document.createElement('div');
    itemElement.className = 'flex items-center justify-between bg-gray-800 p-2 rounded mt-1 mb-1';
    itemElement.dataset.id = data.id;
    
    let iconHtml = '';
    if (data.image) {
        const imageUrl = URL.createObjectURL(bufferToBlob(data.image, data.imageMimeType));
        iconHtml = `<img src="${imageUrl}" class="w-6 h-6 ${isImageRound ? 'rounded-full' : 'rounded'} mr-2 object-cover" style="image-rendering: pixelated;">`;
    } else {
        iconHtml = `<i class="fas ${iconClass} w-6 text-center mr-2"></i>`;
    }

    // Usa 'title' para personagens, 'name' para outros
    const displayText = data.name || data.title;

    itemElement.innerHTML = `
        <div class="flex items-center">
            ${iconHtml}
            <span class="text-sm truncate max-w-[150px]">${displayText}</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-selection-btn text-xl leading-none">&times;</button>
    `;

    itemElement.querySelector('.remove-selection-btn').addEventListener('click', () => itemElement.remove());
    container.appendChild(itemElement);
}

export function populatePericiasCheckboxes(selectedPericias = []) {
    const container = document.getElementById('pericias-checkboxes-container');
    if (!container) return;
    container.innerHTML = '';
    
    const ALL_PERICIAS = getMergedPericiasData();
    const periciaDescriptionDisplay = document.getElementById('pericia-description-display');
    const periciaDescriptionTitle = document.getElementById('periciaDescriptionTitle');
    const periciaDescriptionText = document.getElementById('periciaDescriptionText');

    for (const attribute in ALL_PERICIAS) {
        const details = document.createElement('details');
        details.className = 'bg-gray-700 rounded-lg p-2 transition-all duration-300';
        details.innerHTML = `
            <summary class="flex items-center justify-between cursor-pointer font-semibold text-indigo-200">
                <span>${attribute}</span>
                <svg class="w-4 h-4 transform transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </summary>
            <div class="mt-2 space-y-2 pl-4 border-l border-gray-600 pericias-list"></div>
        `;

        const periciasList = details.querySelector('.pericias-list');
        details.querySelector('summary').addEventListener('click', () => {
            setTimeout(() => {
                details.querySelector('svg').style.transform = details.open ? 'rotate(90deg)' : 'rotate(0deg)';
            }, 300);
        });

        for (const periciaName in ALL_PERICIAS[attribute]) {
            const periciaItem = document.createElement('div');
            periciaItem.className = 'flex items-center justify-between pericia-item rounded-md p-1';
            const periciaId = `pericia-${periciaName.replace(/\s+/g, '-')}`;
            
            const selectedPericia = selectedPericias.find(p => p.name === periciaName);
            const isChecked = selectedPericia ? 'checked' : '';
            const value = selectedPericia ? selectedPericia.value : '';

            periciaItem.innerHTML = `
                <div class="flex items-center">
                    <input type="checkbox" id="${periciaId}" name="pericia" value="${periciaName}" class="form-checkbox h-4 w-4 text-indigo-500 rounded border-gray-600 focus:ring-indigo-500" ${isChecked}>
                    <label for="${periciaId}" class="ml-2 text-sm text-gray-200 cursor-pointer">${periciaName}</label>
                </div>
                <input type="number" id="${periciaId}-value" placeholder="0" value="${value}" class="w-16 px-2 py-1 bg-gray-800 text-white text-sm rounded-md border border-gray-600 focus:border-indigo-500">
            `;
            periciasList.appendChild(periciaItem);

            periciaItem.querySelector('label').addEventListener('mouseenter', () => {
                periciaDescriptionTitle.textContent = periciaName;
                periciaDescriptionText.textContent = ALL_PERICIAS[attribute][periciaName];
                periciaDescriptionDisplay.classList.remove('hidden');
            });

            periciaItem.querySelector('label').addEventListener('mouseleave', () => {
                periciaDescriptionDisplay.classList.add('hidden');
            });
        }
        container.appendChild(details);
    }
}

export async function saveCharacterCard(cardForm) {
    const cardTitleInput = document.getElementById('cardTitle');
    const cardSubTitleInput = document.getElementById('cardSubTitle');
    const cardLevelInput = document.getElementById('cardLevel');
    const dinheiroInput = document.getElementById('dinheiro');
    const vidaInput = document.getElementById('vida');
    const manaInput = document.getElementById('mana');
    const vidaAtualInput = document.getElementById('vidaAtual');
    const manaAtualInput = document.getElementById('manaAtual');
    const armaduraInput = document.getElementById('armadura');
    const esquivaInput = document.getElementById('esquiva');
    const bloqueioInput = document.getElementById('bloqueio');
    const deslocamentoInput = document.getElementById('deslocamento');
    const agilidadeInput = document.getElementById('agilidade');
    const carismaInput = document.getElementById('carisma');
    const forcaInput = document.getElementById('forca');
    const inteligenciaInput = document.getElementById('inteligencia');
    const sabedoriaInput = document.getElementById('sabedoria');
    const vigorInput = document.getElementById('vigor');
    const historiaInput = document.getElementById('historia');
    const personalidadeInput = document.getElementById('personalidade');
    const motivacaoInput = document.getElementById('motivacao');

    const selectedPericias = [];
    document.querySelectorAll('#pericias-checkboxes-container input[type="checkbox"]:checked').forEach(cb => {
        const periciaName = cb.value;
        const periciaId = `pericia-${periciaName.replace(/\s+/g, '-')}`;
        const valueInput = document.getElementById(`${periciaId}-value`);
        selectedPericias.push({
            name: periciaName,
            value: parseInt(valueInput.value) || 0
        });
    });

    const attributes = {
        vida: parseInt(vidaInput.value) || 0,
        mana: parseInt(manaInput.value) || 0,
        vidaAtual: parseInt(vidaAtualInput.value) || 0,
        manaAtual: parseInt(manaAtualInput.value) || 0,
        armadura: parseInt(armaduraInput.value) || 0,
        esquiva: parseInt(esquivaInput.value) || 0,
        bloqueio: parseInt(bloqueioInput.value) || 0,
        deslocamento: parseInt(deslocamentoInput.value) || 0,
        agilidade: parseInt(agilidadeInput.value) || 0,
        carisma: parseInt(carismaInput.value) || 0,
        forca: parseInt(forcaInput.value) || 0,
        inteligencia: parseInt(inteligenciaInput.value) || 0,
        sabedoria: parseInt(sabedoriaInput.value) || 0,
        vigor: parseInt(vigorInput.value) || 0,
        pericias: selectedPericias
    };
    const lore = {
        historia: historiaInput.value,
        personalidade: personalidadeInput.value,
        motivacao: motivacaoInput.value,
    };

    let existingData = null;
    if (currentEditingCardId) {
        existingData = await getData('rpgCards', currentEditingCardId);
    }

    const imageBuffer = characterImageFile ? await readFileAsArrayBuffer(characterImageFile) : (existingData ? existingData.image : null);
    const imageMimeType = characterImageFile ? characterImageFile.type : (existingData ? existingData.imageMimeType : null);

    const backgroundBuffer = backgroundImageFile ? await readFileAsArrayBuffer(backgroundImageFile) : (existingData ? existingData.backgroundImage : null);
    const backgroundMimeType = backgroundImageFile ? backgroundImageFile.type : (existingData ? existingData.backgroundMimeType : null);
    
    const itemIds = currentCharacterItems.map(item => item.id);
    
    // Coleta IDs tanto de magias quanto de habilidades para salvar no array único 'spells' do DB
    const magicIds = [
        ...Array.from(document.querySelectorAll('#selected-magics-container [data-id]')),
        ...Array.from(document.querySelectorAll('#selected-skills-container [data-id]'))
    ].map(el => el.dataset.id);

    const attackIds = Array.from(document.querySelectorAll('#selected-attacks-container [data-id]')).map(el => el.dataset.id);
    const relationshipIds = Array.from(document.querySelectorAll('#selected-relationships-container [data-id]')).map(el => el.dataset.id);
    
    let cardData;
    if (currentEditingCardId) {
        cardData = existingData;
        Object.assign(cardData, {
            title: cardTitleInput.value,
            subTitle: cardSubTitleInput.value,
            level: parseInt(cardLevelInput.value) || 1,
            dinheiro: parseInt(dinheiroInput.value) || 0,
            attributes,
            lore,
            items: itemIds,
            spells: magicIds,
            attacks: attackIds,
            relationships: relationshipIds,
            image: imageBuffer,
            backgroundImage: backgroundBuffer,
            imageMimeType: imageMimeType,
            backgroundMimeType: backgroundMimeType,
        });
    } else {
        cardData = {
            id: Date.now().toString(),
            title: cardTitleInput.value,
            subTitle: cardSubTitleInput.value,
            level: parseInt(cardLevelInput.value) || 1,
            dinheiro: parseInt(dinheiroInput.value) || 0,
            attributes,
            lore,
            items: itemIds,
            spells: magicIds,
            attacks: attackIds,
            relationships: relationshipIds,
            image: imageBuffer,
            backgroundImage: backgroundBuffer,
            imageMimeType: imageMimeType,
            backgroundMimeType: backgroundMimeType,
            inPlay: false
        };
    }

    cardData.predominantColor = await calculateColor(cardData.image, cardData.imageMimeType);

    await saveData('rpgCards', cardData);
    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'personagem' } }));
    resetCharacterFormState();
}

export async function editCard(cardId) {
    const cardData = await getData('rpgCards', cardId);
    if (!cardData) return;
    
    resetCharacterFormState();

    document.getElementById('form-title').textContent = 'Editando: ' + cardData.title;
    document.getElementById('submitButton').textContent = 'Salvar Edição';
    currentEditingCardId = cardId;
    
    document.getElementById('cardTitle').value = cardData.title;
    document.getElementById('cardSubTitle').value = cardData.subTitle;
    document.getElementById('cardLevel').value = cardData.level;
    document.getElementById('dinheiro').value = cardData.dinheiro || 0;
    
    const attrs = cardData.attributes;
    document.getElementById('vida').value = attrs.vida;
    document.getElementById('mana').value = attrs.mana;
    document.getElementById('vidaAtual').value = attrs.vidaAtual;
    document.getElementById('manaAtual').value = attrs.manaAtual;
    document.getElementById('armadura').value = attrs.armadura;
    document.getElementById('esquiva').value = attrs.esquiva;
    document.getElementById('bloqueio').value = attrs.bloqueio;
    document.getElementById('deslocamento').value = attrs.deslocamento;
    document.getElementById('agilidade').value = attrs.agilidade;
    document.getElementById('carisma').value = attrs.carisma;
    document.getElementById('forca').value = attrs.forca;
    document.getElementById('inteligencia').value = attrs.inteligencia;
    document.getElementById('sabedoria').value = attrs.sabedoria;
    document.getElementById('vigor').value = attrs.vigor;
    
    document.getElementById('historia').value = cardData.lore?.historia || '';
    document.getElementById('personalidade').value = cardData.lore?.personalidade || '';
    document.getElementById('motivacao').value = cardData.lore?.motivacao || '';

    populatePericiasCheckboxes(attrs.pericias);

    // Carrega Magias e Habilidades e distribui nos containers corretos
    if (cardData.spells) {
        for (const magicId of cardData.spells) {
            const magicData = await getData('rpgSpells', magicId);
            if (magicData) {
                // Se o tipo for habilidade, renderiza no container de habilidades, senão no de magias
                const renderType = magicData.type === 'habilidade' ? 'skill' : 'magic';
                createSelectedElement(magicData, renderType);
            }
        }
    }

    if (cardData.attacks) {
        for (const attackId of cardData.attacks) {
            const attackData = await getData('rpgAttacks', attackId);
            if (attackData) createSelectedElement(attackData, 'attack');
        }
    }

    if (cardData.relationships) {
        for (const charId of cardData.relationships) {
            const relatedCharData = await getData('rpgCards', charId);
            if (relatedCharData) createSelectedElement(relatedCharData, 'relationship');
        }
    }

    if (cardData.image) {
        const imageBlob = bufferToBlob(cardData.image, cardData.imageMimeType);
        showImagePreview(document.getElementById('characterImagePreview'), URL.createObjectURL(imageBlob), true);
    }
    if (cardData.backgroundImage) {
        const backgroundBlob = bufferToBlob(cardData.backgroundImage, cardData.backgroundMimeType);
        showImagePreview(document.getElementById('backgroundImagePreview'), URL.createObjectURL(backgroundBlob), false);
    }
    
    const items = cardData.items ? (await Promise.all(cardData.items.map(id => getData('rpgItems', id)))).filter(Boolean) : [];
    currentCharacterItems = items;
    document.getElementById('form-inventory-section').classList.remove('hidden');
    renderInventoryForForm(currentCharacterItems, attrs.forca || 0);
}

export async function exportCard(cardId) {
    const cardData = await getData('rpgCards', cardId);
    if (cardData) {
        const dataToExport = { ...cardData };
        if (dataToExport.image) dataToExport.image = arrayBufferToBase64(dataToExport.image);
        if (dataToExport.backgroundImage) dataToExport.backgroundImage = arrayBufferToBase64(dataToExport.backgroundImage);
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(dataToExport.title || 'card').replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export async function importCard(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedCard = JSON.parse(e.target.result);
                if (!importedCard || importedCard.id === undefined) throw new Error("Formato inválido.");

                importedCard.id = Date.now().toString();
                importedCard.inPlay = false; 

                if (importedCard.image) importedCard.image = base64ToArrayBuffer(importedCard.image);
                if (importedCard.backgroundImage) importedCard.backgroundImage = base64ToArrayBuffer(importedCard.backgroundImage);
                
                importedCard.predominantColor = await calculateColor(importedCard.backgroundImage, importedCard.backgroundMimeType);

                await saveData('rpgCards', importedCard);
                resolve(importedCard);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsText(file);
    });
}

export function getCurrentEditingCardId() {
    return currentEditingCardId;
}

function getCurrentlySelectedPericias() {
    const selectedPericias = [];
    document.querySelectorAll('#pericias-checkboxes-container input[type="checkbox"]:checked').forEach(cb => {
        const periciaName = cb.value;
        const periciaId = `pericia-${periciaName.replace(/\s+/g, '-')}`;
        const valueInput = document.getElementById(`${periciaId}-value`);
        selectedPericias.push({
            name: periciaName,
            value: parseInt(valueInput.value) || 0
        });
    });
    return selectedPericias;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('characterImageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            characterImageFile = file;
            showImagePreview(document.getElementById('characterImagePreview'), URL.createObjectURL(file), true);
        }
    });

    document.getElementById('backgroundImageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            backgroundImageFile = file;
            showImagePreview(document.getElementById('backgroundImagePreview'), URL.createObjectURL(file), false);
        }
    });

    document.addEventListener('addItemToCharacter', (e) => {
        const { data, type } = e.detail;
        
        // Verifica o tipo de dado para direcionar ao container correto
        if (type === 'magic') {
            // Se veio do modal de seleção como 'magic', verifica se o objeto interno é habilidade
            const finalType = data.type === 'habilidade' ? 'skill' : 'magic';
            createSelectedElement(data, finalType);
        } else if (type === 'item') {
            currentCharacterItems.push(data);
            renderInventoryForForm(currentCharacterItems, parseInt(document.getElementById('forca').value) || 0);
        } else if (type === 'attack') {
            createSelectedElement(data, 'attack');
        }
    });
    
    document.addEventListener('addRelationshipToCharacter', (e) => createSelectedElement(e.detail.data, 'relationship'));

    document.addEventListener('requestItemRemoval', (e) => {
        const { itemIndex } = e.detail;
        if (itemIndex > -1 && itemIndex < currentCharacterItems.length) {
            currentCharacterItems.splice(itemIndex, 1);
            renderInventoryForForm(currentCharacterItems, parseInt(document.getElementById('forca').value) || 0);
        }
    });

    document.getElementById('forca').addEventListener('input', (e) => {
        renderInventoryForForm(currentCharacterItems, parseInt(e.target.value) || 0);
    });
    
    document.getElementById('add-item-to-inventory-btn').addEventListener('click', () => openItemSelectionModal('item'));

    // Botão de adicionar habilidade
    const addSkillBtn = document.getElementById('add-skill-to-char-btn');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', () => {
            // Reutiliza o modal de seleção de magias, já que ele lista ambos (magias e habilidades)
            // O sistema de filtragem no addItemToCharacter separará visualmente.
            openItemSelectionModal('magic'); 
        });
    }

    const showBtn = document.getElementById('show-add-pericia-form-btn');
    const addForm = document.getElementById('add-pericia-form');
    const addBtn = document.getElementById('add-new-pericia-btn');
    const cancelBtn = document.getElementById('cancel-add-pericia-btn');

    if (showBtn && addForm) showBtn.addEventListener('click', () => addForm.classList.toggle('hidden'));
    if (cancelBtn && addForm) cancelBtn.addEventListener('click', () => addForm.classList.add('hidden'));

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('new-pericia-name').value.trim();
            const attribute = document.getElementById('new-pericia-attribute').value;
            const description = document.getElementById('new-pericia-description').value.trim();

            if (name && attribute) {
                saveCustomPericia(attribute, name, description);
                populatePericiasCheckboxes(getCurrentlySelectedPericias());
                addForm.classList.add('hidden');
                document.getElementById('new-pericia-name').value = '';
                document.getElementById('new-pericia-description').value = '';
                document.dispatchEvent(new CustomEvent('periciasUpdated'));
            } else {
                alert('Por favor, preencha o nome da perícia e selecione um atributo.');
            }
        });
    }
});