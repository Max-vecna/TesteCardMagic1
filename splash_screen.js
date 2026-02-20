
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
    }, 5000); // Corresponde à duração da animação
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
    maxCards = 16,
    minScale = 0.11,
    maxScale = 0.11,
    padding = 10
  } = opts;

  if (!containerEl) throw new Error("Container obrigatório");

  // Isolamento de layout / paint (ótimo pra animação)
  containerEl.style.position = "relative";
  containerEl.style.overflow = "hidden";
  containerEl.style.contain = "strict";
  containerEl.style.contentVisibility = "auto";

  // CSS (uma vez)
  if (!document.getElementById("float-card-anim-style")) {
    const style = document.createElement("style");
    style.id = "float-card-anim-style";
    style.textContent = `
      .splash-float-card {
        will-change: transform, opacity;
        backface-visibility: hidden;
        transform: translateZ(0);
        contain: paint layout;
        pointer-events: none;
      }
      @keyframes floatCycle {
        0% { transform: scale(0) rotate(var(--rot)); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: scale(var(--scale)) rotate(var(--rot)); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Helpers
  const rand = (min, max) => Math.random() * (max - min) + min;

  const escapeHtml = (str) =>
    String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const bufferToBlob = (buffer, mimeType) => new Blob([buffer], { type: mimeType });

  const resolveImageUrl = (data, fallbackUrl, createdUrls) => {
    if (data?.image && data?.imageMimeType) {
      const url = URL.createObjectURL(bufferToBlob(data.image, data.imageMimeType));
      createdUrls.push(url);
      return url;
    }
    return fallbackUrl;
  };

  // --- Templates LEVES (copiados do visual dos cards) ---
  // 1) Template “skin” do Magic Card (para: magia + item + ataque)
  const renderMiniMagicSkin = ({ id, name, imageUrl, predominantColor }) => {
    const color100 = predominantColor?.color100 || "rgb(13, 148, 136)";
    const color30 = predominantColor?.color30 || "rgba(13, 148, 136, 0.30)";

    // valores fixos e rápidos (fictícios)
    const topBar = `<p style="font-size: 10px;">1º Círculo - 3 PM</p>`;
    const fakeDesc = `Uma energia arcana pulsa e se manifesta em forma controlada.`;

    return `
      <div class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white"
           style="transform-origin: top left; width: 520px; height: 832px; box-shadow: 0 0 20px ${color100}; background-color: #1a1a1a;">
        
        <div class="absolute inset-0 w-full h-full bg-cover bg-center"
             style="background-image: url('${imageUrl}'); z-index: 0;"></div>

        <div class="absolute inset-0 w-full h-full z-10"
             style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4);
                    display: flex; align-items: center; justify-content: center; pointer-events: none; box-shadow: inset 0 0 5px black;">
          <div class="rounded-lg"
               style="width: 100%; height: calc(100% - 20px); border: 3px solid ${color100};
                      margin: 10px; box-shadow: inset 0 0 5px black, 0 0 5px black;"></div>
        </div>

        <div class="w-full text-left absolute top-0 z-20 pt-[20px] pb-[10px]"
             style="background-color: ${color30}; text-align: center; --minha-cor: ${color100};">
          <h3 class="font-bold tracking-tight text-white" style="font-size: 1.3rem">
            ${escapeHtml(name)}
          </h3>
          ${topBar}
        </div>

        <div class="mt-auto w-full text-left absolute bottom-0 z-20">
          <div class="p-6 pt-3 sheet-card-text-panel"
               style="background-color: ${color30}; --minha-cor: ${color100};">
            
            <div class="space-y-2" style="max-height: 9rem; height: 9rem; overflow: hidden;">
              <div>
                <h3 class="text-sm font-semibold flex items-center gap-2">Descrição</h3>
                <p class="text-gray-300 text-xs leading-relaxed mt-1"
                   style="white-space: break-spaces; text-align: justify;">
                  ${escapeHtml(fakeDesc)}
                </p>
              </div>
            </div>

            <div class="flex row mt-2 pt-2"
                 style="justify-content: space-around; border-top: 1px solid ${color100};">
              ${miniMagicIconStat("fa-dice-d20", "12+4", color100)}
              ${miniMagicIconStat("fa-crosshairs", "19–20", color100)}
              ${miniMagicIconStat("fa-fire", "2d6+2", color100)}
              ${miniMagicIconStat("fa-skull", "1d6+1", color100)}
            </div>

            <div class="grid grid-cols-5 gap-x-2 text-xs mt-2 text-center text-gray-200">
              <div><p class="font-bold tracking-wider">EX</p><p class="text-gray-300 truncate">1A</p></div>
              <div><p class="font-bold tracking-wider">AL</p><p class="text-gray-300 truncate">Médio</p></div>
              <div><p class="font-bold tracking-wider">AV</p><p class="text-gray-300 truncate">1</p></div>
              <div><p class="font-bold tracking-wider">DU</p><p class="text-gray-300 truncate">Instant.</p></div>
              <div><p class="font-bold tracking-wider">CD</p><p class="text-gray-300 truncate">14</p></div>
            </div>

          </div>
        </div>
      </div>
    `;
  };

  const miniMagicIconStat = (iconClass, value, color100) => {
    // mesmo estilo dos ícones do magic_renderer
    const [a, b] = String(value).split("+");
    const top = escapeHtml(a ?? "");
    const bot = escapeHtml(b ?? "");
    const hasPlus = value.includes("+");

    return `
      <div style="position: relative; transform: scale(.8);" class="flex flex-col items-center flex">
        <i class="fas ${iconClass} text-5xl"
           style="background: ${color100}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-white text-xs pointer-events-none" style="margin: auto;">
          <div class="text-center text-sm">
            <span class="font-bold">${top}</span>
            <hr style="width: 100%;">
            <span style="bottom: 12px;" class="font-bold">${hasPlus ? "+" : ""}${bot}</span>
          </div>
        </div>
      </div>
    `;
  };

  // 2) Template do Character Card (para: personagem)
  const renderMiniCharacterSkin = ({ id, title, subTitle, imageUrl, predominantColor }) => {
    const color = predominantColor?.colorLight || predominantColor?.color100 || "#4a5568";

    // valores fixos e rápidos (fictícios)
    const LV = 7;
    const CA = 16, ES = 12, BL = 10, DL = "9m", CD = 18;

    const attrs = [
      { v: 3, k: "AGI" },
      { v: 2, k: "CAR" },
      { v: 3, k: "FOR" },
      { v: 2, k: "INT" },
      { v: 3, k: "SAB" },
      { v: 2, k: "VIG" },
    ];

    return `
      <div class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white"
           style="transform-origin: top left; background-image: url('${imageUrl}'); background-size: cover; background-position: center;
                  box-shadow: 0 0 20px ${color}; width: 520px; height: 832px;">
        
        <div class="w-full h-full" style="background: linear-gradient(to bottom, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4);
                                          box-shadow: inset 0 0 5px black;">
          <div class="rounded-lg absolute inset-0"
               style="width: 94%; height: 96%; border: 3px solid ${color}; margin: auto;
                      box-shadow: inset 0 0 5px black, 0 0 5px black;">

            <!-- barra esquerda (defesa + atributos) -->
            <div class="h-full w-12 left-2 absolute top-0 bottom-0">
              <div class="div-combat-stats grid grid-row-6 gap-y-2 text-xs absolute top-2"
                   style="border-radius: 28px 5px 28px 5px; background: ${color}; padding: 10px; width: 42px;
                          justify-content: space-evenly; box-shadow: 0 0 10px black;">
                <div class="text-center font-bold" style="color: rgb(0 247 85);">LV<br>${LV}</div>
                ${miniDef("CA", CA)}
                ${miniDef("ES", ES)}
                ${miniDef("BL", BL)}
                ${miniDef("DL", DL)}
                <div class="text-center">CD<br>${CD}</div>
              </div>

              <div class="grid grid-row-6 gap-y-2 text-xs absolute bottom-2"
                   style="border-radius: 28px 5px 28px 5px; background: ${color}; padding: 10px; width: 42px; box-shadow: 0 0 10px black;">
                ${attrs.map(a => `
                  <label class="text-center">${a.v}<br>${a.k}</label>
                `).join("")}
              </div>
            </div>

            <!-- barra direita (vida/mana/dinheiro + ataque) -->
            <div class="h-full right-2 absolute top-0 right-0 bottom-0 flex flex-col"
                 style="align-items: flex-end; justify-content: space-between;">
              <div class="mt-2 flex flex-col items-center">
                ${miniResourceIcon("fa-heart", "88", "88", color, "rgb(0 247 85)")}
                ${miniResourceIcon("fa-fire", "40", "40", color, color)}
                <div class="money-container rounded-full w-12 pb-2 pt-2 flex mt-4 items-center justify-content-center text-sm text-amber-300 font-bold"
                     style="width: 42px; background: ${color}; box-shadow: 0 0 10px black;">
                  💰$<span>120</span>
                </div>
              </div>

              <div class="mb-2 flex flex-col items-center">
                ${miniAtkIcon("fa-dice-d20", "12+4", color)}
                ${miniAtkIcon("fa-fire", "1d8+3", color)}
              </div>
            </div>

            <!-- título topo -->
            <div class="absolute top-8 left-1/2 -translate-x-1/2 text-center z-10">
              <h3 class="text-2xl font-bold">${escapeHtml(title)}</h3>
              <p class="text-md italic text-gray-300">${escapeHtml(subTitle)}</p>
            </div>

          </div>
        </div>
      </div>
    `;
  };

  const miniDef = (label, value) =>
    `<div class="text-center"><span>${label}</span><br>${escapeHtml(value)}</div>`;

  const miniResourceIcon = (icon, cur, max, color, iconColor) => `
    <div style="position: relative;" class="mt-0 flex flex-col items-center">
      <i class="fa-solid ${icon} text-5xl"
         style="background: ${iconColor}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(2px 4px 6px black);"></i>
      <div class="absolute inset-0 flex flex-col items-center justify-center font-bold text-white text-xs pointer-events-none" style="margin: auto;">
        <span>${escapeHtml(cur)}</span>
        <hr style="width: 15px;">
        <span style="bottom: 12px;">${escapeHtml(max)}</span>
      </div>
    </div>
  `;

  const miniAtkIcon = (icon, value, color) => {
    const [a, b] = String(value).split("+");
    const top = escapeHtml(a ?? "");
    const bot = escapeHtml(b ?? "");
    const hasPlus = value.includes("+");

    return `
      <div style="position: relative; transform: scale(.8);" class="mt-4 flex flex-col items-center">
        <i class="fas ${icon} text-5xl"
           style="background: ${color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(2px 4px 6px black);"></i>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-white text-xs pointer-events-none" style="margin: auto;">
          <div class="text-center text-sm">
            <span class="font-bold">${top}</span>
            <hr style="width: 100%;">
            <span style="bottom: 12px;" class="font-bold">${hasPlus ? "+" : ""}${bot}</span>
          </div>
        </div>
      </div>
    `;
  };

  // 1) Carrega dados (só pra pegar imagem / nome / cor)
  const [characters, spells, items, attacks] = await Promise.all([
    getData("rpgCards"),
    getData("rpgSpells"),
    getData("rpgItems"),
    getData("rpgAttacks"),
  ]);

  const pool = [
    ...(spells || []).map((x) => ({ type: "spell", data: x })),
    ...(characters || []).map((x) => ({ type: "character", data: x })),
    ...(items || []).map((x) => ({ type: "item", data: x })),
    ...(attacks || []).map((x) => ({ type: "attack", data: x })),
  ];

  containerEl.replaceChildren();
  if (pool.length === 0) return;

  // libera URLs antigas
  containerEl._splashObjectUrls?.forEach((u) => URL.revokeObjectURL(u));
  const createdUrls = [];
  containerEl._splashObjectUrls = createdUrls;

  // embaralha e limita
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selectedEntries = pool.slice(0, Math.min(maxCards, pool.length));

  // grid
  const rect = containerEl.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  const totalCards = selectedEntries.length;
  const aspectRatio = W / H;
  const cols = Math.max(1, Math.ceil(Math.sqrt(totalCards * aspectRatio)));
  const rows = Math.max(1, Math.ceil(totalCards / cols));
  const cellW = W / cols;
  const cellH = H / rows;

  const gridSlots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) gridSlots.push({ r, c });
  for (let i = gridSlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gridSlots[i], gridSlots[j]] = [gridSlots[j], gridSlots[i]];
  }

  const fragment = document.createDocumentFragment();

  // monta cards (SEM renderFull...)
  selectedEntries.forEach((entry, i) => {
    const d = entry.data || {};
    const type = entry.type;

    const el = document.createElement("div");
    el.className = "splash-float-card";
    el.style.position = "absolute";
    el.style.transformOrigin = "top left";

    const scale = rand(minScale, maxScale);
    const rotation = rand(0, 0);
    const duration = rand(15, 30);
    const delay = rand(-30, 0);

    el.style.setProperty("--scale", scale);
    el.style.setProperty("--rot", `${rotation}deg`);
    el.style.animation = `floatCycle ${duration}s linear infinite`;
    el.style.animationDelay = `${delay}s`;

    // imagens fallback por tipo
    const fallback =
      type === "character"
        ? "https://placehold.co/800x600/4a5568/a0aec0?text=Personagem"
        : "https://placehold.co/400x400/00796B/B2DFDB?text=Magia";

    const imageUrl = resolveImageUrl(d, fallback, createdUrls);

    // Nomes
    const name =
      (d.name && String(d.name).trim()) ? d.name :
      (d.title && String(d.title).trim()) ? d.title :
      (type === "character" ? "Aventureiro" : "Efeito Arcano");

    // Predominant colors
    const predominantColor = d.predominantColor || (type === "character"
      ? { colorLight: "#4a5568", color100: "#4a5568" }
      : { color30: "rgba(13, 148, 136, 0.30)", color100: "rgb(13, 148, 136)" });

    // >>> regra que você pediu:
    // - personagem usa card de personagem
    // - magia usa card de magia
    // - item e ataque usam card de magia
    if (type === "character") {
      const title = d.title || name;
      const subTitle = d.subTitle || "—";
      el.innerHTML = renderMiniCharacterSkin({
        id: d.id,
        title,
        subTitle,
        imageUrl,
        predominantColor
      });
    } else {
      el.innerHTML = renderMiniMagicSkin({
        id: d.id,
        name,
        imageUrl,
        predominantColor
      });
    }

    // posicionamento
    const slot = gridSlots[i % gridSlots.length];
    const baseX = slot.c * cellW;
    const baseY = slot.r * cellH;

    const jitterX = Math.random() * (cellW * 0.6) + (cellW * 0.2);
    const jitterY = Math.random() * (cellH * 0.6) + (cellH * 0.2);

    const left = Math.min(W - padding, Math.max(padding, baseX + jitterX));
    const top = Math.min(H - padding, Math.max(padding, baseY + jitterY));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    fragment.appendChild(el);
  });

  containerEl.appendChild(fragment);
}

// Helper caso não tenha no escopo global
function rand(min, max) {
  return Math.random() * (max - min) + min;
}