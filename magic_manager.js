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
let activeSpellRelationType = 'enhance';
let pendingRelatedSpellCreation = null;

function normalizeEffectType(type) {
    if (type === 'habilidade' || type === 'ataque') return type;
    return 'magia';
}

function getCurrentSpellFormType() {
    const form = document.getElementById('spellForm');
    return normalizeEffectType(form?.dataset.type);
}

function getEffectTypeMeta(type) {
    const normalizedType = normalizeEffectType(type);
    if (normalizedType === 'habilidade') {
        return { label: 'Habilidade', icon: 'fa-fist-raised', tone: 'text-cyan-300' };
    }
    if (normalizedType === 'ataque') {
        return { label: 'Ataque', icon: 'fa-khanda', tone: 'text-red-400' };
    }
    return { label: 'Magia', icon: 'fa-magic', tone: 'text-teal-300' };
}

function getSpellFormUiMeta(type, mode = 'create') {
    const normalizedType = normalizeEffectType(type);
    const isRelated = mode === 'related';
    const isEdit = mode === 'edit';

    if (normalizedType === 'habilidade') {
        return {
            title: isRelated ? 'Nova Habilidade relacionada' : (isEdit ? 'Editando Habilidade' : 'Nova Habilidade'),
            submit: isRelated ? 'Criar relacionada' : (isEdit ? 'Salvar Habilidade' : 'Criar Habilidade'),
            hideMana: true
        };
    }

    if (normalizedType === 'ataque') {
        return {
            title: isRelated ? 'Novo Ataque relacionado' : (isEdit ? 'Editando Ataque' : 'Novo Ataque'),
            submit: isRelated ? 'Criar relacionado' : (isEdit ? 'Salvar Ataque' : 'Criar Ataque'),
            hideMana: true
        };
    }

    return {
        title: isRelated ? 'Nova Magia relacionada' : (isEdit ? 'Editando Magia' : 'Nova Magia'),
        submit: isRelated ? 'Criar relacionada' : (isEdit ? 'Salvar Magia' : 'Criar Magia'),
        hideMana: false
    };
}

function applySpellFormUi(type, mode = 'create', baseName = '') {
    const meta = getSpellFormUiMeta(type, mode);
    const titleEl = document.getElementById('spell-form-title');
    const submitEl = document.getElementById('spellSubmitButton');
    const manaWrapper = document.getElementById('mana-cost-wrapper');
    const relationsWrapper = document.getElementById('spell-related-wrapper');
    const form = document.getElementById('spellForm');

    if (titleEl) {
        titleEl.textContent = mode === 'related' && baseName
            ? `${meta.title}: ${baseName}`
            : meta.title;
    }
    if (submitEl) submitEl.textContent = meta.submit;
    if (manaWrapper) manaWrapper.classList.toggle('hidden', meta.hideMana);
    if (relationsWrapper) relationsWrapper.classList.remove('hidden');
    if (form) form.dataset.type = normalizeEffectType(type);
}

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

function hasBaseSpellImage(snapshot) {
    return Boolean(snapshot?.spellImageFile || snapshot?.spellImage);
}

function updateRelatedSpellCreationUi() {
    const createBtn = document.getElementById('create-related-spell-btn');
    const panel = document.getElementById('related-spell-creation-panel');
    const baseNameEl = document.getElementById('related-spell-base-name');
    const targetSlotEl = document.getElementById('related-spell-target-slot');
    const sameImageCheckbox = document.getElementById('related-spell-base-image-option');
    const sameImageWrapper = document.getElementById('related-spell-base-image-option-wrapper');
    const isEditingSpell = Boolean(currentEditingSpellId) && !pendingRelatedSpellCreation;

    if (createBtn) createBtn.classList.toggle('hidden', !isEditingSpell);
    if (panel) panel.classList.toggle('hidden', !pendingRelatedSpellCreation);

    if (!pendingRelatedSpellCreation) {
        if (sameImageCheckbox) {
            sameImageCheckbox.checked = false;
            sameImageCheckbox.disabled = false;
        }
        if (sameImageWrapper) sameImageWrapper.classList.remove('hidden');
        return;
    }

    if (baseNameEl) baseNameEl.textContent = pendingRelatedSpellCreation.baseName || 'card base';
    if (targetSlotEl) targetSlotEl.textContent = pendingRelatedSpellCreation.targetRelationType === 'true' ? 'Verdadeiro' : 'Aprimorar';

    const canReuseImage = hasBaseSpellImage(pendingRelatedSpellCreation.baseSnapshot);
    if (sameImageCheckbox) {
        sameImageCheckbox.checked = canReuseImage && Boolean(pendingRelatedSpellCreation.useBaseImage);
        sameImageCheckbox.disabled = !canReuseImage;
    }
    if (sameImageWrapper) sameImageWrapper.classList.toggle('hidden', !canReuseImage);
}

