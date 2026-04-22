// local_db.js
import { initDrive, loadFromDrive, saveToDrive } from './drive_adapter.js';
import {
    showCustomAlert,
    showTopAlert,
    showCustomConfirm,
    arrayBufferToBase64 as arrayBufferToBase64Util,
    base64ToArrayBuffer as base64ToArrayBufferUtil
} from './ui_utils.js';

import { renderFullItemSheet } from './item_renderer.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { renderFullCharacterSheet } from './card-renderer.js';
let db;
let isDriveLoaded = false;

const DB_CONFIG = {
    name: 'RPGCardsDB',
    version: 2,
    stores: {
        rpgCards: { keyPath: 'id' },
        rpgSpells: { keyPath: 'id' },
        rpgItems: { keyPath: 'id' },
        rpgAttacks: { keyPath: 'id' },
        rpgEffects: { keyPath: 'id' },
        rpgCategories: { keyPath: 'id' },
        rpgGrimoires: { keyPath: 'id' }
    }
};

async function migrateEffectsStoreIfNeeded() {
    // Esta migração faz 2 coisas:
    // 1) Garante que quaisquer dados antigos (rpgSpells/rpgAttacks) existam em rpgEffects.
    // 2) Remove os duplicados dos stores antigos, deixando apenas rpgEffects como fonte de verdade.

    const [effects, oldSpells, oldAttacks] = await Promise.all([
        getData('rpgEffects'),
        getData('rpgSpells'),
        getData('rpgAttacks')
    ]);

    const existingIds = new Set((Array.isArray(effects) ? effects : []).map(e => e.id));
    const toUpsert = [];

    if (Array.isArray(oldSpells) && oldSpells.length > 0) {
        oldSpells.forEach(s => {
            // Mantém magia/habilidade conforme já existe no card
            const base = { ...s };
            base.type = base.type || 'magia';

            if (!existingIds.has(base.id)) {
                toUpsert.push(base);
                existingIds.add(base.id);
            }
        });
    }

    if (Array.isArray(oldAttacks) && oldAttacks.length > 0) {
        oldAttacks.forEach(a => {
            const base = {
                id: a.id,
                name: a.name || '',
                description: a.description || '',

                circle: 0,
                execution: a.execution || '',
                manaCost: 0,
                range: a.range || '',
                target: a.target || '',
                duration: a.duration || '',
                resistencia: a.resistencia || '',
                enhance: a.enhance || '',
                true: a.true || '',
                aumentos: Array.isArray(a.aumentos) ? a.aumentos : [],

                type: 'ataque',
                characterId: a.characterId || '',
                categoryId: a.categoryId || '',

                acerto: a.acerto || '',
                dano: a.dano || '',
                critico: a.critico || '',
                danoSemMana: a.danoSemMana || '',

                image: a.image || null,
                imageMimeType: a.imageMimeType || null,
                enhanceImage: a.enhanceImage || null,
                enhanceImageMimeType: a.enhanceImageMimeType || null,
                trueImage: a.trueImage || null,
                trueImageMimeType: a.trueImageMimeType || null,

                predominantColor: a.predominantColor || null
            };

            if (!existingIds.has(base.id)) {
                toUpsert.push(base);
                existingIds.add(base.id);
            }
        });
    }

    // 1) Upsert no novo store
    for (const eff of toUpsert) {
        await saveData('rpgEffects', eff);
    }

    // 2) Sempre que houver dados antigos, limpa os stores antigos para evitar duplicação
    // (principalmente após restaurar backup de versões antigas).
    const shouldClearOldSpells = Array.isArray(oldSpells) && oldSpells.length > 0;
    const shouldClearOldAttacks = Array.isArray(oldAttacks) && oldAttacks.length > 0;

    if (shouldClearOldSpells) {
        const tx = db.transaction('rpgSpells', 'readwrite');
        await new Promise(resolve => { tx.objectStore('rpgSpells').clear().onsuccess = resolve; });
    }
    if (shouldClearOldAttacks) {
        const tx = db.transaction('rpgAttacks', 'readwrite');
        await new Promise(resolve => { tx.objectStore('rpgAttacks').clear().onsuccess = resolve; });
    }
}

