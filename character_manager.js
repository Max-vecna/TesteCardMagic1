import { openDatabase, saveData, getData, removeData } from './local_db.js';
import { renderFullCharacterSheet } from './card-renderer.js';
import { renderInventoryForForm } from './item_manager.js';
import { openSelectionModal as openItemSelectionModal } from './navigation_manager.js';


const PERICIAS_DATA = {
    "AGILIDADE": {
        "Acrobacia": "Capacidade de realizar movimentos ágeis e controlados...",
        "Iniciativa": "Velocidade de reação quando o combate começa...",
        "Montaria": "Controle de veículos e montarias complexas...",
        "Furtividade": "A arte de mover-se sem ser notado...",
        "Pontaria": "Precisão com armas de longo alcance...",
        "Ladinagem": "Manipulação veloz e precisa com as mãos...",
        "Reflexos": "Rapidez em reagir a estímulos..."
    },
    "CARISMA": {
        "Adestramento": "Treinamento e comando de animais...",
        "Enganação": "A arte de manipular a verdade...",
        "Intimidação": "Uso da força de personalidade para impor medo...",
        "Persuasão": "A habilidade de influenciar e inspirar..."
    },
    "INTELIGÊNCIA": {
        "Arcanismo": "Conhecimento das artes místicas...",
        "História": "Memória de tempos antigos...",
        "Investigação": "Capacidade de analisar cenários e reunir pistas...",
        "Ofício": "Criação, manutenção e reparo de objetos...",
        "Religião": "Conhecimento sobre divindades e rituais...",
        "Tecnologia": "Compreensão de mecanismos e engenhocas..."
    },
    "FORÇA": {
        "Atletismo": "Medida da força bruta aplicada com técnica...",
        "Luta": "Combate corpo a corpo com armas simples ou improvisadas..."
    },
    "SABEDORIA": {
        "Intuição": "Habilidade de ler emoções e detectar mentiras...",
        "Percepção": "Capacidade de notar detalhes ao redor...",
        "Medicina": "Conhecimento de curas e tratamento de feridas...",
        "Natureza": "Sabedoria sobre o mundo natural...",
        "Sobrevivência": "A perícia de se adaptar ao mundo selvagem...",
        "Vontade": "Força interior e estabilidade emocional..."
    },
    "VIGOR": {
        "Fortitude": "Resistência física e imunológica do personagem..."
    }
};

let currentEditingCardId = null;
let characterImageFile = null;
let backgroundImageFile = null;
let currentCharacterItems = [];

// --- Funções de Cálculo de Cor ---
function getPredominantColor(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            try {
                const data = ctx.getImageData(0, 0, img.width, img.height).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 20) { // amostragem de pixels
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);

                // Clareia a cor aproximando de branco
                const lighten = (value, amount = 0.4) =>
                    Math.min(255, Math.floor(value + (100 - value) * amount));

                const lr = lighten(r);
                const lg = lighten(g);
                const lb = lighten(b);

                resolve({
                    color30: `rgba(${r}, ${g}, ${b}, 0.3)`,
                    color100: `rgb(${r}, ${g}, ${b})`,
                    colorLight: `rgb(${lr}, ${lg}, ${lb})`
                });
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = reject;
    });
}


async function calculateColor(imageBuffer, imageMimeType) {
    let imageUrl;
    let createdObjectUrl = null;
    const defaultColor = { color30: 'rgba(74, 85, 104, 0.3)', color100: 'rgb(74, 85, 104)' };

    if (imageBuffer) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(imageBuffer, imageMimeType));
        imageUrl = createdObjectUrl;
    } else {
        imageUrl = './icons/back.png'; // Imagem padrão
    }

    let predominantColor;
    try {
        predominantColor = await getPredominantColor(imageUrl);
    } catch (error) {
        console.error('Não foi possível obter a cor predominante, usando padrão.', error);
        predominantColor = defaultColor;
    } finally {
        if (createdObjectUrl) {
            URL.revokeObjectURL(createdObjectUrl);
        }
    }
    return predominantColor;
}
// --- Fim das Funções de Cálculo de Cor ---