async function captureSpellFormSnapshot() {
    const persistedData = currentEditingSpellId ? await getData('rpgEffects', currentEditingSpellId) : null;
    const aumentos = [];
    document.querySelectorAll('#spell-aumentos-list div[data-nome]').forEach(el => {
        aumentos.push({
            nome: el.dataset.nome,
            valor: parseInt(el.dataset.valor, 10) || 0,
            tipo: el.dataset.tipo || 'fixo'
        });
    });

    return {
        currentEditingSpellId,
        type: getCurrentSpellFormType(),
        name: document.getElementById('spellName')?.value || '',
        circle: document.getElementById('spellCircle')?.value || '',
        execution: document.getElementById('spellExecution')?.value || '',
        manaCost: document.getElementById('spellManaCost')?.value || '',
        range: document.getElementById('spellRange')?.value || '',
        target: document.getElementById('spellTarget')?.value || '',
        duration: document.getElementById('spellDuration')?.value || '',
        resistencia: document.getElementById('spellResistencia')?.value || '',
        description: document.getElementById('spellDescription')?.value || '',
        enhanceCardId: document.getElementById('spellEnhanceCardId')?.value || '',
        trueCardId: document.getElementById('spellTrueCardId')?.value || '',
        characterId: document.getElementById('spellCharacterOwner')?.value || '',
        categoryId: document.getElementById('spell-category-select')?.value || '',
        acerto: document.getElementById('spellAcerto')?.value || '',
        dano: document.getElementById('spellDamage')?.value || '',
        critico: document.getElementById('spellcritico')?.value || '',
        danoSemMana: document.getElementById('spellDanoSemMana')?.value || '',
        aumentos,
        spellImageFile,
        spellImage: persistedData?.image || null,
        spellImageMimeType: persistedData?.imageMimeType || null
    };
}

async function restoreSpellFormSnapshot(snapshot, options = {}) {
    if (!snapshot) return;
    const { asNew = false, mode = 'edit' } = options;

    resetSpellFormState(true);
    applySpellFormUi(snapshot.type, mode, asNew ? (snapshot.name || 'card base') : '');
    currentEditingSpellId = asNew ? null : (snapshot.currentEditingSpellId || null);

    document.getElementById('spellName').value = snapshot.name || '';
    document.getElementById('spellCircle').value = snapshot.circle || '';
    document.getElementById('spellExecution').value = snapshot.execution || '';
    document.getElementById('spellManaCost').value = snapshot.manaCost || '';
    document.getElementById('spellRange').value = snapshot.range || '';
    document.getElementById('spellTarget').value = snapshot.target || '';
    document.getElementById('spellDuration').value = snapshot.duration || '';
    document.getElementById('spellResistencia').value = snapshot.resistencia || '';
    document.getElementById('spellDescription').value = snapshot.description || '';
    document.getElementById('spellEnhanceCardId').value = asNew ? '' : (snapshot.enhanceCardId || '');
    document.getElementById('spellTrueCardId').value = asNew ? '' : (snapshot.trueCardId || '');
    document.getElementById('spellAcerto').value = snapshot.acerto || '';
    document.getElementById('spellDamage').value = snapshot.dano || '';
    document.getElementById('spellcritico').value = snapshot.critico || '';
    document.getElementById('spellDanoSemMana').value = snapshot.danoSemMana || '';

    await populateCharacterSelect('spellCharacterOwner');
    document.getElementById('spellCharacterOwner').value = snapshot.characterId || '';

    await populateCategorySelect('spell-category-select', snapshot.type);
    document.getElementById('spell-category-select').value = snapshot.categoryId || '';

    const aumentosList = document.getElementById('spell-aumentos-list');
    if (aumentosList) {
        aumentosList.innerHTML = '';
        normalizeFixedAumentos(snapshot.aumentos).forEach(aumento => renderAumentoNaLista(aumento));
    }

    spellImageFile = snapshot.spellImageFile || null;
    if (spellImageFile) {
        showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(spellImageFile), true);
    } else if (snapshot.spellImage) {
        const imageBlob = bufferToBlobUtil(snapshot.spellImage, snapshot.spellImageMimeType);
        showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(imageBlob), true);
    } else {
        showImagePreview(document.getElementById('spellImagePreview'), null, true);
    }

    if (!asNew) pendingRelatedSpellCreation = null;
    await updateSpellRelationLabels();
    updateRelatedSpellCreationUi();
}