// --- Funções Auxiliares de Conversão (Reutilizadas) ---
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

async function createMiniCards()
{
    const [characters, effects, items] = await Promise.all([getData('rpgCards'), getData('rpgEffects'), getData('rpgItems') ]);

    let allCardsHtml = '<div id="characters-grid" class="relationships-grid relationships-grid-slide expanded" style="overflow-y: auto; ">';

    if (effects && effects.length > 0) {
        const effectCardsHtml = await Promise.all(effects.map(async (eff) => {
            const miniSheetHtml = await renderFullSpellSheet(eff, false);
            return `
                <div class="related-spell-grid-item" data-id="${eff.id}" data-type="effect" style="margin-right: -15px;">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        allCardsHtml += ` ${effectCardsHtml.join('')}  `;
    }

    let charactersGridHtml = '';
    if (characters.length > 0) {
        const charactersCardsHtml = await Promise.all(characters.map(async (character) => {
            const miniSheetHtml = await renderFullCharacterSheet(character, false);
            return `
                <div class="related-character-grid-item" data-id="${character.id}" data-type="character" style="margin-right: -15px;">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        allCardsHtml += ` ${charactersCardsHtml.join('')} `;
    }

    let itemsGridHtml = '';
    if (items.length > 0) {
        const itemsCardsHtml = await Promise.all(items.map(async (item) => {
            const miniSheetHtml = await renderFullItemSheet(item, false);
            return `
                <div class="related-item-grid-item" data-id="${item.id}" data-type="item" style="margin-right: -15px;">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        allCardsHtml += ` ${itemsCardsHtml.join('')} `;
    }

  
    return allCardsHtml;

}

// --- Modais de Progresso (Com Barra) ---
let progressModal = null;
async function createProgressModal() {

   let grid = await createMiniCards();

    if (document.getElementById('progress-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'progress-modal';
    modal.className = 'hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999]';
    modal.innerHTML = `
        <div class="bg-gray-900 border-2 border-indigo-800/50 text-white rounded-2xl shadow-2xl w-72 max-w-sm text-center p-6 relative" style="overflow: hidden;">
            <div class="loading-dice text-4xl mb-3 text-indigo-400"><i class="fas fa-dice-d20 fa-spin"></i></div>
            <h3 id="progress-title" class="text-lg font-bold text-indigo-300" style="margin-bottom: 25px;">Processando...</h3>
            <div class="rounded-3xl w-full" style="scroll-snap-align: start;flex-shrink: 0;min-width: 100%; position: relative; z-index: 1; overflow-y: visible; display: flex; flex-direction: column; justify-content: flex-end; opacity: 0.6;">
                ${grid}
            </div>
            <p id="progress-message" class="text-gray-400 text-sm mb-4">Aguarde...</p>            

            <!-- Botão de Abortar -->
            <button id="abort-progress-btn" class="mt-4 text-xs text-red-400 hover:text-red-300 hidden">Cancelar Operação</button>
        </div>
    `;
    document.body.appendChild(modal);
    progressModal = modal;
}

export function showProgressModal(title = "Processando...", initialPercent = 0) {
    if (!progressModal) {
        createProgressModal().then(() => showProgressModal(title, initialPercent));
        return;
    }
    const modal = document.getElementById('progress-modal');
    if (!modal) return;
    modal.querySelector('#progress-title').textContent = title;
    modal.querySelector('#progress-message').textContent = 'Iniciando...';
    modal.querySelector('#abort-progress-btn').classList.add('hidden'); // Reset do botão
    
    modal.classList.remove('hidden');
}

export function updateProgress(message, percent = null) {
    if (!progressModal) return;
    const modal = document.getElementById('progress-modal');
    if (message) {
        modal.querySelector('#progress-message').textContent = message;
    }
}


export function hideProgressModal() {
    if (!progressModal) return;
    progressModal.classList.add('hidden');
}

// --- Captura de Dados Completa (Para Salvar no Drive) ---
async function getAllDataAsJSON() {
    const exportedData = {};
    const storeNames = Object.keys(DB_CONFIG.stores);

    for (const storeName of storeNames) {
        const data = await getData(storeName);
        if (Array.isArray(data)) {
            exportedData[storeName] = data.map(item => {
                const newItem = { ...item };
                // Converte Buffers para Base64 para salvar em JSON
                if (newItem.image instanceof ArrayBuffer) newItem.image = arrayBufferToBase64(newItem.image);
                if (newItem.backgroundImage instanceof ArrayBuffer) newItem.backgroundImage = arrayBufferToBase64(newItem.backgroundImage);
                if (newItem.enhanceImage instanceof ArrayBuffer) newItem.enhanceImage = arrayBufferToBase64(newItem.enhanceImage);
                if (newItem.trueImage instanceof ArrayBuffer) newItem.trueImage = arrayBufferToBase64(newItem.trueImage);
                
                if (storeName === 'rpgGrimoires' && Array.isArray(newItem.entries)) {
                    newItem.entries = newItem.entries.map(entry => {
                        const newEntry = { ...entry };
                        if (newEntry.image instanceof ArrayBuffer) newEntry.image = arrayBufferToBase64(newEntry.image);
                        return newEntry;
                    });
                }
                return newItem;
            });
        }
    }
    return exportedData;
}

// --- Restauração de Dados (Do JSON para IndexedDB) ---
async function restoreDataFromJSON(jsonData) {
    const storeNames = Object.keys(jsonData);
    for (const storeName of storeNames) {
        if (db.objectStoreNames.contains(storeName)) {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Limpa dados antigos
            await new Promise(resolve => {
                store.clear().onsuccess = resolve;
            });

            const items = jsonData[storeName];
            for (const item of items) {
                // Converte Base64 de volta para ArrayBuffer
                if (item.image && typeof item.image === 'string') item.image = base64ToArrayBuffer(item.image);
                if (item.backgroundImage && typeof item.backgroundImage === 'string') item.backgroundImage = base64ToArrayBuffer(item.backgroundImage);
                if (item.enhanceImage && typeof item.enhanceImage === 'string') item.enhanceImage = base64ToArrayBuffer(item.enhanceImage);
                if (item.trueImage && typeof item.trueImage === 'string') item.trueImage = base64ToArrayBuffer(item.trueImage);
                
                if (storeName === 'rpgGrimoires' && Array.isArray(item.entries)) {
                    item.entries = item.entries.map(entry => {
                        if (entry.image && typeof entry.image === 'string') entry.image = base64ToArrayBuffer(entry.image);
                        return entry;
                    });
                }
                await store.put(item);
            }
        }
    }
}

// --- Inicialização do Banco de Dados ---
export async function openDatabase() {
    // 1. Inicia o IndexedDB Local (Rápido)
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
        request.onerror = (e) => reject(e.target.errorCode);
        request.onsuccess = (e) => {
            db = e.target.result;
            createProgressModal();
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            Object.keys(DB_CONFIG.stores).forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, DB_CONFIG.stores[storeName]);
                }
            });
        };
    });

    await migrateEffectsStoreIfNeeded();

    // 2. Inicializa o Drive em segundo plano
    initDrive().then(() => {
        console.log("Drive API Initialized");
    });

    // 3. Ouve o evento de sucesso de login
    document.addEventListener('driveLoginSuccess', async () => {
        showTopAlert('Conectado ao Drive. Use os botões para Salvar/Carregar.', 3000, 'info');
    });

    // 4. Listeners de conexão Global
    window.addEventListener('offline', () => {
        showTopAlert("Você está offline.", 3000, "error");
    });
    window.addEventListener('online', () => {
        showTopAlert("Conexão restaurada.", 3000, "success");
    });

    return db;
}

// --- FUNÇÕES DE SINCRONIZAÇÃO MANUAL (COM PROCESSO CONTROLADO) ---

export async function manualSaveToDrive() {
    // Check de Internet
    if (!navigator.onLine) {
        showTopAlert("Sem conexão com a internet.", 3000, "error");
        return;
    }

    if(await showCustomConfirm('Isso substituirá o backup no Google Drive. Continuar?')) {
        showProgressModal("Salvando na Nuvem", 0);
        
        // Controlador de Abortamento (para Internet cair ou User cancelar)
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Habilitar botão cancelar
        const abortBtn = document.getElementById('abort-progress-btn');
        if(abortBtn) {
            abortBtn.classList.remove('hidden');
            abortBtn.onclick = () => {
                controller.abort();
                hideProgressModal();
                showTopAlert("Operação cancelada pelo usuário.", 2000, "info");
            };
        }
        
        // Handler para Offline
        const offlineHandler = () => {
            controller.abort();
            hideProgressModal();
            showTopAlert("Conexão perdida. Operação abortada.", 4000, "error");
        };
        window.addEventListener('offline', offlineHandler);

        try {
            updateProgress("Preparando dados...", 5);
            const fullData = await getAllDataAsJSON(); 
            
            if (signal.aborted) throw new Error("Aborted");

            // Passa signal e callback para atualizar a barra
            await saveToDrive(fullData, signal, (percent) => {
                // Ajuste fino da mensagem
                let msg = percent < 30 ? "Preparando upload..." : "Enviando dados...";
                updateProgress(msg, percent);
            });
            
            updateProgress("Concluído!", 100);
            setTimeout(hideProgressModal, 800);

        } catch (e) {
            if (e.name === 'AbortError' || e.message === 'Aborted') {
                // Já tratado no handler
            } else {
                console.error("Erro no salvamento manual:", e);
                showTopAlert("Erro ao salvar. Verifique sua conexão.", 3000, "error");
                hideProgressModal();
            }
        } finally {
            window.removeEventListener('offline', offlineHandler);
        }
    }
}

export async function manualLoadFromDrive() {
    if (!navigator.onLine) {
        showTopAlert("Sem conexão com a internet.", 3000, "error");
        return;
    }

    if(await showCustomConfirm('Isso substituirá TODOS os dados locais pelos da Nuvem. Continuar?')) {
        showProgressModal("Baixando da Nuvem", 0);
        
        const controller = new AbortController();
        const signal = controller.signal;

        const abortBtn = document.getElementById('abort-progress-btn');
        if(abortBtn) {
            abortBtn.classList.remove('hidden');
            abortBtn.onclick = () => {
                controller.abort();
                hideProgressModal();
                showTopAlert("Operação cancelada.", 2000, "info");
            };
        }

        const offlineHandler = () => {
            controller.abort();
            hideProgressModal();
            showTopAlert("Conexão perdida. Download abortado.", 4000, "error");
        };
        window.addEventListener('offline', offlineHandler);

        let success = false;
        try {
            updateProgress("Conectando...", 5);
            
            const cloudData = await loadFromDrive(signal, (percent) => {
                let msg = "Baixando...";
                if (percent > 90) msg = "Processando arquivo...";
                updateProgress(msg, percent);
            });

            if (signal.aborted) throw new Error("Aborted");

            if (cloudData) {
                updateProgress("Restaurando banco de dados...", 98);
                await restoreDataFromJSON(cloudData);

                await migrateEffectsStoreIfNeeded();
                
                success = true;
                updateProgress("Concluído! Recarregando...", 100);
                showTopAlert('Dados carregados! O site será recarregado.', 2000, 'success');
                
                // Recarrega a página após 1.5 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (e) {
            if (e.name === 'AbortError' || e.message === 'Aborted') {
                // Ignore
            } else {
                console.error("Erro no carregamento manual:", e);
                showTopAlert("Erro ao carregar da nuvem.", 3000, "error");
            }
        } finally {
            window.removeEventListener('offline', offlineHandler);
            
            // Só esconde o modal se NÃO for recarregar a página (se deu erro ou abortou)
            if (!success) {
                if (!signal.aborted) setTimeout(hideProgressModal, 800);
                else hideProgressModal();
            }
        }
    }
}


// --- Operações CRUD (SEM SYNC AUTOMÁTICO) ---

export function saveData(storeName, data) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not open.");
        
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = async () => {
            resolve(request.result);
            // REMOVIDO: agendamento automático para o drive
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

export function getData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not open.");
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = key ? store.get(key) : store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export function removeData(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not open.");
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = async () => {
            resolve();
            // REMOVIDO: agendamento automático para o drive
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- Importação/Exportação Manual (Mantidas) ---

export async function exportDatabase(onProgress = () => {}) {
    showProgressModal("Exportando Local", 0);
    try {
        updateProgress("Coletando dados...", 20);
        const exportedData = await getAllDataAsJSON();
        
        updateProgress("Gerando arquivo JSON...", 80);
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
        updateProgress("Concluído!", 100);
        setTimeout(hideProgressModal, 500);
    } catch(e) {
        hideProgressModal();
        console.error(e);
        showTopAlert("Erro ao exportar", 3000, "error");
    }
}

export async function importDatabase(file, onProgress = () => {}) {
    showProgressModal("Importando Local", 0);
    try {
        updateProgress("Lendo arquivo...", 30);
        const content = await file.text();
        const importedData = JSON.parse(content);
        
        updateProgress("Restaurando dados...", 60);
        await restoreDataFromJSON(importedData);

        await migrateEffectsStoreIfNeeded();
        
        updateProgress("Importação concluída!", 100);
        setTimeout(hideProgressModal, 500);
    } catch(e) {
        hideProgressModal();
        console.error(e);
        showTopAlert("Erro ao importar", 3000, "error");
    }
}

export async function exportImagesAsPng(onProgress = () => {}) {
    showProgressModal("Exportando Imagens", 0);
    
    // Helper local para usar a modal de progresso global
    const localOnProgress = (msg) => updateProgress(msg, -1);
    
    try {
        const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip();

        const processRawImages = async (storeName, mainFolderName) => {
            localOnProgress(`A carregar imagens de ${mainFolderName}...`);
            const items = await getData(storeName);
            if (!items || items.length === 0) return;
            const folder = zip.folder(mainFolderName);
            for (const item of items) {
                const safeItemName = (item.name || item.title || `${mainFolderName}_sem_nome_${item.id}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                if (item.image && item.imageMimeType) {
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
        
        localOnProgress("A carregar fichas de personagem...");
        const allCards = await getData('rpgCards');
        if (allCards && allCards.length > 0) {
            const sheetsFolder = zip.folder("fichas_personagens_renderizadas");
            const totalCards = allCards.length;
            const renderPromises = allCards.map(async (card, index) => {
                localOnProgress(`A renderizar personagem ${index + 1} de ${totalCards}: ${card.title}`);
                try {
                    const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
                    const container = document.createElement('div');
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    container.style.top = '0px';
                    document.body.appendChild(container);
                    await renderFullCharacterSheet(card, false, false, container);
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
                    localOnProgress(`Erro ao renderizar ${card.title}. A saltar.`);
                }
            });
            await Promise.all(renderPromises);
        }
        
        await processRawImages('rpgCards', 'imagens_personagens');
        await processRawImages('rpgEffects', 'imagens_efeitos');
        await processRawImages('rpgItems', 'imagens_itens');

        localOnProgress("A carregar imagens do grimório...");
        const allGrimoires = await getData('rpgGrimoires');
        if (allGrimoires && allGrimoires.length > 0) {
            const grimoiresFolder = zip.folder("imagens_grimorios");
            for (const grimoire of allGrimoires) {
                const safeGrimoireTitle = (grimoire.title || 'grimorio_sem_titulo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const grimoireVol = (grimoire.vol || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const folderName = `${safeGrimoireTitle}${grimoireVol ? `_${grimoireVol}` : ''}`;
                const specificGrimoireFolder = grimoiresFolder.folder(folderName);
                if (grimoire.entries && grimoire.entries.length > 0) {
                    for (let i = 0; i < grimoire.entries.length; i++) {
                        const entry = grimoire.entries[i];
                        if (entry.image && entry.imageMimeType) {
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

        localOnProgress("A compactar ficheiros... Por favor, aguarde.");
        const content = await zip.generateAsync({ type: "blob" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = "rpg_backup_imagens.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        
        updateProgress("Concluído!", 100);
        setTimeout(hideProgressModal, 500);
    } catch (e) {
        hideProgressModal();
        showTopAlert("Erro na exportação de imagens.", 3000, "error");
    }
}
