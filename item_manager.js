import { saveData, getData, removeData } from './local_db.js';
import { renderFullItemSheet } from './item_renderer.js';
import { openSelectionModal } from './navigation_manager.js';
import { getAumentosData, populateCharacterSelect } from './character_manager.js';
import { populateCategorySelect } from './category_manager.js';
import { showImagePreview } from './ui_utils.js';

let currentEditingItemId = null;
let itemImageFile = null;

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
    const defaultColor = { color30: 'rgba(217, 119, 6, 0.3)', color100: 'rgb(217, 119, 6)' }; // amber-600

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

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
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

export function populateItemAumentosSelect() {
    const select = document.getElementById('item-aumento-select');
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
    const list = document.getElementById('item-aumentos-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-gray-800 p-2 rounded-lg';
    div.dataset.nome = aumento.nome;
    div.dataset.valor = aumento.valor;
    div.dataset.tipo = aumento.tipo;

    div.innerHTML = `
        <div>
            <span class="font-semibold text-amber-300">${aumento.nome}</span>
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

export async function saveItemCard(itemForm) {
    const itemNameInput = document.getElementById('itemName');
    const itemDescriptionInput = document.getElementById('itemDescription');
    const itemTypeInput = document.getElementById('itemType');
    const itemDamageInput = document.getElementById('itemDamage');
    const itemChargeInput = document.getElementById('itemCharge');
    const itemPrerequisiteInput = document.getElementById('itemPrerequisite');
    const itemCharacterOwnerInput = document.getElementById('itemCharacterOwner');
    const itemCategorySelect = document.getElementById('item-category-select');
    
    const aumentosList = document.getElementById('item-aumentos-list');
    const aumentos = [];
    aumentosList.querySelectorAll('div[data-nome]').forEach(el => {
        aumentos.push({
            nome: el.dataset.nome,
            valor: parseInt(el.dataset.valor, 10),
            tipo: el.dataset.tipo
        });
    });

    let existingData = null;
    if (currentEditingItemId) {
        existingData = await getData('rpgItems', currentEditingItemId);
    }

    const imageBuffer = itemImageFile ? await readFileAsArrayBuffer(itemImageFile) : (existingData ? existingData.image : null);
    const imageMimeType = itemImageFile ? itemImageFile.type : (existingData ? existingData.imageMimeType : null);
    
    let itemData;
    if (currentEditingItemId) {
        itemData = existingData;
        Object.assign(itemData, {
            name: itemNameInput.value,
            effect: itemDescriptionInput.value,
            type: itemTypeInput.value,
            damage: itemDamageInput.value,
            charge: itemChargeInput.value,
            prerequisite: itemPrerequisiteInput.value,
            characterId: itemCharacterOwnerInput.value,
            categoryId: itemCategorySelect.value,
            aumentos,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        });
    } else {
        itemData = {
            id: Date.now().toString(),
            name: itemNameInput.value,
            effect: itemDescriptionInput.value,
            type: itemTypeInput.value,
            damage: itemDamageInput.value,
            charge: itemChargeInput.value,
            prerequisite: itemPrerequisiteInput.value,
            characterId: itemCharacterOwnerInput.value,
            categoryId: itemCategorySelect.value,
            aumentos,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        };
    }

    itemData.predominantColor = await calculateColor(itemData.image, itemData.imageMimeType);

    await saveData('rpgItems', itemData);

    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'itens' } }));

    itemForm.reset();
    itemImageFile = null;
    document.getElementById('item-aumentos-list').innerHTML = '';
    showImagePreview(document.getElementById('itemImagePreview'), null);
    currentEditingItemId = null;
}

export async function editItem(itemId) {
    const itemData = await getData('rpgItems', itemId);
    if (!itemData) return;

    currentEditingItemId = itemId;
    document.getElementById('itemName').value = itemData.name;
    document.getElementById('itemDescription').value = itemData.effect;
    document.getElementById('itemType').value = itemData.type || '';
    document.getElementById('itemDamage').value = itemData.damage || '';
    document.getElementById('itemCharge').value = itemData.charge || '';
    document.getElementById('itemPrerequisite').value = itemData.prerequisite || '';
    
    await populateCharacterSelect('itemCharacterOwner');
    document.getElementById('itemCharacterOwner').value = itemData.characterId || '';

    await populateCategorySelect('item-category-select', 'item');
    document.getElementById('item-category-select').value = itemData.categoryId || '';

    const aumentosList = document.getElementById('item-aumentos-list');
    aumentosList.innerHTML = '';
    if (itemData.aumentos && Array.isArray(itemData.aumentos)) {
        itemData.aumentos.forEach(aumento => renderAumentoNaLista(aumento));
    }

    const itemImagePreview = document.getElementById('itemImagePreview');
    if (itemData.image) {
        const imageBlob = bufferToBlob(itemData.image, itemData.imageMimeType);
        showImagePreview(itemImagePreview, URL.createObjectURL(imageBlob));
    } else {
        showImagePreview(itemImagePreview, null);
    }
}

export async function removeItem(itemId) {
    await removeData('rpgItems', itemId);
}

export async function exportItem(itemId) {
    const itemData = await getData('rpgItems', itemId);
    if (itemData) {
        const dataToExport = { ...itemData };
        if (dataToExport.image) dataToExport.image = arrayBufferToBase64(dataToExport.image);
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(dataToExport.name || 'item').replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export async function importItem(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedItem = JSON.parse(e.target.result);
                importedItem.id = Date.now().toString(); 
                if (importedItem.image) {
                    importedItem.image = base64ToArrayBuffer(importedItem.image);
                }
                importedItem.predominantColor = await calculateColor(importedItem.image, importedItem.imageMimeType);
                await saveData('rpgItems', importedItem);
                resolve(importedItem);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    populateItemAumentosSelect();
    
    document.addEventListener('periciasUpdated', populateItemAumentosSelect);

    const addBtn = document.getElementById('add-item-aumento-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const select = document.getElementById('item-aumento-select');
            const valueInput = document.getElementById('item-aumento-value');
            const typeRadio = document.querySelector('input[name="item-aumento-type"]:checked');
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

document.getElementById('itemImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        itemImageFile = file;
        showImagePreview(document.getElementById('itemImagePreview'), URL.createObjectURL(file));
    }
});

export function renderInventoryForForm(characterItems, strengthValue) {
    const strength = strengthValue || 0;
    const charItemsWithOriginalIndex = characterItems.map((item, index) => ({ ...item, originalIndex: index }));

    const slotAddingItems = charItemsWithOriginalIndex.filter(item => parseInt(item.charge) < 0);
    const zeroChargeItems = charItemsWithOriginalIndex.filter(item => parseInt(item.charge) == 0);
    const regularItems = charItemsWithOriginalIndex.filter(item => parseInt(item.charge) > 0);
    
    const extraSlots = slotAddingItems.reduce((acc, item) => acc + Math.abs(parseInt(item.charge)), 0);
    const totalSlots = (strength * 2) + 5 + extraSlots;
    const totalCharge = regularItems.reduce((acc, item) => acc + parseInt(item.charge), 0);
    
    document.getElementById('slots-info').textContent = `Força: ${strength} | Carga: ${totalCharge}/${totalSlots}`;

    const specialContainer = document.getElementById('special-equipment-container');
    const slotsContainer = document.getElementById('item-slots-container');
    const zeroChargeContainer = document.getElementById('zero-charge-items-container');
    
    specialContainer.innerHTML = '';
    slotsContainer.innerHTML = '';
    zeroChargeContainer.innerHTML = '';

    if (slotAddingItems.length > 0) {
        slotAddingItems.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'slot slot-occupied';
            slot.title = `Clique para remover "${item.name}"`;
            let imageURL = 'https://placehold.co/60x60/d2a679/422006?text=B';
            if (item.image) imageURL = URL.createObjectURL(bufferToBlob(item.image, item.imageMimeType));
            slot.innerHTML = `<img src="${imageURL}" alt="${item.name}"><span class="slot-item-name">${item.name} (${item.charge})</span>`;
            slot.addEventListener('click', () => document.dispatchEvent(new CustomEvent('requestItemRemoval', { detail: { itemIndex: item.originalIndex } })));
            specialContainer.appendChild(slot);
        });
    } else {
        specialContainer.innerHTML = '<p class="col-span-full text-center text-xs text-gray-500">Nenhum equipamento especial.</p>';
    }

    if (zeroChargeItems.length > 0) {
        zeroChargeItems.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'slot slot-occupied';
            slot.title = `Clique para remover "${item.name}"`;
            let imageURL = 'https://placehold.co/60x60/9ca3af/1f2937?text=0';
            if (item.image) imageURL = URL.createObjectURL(bufferToBlob(item.image, item.imageMimeType));
            slot.innerHTML = `<img src="${imageURL}" alt="${item.name}"><span class="slot-item-name">${item.name}</span>`;
            slot.addEventListener('click', () => document.dispatchEvent(new CustomEvent('requestItemRemoval', { detail: { itemIndex: item.originalIndex } })));
            zeroChargeContainer.appendChild(slot);
        });
    } else {
        zeroChargeContainer.innerHTML = '<p class="col-span-full text-center text-xs text-gray-500">Nenhum item de carga zero.</p>';
    }

    for (let i = 0; i < totalSlots; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = i < totalCharge ? 'slot slot-occupied' : 'slot slot-available';
        slotsContainer.appendChild(slotEl);
    }
    
    let currentSlot = 0;
    regularItems.forEach(item => {
        if(currentSlot >= totalSlots) return;
        
        const occupiedSlot = slotsContainer.children[currentSlot];
        if (occupiedSlot) {
            let imageURL = 'https://placehold.co/60x60/f59e0b/422006?text=I';
            if (item.image) imageURL = URL.createObjectURL(bufferToBlob(item.image, item.imageMimeType));
            occupiedSlot.innerHTML = `<img src="${imageURL}" alt="${item.name}"><span class="slot-item-name">${item.name} (${item.charge})</span>`;
            occupiedSlot.title = `Clique para remover "${item.name}"`;
            
            occupiedSlot.addEventListener('click', () => document.dispatchEvent(new CustomEvent('requestItemRemoval', { detail: { itemIndex: item.originalIndex } })));

            for (let i = 1; i < parseInt(item.charge); i++) {
                const nextSlotIndex = currentSlot + i;
                if (nextSlotIndex < totalSlots) {
                    slotsContainer.children[nextSlotIndex].className = 'slot slot-blocked';
                    slotsContainer.children[nextSlotIndex].innerHTML = '';
                }
            }
            currentSlot += parseInt(item.charge);
        }
    });
}