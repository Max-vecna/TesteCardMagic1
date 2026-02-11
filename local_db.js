// local_db.js
let db;

const DB_CONFIG = {
    name: 'RPGCardsDB',
    version: 1,
    stores: {
        rpgCards: { keyPath: 'id' },
        rpgSpells: { keyPath: 'id' },
        rpgItems: { keyPath: 'id' },
        rpgAttacks: { keyPath: 'id' },
        rpgCategories: { keyPath: 'id' },
        rpgGrimoires: { keyPath: 'id' }
    }
};

// --- START: Progress Modal Logic ---
let progressModal = null;

function createProgressModal() {
    if (document.getElementById('progress-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'progress-modal';
    modal.className = 'hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999]';
    modal.innerHTML = `
        <div class="bg-gray-900 border-2 border-indigo-800/50 text-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8">
            <div class="loading-dice text-6xl mb-4">
                <i class="fas fa-dice-d20 fa-spin"></i>
            </div>
            <h3 id="progress-title" class="text-xl font-bold text-indigo-300 mb-2">Processando...</h3>
            <p id="progress-message" class="text-gray-400 text-sm">Por favor, aguarde.</p>
        </div>
    `;
    document.body.appendChild(modal);
    progressModal = modal;
}

export function showProgressModal(title = "Processando...") {
    if (!progressModal) createProgressModal();
    progressModal.querySelector('#progress-title').textContent = title;
    progressModal.querySelector('#progress-message').textContent = 'Por favor, aguarde...';
    progressModal.classList.remove('hidden');
}

export function updateProgress(message) {
    if (!progressModal) return;
    progressModal.querySelector('#progress-message').textContent = message;
}

export function hideProgressModal() {
    if (!progressModal) return;
    progressModal.classList.add('hidden');
}

// --- END: Progress Modal Logic ---


export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

        request.onerror = (event) => {
            console.error("Database error:", event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully.");
            createProgressModal(); // Create the modal once the DB is ready
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            const transaction = event.target.transaction;
            console.log(`Upgrading database from version ${event.oldVersion} to ${event.newVersion}`);

            Object.keys(DB_CONFIG.stores).forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, DB_CONFIG.stores[storeName]);
                    console.log(`Object store '${storeName}' created.`);
                }
            });

             // Exemplo de limpeza de stores antigas se necessário
            for (let i = 0; i < db.objectStoreNames.length; i++) {
                const storeName = db.objectStoreNames[i];
                if (!DB_CONFIG.stores[storeName]) {
                    db.deleteObjectStore(storeName);
                    console.log(`Old object store '${storeName}' deleted.`);
                }
            }
        };
    });
}

export function saveData(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("Database not open.");
            return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function getData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("Database not open.");
            return;
        }
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const request = key ? store.get(key) : store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function removeData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("Database not open.");
            return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}


export async function exportDatabase(onProgress = () => {}) {
    const exportedData = {};
    const storeNames = Object.keys(DB_CONFIG.stores);

    for (const storeName of storeNames) {
        onProgress(`Processando: ${storeName}...`);
        const data = await getData(storeName);
        if (Array.isArray(data)) {
            exportedData[storeName] = data.map(item => {
                const newItem = { ...item };
                if (newItem.image instanceof ArrayBuffer) {
                    newItem.image = arrayBufferToBase64(newItem.image);
                }
                if (newItem.backgroundImage instanceof ArrayBuffer) {
                    newItem.backgroundImage = arrayBufferToBase64(newItem.backgroundImage);
                }
                if (storeName === 'rpgGrimoires' && Array.isArray(newItem.entries)) {
                    newItem.entries = newItem.entries.map(entry => {
                        const newEntry = { ...entry };
                        if (newEntry.image instanceof ArrayBuffer) {
                            newEntry.image = arrayBufferToBase64(newEntry.image);
                        }
                        return newEntry;
                    });
                }
                return newItem;
            });
        }
    }

    onProgress("Gerando arquivo JSON...");
    const jsonString = JSON.stringify(exportedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rpg_cards_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onProgress("Concluído!");
}

export async function importDatabase(file, onProgress = () => {}) {
    onProgress("Lendo arquivo...");
    const content = await file.text();
    const importedData = JSON.parse(content);

    const storeNames = Object.keys(importedData);
    for (const storeName of storeNames) {
        if (db.objectStoreNames.contains(storeName)) {
            onProgress(`Limpando dados de ${storeName}...`);
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise(resolve => {
                const clearRequest = store.clear();
                clearRequest.onsuccess = resolve;
            });

            const items = importedData[storeName];
            onProgress(`Importando ${items.length} itens para ${storeName}...`);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if ((i + 1) % 20 === 0) { // Update progress every 20 items to avoid slowing down
                    onProgress(`Importando item ${i + 1} de ${items.length} para ${storeName}...`);
                }
                if (item.image && typeof item.image === 'string') {
                    item.image = base64ToArrayBuffer(item.image);
                }
                if (item.backgroundImage && typeof item.backgroundImage === 'string') {
                    item.backgroundImage = base64ToArrayBuffer(item.backgroundImage);
                }
                if (storeName === 'rpgGrimoires' && Array.isArray(item.entries)) {
                    item.entries = item.entries.map(entry => {
                        if (entry.image && typeof entry.image === 'string') {
                            entry.image = base64ToArrayBuffer(entry.image);
                        }
                        return entry;
                    });
                }
                await store.put(item);
            }
        }
    }
    onProgress("Importação concluída!");
}

