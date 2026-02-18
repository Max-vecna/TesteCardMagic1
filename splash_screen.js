
import { renderFullItemSheet } from './item_renderer.js';
import { renderFullSpellSheet } from './magic_renderer.js';
import { renderFullAttackSheet } from './attack_renderer.js';
import { renderFullCharacterSheet } from './card-renderer.js';
import { openDatabase, removeData, getData, saveData, exportDatabase, importDatabase, exportImagesAsPng, showProgressModal, hideProgressModal, updateProgress, manualSaveToDrive, manualLoadFromDrive } from './local_db.js';

document.addEventListener('DOMContentLoaded', async () => {
    
await openDatabase();
const splashScreen = document.getElementById('splash-screen');

    const splashFloatingCards = document.getElementById('splash-floating-cards');
    splashFloatingCards.style.opacity = '0'; // Opacidade para destacar o conteúdo
    await createMiniCardsFloat(splashFloatingCards, { maxCards: 16 });
    setTimeout(() => {splashFloatingCards.style.opacity = '1';}, 1000); // Opacidade para destacar o conteúdo

    const mainContent = document.getElementById('main-content');

    setTimeout(() => {
        splashScreen.classList.add('hidden');
        mainContent.style.visibility = 'visible';
        mainContent.style.opacity = '1';
    }, 3000); // Corresponde à duração da animação
});

export async function createMiniCards()
{
    const [characters, spells, items, attacks] = await Promise.all([getData('rpgCards'), getData('rpgSpells'), getData('rpgItems'), getData('rpgAttacks') ]);

    let allCardsHtml = '<div id="characters-grid" class="relationships-grid relationships-grid-slide expanded" style="overflow-y: auto; ">';

    if (spells.length > 0) {
        const skillCardsHtml = await Promise.all(spells.map(async (skill) => {
            const miniSheetHtml = await renderFullSpellSheet(skill, false);
            return `
                <div class="related-spell-grid-item" data-id="${skill.id}" data-type="skill" style="margin-right: -15px;">
                    ${miniSheetHtml}
                </div>
            `;
        }));

        allCardsHtml += ` ${skillCardsHtml.join('')}  `;
    }

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

    if (attacks.length > 0) {
        const attackCardsHtml = await Promise.all(attacks.map(async (attack) => {
            const miniSheetHtml = await renderFullAttackSheet(attack, false);
            return `
                <div class="related-attack-grid-item" data-id="${attack.id}" data-type="attacks" style="margin-right: -15px;">
                    ${miniSheetHtml}
                </div>
            `;
        }));

       allCardsHtml += ` ${attackCardsHtml.join('')} </div> `;
    }

    return allCardsHtml;

}