export function resetCharacterFormState() {
    currentEditingCardId = null;
    characterImageFile = null;
    backgroundImageFile = null;
    currentCharacterItems = [];
    
    const cardForm = document.getElementById('cardForm');
    if (cardForm) cardForm.reset();

    document.getElementById('selected-magics-container').innerHTML = '';
    document.getElementById('selected-attacks-container').innerHTML = '';
    document.getElementById('selected-relationships-container').innerHTML = '';
    document.getElementById('form-inventory-section').classList.add('hidden');
    
    showImagePreview(document.getElementById('characterImagePreview'), null, true);
    showImagePreview(document.getElementById('backgroundImagePreview'), null, false);
    
    populatePericiasCheckboxes();
    renderInventoryForForm([], 0);
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
        if (!merged[attr]) {
            merged[attr] = {};
        }
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
        if (!aumentosData.Perícias[capitalizedAttr]) {
             aumentosData.Perícias[capitalizedAttr] = [];
        }
        aumentosData.Perícias[capitalizedAttr].push(...Object.keys(mergedPericias[attr]));
    }
    return aumentosData;
}

function showImagePreview(element, url, isImageElement) {
    if (url) {
        if (isImageElement) element.src = url;
        else element.style.backgroundImage = 'url(' + url + ')';
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(file);
    });
}

