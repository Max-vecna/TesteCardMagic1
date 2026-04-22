import { saveData, getData, removeData } from './local_db.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { getAumentosData, populateCharacterSelect } from './character_manager.js';
import { populateCategorySelect } from './category_manager.js';
import {
    showImagePreview,
    readFileAsArrayBuffer as readFileAsArrayBufferUtil,
    bufferToBlob as bufferToBlobUtil,
    arrayBufferToBase64 as arrayBufferToBase64Util,
    base64ToArrayBuffer as base64ToArrayBufferUtil,
    calculateColor as calculateColorUtil,
    showCustomAlert,
    showCustomConfirm
} from './ui_utils.js';

export { showImagePreview } from './ui_utils.js';

let currentEditingSpellId = null;
let spellImageFile = null;
let spellEnhanceImageFile = null; 
let spellTrueImageFile = null;    

function normalizeFixedAumentos(aumentos) {
    if (!Array.isArray(aumentos)) return [];

    return aumentos
        .filter(Boolean)
        .map(aumento => ({
            nome: aumento.nome,
            valor: parseInt(aumento.valor, 10) || 0,
            tipo: 'fixo'
        }))
        .filter(aumento => aumento.nome && aumento.valor !== 0);
}

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
                for (let i = 0; i < data.length; i += 20) {
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
    const defaultColor = { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' };

    if (imageBuffer) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(imageBuffer, imageMimeType));
        imageUrl = createdObjectUrl;
    } else {
        imageUrl = './icons/back.svg';
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

export function populateSpellAumentosSelect() {
    const select = document.getElementById('spell-aumento-select');
    if (!select) return;
    select.innerHTML = ''; 

    const AUMENTOS_DATA = getAumentosData();

    const statusGroup = document.createElement('optgroup');
    statusGroup.label = 'Status';
    AUMENTOS_DATA.Status.forEach(stat => {
        const option = document.createElement('option');
        option.value = stat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        option.textContent = stat;
        statusGroup.appendChild(option);
    });
    select.appendChild(statusGroup);

    const atributosGroup = document.createElement('optgroup');
    atributosGroup.label = 'Atributos';
    AUMENTOS_DATA.Atributos.forEach(attr => {
        const option = document.createElement('option');
        option.value = attr.toLowerCase();
        option.textContent = attr;
        atributosGroup.appendChild(option);
    });
    select.appendChild(atributosGroup);

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

function renderAumentoNaLista(aumento) {
    const list = document.getElementById('spell-aumentos-list');
    if (!list) return;

    const normalizedAumento = normalizeFixedAumentos([aumento])[0];
    if (!normalizedAumento) return;

    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-gray-800 p-2 rounded-lg';
    div.dataset.nome = normalizedAumento.nome;
    div.dataset.valor = normalizedAumento.valor;
    div.dataset.tipo = 'fixo';

    div.innerHTML = `
        <div>
            <span class="font-semibold text-teal-300">${normalizedAumento.nome}</span>
            <span class="text-white ml-2">${normalizedAumento.valor > 0 ? '+' : ''}${normalizedAumento.valor}</span>
        </div>
        <button type="button" class="text-red-500 hover:text-red-400 remove-aumento-btn text-xl leading-none">&times;</button>
    `;

    div.querySelector('.remove-aumento-btn').addEventListener('click', () => {
        div.remove();
    });

    list.appendChild(div);
}

function resetExtraImagePreviews() {
    const enhancePreview = document.getElementById('spellEnhanceImagePreview');
    const enhanceContainer = document.getElementById('spellEnhanceImagePreviewContainer');
    const truePreview = document.getElementById('spellTrueImagePreview');
    const trueContainer = document.getElementById('spellTrueImagePreviewContainer');

    if(enhancePreview) enhancePreview.src = '';
    if(enhanceContainer) enhanceContainer.classList.add('hidden');
    if(truePreview) truePreview.src = '';
    if(trueContainer) trueContainer.classList.add('hidden');
    
    document.getElementById('spellEnhanceImageUpload').value = '';
    document.getElementById('spellTrueImageUpload').value = '';
}

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
    
    const spellAcertoInput = document.getElementById('spellAcerto');
    const spellDamageInput = document.getElementById('spellDamage');
    // Novos campos
    const spellcriticoInput = document.getElementById('spellcritico');
    const spellDanoSemManaInput = document.getElementById('spellDanoSemMana');

    const aumentosList = document.getElementById('spell-aumentos-list');
    const aumentos = [];
    aumentosList.querySelectorAll('div[data-nome]').forEach(el => {
        aumentos.push({
            nome: el.dataset.nome,
            valor: parseInt(el.dataset.valor, 10),
            tipo: 'fixo'
        });
    });
    const normalizedAumentos = normalizeFixedAumentos(aumentos);

    let existingData = null;
    if (currentEditingSpellId) {
        existingData = await getData('rpgEffects', currentEditingSpellId);
    }

    const imageBuffer = spellImageFile ? await readFileAsArrayBufferUtil(spellImageFile) : (existingData ? existingData.image : null);
    const imageMimeType = spellImageFile ? spellImageFile.type : (existingData ? existingData.imageMimeType : null);

    const enhanceImageBuffer = spellEnhanceImageFile ? await readFileAsArrayBufferUtil(spellEnhanceImageFile) : (existingData ? existingData.enhanceImage : null);
    const enhanceImageMimeType = spellEnhanceImageFile ? spellEnhanceImageFile.type : (existingData ? existingData.enhanceImageMimeType : null);

    const trueImageBuffer = spellTrueImageFile ? await readFileAsArrayBufferUtil(spellTrueImageFile) : (existingData ? existingData.trueImage : null);
    const trueImageMimeType = spellTrueImageFile ? spellTrueImageFile.type : (existingData ? existingData.trueImageMimeType : null);

    let spellData;
    const baseData = {
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
        aumentos: normalizedAumentos,
        type: type,
        characterId: spellCharacterOwnerInput.value,
        categoryId: spellCategorySelect.value,
        image: imageBuffer,
        imageMimeType: imageMimeType,
        acerto: spellAcertoInput.value,
        dano: spellDamageInput.value,  
        // Novos campos salvos
        critico: spellcriticoInput ? spellcriticoInput.value : '',
        danoSemMana: spellDanoSemManaInput ? spellDanoSemManaInput.value : '',
        
        enhanceImage: enhanceImageBuffer,
        enhanceImageMimeType: enhanceImageMimeType,
        trueImage: trueImageBuffer,
        trueImageMimeType: trueImageMimeType
    };

    if (currentEditingSpellId) {
        spellData = existingData;
        Object.assign(spellData, baseData);
    } else {
        spellData = {
            id: Date.now().toString(),
            ...baseData
        };
    }

    spellData.predominantColor = await calculateColorUtil(spellData.image, spellData.imageMimeType, spellData.type === 'ataque'
        ? { color30: 'rgba(248, 113, 113, 0.3)', color100: 'rgb(248, 113, 113)' }
        : { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' });
    await saveData('rpgEffects', spellData);

    const eventType = type === 'habilidade' ? 'habilidades' : (type === 'ataque' ? 'ataques' : 'magias');
    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: eventType } }));

    spellForm.reset();
    spellImageFile = null;
    spellEnhanceImageFile = null;
    spellTrueImageFile = null;
    
    document.getElementById('spell-aumentos-list').innerHTML = '';
    showImagePreview(document.getElementById('spellImagePreview'), null, true);
    resetExtraImagePreviews();
    currentEditingSpellId = null;
}

