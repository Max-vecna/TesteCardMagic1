import { saveData, getData, removeData } from './local_db.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { getAumentosData, populateCharacterSelect } from './character_manager.js';
import { populateCategorySelect } from './category_manager.js';

// Variáveis de estado
let currentEditingSpellId = null;
let spellImageFile = null;

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
                 resolve({
                    color30: `rgba(${Math.floor(r/count)}, ${Math.floor(g/count)}, ${Math.floor(b/count)}, 0.3)`,
                    color100: `rgb(${Math.floor(r/count)}, ${Math.floor(g/count)}, ${Math.floor(b/count)})`
                });
            } catch (e) { reject(e); }
        };
        img.onerror = reject;
    });
}

async function calculateColor(imageBuffer, imageMimeType) {
    let imageUrl;
    let createdObjectUrl = null;
    const defaultColor = { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' }; // teal-600

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

// Funções auxiliares para imagens
/**
 * Shows or hides an image preview element.
 * @param {HTMLImageElement|HTMLElement} element The image or div element for preview.
 * @param {string|null} url The object URL of the image or null to hide.
 * @param {boolean} isImageElement True if the element is an <img>, false if it's a div for background.
 */
export function showImagePreview(element, url, isImageElement) { // Added export
    if (url) {
        if (isImageElement) element.src = url;
        else element.style.backgroundImage = `url('${url}')`;
        element.classList.remove('hidden');
    } else {
        if (isImageElement) element.src = ''; // Clear src for img tags
        else element.style.backgroundImage = ''; // Clear background for divs
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
 * Popula o select de aumentos no formulário de magia/habilidade.
 */
export function populateSpellAumentosSelect() {
    const select = document.getElementById('spell-aumento-select');
    if (!select) return;
    select.innerHTML = ''; // Limpa opções existentes

    const AUMENTOS_DATA = getAumentosData();

    // Adiciona Status
    const statusGroup = document.createElement('optgroup');
    statusGroup.label = 'Status';
    AUMENTOS_DATA.Status.forEach(stat => {
        const option = document.createElement('option');
        option.value = stat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        option.textContent = stat;
        statusGroup.appendChild(option);
    });
    select.appendChild(statusGroup);

    // Adiciona Atributos
    const atributosGroup = document.createElement('optgroup');
    atributosGroup.label = 'Atributos';
    AUMENTOS_DATA.Atributos.forEach(attr => {
        const option = document.createElement('option');
        option.value = attr.toLowerCase();
        option.textContent = attr;
        atributosGroup.appendChild(option);
    });
    select.appendChild(atributosGroup);

    // Adiciona Perícias
    for (const attr in AUMENTOS_DATA.Perícias) {
        const periciasGroup = document.createElement('optgroup');
        periciasGroup.label = `Perícias (${attr})`;
        AUMENTOS_DATA.Perícias[attr].forEach(pericia => {
            const option = document.createElement('option');
            option.value = pericia;
            option.textContent = pericia;
            periciasGroup.appendChild(option);
        });
        select.appendChild(periciasGroup);
    }
}


/**
 * Adiciona um elemento visual de aumento à lista no formulário.
 * @param {object} aumento - O objeto de aumento a ser renderizado.
 */
function renderAumentoNaLista(aumento) {
    const list = document.getElementById('spell-aumentos-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-gray-800 p-2 rounded-lg';
    div.dataset.nome = aumento.nome;
    div.dataset.valor = aumento.valor;
    div.dataset.tipo = aumento.tipo;

    div.innerHTML = `
        <div>
            <span class="font-semibold text-teal-300">${aumento.nome}</span>
            <span class="text-white ml-2">${aumento.valor > 0 ? '+' : ''}${aumento.valor}</span>
            <span class="text-xs ${aumento.tipo === 'fixo' ? 'text-green-400' : 'text-blue-400'} ml-2 capitalize">(${aumento.tipo})</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-aumento-btn text-xl leading-none">&times;</button>
    `;

    div.querySelector('.remove-aumento-btn').addEventListener('click', () => {
        div.remove();
    });

    list.appendChild(div);
}

/**
 * Salva ou atualiza uma magia/habilidade no IndexedDB.
 * @param {HTMLFormElement} spellForm - O formulário com os dados da magia.
 * @param {string} type - O tipo de item a ser salvo ('magia' ou 'habilidade').
 * @returns {Promise<void>}
 */
export async function saveSpellCard(spellForm, type) {
    const spellNameInput = document.getElementById('spellName');
    const spellCircleInput = document.getElementById('spellCircle');
    const spellExecutionInput = document.getElementById('spellExecution');
    const spellManaCostInput = document.getElementById('spellManaCost');
    const spellRangeInput = document.getElementById('spellRange');
    const spellTargetInput = document.getElementById('spellTarget');
    const spellDurationInput = document.getElementById('spellDuration');
    const spellResistenciaInput = document.getElementById('spellResistencia');
    const spellDescriptionInput = document.getElementById('spellDescription');
    const spellEnhanceInput = document.getElementById('spellEnhance');
    const spellTrueInput = document.getElementById('spellTrue');
    const spellCharacterOwnerInput = document.getElementById('spellCharacterOwner');
    const spellCategorySelect = document.getElementById('spell-category-select');

    const aumentosList = document.getElementById('spell-aumentos-list');
    const aumentos = [];
    aumentosList.querySelectorAll('div[data-nome]').forEach(el => {
        aumentos.push({
            nome: el.dataset.nome,
            valor: parseInt(el.dataset.valor, 10),
            tipo: el.dataset.tipo
        });
    });

    let existingData = null;
    if (currentEditingSpellId) {
        existingData = await getData('rpgSpells', currentEditingSpellId);
    }

    const imageBuffer = spellImageFile ? await readFileAsArrayBuffer(spellImageFile) : (existingData ? existingData.image : null);
    const imageMimeType = spellImageFile ? spellImageFile.type : (existingData ? existingData.imageMimeType : null);

    let spellData;
    if (currentEditingSpellId) {
        spellData = existingData;
        if (!spellData) return;
        Object.assign(spellData, {
            name: spellNameInput.value,
            circle: parseInt(spellCircleInput.value) || 0,
            execution: spellExecutionInput.value,
            manaCost: parseInt(spellManaCostInput.value) || 0,
            range: spellRangeInput.value,
            target: spellTargetInput.value,
            duration: spellDurationInput.value,
            resistencia: spellResistenciaInput.value,
            description: spellDescriptionInput.value,
            enhance: spellEnhanceInput.value,
            true: spellTrueInput.value,
            aumentos: aumentos,
            type: type,
            characterId: spellCharacterOwnerInput.value,
            categoryId: spellCategorySelect.value,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        });
    } else {
        spellData = {
            id: Date.now().toString(),
            name: spellNameInput.value,
            circle: parseInt(spellCircleInput.value) || 0,
            execution: spellExecutionInput.value,
            manaCost: parseInt(spellManaCostInput.value) || 0,
            range: spellRangeInput.value,
            target: spellTargetInput.value,
            duration: spellDurationInput.value,
            resistencia: spellResistenciaInput.value,
            description: spellDescriptionInput.value,
            enhance: spellEnhanceInput.value,
            true: spellTrueInput.value,
            aumentos: aumentos,
            type: type,
            characterId: spellCharacterOwnerInput.value,
            categoryId: spellCategorySelect.value,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        };
    }

    spellData.predominantColor = await calculateColor(spellData.image, spellData.imageMimeType);

    await saveData('rpgSpells', spellData);

    const eventType = type === 'habilidade' ? 'habilidades' : 'magias';
    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: eventType } }));

    spellForm.reset();
    spellImageFile = null;
    document.getElementById('spell-aumentos-list').innerHTML = '';
    showImagePreview(document.getElementById('spellImagePreview'), null, true);
    currentEditingSpellId = null;
}

/**
 * Carrega os dados de uma magia/habilidade existente no formulário para edição.
 * @param {string} spellId - O ID da magia a ser editada.
 */
export async function editSpell(spellId) {
    const spellData = await getData('rpgSpells', spellId);
    if (!spellData) return;

    currentEditingSpellId = spellId;

    document.getElementById('spellName').value = spellData.name;
    document.getElementById('spellCircle').value = spellData.circle || '';
    document.getElementById('spellExecution').value = spellData.execution;
    document.getElementById('spellManaCost').value = spellData.manaCost || '';
    document.getElementById('spellRange').value = spellData.range;
    document.getElementById('spellTarget').value = spellData.target;
    document.getElementById('spellDuration').value = spellData.duration;
    document.getElementById('spellResistencia').value = spellData.resistencia;
    document.getElementById('spellDescription').value = spellData.description;
    document.getElementById('spellEnhance').value = spellData.enhance;
    document.getElementById('spellTrue').value = spellData.true;

    await populateCharacterSelect('spellCharacterOwner');
    document.getElementById('spellCharacterOwner').value = spellData.characterId || '';

    await populateCategorySelect('spell-category-select', spellData.type);
    document.getElementById('spell-category-select').value = spellData.categoryId || '';

    const aumentosList = document.getElementById('spell-aumentos-list');
    aumentosList.innerHTML = '';
    if (spellData.aumentos && Array.isArray(spellData.aumentos)) {
        spellData.aumentos.forEach(aumento => renderAumentoNaLista(aumento));
    }

    const spellImagePreview = document.getElementById('spellImagePreview');
    if (spellData.image) {
        const imageBlob = bufferToBlob(spellData.image, spellData.imageMimeType);
        showImagePreview(spellImagePreview, URL.createObjectURL(imageBlob), true);
    } else {
        showImagePreview(spellImagePreview, null, true);
    }
}

/**
 * Remove uma magia/habilidade do IndexedDB.
 * @param {string} spellId - O ID da magia a ser removida.
 */
export async function removeSpell(spellId) {
    if (window.confirm('Tem certeza que deseja excluir este item?')) {
        await removeData('rpgSpells', spellId);
    }
}

/**
 * Exporta uma única magia/habilidade para um arquivo JSON.
 * @param {string} spellId - O ID da magia a ser exportada.
 */
export async function exportSpell(spellId) {
    const spellData = await getData('rpgSpells', spellId);
    if (spellData) {
        const dataToExport = { ...spellData };
        if (dataToExport.image) dataToExport.image = arrayBufferToBase64(dataToExport.image);
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (dataToExport.name || 'item').replace(/\s+/g, '_');
        a.download = `${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

/**
 * Importa uma única magia/habilidade a partir de um arquivo JSON.
 * @param {File} file - O arquivo JSON a ser importado.
 * @param {string} type - 'magias' ou 'habilidades' para definir o tipo do item importado.
 */
export async function importSpell(file, type) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSpell = JSON.parse(e.target.result);
                if (!importedSpell || importedSpell.id === undefined) {
                    throw new Error("Formato de arquivo inválido. Esperado um único objeto com um ID.");
                }

                importedSpell.id = Date.now().toString();
                importedSpell.type = type === 'habilidades' ? 'habilidade' : 'magia';

                if (importedSpell.image) {
                    importedSpell.image = base64ToArrayBuffer(importedSpell.image);
                }

                importedSpell.predominantColor = await calculateColor(importedSpell.image, importedSpell.imageMimeType);

                await saveData('rpgSpells', importedSpell);
                resolve(importedSpell);
            } catch (error) {
                console.error("Erro ao importar item:", error);
                reject(error);
            }
        };
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsText(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    populateSpellAumentosSelect();

    document.addEventListener('periciasUpdated', populateSpellAumentosSelect);

    const addBtn = document.getElementById('add-spell-aumento-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const select = document.getElementById('spell-aumento-select');
            const valueInput = document.getElementById('spell-aumento-value');
            const typeRadio = document.querySelector('input[name="spell-aumento-type"]:checked');

            const nome = select.options[select.selectedIndex].text;
            const valor = parseInt(valueInput.value, 10) || 0;
            const tipo = typeRadio.value;

            if (!nome || valor === 0) {
                alert("Por favor, selecione um tipo de aumento e insira um valor diferente de zero.");
                return;
            }

            renderAumentoNaLista({ nome, valor, tipo });
            valueInput.value = '0';
        });
    }
});


document.getElementById('spellImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        spellImageFile = file;
        showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(file), true);
    }
});