function bufferToBlob(buffer, mimeType) {
    return new Blob([buffer], { type: mimeType });
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Populates a select element with a list of characters.
 * @param {string} selectId - The ID of the select element to populate.
 * @param {boolean} includeNoneOption - Whether to include a "None" or "All" option.
 * @param {string} noneOptionText - The text for the none/all option.
 */
export async function populateCharacterSelect(selectId, includeNoneOption = true, noneOptionText = 'Nenhum') {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    selectElement.innerHTML = ''; // Clear existing options

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

function createSelectedItemElement(data, type) {
    const containerId = type === 'item' ? 'selected-items-container' : 'selected-magics-container';
    const container = document.getElementById(containerId);
    
    if (!container || container.querySelector(`[data-id="${data.id}"]`)) return;

    const itemElement = document.createElement('div');
    itemElement.className = 'flex items-center justify-between bg-gray-800 p-2 rounded';
    itemElement.dataset.id = data.id;
    
    let iconHtml = '';
    if (data.image) {
        const imageUrl = URL.createObjectURL(bufferToBlob(data.image, data.imageMimeType));
        iconHtml = `<img src="${imageUrl}" class="w-6 h-6 rounded-full mr-2 object-cover" style="image-rendering: pixelated;">`;
    } else {
        const iconClass = type === 'item' ? 'fa-box' : 'fa-magic';
        iconHtml = `<i class="fas ${iconClass} w-6 text-center mr-2"></i>`;
    }

    itemElement.innerHTML = `
        <div class="flex items-center">
            ${iconHtml}
            <span class="text-sm">${data.name}</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-selection-btn text-xl leading-none">&times;</button>
    `;

    itemElement.querySelector('.remove-selection-btn').addEventListener('click', () => {
        itemElement.remove();
    });

    container.appendChild(itemElement);
}

function createSelectedAttackElement(data) {
    const container = document.getElementById('selected-attacks-container');
    if (!container || container.querySelector(`[data-id="${data.id}"]`)) return;

    const itemElement = document.createElement('div');
    itemElement.className = 'flex items-center justify-between bg-gray-800 p-2 rounded';
    itemElement.dataset.id = data.id;
    
    let iconHtml = '';
    if (data.image) {
        const imageUrl = URL.createObjectURL(bufferToBlob(data.image, data.imageMimeType));
        iconHtml = `<img src="${imageUrl}" class="w-6 h-6 rounded-full mr-2 object-cover" style="image-rendering: pixelated;">`;
    } else {
        iconHtml = `<i class="fas fa-khanda w-6 text-center mr-2"></i>`;
    }

    itemElement.innerHTML = `
        <div class="flex items-center">
            ${iconHtml}
            <span class="text-sm">${data.name}</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-selection-btn text-xl leading-none">&times;</button>
    `;

    itemElement.querySelector('.remove-selection-btn').addEventListener('click', () => {
        itemElement.remove();
    });

    container.appendChild(itemElement);
}

function createSelectedRelationshipElement(data) {
    const container = document.getElementById('selected-relationships-container');
    if (!container || container.querySelector(`[data-id="${data.id}"]`)) return;

    const itemElement = document.createElement('div');
    itemElement.className = 'flex items-center justify-between bg-gray-800 p-2 rounded';
    itemElement.dataset.id = data.id;
    
    let iconHtml = '';
    if (data.image) {
        const imageUrl = URL.createObjectURL(bufferToBlob(data.image, data.imageMimeType));
        iconHtml = `<img src="${imageUrl}" class="w-6 h-6 rounded-full mr-2 object-cover">`;
    } else {
        iconHtml = `<i class="fas fa-user w-6 text-center mr-2"></i>`;
    }

    itemElement.innerHTML = `
        <div class="flex items-center">
            ${iconHtml}
            <span class="text-sm">${data.title}</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-selection-btn text-xl leading-none">&times;</button>
    `;

    itemElement.querySelector('.remove-selection-btn').addEventListener('click', () => {
        itemElement.remove();
    });

    container.appendChild(itemElement);
}


/**
 * Função para renderizar as perícias no formulário.
 * @param {Array} [selectedPericias] - Um array de objetos de perícias para pré-selecionar.
 */
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
    const magicIds = Array.from(document.querySelectorAll('#selected-magics-container [data-id]')).map(el => el.dataset.id);
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
            inPlay: false,
            activeBuffs: [], // Inicializa a propriedade de buffs
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

    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submitButton');
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
    const characterImagePreview = document.getElementById('characterImagePreview');
    const backgroundImagePreview = document.getElementById('backgroundImagePreview');
    
    formTitle.textContent = 'Editando: ' + cardData.title;
    submitButton.textContent = 'Salvar Edição';
    currentEditingCardId = cardId;
    
    cardTitleInput.value = cardData.title;
    cardSubTitleInput.value = cardData.subTitle;
    cardLevelInput.value = cardData.level;
    dinheiroInput.value = cardData.dinheiro || 0;
    vidaInput.value = cardData.attributes.vida;
    manaInput.value = cardData.attributes.mana;
    vidaAtualInput.value = cardData.attributes.vidaAtual;
    manaAtualInput.value = cardData.attributes.manaAtual;
    armaduraInput.value = cardData.attributes.armadura;
    esquivaInput.value = cardData.attributes.esquiva;
    bloqueioInput.value = cardData.attributes.bloqueio;
    deslocamentoInput.value = cardData.attributes.deslocamento;
    agilidadeInput.value = cardData.attributes.agilidade;
    carismaInput.value = cardData.attributes.carisma;
    forcaInput.value = cardData.attributes.forca;
    inteligenciaInput.value = cardData.attributes.inteligencia;
    sabedoriaInput.value = cardData.attributes.sabedoria;
    vigorInput.value = cardData.attributes.vigor;
    historiaInput.value = cardData.lore?.historia || '';
    personalidadeInput.value = cardData.lore?.personalidade || '';
    motivacaoInput.value = cardData.lore?.motivacao || '';

    populatePericiasCheckboxes(cardData.attributes.pericias);

    if (cardData.spells && Array.isArray(cardData.spells)) {
        for (const magicId of cardData.spells) {
            const magicData = await getData('rpgSpells', magicId);
            if (magicData) createSelectedItemElement(magicData, 'magic');
        }
    }

    if (cardData.attacks && Array.isArray(cardData.attacks)) {
        for (const attackId of cardData.attacks) {
            const attackData = await getData('rpgAttacks', attackId);
            if (attackData) createSelectedAttackElement(attackData);
        }
    }

    if (cardData.relationships && Array.isArray(cardData.relationships)) {
        for (const charId of cardData.relationships) {
            const relatedCharData = await getData('rpgCards', charId);
            if (relatedCharData) createSelectedRelationshipElement(relatedCharData);
        }
    }

    if (cardData.image) {
        const imageBlob = bufferToBlob(cardData.image, cardData.imageMimeType);
        showImagePreview(characterImagePreview, URL.createObjectURL(imageBlob), true);
    }
    if (cardData.backgroundImage) {
        const backgroundBlob = bufferToBlob(cardData.backgroundImage, cardData.backgroundMimeType);
        showImagePreview(backgroundImagePreview, URL.createObjectURL(backgroundBlob), false);
    }
    
    const forcaValue = cardData.attributes.forca || 0;
    const items = cardData.items ? (await Promise.all(cardData.items.map(id => getData('rpgItems', id)))).filter(Boolean) : [];
    currentCharacterItems = items;
    
    document.getElementById('form-inventory-section').classList.remove('hidden');
    renderInventoryForForm(currentCharacterItems, forcaValue);
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
        const safeTitle = (dataToExport.title || 'card').replace(/\s+/g, '_');
        a.download = `${safeTitle}.json`;
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
                if (!importedCard || importedCard.id === undefined) {
                    throw new Error("Formato de arquivo inválido. Esperado um único objeto de personagem com um ID.");
                }

                importedCard.id = Date.now().toString();
                importedCard.inPlay = false; 

                if (importedCard.image) {
                    importedCard.image = base64ToArrayBuffer(importedCard.image);
                }
                if (importedCard.backgroundImage) {
                    importedCard.backgroundImage = base64ToArrayBuffer(importedCard.backgroundImage);
                }
                
                importedCard.predominantColor = await calculateColor(importedCard.backgroundImage, importedCard.backgroundMimeType);

                await saveData('rpgCards', importedCard);
                resolve(importedCard);
            } catch (error) {
                console.error("Erro ao importar cartão:", error);
                reject(error);
            }
        };
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsText(file);
    });
}