export async function editSpell(spellId) {
    const spellData = await getData('rpgEffects', spellId);
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
    
    document.getElementById('spellAcerto').value = spellData.acerto || '';
    document.getElementById('spellDamage').value = spellData.dano || '';
    
    // Novos campos preenchidos na edição
    const semManaAcerto = document.getElementById('spellcritico');
    const semManaDano = document.getElementById('spellDanoSemMana');
    if (semManaAcerto) semManaAcerto.value = spellData.critico || '';
    if (semManaDano) semManaDano.value = spellData.danoSemMana || '';

    await populateCharacterSelect('spellCharacterOwner');
    document.getElementById('spellCharacterOwner').value = spellData.characterId || '';

    await populateCategorySelect('spell-category-select', spellData.type);
    document.getElementById('spell-category-select').value = spellData.categoryId || '';

    const aumentosList = document.getElementById('spell-aumentos-list');
    aumentosList.innerHTML = '';
    normalizeFixedAumentos(spellData.aumentos).forEach(aumento => renderAumentoNaLista(aumento));

    const spellImagePreview = document.getElementById('spellImagePreview');
    if (spellData.image) {
        const imageBlob = bufferToBlobUtil(spellData.image, spellData.imageMimeType);
        showImagePreview(spellImagePreview, URL.createObjectURL(imageBlob), true);
    } else {
        showImagePreview(spellImagePreview, null, true);
    }

    if (spellData.enhanceImage) {
        const blob = bufferToBlobUtil(spellData.enhanceImage, spellData.enhanceImageMimeType);
        document.getElementById('spellEnhanceImagePreview').src = URL.createObjectURL(blob);
        document.getElementById('spellEnhanceImagePreviewContainer').classList.remove('hidden');
    } else {
        document.getElementById('spellEnhanceImagePreviewContainer').classList.add('hidden');
    }

    if (spellData.trueImage) {
        const blob = bufferToBlobUtil(spellData.trueImage, spellData.trueImageMimeType);
        document.getElementById('spellTrueImagePreview').src = URL.createObjectURL(blob);
        document.getElementById('spellTrueImagePreviewContainer').classList.remove('hidden');
    } else {
        document.getElementById('spellTrueImagePreviewContainer').classList.add('hidden');
    }
}