async function restoreBaseSpellDraft(newRelatedId = '') {
    const snapshot = pendingRelatedSpellCreation?.baseSnapshot;
    if (!snapshot) return false;

    if (newRelatedId) {
        if (pendingRelatedSpellCreation.targetRelationType === 'true') snapshot.trueCardId = newRelatedId;
        else snapshot.enhanceCardId = newRelatedId;
    }

    await restoreSpellFormSnapshot(snapshot);
    return true;
}

function getRelatedSpellBaseImage(snapshot) {
    if (!snapshot) return { image: null, mimeType: null, isFile: false };

    if (snapshot.spellImageFile) {
        return {
            image: snapshot.spellImageFile,
            mimeType: snapshot.spellImageFile.type || null,
            isFile: true
        };
    }

    return {
        image: snapshot.spellImage || null,
        mimeType: snapshot.spellImageMimeType || null,
        isFile: false
    };
}

export async function startRelatedSpellCreation() {
    if (!currentEditingSpellId) return false;

    const enhanceId = document.getElementById('spellEnhanceCardId')?.value || '';
    const trueId = document.getElementById('spellTrueCardId')?.value || '';
    const targetRelationType = !enhanceId ? 'enhance' : (!trueId ? 'true' : '');

    if (!targetRelationType) {
        showCustomAlert('Os slots Aprimorar e Verdadeiro ja estao ocupados. Remova um ou use Relacionar Cards.');
        return false;
    }

    const snapshot = await captureSpellFormSnapshot();
    pendingRelatedSpellCreation = {
        baseSpellId: snapshot.currentEditingSpellId,
        baseName: snapshot.name || 'card base',
        baseSnapshot: snapshot,
        targetRelationType,
        useBaseImage: true
    };

    await restoreSpellFormSnapshot(snapshot, { asNew: true, mode: 'related' });
    return true;
}

export async function handleSpellFormCloseRequest() {
    if (!pendingRelatedSpellCreation) return false;
    await restoreBaseSpellDraft();
    return true;
}

export function resetSpellFormState(preserveRelatedCreation = false) {
    if (!preserveRelatedCreation) pendingRelatedSpellCreation = null;
    currentEditingSpellId = null;
    spellImageFile = null;

    const spellForm = document.getElementById('spellForm');
    if (spellForm) spellForm.reset();

    const aumentosList = document.getElementById('spell-aumentos-list');
    if (aumentosList) aumentosList.innerHTML = '';

    showImagePreview(document.getElementById('spellImagePreview'), null, true);

    const enhanceInput = document.getElementById('spellEnhanceCardId');
    const trueInput = document.getElementById('spellTrueCardId');
    const enhanceLabel = document.getElementById('spellEnhanceCardName');
    const trueLabel = document.getElementById('spellTrueCardName');

    if (enhanceInput) enhanceInput.value = '';
    if (trueInput) trueInput.value = '';
    if (enhanceLabel) enhanceLabel.textContent = 'Nenhum card selecionado';
    if (trueLabel) trueLabel.textContent = 'Nenhum card selecionado';
    updateRelatedSpellCreationUi();
}

async function updateSpellRelationLabels() {
    const relations = [
        { inputId: 'spellEnhanceCardId', labelId: 'spellEnhanceCardName' },
        { inputId: 'spellTrueCardId', labelId: 'spellTrueCardName' }
    ];

    await Promise.all(relations.map(async ({ inputId, labelId }) => {
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);
        if (!input || !label) return;

        const related = input.value ? await getData('rpgEffects', input.value) : null;
        label.textContent = related?.name || 'Nenhum card selecionado';
    }));
}

