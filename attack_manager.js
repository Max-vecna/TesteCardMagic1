import { saveData, getData, removeData } from './local_db.js';
import { populateCharacterSelect } from './character_manager.js';
import { populateCategorySelect } from './category_manager.js';

let currentEditingAttackId = null;
let attackImageFile = null;

function showImagePreview(element, url) {
    if (url) {
        element.src = url;
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

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
    for (let i = 0; i < bytes.byteLength; i++) {
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
    const defaultColor = { color30: 'rgba(185, 28, 28, 0.3)', color100: 'rgb(185, 28, 28)' }; // red-700

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

export async function saveAttackCard(attackForm) {
    const attackNameInput = document.getElementById('attackName');
    const attackDescriptionInput = document.getElementById('attackDescription');
    const attackCharacterOwnerInput = document.getElementById('attackCharacterOwner');
    const attackCategorySelect = document.getElementById('attack-category-select');

    let existingData = null;
    if (currentEditingAttackId) {
        existingData = await getData('rpgAttacks', currentEditingAttackId);
    }

    const imageBuffer = attackImageFile ? await readFileAsArrayBuffer(attackImageFile) : (existingData ? existingData.image : null);
    const imageMimeType = attackImageFile ? attackImageFile.type : (existingData ? existingData.imageMimeType : null);
    
    let attackData;
    if (currentEditingAttackId) {
        attackData = existingData;
        Object.assign(attackData, {
            name: attackNameInput.value,
            description: attackDescriptionInput.value,
            characterId: attackCharacterOwnerInput.value,
            categoryId: attackCategorySelect.value,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        });
    } else {
        attackData = {
            id: Date.now().toString(),
            name: attackNameInput.value,
            description: attackDescriptionInput.value,
            characterId: attackCharacterOwnerInput.value,
            categoryId: attackCategorySelect.value,
            image: imageBuffer,
            imageMimeType: imageMimeType,
        };
    }

    attackData.predominantColor = await calculateColor(attackData.image, attackData.imageMimeType);

    await saveData('rpgAttacks', attackData);
    
    document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'ataques' } }));

    attackForm.reset();
    attackImageFile = null;
    showImagePreview(document.getElementById('attackImagePreview'), null);
    currentEditingAttackId = null;
}

export async function editAttack(attackId) {
    const attackData = await getData('rpgAttacks', attackId);
    if (!attackData) return;

    currentEditingAttackId = attackId;
    document.getElementById('attackName').value = attackData.name;
    document.getElementById('attackDescription').value = attackData.description;
    
    await populateCharacterSelect('attackCharacterOwner');
    document.getElementById('attackCharacterOwner').value = attackData.characterId || '';

    await populateCategorySelect('attack-category-select', 'ataque');
    document.getElementById('attack-category-select').value = attackData.categoryId || '';

    const attackImagePreview = document.getElementById('attackImagePreview');
    if (attackData.image) {
        const imageBlob = bufferToBlob(attackData.image, attackData.imageMimeType);
        showImagePreview(attackImagePreview, URL.createObjectURL(imageBlob));
    } else {
        showImagePreview(attackImagePreview, null);
    }
}

export async function removeAttack(attackId) {
    await removeData('rpgAttacks', attackId);
}

export async function exportAttack(attackId) {
    const attackData = await getData('rpgAttacks', attackId);
    if (attackData) {
        const dataToExport = { ...attackData };
        if (dataToExport.image) dataToExport.image = arrayBufferToBase64(dataToExport.image);
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(attackData.name || 'attack').replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export async function importAttack(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedAttack = JSON.parse(e.target.result);
                importedAttack.id = Date.now().toString(); 
                if (importedAttack.image) {
                    importedAttack.image = base64ToArrayBuffer(importedAttack.image);
                }
                importedAttack.predominantColor = await calculateColor(importedAttack.image, importedAttack.imageMimeType);
                await saveData('rpgAttacks', importedAttack);
                resolve(importedAttack);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

document.getElementById('attackImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        attackImageFile = file;
        showImagePreview(document.getElementById('attackImagePreview'), URL.createObjectURL(file));
    }
});
