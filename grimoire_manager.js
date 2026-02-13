import { saveData, getData, removeData } from './local_db.js';
import { populateCharacterSelect } from './character_manager.js';
import { showCustomAlert, showCustomConfirm } from './ui_utils.js';

let currentPageIndex = 0;
let currentGrimoireData = null;
let entryImageFile = null;

// Funções auxiliares para manipulação de arquivos
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

/**
 * Exporta o conteúdo de um grimório para um arquivo .txt
 * @param {string} id - O ID do grimório.
 */
async function exportGrimoireToTxt(id) {
    const grimoire = await getData('rpgGrimoires', id);
    if (!grimoire) {
        showCustomAlert("Erro ao exportar: Grimório não encontrado.");
        return;
    }

    let content = "";
    const separator = "==================================================\n";
    const pageSeparator = "--------------------------------------------------\n";

    // Cabeçalho
    content += separator;
    content += `TÍTULO: ${grimoire.title}\n`;
    if (grimoire.vol) content += `VOLUME: ${grimoire.vol}\n`;
    
    // Tenta buscar o nome do dono se houver ID
    if (grimoire.characterId) {
        const character = await getData('rpgCards', grimoire.characterId);
        const ownerName = character ? character.title : 'Desconhecido';
        content += `PROPRIEDADE DE: ${ownerName}\n`;
    }
    
    content += separator + "\n";

    // Conteúdo das páginas
    if (grimoire.entries && grimoire.entries.length > 0) {
        grimoire.entries.forEach((entry, index) => {
            content += `PÁGINA ${index + 1}: ${entry.subtitle || 'Sem Título'}\n`;
            content += pageSeparator;
            content += `${entry.content || '(Página em branco)'}\n`;
            
            if (entry.image) {
                content += `\n[NOTA: Esta página contém uma imagem anexada no sistema]\n`;
            }
            content += "\n\n";
        });
    } else {
        content += "(Este grimório não possui páginas escritas.)\n";
    }

    content += separator;
    content += "Gerado por Farland RPG Manager";

    // Cria o download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Nome do arquivo seguro
    const safeTitle = (grimoire.title || 'grimorio').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeVol = (grimoire.vol || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle}${safeVol ? `_${safeVol}` : ''}.txt`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


/**
 * Função principal para renderizar a tela de gerenciamento de grimórios.
 */
export async function renderGrimoireScreen(container) {
    if (!container) {
        container = document.getElementById('content-display');
        container.innerHTML = '';
    }
    
    container.innerHTML = `
        <div class="p-6 w-full max-w-6xl mx-auto">
            <h2 class="text-3xl font-bold text-yellow-300 mb-6 border-b-2 border-gray-700 pb-2">Grimórios e Diários</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Coluna para adicionar novo -->
                <div class="bg-gray-900/50 p-6 rounded-xl border border-gray-700 h-fit">
                    <h3 class="text-xl font-semibold text-white mb-4">Novo Grimório</h3>
                    <form id="grimoire-form">
                        <div class="space-y-4">
                            <div>
                                <label for="grimoire-title" class="block text-sm font-semibold mb-1">Título</label>
                                <input type="text" id="grimoire-title" placeholder="Ex: Diário de Bordo" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                            </div>
                            <div>
                                <label for="grimoire-vol" class="block text-sm font-semibold mb-1">Volume</label>
                                <input type="text" id="grimoire-vol" placeholder="Ex: Vol. 1, Livro I" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                            </div>
                            <div>
                                <label for="grimoire-character" class="block text-sm font-semibold mb-1">Personagem Associado</label>
                                <select id="grimoire-character" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"></select>
                            </div>
                            <button type="submit" class="w-full py-2 px-6 rounded-lg font-bold text-white bg-yellow-600 hover:bg-yellow-700 transition-colors">Criar Grimório</button>
                        </div>
                    </form>
                </div>

                <!-- Lista de grimórios existentes -->
                <div id="grimoire-list-container" class="md:col-span-2 flex flex-col gap-4 h-fit">
                    <!-- Grimórios serão listados aqui -->
                </div>
            </div>
            
            <!-- Modal de Edição de Metadados do Grimório -->
            <div id="edit-metadata-modal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[300]">
                <div class="bg-gray-900 border-2 border-yellow-800/50 text-white rounded-2xl shadow-2xl w-full max-w-md">
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-yellow-300 mb-4">Editar Detalhes do Grimório</h3>
                        <form id="edit-grimoire-metadata-form">
                            <input type="hidden" id="edit-grimoire-id">
                            <div class="space-y-4">
                                <div>
                                    <label for="edit-grimoire-title" class="block text-sm font-semibold mb-1">Título</label>
                                    <input type="text" id="edit-grimoire-title" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                </div>
                                <div>
                                    <label for="edit-grimoire-vol" class="block text-sm font-semibold mb-1">Volume</label>
                                    <input type="text" id="edit-grimoire-vol" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                </div>
                                <div>
                                    <label for="edit-grimoire-character" class="block text-sm font-semibold mb-1">Personagem Associado</label>
                                    <select id="edit-grimoire-character" required class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"></select>
                                </div>
                                <div class="flex justify-end gap-3 pt-2">
                                    <button type="button" id="cancel-edit-btn" class="py-2 px-6 rounded-lg font-bold text-white bg-gray-600 hover:bg-gray-700 transition-colors">Cancelar</button>
                                    <button type="submit" class="py-2 px-6 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition-colors">Salvar Alterações</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
        </div>
    `;

    // Garante que o dropdown de personagem para o novo grimório seja populado
    await populateCharacterSelect('grimoire-character', false);
    
    // Adiciona o dropdown para o modal de edição
    await populateCharacterSelect('edit-grimoire-character', false);
    
    // Adiciona event listeners para o modal de edição de metadados
    setupMetadataModalEventListeners();


    await loadAndDisplayGrimoires();

    document.getElementById('grimoire-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('grimoire-title').value;
        const vol = document.getElementById('grimoire-vol').value;
        const characterId = document.getElementById('grimoire-character').value;
        
        if (title && characterId) {
            const grimoireData = {
                id: Date.now().toString(),
                title: title,
                vol: vol,
                characterId: characterId,
                entries: []
            };
            await saveData('rpgGrimoires', grimoireData);
            document.getElementById('grimoire-form').reset();
            await loadAndDisplayGrimoires();
        } else {
            showCustomAlert('Por favor, preencha todos os campos.');
        }
    });
}

/**
 * Configura os event listeners para o modal de edição de metadados do grimório.
 */
function setupMetadataModalEventListeners() {
    const modal = document.getElementById('edit-metadata-modal');
    const form = document.getElementById('edit-grimoire-metadata-form');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    
    // Fechar o modal
    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Submissão do formulário de edição
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const grimoireId = document.getElementById('edit-grimoire-id').value;
        const title = document.getElementById('edit-grimoire-title').value;
        const vol = document.getElementById('edit-grimoire-vol').value;
        const characterId = document.getElementById('edit-grimoire-character').value;
        
        if (grimoireId && title && characterId) {
            let grimoire = await getData('rpgGrimoires', grimoireId);
            if (grimoire) {
                grimoire.title = title;
                grimoire.vol = vol;
                grimoire.characterId = characterId;
                await saveData('rpgGrimoires', grimoire);
                showCustomAlert('Grimório atualizado com sucesso!');
                modal.classList.add('hidden');
                await loadAndDisplayGrimoires(); // Recarrega a lista
            }
        } else {
            showCustomAlert('Por favor, preencha todos os campos.');
        }
    });
}

/**
 * Abre o modal para edição do título e personagem de um grimório.
 */
async function editGrimoireMetadata(grimoireId) {
    const grimoire = await getData('rpgGrimoires', grimoireId);
    if (!grimoire) {
        showCustomAlert("Grimório não encontrado.");
        return;
    }

    // Preenche o modal
    document.getElementById('edit-grimoire-id').value = grimoire.id;
    document.getElementById('edit-grimoire-title').value = grimoire.title;
    document.getElementById('edit-grimoire-vol').value = grimoire.vol;
    document.getElementById('edit-grimoire-character').value = grimoire.characterId;
    
    // Abre o modal
    document.getElementById('edit-metadata-modal').classList.remove('hidden');
}

/**
 * Carrega e exibe a lista de grimórios existentes.
 */
async function loadAndDisplayGrimoires() {
    const listContainer = document.getElementById('grimoire-list-container');
    const allGrimoires = await getData('rpgGrimoires') || [];
    const allCharacters = await getData('rpgCards') || [];

    const charactersById = allCharacters.reduce((acc, char) => ({ ...acc, [char.id]: char }), {});

    if (allGrimoires.length === 0) {
        listContainer.className = "md:col-span-2";
        listContainer.innerHTML = '<p class="text-gray-500 italic">Nenhum grimório criado ainda.</p>';
        return;
    }

    // Agrupa os grimórios por título
    const groupedGrimoires = allGrimoires.reduce((acc, grimoire) => {
        const title = grimoire.title.trim();
        if (!acc[title]) {
            acc[title] = [];
        }
        acc[title].push(grimoire);
        return acc;
    }, {});

    // Ordena os volumes dentro de cada grupo
    for (const title in groupedGrimoires) {
        groupedGrimoires[title].sort((a, b) => 
            (a.vol || '').localeCompare(b.vol || '', undefined, { numeric: true, sensitivity: 'base' })
        );
    }

    listContainer.className = "md:col-span-2 flex flex-col gap-4 h-fit";
    
    const sortedTitles = Object.keys(groupedGrimoires).sort((a, b) => a.localeCompare(b));

    listContainer.innerHTML = sortedTitles.map(title => {
        const volumes = groupedGrimoires[title];
        const firstVolume = volumes[0];
        const owner = charactersById[firstVolume.characterId];
        const ownerName = owner ? owner.title : 'Desconhecido';
        const totalPages = volumes.reduce((sum, vol) => sum + (vol.entries?.length || 0), 0);

        const volumesHtml = volumes.map(g => {
            const pageCount = g.entries?.length || 0;
            return `
                <div class="bg-gray-900/50 rounded-md p-3 flex items-center justify-between gap-4 flex-col">
                     <div class="flex-1 min-w-0 w-full">
                        <p class="font-semibold text-white truncate" title="${g.vol || 'Volume Único'}">${g.vol || 'Volume Único'}</p>
                        <p class="text-xs text-gray-400">${pageCount} ${pageCount === 1 ? 'página escrita' : 'páginas escritas'}</p>
                     </div>
                     <div class="flex-shrink-0 flex items-center gap-2 w-full flex justify-end">
                        <button class="w-10 h-9 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center" data-action="view" data-id="${g.id}" title="Abrir Volume">
                            <i class="fas fa-book-reader"></i>
                        </button>
                        <button class="w-10 h-9 text-sm rounded-md bg-green-600 hover:bg-green-700 flex items-center justify-center" data-action="edit" data-id="${g.id}" title="Editar Volume">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="w-10 h-9 text-sm rounded-md bg-blue-600 hover:bg-blue-700 flex items-center justify-center" data-action="export-txt" data-id="${g.id}" title="Baixar como .txt">
                            <i class="fas fa-file-alt"></i>
                        </button>
                        <button class="w-10 h-9 text-sm rounded-md bg-red-700 hover:bg-red-800 flex items-center justify-center" data-action="delete" data-id="${g.id}" title="Excluir Volume">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="bg-gray-800/50 rounded-lg overflow-hidden border border-yellow-800/30 transition-all duration-300 hover:border-yellow-600/50 hover:shadow-2xl hover:shadow-yellow-900/40">
                <div class="p-5">
                    <div class="flex items-start gap-4">
                        <i class="fas fa-book-open text-3xl text-yellow-400/70 mt-1 flex-shrink-0"></i>
                        <div>
                            <h4 class="font-bold text-lg text-yellow-200">${title}</h4>
                            <p class="text-xs text-gray-400">Propriedade de: ${ownerName}</p>
                            <p class="text-xs text-gray-400">${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}, ${totalPages} ${totalPages === 1 ? 'página' : 'páginas'} no total</p>
                        </div>
                    </div>
                    <div class="mt-3 flex justify-end">
                        <button 
                            class="px-3 py-1 text-xs rounded-md bg-blue-700 hover:bg-blue-800"
                            data-action="export-all"
                            data-title="${title}"
                            title="Baixar todos os volumes em um único .txt">
                            Baixar Coleção Completa
                        </button>
                    </div>

                </div>
                <div class="bg-black/20 px-5 pb-4 pt-2">
                    <div class="flex flex-col gap-2">
                        ${volumesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listContainer.querySelectorAll('button[data-action]').forEach(button => {
        button.addEventListener('click', async (e) => {
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            if (action === 'delete') {
                if (await showCustomConfirm('Tem certeza que deseja excluir este volume do grimório?')) {
                    await removeData('rpgGrimoires', id);
                    await loadAndDisplayGrimoires();
                }
            } else if (action === 'view') {
                const grimoireData = await getData('rpgGrimoires', id);
                if (grimoireData) {
                    await openGrimoireViewer(grimoireData);
                } else {
                    showCustomAlert("Grimório não encontrado.");
                }
            } else if (action === 'edit') {
                await editGrimoireMetadata(id);
            } else if (action === 'export-txt') {
                await exportGrimoireToTxt(id);
            }
            else if (action === 'export-all') {
                const title = button.dataset.title;
                await exportAllVolumesByTitle(title);
            }
        });
    });
}

/**
 * Abre o visualizador/editor de um grimório específico.
 * @param {object} grimoireData - O objeto de dados do grimório a ser aberto.
 */
async function openGrimoireViewer(grimoireData) {
    currentGrimoireData = grimoireData;
    
    if (!Array.isArray(currentGrimoireData.entries)) {
        currentGrimoireData.entries = [];
    }

    currentPageIndex = 0;
    entryImageFile = null; // Reseta a imagem selecionada ao abrir

    const oldContainer = document.getElementById('grimoire-editor-container');
    if (oldContainer) {
        oldContainer.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'grimoire-editor-container';
    
    container.innerHTML = `
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div id="grimoire-modal-content" class="bg-gray-900 text-white shadow-2xl w-full flex flex-col relative overflow-scroll" style="position: absolute; top: 0; bottom: 0;}">
                <div class="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 class="text-2xl font-bold text-yellow-300 truncate">${currentGrimoireData.title} - ${currentGrimoireData.vol || ''}</h2>
                    <button id="close-grimoire-btn" class="text-gray-400 hover:text-white text-2xl w-8 h-8 rounded-full hover:bg-gray-700">&times;</button>
                </div>
                
                <div class="flex-grow flex flex-col md:flex-row p-2 md:p-4 gap-4 overflow-hidden">
                    <div id="page-viewer" class="w-full h-full flex flex-col bg-black/20 rounded-lg p-4 overflow-y-auto"></div>
                    <button id="toggle-editor-btn" class="md:hidden absolute bottom-4 right-4 z-20 w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center text-white shadow-lg" style="z-index: 0;">
                        <i class="fas fa-pen"></i>
                    </button>
                    <div id="editor-panel" class="absolute md:relative z-10 inset-0 md:inset-auto bg-gray-900 md:bg-transparent transform translate-x-full md:transform-none transition-transform duration-300 ease-in-out md:w-80 flex-shrink-0 flex flex-col gap-4 p-4 md:p-0">
                        <div class="flex justify-between items-center md:hidden">
                            <h3 class="text-lg font-bold text-yellow-200">Editor de Página</h3>
                            <button id="close-editor-panel-btn" class="w-8 h-8 text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                        </div>
                        <div id="page-list" class="bg-black/20 rounded-lg p-2 overflow-y-auto h-32 md:h-40"></div>
                        <form id="page-entry-form" class="bg-black/20 rounded-lg p-4 space-y-3 flex-grow flex flex-col">
                            <h4 id="form-mode-title" class="font-semibold text-lg">Nova Página</h4>
                            <input type="hidden" id="editing-page-index" value="-1">
                            <div>
                                <label for="entry-subtitle" class="text-sm font-medium">Subtítulo</label>
                                <input type="text" id="entry-subtitle" class="w-full mt-1 px-3 py-1.5 bg-gray-700 rounded-md text-sm">
                            </div>
                            <div class="flex-grow flex flex-col">
                                <div class="flex justify-between items-center mb-1">
                                    <label for="entry-content" class="text-sm font-medium">Conteúdo</label>
                                    <button type="button" id="expand-textarea-btn" class="text-gray-400 hover:text-white" title="Expandir Editor">
                                        <i class="fas fa-expand-arrows-alt"></i>
                                    </button>
                                </div>
                                <textarea id="entry-content" class="w-full px-3 py-1.5 bg-gray-700 rounded-md text-sm flex-grow resize-none"></textarea>
                            </div>
                            <div>
                                <label for="entry-image" class="text-sm font-medium">Imagem</label>
                                <input type="file" id="entry-image" accept="image/*" class="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-yellow-600 file:text-white hover:file:bg-yellow-700">
                                <img id="entry-image-preview" class="mt-2 w-full h-24 object-contain hidden rounded-md bg-black/20">
                            </div>
                            <div class="flex gap-2">
                                <button type="submit" id="save-entry-btn" class="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-bold text-sm">Salvar Página</button>
                                <button type="button" id="clear-form-btn" class="py-2 px-3 rounded-lg bg-gray-600 hover:bg-gray-500 font-bold text-sm" title="Limpar Formulário"><i class="fas fa-undo"></i></button>
                            </div>
                        </form>
                    </div>
                </div>
                <div id="fullscreen-editor-modal" class="hidden absolute inset-0 bg-gray-900/95 backdrop-blur-sm z-[210] p-4 flex flex-col rounded-2xl">
                    <div class="flex-shrink-0 flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-yellow-300">Editor de Conteúdo</h3>
                        <div class="flex gap-2">
                            <button id="save-expanded-content" class="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 font-bold text-sm">Salvar e Fechar</button>
                            <button id="cancel-expanded-content" class="py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 font-bold text-sm">Cancelar</button>
                        </div>
                    </div>
                    <textarea id="fullscreen-textarea" class="w-full h-full bg-gray-800 text-white rounded-lg p-4 resize-none border border-gray-700 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"></textarea>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    renderCurrentPage(container);
    renderPageList(container);
    setupGrimoireEventListeners(container);
}

/**
 * Renderiza a página atual no painel de visualização.
 * @param {HTMLElement} container - O elemento raiz do modal do grimório.
 */
function renderCurrentPage(container) {
    const viewer = container.querySelector('#page-viewer');
    const entry = currentGrimoireData.entries[currentPageIndex];

    if (!entry) {
        viewer.innerHTML = `<div class="m-auto text-center text-gray-500">
            <i class="fas fa-book-dead text-4xl mb-2"></i>
            <p>Este grimório está vazio.</p>
            <p class="text-sm">Use o formulário ao lado para adicionar a primeira página.</p>
        </div>`;
        return;
    }

    let imageUrl = '';
    if (entry.image && entry.imageMimeType) {
        const blob = bufferToBlob(entry.image, entry.imageMimeType);
        imageUrl = URL.createObjectURL(blob);
    }
    
    const imageElement = imageUrl 
        ? `<div class="float-left mt-4 sm:max-w-xs md:max-w-sm" style="max-width: 100%;">
               <img src="${imageUrl}" class="w-full h-auto object-contain rounded-md shadow-lg border border-gray-700">
           </div>` 
        : '';

    const pageContent = `
        <div class="clearfix">            
            <div class="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap" style="text-align: justify;">${entry.content || 'Esta página está em branco.'}</div>
            ${imageElement}
        </div>
    `;
    
    viewer.innerHTML = `
        <div class="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 class="text-xl font-bold text-yellow-100">${entry.subtitle || 'Sem subtítulo'}</h3>
            <span class="text-sm text-gray-400">Página ${currentPageIndex + 1}</span>
        </div>
        <div class="flex-grow overflow-y-auto pr-2">
            ${pageContent}
        </div>
        <div class="flex justify-center items-center gap-4 mt-4 pt-4 border-t border-gray-700 flex-shrink-0">
            <button id="prev-page-btn" class="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50" ${currentPageIndex === 0 ? 'disabled' : ''}>Anterior</button>
            <span>${currentPageIndex + 1} de ${currentGrimoireData.entries.length}</span>
            <button id="next-page-btn" class="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50" ${currentPageIndex >= currentGrimoireData.entries.length - 1 ? 'disabled' : ''}>Próxima</button>
        </div>
    `;
}

/**
 * Renderiza a lista de páginas para seleção rápida.
 * @param {HTMLElement} container - O elemento raiz do modal do grimório.
 */
function renderPageList(container) {
    const listEl = container.querySelector('#page-list');
    if (currentGrimoireData.entries.length === 0) {
        listEl.innerHTML = '<p class="text-center text-xs text-gray-500 p-2">Nenhuma página.</p>';
        return;
    }

    listEl.innerHTML = currentGrimoireData.entries.map((entry, index) => `
        <div class="flex justify-between items-center p-1.5 rounded-md cursor-pointer ${index === currentPageIndex ? 'bg-indigo-600' : 'hover:bg-gray-700/50'}" data-page-index="${index}">
            <span class="text-xs truncate">${index + 1}. ${entry.subtitle || 'Página sem título'}</span>
            <div class="flex items-center">
                <button class="text-green-400 hover:text-green-300 w-5 h-5 text-xs" title="Editar" data-action="edit-page" data-page-index="${index}"><i class="fas fa-pen"></i></button>
                <button class="text-red-500 hover:text-red-400 w-5 h-5 text-xs" title="Excluir" data-action="delete-page" data-page-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}


/**
 * Configura todos os event listeners para o modal do grimório.
 * @param {HTMLElement} container - O elemento raiz do modal do grimório.
 */
function setupGrimoireEventListeners(container) {
    if (!container) return;
    
    container.querySelector('#close-grimoire-btn').addEventListener('click', () => container.remove());

    const viewer = container.querySelector('#page-viewer');
    viewer.addEventListener('click', (e) => {
        if (e.target.id === 'prev-page-btn' && currentPageIndex > 0) {
            currentPageIndex--;
            renderCurrentPage(container);
            renderPageList(container);
        }
        if (e.target.id === 'next-page-btn' && currentPageIndex < currentGrimoireData.entries.length - 1) {
            currentPageIndex++;
            renderCurrentPage(container);
            renderPageList(container);
        }
    });

    const toggleEditorBtn = container.querySelector('#toggle-editor-btn');
    const editorPanel = container.querySelector('#editor-panel');
    const closeEditorPanelBtn = container.querySelector('#close-editor-panel-btn');

    if (toggleEditorBtn && editorPanel && closeEditorPanelBtn) {
        toggleEditorBtn.addEventListener('click', () => editorPanel.classList.remove('translate-x-full'));
        closeEditorPanelBtn.addEventListener('click', () => editorPanel.classList.add('translate-x-full'));
    }

    const form = container.querySelector('#page-entry-form');
    const imageInput = container.querySelector('#entry-image');
    const imagePreview = container.querySelector('#entry-image-preview');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            entryImageFile = file;
            imagePreview.src = URL.createObjectURL(file);
            imagePreview.classList.remove('hidden');
        } else {
            entryImageFile = null;
            imagePreview.classList.add('hidden');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subtitle = container.querySelector('#entry-subtitle').value;
        const content = container.querySelector('#entry-content').value;
        const editingIndex = parseInt(container.querySelector('#editing-page-index').value, 10);
        
        const imageBuffer = entryImageFile ? await readFileAsArrayBuffer(entryImageFile) : null;
        const imageMimeType = entryImageFile ? entryImageFile.type : null;

        if (editingIndex > -1) {
            const page = currentGrimoireData.entries[editingIndex];
            page.subtitle = subtitle;
            page.content = content;
            if (entryImageFile) {
                page.image = imageBuffer;
                page.imageMimeType = imageMimeType;
            } else if (container.querySelector('#entry-image').value === '' && !imagePreview.classList.contains('hidden')) {
                 // Manter imagem existente
            } else if (container.querySelector('#entry-image').value === '' && imagePreview.classList.contains('hidden')) {
                page.image = null;
                page.imageMimeType = null;
            }
        } else {
            const newPage = { subtitle, content, image: imageBuffer, imageMimeType: imageMimeType };
            currentGrimoireData.entries.push(newPage);
            currentPageIndex = currentGrimoireData.entries.length - 1;
        }

        await saveData('rpgGrimoires', currentGrimoireData);
        clearEntryForm(container);
        renderCurrentPage(container);
        renderPageList(container);
        await loadAndDisplayGrimoires(); // Atualiza a contagem de páginas na tela principal
    });

    container.querySelector('#clear-form-btn').addEventListener('click', () => clearEntryForm(container));

    const pageList = container.querySelector('#page-list');
    pageList.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-page-index]');
        if (!target) return;

        const index = parseInt(target.dataset.pageIndex, 10);
        const action = e.target.closest('[data-action]')?.dataset.action;

        if (action === 'edit-page') {
            const entry = currentGrimoireData.entries[index];
            container.querySelector('#form-mode-title').textContent = `Editando Página ${index + 1}`;
            container.querySelector('#editing-page-index').value = index;
            container.querySelector('#entry-subtitle').value = entry.subtitle || '';
            container.querySelector('#entry-content').value = entry.content || '';
            
            if (entry.image && entry.imageMimeType) {
                imagePreview.src = URL.createObjectURL(bufferToBlob(entry.image, entry.imageMimeType));
                imagePreview.classList.remove('hidden');
            } else {
                imagePreview.classList.add('hidden');
            }
            
            entryImageFile = null;
            container.querySelector('#entry-image').value = '';

        } else if (action === 'delete-page') {
            if(await showCustomConfirm(`Deseja excluir a página ${index + 1}?`)) {
                currentGrimoireData.entries.splice(index, 1);
                await saveData('rpgGrimoires', currentGrimoireData);
                currentPageIndex = Math.min(currentPageIndex, currentGrimoireData.entries.length - 1);
                currentPageIndex = Math.max(0, currentPageIndex);
                renderCurrentPage(container);
                renderPageList(container);
                clearEntryForm(container);
                await loadAndDisplayGrimoires(); // Atualiza a contagem de páginas
            }
        } else {
            currentPageIndex = index;
            renderCurrentPage(container);
            renderPageList(container);
        }
    });

    const expandBtn = container.querySelector('#expand-textarea-btn');
    const fullscreenModal = container.querySelector('#fullscreen-editor-modal');
    const smallTextarea = container.querySelector('#entry-content');
    const largeTextarea = container.querySelector('#fullscreen-textarea');
    const saveExpandedBtn = container.querySelector('#save-expanded-content');
    const cancelExpandedBtn = container.querySelector('#cancel-expanded-content');

    if (expandBtn && fullscreenModal && smallTextarea && largeTextarea && saveExpandedBtn && cancelExpandedBtn) {
        expandBtn.addEventListener('click', () => {
            largeTextarea.value = smallTextarea.value;
            fullscreenModal.classList.remove('hidden');
            largeTextarea.focus();
        });
        saveExpandedBtn.addEventListener('click', () => {
            smallTextarea.value = largeTextarea.value;
            fullscreenModal.classList.add('hidden');
        });
        cancelExpandedBtn.addEventListener('click', () => {
            fullscreenModal.classList.add('hidden');
        });
    }
}