export async function saveSpellCard(spellForm, type) {
    const relatedCreationContext = pendingRelatedSpellCreation;
    const spellNameInput = document.getElementById('spellName');
    const spellCircleInput = document.getElementById('spellCircle');
    const spellExecutionInput = document.getElementById('spellExecution');
    const spellManaCostInput = document.getElementById('spellManaCost');
    const spellRangeInput = document.getElementById('spellRange');
    const spellTargetInput = document.getElementById('spellTarget');
    const spellDurationInput = document.getElementById('spellDuration');
    const spellResistenciaInput = document.getElementById('spellResistencia');
    const spellDescriptionInput = document.getElementById('spellDescription');
    const spellEnhanceCardInput = document.getElementById('spellEnhanceCardId');
    const spellTrueCardInput = document.getElementById('spellTrueCardId');
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

    const baseImageSource = relatedCreationContext?.useBaseImage
        ? getRelatedSpellBaseImage(relatedCreationContext.baseSnapshot)
        : null;
    const imageBuffer = spellImageFile
        ? await readFileAsArrayBufferUtil(spellImageFile)
        : (baseImageSource?.isFile
            ? await readFileAsArrayBufferUtil(baseImageSource.image)
            : (baseImageSource?.image || (existingData ? existingData.image : null)));
    const imageMimeType = spellImageFile
        ? spellImageFile.type
        : (baseImageSource?.mimeType || (existingData ? existingData.imageMimeType : null));

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
        enhanceCardId: spellEnhanceCardInput?.value || '',
        trueCardId: spellTrueCardInput?.value || '',
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
        danoSemMana: spellDanoSemManaInput ? spellDanoSemManaInput.value : ''
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

    if (relatedCreationContext?.baseSpellId) {
        const baseSpellData = await getData('rpgEffects', relatedCreationContext.baseSpellId);
        if (baseSpellData) {
            if (relatedCreationContext.targetRelationType === 'true') baseSpellData.trueCardId = spellData.id;
            else baseSpellData.enhanceCardId = spellData.id;
            await saveData('rpgEffects', baseSpellData);
        }
    }

    const eventType = type === 'habilidade' ? 'habilidades' : (type === 'ataque' ? 'ataques' : 'magias');
    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: eventType } }));

    if (relatedCreationContext) {
        await restoreBaseSpellDraft(spellData.id);
        return { keepOpen: true, createdRelatedCardId: spellData.id };
    }

    resetSpellFormState();
    return { keepOpen: false, createdRelatedCardId: null };
}

export async function editSpell(spellId) {
    const spellData = await getData('rpgEffects', spellId);
    if (!spellData) return;

    pendingRelatedSpellCreation = null;
    currentEditingSpellId = spellId;
    applySpellFormUi(spellData.type, 'edit');

    document.getElementById('spellName').value = spellData.name;
    document.getElementById('spellCircle').value = spellData.circle || '';
    document.getElementById('spellExecution').value = spellData.execution;
    document.getElementById('spellManaCost').value = spellData.manaCost || '';
    document.getElementById('spellRange').value = spellData.range;
    document.getElementById('spellTarget').value = spellData.target;
    document.getElementById('spellDuration').value = spellData.duration;
    document.getElementById('spellResistencia').value = spellData.resistencia;
    document.getElementById('spellDescription').value = spellData.description;
    const enhanceInput = document.getElementById('spellEnhanceCardId');
    const trueInput = document.getElementById('spellTrueCardId');
    
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

    if (enhanceInput) enhanceInput.value = spellData.enhanceCardId || '';
    if (trueInput) trueInput.value = spellData.trueCardId || '';
    await updateSpellRelationLabels();
    updateRelatedSpellCreationUi();
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

    setupSpellRelationsModal();

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

    const createRelatedBtn = document.getElementById('create-related-spell-btn');
    if (createRelatedBtn) {
        createRelatedBtn.addEventListener('click', async () => {
            await startRelatedSpellCreation();
        });
    }

    const sameImageCheckbox = document.getElementById('related-spell-base-image-option');
    if (sameImageCheckbox) {
        sameImageCheckbox.addEventListener('change', (e) => {
            if (!pendingRelatedSpellCreation) {
                e.currentTarget.checked = false;
                return;
            }
            pendingRelatedSpellCreation.useBaseImage = e.currentTarget.checked;
            const baseSnapshot = pendingRelatedSpellCreation.baseSnapshot;
            const isBaseFile = spellImageFile && spellImageFile === baseSnapshot?.spellImageFile;

            if (!e.currentTarget.checked && isBaseFile) {
                spellImageFile = null;
                showImagePreview(document.getElementById('spellImagePreview'), null, true);
            } else if (!e.currentTarget.checked && !spellImageFile) {
                showImagePreview(document.getElementById('spellImagePreview'), null, true);
            } else if (e.currentTarget.checked && !spellImageFile) {
                if (baseSnapshot?.spellImageFile) {
                    spellImageFile = baseSnapshot.spellImageFile;
                    showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(baseSnapshot.spellImageFile), true);
                } else if (baseSnapshot?.spellImage) {
                    const imageBlob = bufferToBlobUtil(baseSnapshot.spellImage, baseSnapshot.spellImageMimeType);
                    showImagePreview(document.getElementById('spellImagePreview'), URL.createObjectURL(imageBlob), true);
                }
            }
        });
    }

    updateRelatedSpellCreationUi();
});