export async function exportImagesAsPng(onProgress = () => {}) {
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    const zip = new JSZip();

    // Função auxiliar para processar imagens brutas de qualquer store
    const processRawImages = async (storeName, mainFolderName) => {
        onProgress(`A carregar imagens de ${mainFolderName}...`);
        const items = await getData(storeName);
        if (!items || items.length === 0) return;

        const folder = zip.folder(mainFolderName);
        let imageCount = 0;

        for (const item of items) {
            const safeItemName = (item.name || item.title || `${mainFolderName}_sem_nome_${item.id}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();

            if (item.image && item.imageMimeType) {
                imageCount++;
                const blob = new Blob([item.image], { type: item.imageMimeType });
                const extension = item.imageMimeType.split('/')[1] || 'png';
                folder.file(`${safeItemName}_imagem.${extension}`, blob);
            }

            if (storeName === 'rpgCards' && item.backgroundImage && item.backgroundMimeType) {
                const blob = new Blob([item.backgroundImage], { type: item.backgroundMimeType });
                const extension = item.backgroundMimeType.split('/')[1] || 'png';
                folder.file(`${safeItemName}_fundo.${extension}`, blob);
            }
        }
    };
    
    // Etapa 1: Renderizar Fichas de Personagem
    onProgress("A carregar fichas de personagem...");
    const allCards = await getData('rpgCards');
    if (allCards && allCards.length > 0) {
        const sheetsFolder = zip.folder("fichas_personagens_renderizadas");
        const totalCards = allCards.length;
        const renderPromises = allCards.map(async (card, index) => {
            onProgress(`A renderizar personagem ${index + 1} de ${totalCards}: ${card.title}`);
            try {
                const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0px';
                document.body.appendChild(container);

                const cardHtml = await window.renderFullCharacterSheet(card, false, false, container);
                container.innerHTML = cardHtml;
                const cardElement = container.querySelector('[id^="character-sheet-"]');

                if (cardElement) {
                    const canvas = await html2canvas(cardElement, { backgroundColor: null, scale: 2 });
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    const safeTitle = card.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    sheetsFolder.file(`${safeTitle}.png`, blob);
                }
                document.body.removeChild(container);
            } catch (error) {
                console.error(`Falha ao renderizar o card '${card.title}':`, error);
                onProgress(`Erro ao renderizar ${card.title}. A saltar.`);
            }
        });
        await Promise.all(renderPromises);
    }
    
    // Etapa 2: Processar todas as imagens brutas
    await processRawImages('rpgCards', 'imagens_personagens');
    await processRawImages('rpgSpells', 'imagens_magias_habilidades');
    await processRawImages('rpgItems', 'imagens_itens');
    await processRawImages('rpgAttacks', 'imagens_ataques');

    // Etapa 3: Processar Imagens dos Grimórios
    onProgress("A carregar imagens do grimório...");
    const allGrimoires = await getData('rpgGrimoires');
    if (allGrimoires && allGrimoires.length > 0) {
        const grimoiresFolder = zip.folder("imagens_grimorios");
        let imageCount = 0;
        for (const grimoire of allGrimoires) {
            const safeGrimoireTitle = (grimoire.title || 'grimorio_sem_titulo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const grimoireVol = (grimoire.vol || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const folderName = `${safeGrimoireTitle}${grimoireVol ? `_${grimoireVol}` : ''}`;
            const specificGrimoireFolder = grimoiresFolder.folder(folderName);

            if (grimoire.entries && grimoire.entries.length > 0) {
                for (let i = 0; i < grimoire.entries.length; i++) {
                    const entry = grimoire.entries[i];
                    if (entry.image && entry.imageMimeType) {
                        imageCount++;
                        onProgress(`A processar a imagem ${imageCount} do grimório...`);
                        const blob = new Blob([entry.image], { type: entry.imageMimeType });
                        const pageNumber = String(i + 1).padStart(2, '0');
                        const safeSubtitle = (entry.subtitle || 'sem_subtitulo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                        const extension = entry.imageMimeType.split('/')[1] || 'png';
                        
                        specificGrimoireFolder.file(`pagina_${pageNumber}_${safeSubtitle}.${extension}`, blob);
                    }
                }
            }
        }
    }

    // Etapa 4: Gerar o ZIP Final
    onProgress("A compactar ficheiros... Por favor, aguarde.");
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = "rpg_backup_imagens.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    onProgress("Concluído!");
}


// Funções auxiliares de conversão
function arrayBufferToBase64(buffer) {
    if (!buffer) return null;
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    if (!base64) return null;
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