export async function createMiniCardsFloat(containerEl, opts = {}) {
  const {
    density = 0.00008, // Ignorado agora, pois usaremos TODOS os cards
    minScale = 0.11,
    maxScale = 0.11,
    padding = 0
  } = opts;

  if (!containerEl) throw new Error("Container obrigatório");

  // Garante posicionamento relativo para os cards absolutos funcionarem
  containerEl.style.position = "relative";
  containerEl.style.overflow = "hidden";

  // --- INJEÇÃO DE ESTILO DE ANIMAÇÃO ---
  // Cria a animação de "surgir e sumir" se ainda não existir
  if (!document.getElementById("float-card-anim-style")) {
    const style = document.createElement("style");
    style.id = "float-card-anim-style";
    // Efeito "Starfield": Crescimento contínuo do 0 ao tamanho final
    style.textContent = `
      @keyframes floatCycle {
        0% { 
          transform: scale(0) rotate(var(--rot)); 
          opacity: 0; 
        }
        20% { 
          opacity: 1; 
        }
        80% { 
          opacity: 1; 
        }
        100% { 
          transform: scale(var(--scale)) rotate(var(--rot)); 
          opacity: 0; 
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 1. Carrega dados
  const [characters, spells, items, attacks] = await Promise.all([
    getData('rpgCards'),
    getData('rpgSpells'),
    getData('rpgItems'),
    getData('rpgAttacks')
  ]);

  // Cria o pool de dados
  const pool = [
    ...(spells || []).map(x => ({ type: "spell", data: x })),
    ...(characters || []).map(x => ({ type: "character", data: x })),
    ...(items || []).map(x => ({ type: "item", data: x })),
    ...(attacks || []).map(x => ({ type: "attack", data: x })),
  ];

  containerEl.innerHTML = "";
  if (pool.length === 0) return;

  const rect = containerEl.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // 2. Define quantidade: TODOS OS CARDS
  const totalCards = pool.length;

  // Calcula colunas e linhas baseadas na proporção da tela
  const aspectRatio = W / H;
  const cols = Math.ceil(Math.sqrt(totalCards * aspectRatio));
  const rows = Math.ceil(totalCards / cols);
  
  // Tamanho de cada célula da grid
  const cellW = W / cols;
  const cellH = H / rows;

  // --- NOVA LÓGICA DE DISTRIBUIÇÃO ---
  // Gera todos os slots possíveis na grade e embaralha para evitar aglomeração
  const gridSlots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      gridSlots.push({ r, c });
    }
  }

  // Fisher-Yates Shuffle para embaralhar as posições da grade
  for (let i = gridSlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gridSlots[i], gridSlots[j]] = [gridSlots[j], gridSlots[i]];
  }

  // 3. Seleciona itens aleatórios do pool SEM REPETIÇÃO
  // Primeiro, embaralha o pool inteiro
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Usa TODOS os itens disponíveis
  const selectedEntries = pool; // Pega tudo

  // 4. Renderiza HTML de todos em paralelo
  const renderedHtmls = await Promise.all(selectedEntries.map(async (entry) => {
    let html = "";
    if (entry.type === "spell") html = await renderFullSpellSheet(entry.data, false);
    if (entry.type === "character") html = await renderFullCharacterSheet(entry.data, false);
    if (entry.type === "item") html = await renderFullItemSheet(entry.data, false);
    if (entry.type === "attack") html = await renderFullAttackSheet(entry.data, false);
    return html;
  }));

  // 5. Cria fragmento para inserção única no DOM
  const fragment = document.createDocumentFragment();

  renderedHtmls.forEach((html, i) => {
    const el = document.createElement("div");
    el.className = "splash-float-card";
    
    // 🔥 FORÇA O POSICIONAMENTO CORRETO
    el.style.position = "absolute"; 
    el.style.transformOrigin = "top left"; // Importante: ancora o redimensionamento no canto
    el.innerHTML = html;

    // Estilização Visual
    const scale = rand(minScale, maxScale);
    const rotation = rand(0, 12); // Menos rotação para ficar mais legível na grade apertada
    const duration = rand(15, 30); // Duração um pouco maior para ser suave

    el.style.setProperty("--scale", scale);
    el.style.setProperty("--rot", `0deg`);
    el.style.setProperty("--dur", `${duration}s`);
    
    // Aplica a animação definida no <style> acima
    // Usando 'linear' para movimento constante tipo estrela
    const delay = rand(-30, 0); // Delay maior para espalhar bem o ciclo
    el.style.animation = `floatCycle ${duration}s linear infinite`;
    el.style.animationDelay = `${delay}s`;

    // 6. Posicionamento Distribuído (Grid Embaralhada + Jitter)
    // Se acabarem os slots únicos (caso raro onde cards > slots), repete slots ciclicamente
    const slot = gridSlots[i % gridSlots.length];
    const colIndex = slot.c;
    const rowIndex = slot.r;

    // Posição base
    const baseX = colIndex * cellW;
    const baseY = rowIndex * cellH;

    // Adiciona aleatoriedade (Jitter)
    const jitterX = Math.random() * (cellW * 0.6) + (cellW * 0.2); 
    const jitterY = Math.random() * (cellH * 0.6) + (cellH * 0.2);

    const left = baseX + jitterX;
    const top = baseY + jitterY;

    // Aplica as coordenadas calculadas
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    
    fragment.appendChild(el);
  });

  // 7. Inserção única no DOM
  containerEl.appendChild(fragment);
}

// Helper caso não tenha no escopo global
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