function setActiveSpellRelationType(type) {
    activeSpellRelationType = type;
    document.querySelectorAll('.spell-relation-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.relationType === type);
    });
}

async function setupSpellRelationsModal() {
    const openBtn = document.getElementById('open-spell-relations-btn');
    const modal = document.getElementById('spell-relations-modal');
    const closeBtn = document.getElementById('close-spell-relations-modal-btn');
    const list = document.getElementById('spell-relations-list');
    if (!openBtn || !modal || !closeBtn || !list) return;

    const closeModal = () => modal.classList.add('hidden');

    const renderList = async () => {
        const currentId = currentEditingSpellId;
        const currentType = getCurrentSpellFormType();
        const effects = (await getData('rpgEffects'))
            .filter(effect => effect.id !== currentId)
            .filter(effect => normalizeEffectType(effect.type) === currentType);

        const typeMeta = getEffectTypeMeta(currentType);

        if (effects.length === 0) {
            list.innerHTML = `<p class="text-gray-400 text-sm md:col-span-2">Nenhum card de ${typeMeta.label.toLowerCase()} disponivel para relacionar.</p>`;
            return;
        }

        const targetInputId = activeSpellRelationType === 'enhance' ? 'spellEnhanceCardId' : 'spellTrueCardId';
        const selectedId = document.getElementById(targetInputId)?.value || '';
        const noneActive = selectedId ? '' : ' active';
        list.innerHTML = `
            <button type="button" class="spell-relation-option${noneActive}" data-card-id="">
                <span class="flex items-center gap-2 font-semibold">
                    <i class="fas fa-ban text-gray-400"></i>
                    <span>Nenhum card</span>
                </span>
                <small>Remover relacao atual</small>
            </button>
            ${effects.map(effect => `
                <button type="button" class="spell-relation-option${effect.id === selectedId ? ' active' : ''}" data-card-id="${effect.id}">
                    <span class="flex items-center gap-2 font-semibold">
                        <i class="fas ${getEffectTypeMeta(effect.type).icon} ${getEffectTypeMeta(effect.type).tone}"></i>
                        <span>${effect.name || 'Sem nome'}</span>
                    </span>
                    <small>${effect.categoryId ? 'Card categorizado' : typeMeta.label}</small>
                </button>
            `).join('')}
        `;
    };

    openBtn.addEventListener('click', async () => {
        setActiveSpellRelationType('enhance');
        await renderList();
        modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modal.querySelectorAll('.spell-relation-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            setActiveSpellRelationType(tab.dataset.relationType);
            await renderList();
        });
    });

    list.addEventListener('click', async (e) => {
        const option = e.target.closest('.spell-relation-option');
        if (!option) return;

        const inputId = activeSpellRelationType === 'enhance' ? 'spellEnhanceCardId' : 'spellTrueCardId';
        const input = document.getElementById(inputId);
        if (input) input.value = option.dataset.cardId || '';
        await updateSpellRelationLabels();
        await renderList();
    });
}