function showCustomAlert(message) {
    const modalHtml = `
        <div id="custom-alert-modal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-sm border border-gray-700">
                <p class="text-center text-lg mb-4">${message}</p>
                <button id="close-alert-btn" class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('close-alert-btn').addEventListener('click', () => {
        document.getElementById('custom-alert-modal').remove();
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
        if (type === 'magic') {
            createSelectedItemElement(data, type);
        } else if (type === 'item') {
            currentCharacterItems.push(data);
            const strength = parseInt(document.getElementById('forca').value) || 0;
            renderInventoryForForm(currentCharacterItems, strength);
        } else if (type === 'attack') {
            createSelectedAttackElement(data);
        }
    });
    
    document.addEventListener('addRelationshipToCharacter', (e) => {
        const { data } = e.detail;
        createSelectedRelationshipElement(data);
    });

    document.addEventListener('requestItemRemoval', (e) => {
        const { itemIndex } = e.detail;
        if (itemIndex > -1 && itemIndex < currentCharacterItems.length) {
            currentCharacterItems.splice(itemIndex, 1);
            const strength = parseInt(document.getElementById('forca').value) || 0;
            renderInventoryForForm(currentCharacterItems, strength);
        }
    });

    const forcaInput = document.getElementById('forca');
    forcaInput.addEventListener('input', () => {
        const strength = parseInt(forcaInput.value) || 0;
        renderInventoryForForm(currentCharacterItems, strength);
    });
    
    document.getElementById('add-item-to-inventory-btn').addEventListener('click', () => {
        openItemSelectionModal('item');
    });

    const showBtn = document.getElementById('show-add-pericia-form-btn');
    const addForm = document.getElementById('add-pericia-form');
    const addBtn = document.getElementById('add-new-pericia-btn');
    const cancelBtn = document.getElementById('cancel-add-pericia-btn');
    const nameInput = document.getElementById('new-pericia-name');
    const attributeSelect = document.getElementById('new-pericia-attribute');
    const descriptionInput = document.getElementById('new-pericia-description');

    if (showBtn && addForm) {
        showBtn.addEventListener('click', () => {
            addForm.classList.toggle('hidden');
        });
    }

    if (cancelBtn && addForm) {
        cancelBtn.addEventListener('click', () => {
            addForm.classList.add('hidden');
            if (nameInput) nameInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
        });
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const attribute = attributeSelect.value;
            const description = descriptionInput.value.trim();

            if (name && attribute) {
                saveCustomPericia(attribute, name, description);
                populatePericiasCheckboxes(getCurrentlySelectedPericias());

                addForm.classList.add('hidden');
                nameInput.value = '';
                descriptionInput.value = '';

                document.dispatchEvent(new CustomEvent('periciasUpdated'));

            } else {
                showCustomAlert('Por favor, preencha o nome da perícia e selecione um atributo.');
            }
        });
    }
});