/**
 * Limpa o formulário de edição de página.
 * @param {HTMLElement} container - O elemento raiz do modal do grimório.
 */
function clearEntryForm(container) {
    const form = container.querySelector('#page-entry-form');
    if (form) form.reset();
    
    const editingIndexInput = container.querySelector('#editing-page-index');
    if (editingIndexInput) editingIndexInput.value = -1;

    const formModeTitle = container.querySelector('#form-mode-title');
    if (formModeTitle) formModeTitle.textContent = 'Nova Página';

    const imagePreview = container.querySelector('#entry-image-preview');
    if (imagePreview) {
        imagePreview.classList.add('hidden');
        imagePreview.src = '';
    }
    
    entryImageFile = null;
}

/**
 * Exporta todos os volumes de um mesmo título em um único arquivo .txt
 * @param {string} title - O título do grupo de grimórios.
 */
async function exportAllVolumesByTitle(title) {
    const allGrimoires = await getData('rpgGrimoires') || [];
    const grouped = allGrimoires.filter(g => g.title.trim() === title.trim());

    if (grouped.length === 0) {
        showCustomAlert("Nenhum volume encontrado para exportação.");
        return;
    }

    let content = "";
    const bigSeparator = "============================================================\n";
    const separator = "------------------------------------------------------------\n";

    content += bigSeparator;
    content += `GRIMÓRIO COMPLETO: ${title}\n`;
    content += `TOTAL DE VOLUMES: ${grouped.length}\n`;
    content += bigSeparator + "\n\n";

    for (const grimoire of grouped) {

        content += bigSeparator;
        content += `VOLUME: ${grimoire.vol || "Volume Único"}\n`;

        if (grimoire.characterId) {
            const character = await getData('rpgCards', grimoire.characterId);
            const ownerName = character ? character.title : 'Desconhecido';
            content += `PROPRIEDADE DE: ${ownerName}\n`;
        }

        content += bigSeparator + "\n";

        if (grimoire.entries && grimoire.entries.length > 0) {
            grimoire.entries.forEach((entry, index) => {
                content += `PÁGINA ${index + 1}: ${entry.subtitle || 'Sem Título'}\n`;
                content += separator;
                content += `${entry.content || '(Página em branco)'}\n`;

                if (entry.image) {
                    content += "\n[NOTA: Esta página contém imagem no sistema]\n";
                }

                content += "\n\n";
            });
        } else {
            content += "(Este volume não possui páginas escritas.)\n\n";
        }
    }

    content += bigSeparator;
    content += "Gerado por Farland RPG Manager";

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle}_colecao_completa.txt`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