export async function removeSpell(spellId) {
    if (await showCustomConfirm('Tem certeza que deseja excluir este efeito?')) {
        await removeData('rpgEffects', spellId);
    }
}

export async function exportSpell(spellId) {
    const spellData = await getData('rpgEffects', spellId);
    if (spellData) {
        const dataToExport = { ...spellData };
        if (dataToExport.image) dataToExport.image = arrayBufferToBase64Util(dataToExport.image);
        if (dataToExport.enhanceImage) dataToExport.enhanceImage = arrayBufferToBase64Util(dataToExport.enhanceImage);
        if (dataToExport.trueImage) dataToExport.trueImage = arrayBufferToBase64Util(dataToExport.trueImage);

        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (dataToExport.name || 'efeito').replace(/\s+/g, '_');
        const prefix = dataToExport.type === 'habilidade' ? 'habilidade' : (dataToExport.type === 'ataque' ? 'ataque' : 'magia');
        a.download = `${prefix}_${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export async function importSpell(file, type) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSpell = JSON.parse(e.target.result);
                if (!importedSpell || importedSpell.id === undefined) {
                    throw new Error("Formato de arquivo inválido.");
                }

                importedSpell.id = Date.now().toString();
                if (type === 'habilidades') importedSpell.type = 'habilidade';
                else if (type === 'ataques') importedSpell.type = 'ataque';
                else importedSpell.type = 'magia';

                if (importedSpell.image) importedSpell.image = base64ToArrayBufferUtil(importedSpell.image);
                if (importedSpell.enhanceImage) importedSpell.enhanceImage = base64ToArrayBufferUtil(importedSpell.enhanceImage);
                if (importedSpell.trueImage) importedSpell.trueImage = base64ToArrayBufferUtil(importedSpell.trueImage);

                importedSpell.predominantColor = await calculateColorUtil(importedSpell.image, importedSpell.imageMimeType, importedSpell.type === 'ataque'
                    ? { color30: 'rgba(248, 113, 113, 0.3)', color100: 'rgb(248, 113, 113)' }
                    : { color30: 'rgba(13, 148, 136, 0.3)', color100: 'rgb(13, 148, 136)' });
                await saveData('rpgEffects', importedSpell);
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

            const nome = select.options[select.selectedIndex].text;
            const valor = parseInt(valueInput.value, 10) || 0;

            if (!nome || valor === 0) {
                showCustomAlert('Selecione um aumento e informe um valor diferente de zero.');
                return;
            }

            renderAumentoNaLista({ nome, valor, tipo: 'fixo' });
            valueInput.value = '0';
        });
    }

    const setupExtraImageListener = (inputId, previewId, containerId, removeBtnId, fileVarSetter) => {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const container = document.getElementById(containerId);
        const removeBtn = document.getElementById(removeBtnId);

        if (input && preview && container && removeBtn) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileVarSetter(file);
                    preview.src = URL.createObjectURL(file);
                    container.classList.remove('hidden');
                }
            });

            removeBtn.addEventListener('click', () => {
                input.value = '';
                preview.src = '';
                container.classList.add('hidden');
                fileVarSetter(null);
            });
        }
    };

    setupExtraImageListener('spellEnhanceImageUpload', 'spellEnhanceImagePreview', 'spellEnhanceImagePreviewContainer', 'removeEnhanceImageBtn', (file) => { spellEnhanceImageFile = file; });
    setupExtraImageListener('spellTrueImageUpload', 'spellTrueImagePreview', 'spellTrueImagePreviewContainer', 'removeTrueImageBtn', (file) => { spellTrueImageFile = file; });

    const mainUpload = document.getElementById('spellImageUpload');
    if (mainUpload) {
        mainUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                spellImageFile = file;
                showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(file), true);
            }
        });
    }
});
