import { bufferToBlob } from './ui_utils.js';

async function getRelatedItemCards(itemData) {
    const { getData } = await import('./local_db.js');
    const relationIds = [
        { role: 'base', label: 'Base', id: itemData.id },
        { role: 'enhance', label: 'Aprimorar', id: itemData.enhanceCardId },
        { role: 'true', label: 'Verdadeiro', id: itemData.trueCardId }
    ];

    const cards = await Promise.all(relationIds.map(async relation => {
        if (relation.role === 'base') return { ...relation, card: itemData };
        if (!relation.id) return null;
        const card = await getData('rpgItems', relation.id);
        return card ? { ...relation, card } : null;
    }));

    return cards.filter(Boolean);
}

function resolveItemCardSize(aspectRatio, options = {}) {
    if (Number(options.cardWidth) > 0 && Number(options.cardHeight) > 0) {
        return {
            finalWidth: Number(options.cardWidth),
            finalHeight: Number(options.cardHeight)
        };
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if ((windowWidth / aspectRatio) > windowHeight) {
        const finalHeight = windowHeight * 0.9;
        return {
            finalWidth: finalHeight * aspectRatio,
            finalHeight
        };
    }

    const finalWidth = windowWidth * 0.9;
    return {
        finalWidth,
        finalHeight: finalWidth / aspectRatio
    };
}

function getInlineRelatedLayout(cardCount, aspectRatio) {
    if (cardCount <= 1 || window.innerWidth < 900) return null;

    const gap = 18;
    const maxWidth = window.innerWidth * 0.94;
    const maxHeight = window.innerHeight * 0.86;
    let cardWidth = (maxWidth - (gap * (cardCount - 1))) / cardCount;
    let cardHeight = cardWidth / aspectRatio;

    if (cardHeight > maxHeight) {
        cardHeight = maxHeight;
        cardWidth = cardHeight * aspectRatio;
    }

    if (cardWidth < 300) return null;

    return {
        cardWidth: Math.floor(cardWidth),
        cardHeight: Math.floor(cardHeight),
        gap
    };
}

export async function renderFullItemSheet(itemData, isModal, options = {}) {
    const sheetContainer = document.getElementById('item-sheet-container');
    if (!sheetContainer) return '';

    const aspectRatio = 9 / 16;

    if(isModal) {  
        const index = document.getElementsByClassName('visible').length;
        sheetContainer.style.zIndex = 100000000 + index;
    }

    const { finalWidth, finalHeight } = resolveItemCardSize(aspectRatio, options);

    let createdObjectUrl = null;
    let imageUrl = 'https://placehold.co/400x400/a0522d/ffffff?text=Item';
    if (itemData.image) {
        createdObjectUrl = URL.createObjectURL(bufferToBlob(itemData.image, itemData.imageMimeType));
        imageUrl = createdObjectUrl;
    }
    
    const predominantColor = itemData.predominantColor || { color30: 'rgba(217, 119, 6, 0.3)', color100: 'rgb(217, 119, 6)' };
    const origin = isModal ? "" : "transform-origin: top left";
    const transformProp = isModal ? 'transform: scale(.9);' : '';
    const uniqueId = `item-${itemData.id}-${Date.now()}`;
    itemData.aumentos = Array.isArray(itemData.aumentos)
        ? itemData.aumentos.filter(a => (a?.tipo || 'fixo') === 'fixo')
        : [];

    // Incluindo Acerto
    const details = [
        { label: 'Tipo', value: itemData.type },
        { label: 'Acerto', value: itemData.acerto },
        { label: 'Critico', value: itemData.critico },
        { label: 'Dano', value: itemData.damage },
        { label: 'Dano Sem Mana', value: itemData.danoSemMana },
        { label: 'Dado Vida', value: itemData.vidaDado },
        { label: 'Dado Mana', value: itemData.manaDado },
        { label: 'Carga', value: itemData.charge },
        { label: 'Pré-requisito', value: itemData.prerequisite }
    ].filter(d => d.value);

    let detailsHtml = '';
    if (details.length > 0) {
        detailsHtml = `
            <div class="pt-2">
                <h3 class="text-sm font-semibold flex items-center gap-2">Detalhes</h3>
                <div class="text-gray-300 text-xs leading-relaxed mt-1 pl-6 space-y-1">
                    <ul class="list-disc list-inside">
                        ${details.map(d => `<li><span class="font-semibold">${d.label}:</span> ${d.value}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    let aumentosHtml = '';
    if (itemData.aumentos && itemData.aumentos.length > 0) {
        const aumentosFixos = itemData.aumentos.filter(a => (a?.tipo || 'fixo') === 'fixo');
        const createList = (list, title, color) => {
            if (list.length === 0) return '';
            const items = list.map(a => `<li><span class="font-semibold">${a.nome}:</span> ${a.valor > 0 ? '+' : ''}${a.valor}</li>`).join('');
            return `<div class="mb-2"><h5 class="font-bold text-sm ${color}">${title}</h5><ul class="list-disc list-inside text-xs">${items}</ul></div>`;
        };
        
        aumentosHtml = `
            <div class="pt-2">
                <h3 class="text-sm font-semibold flex items-center gap-2">Aumentos</h3>
                <div class="text-gray-300 text-xs leading-relaxed mt-1 pl-6 space-y-1">
                    ${createList(aumentosFixos, 'Bônus Fixos', 'text-green-300')}
                    ${''}
                </div>
            </div>
        `;
    }

    const sheetHtml = `
        <button id="close-item-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-20 thumb-btn" style="display:${isModal? "block": "none"};"><i class="fa-solid fa-xmark"></i></button>
        <div id="item-sheet-${uniqueId}" class="w-full h-full rounded-lg shadow-2xl overflow-hidden relative text-white" style="${origin}; background-image: url('${imageUrl}'); background-size: cover; background-position: center; box-shadow: 0 0 20px ${predominantColor.color100}; width: ${finalWidth}px; height: ${finalHeight}px; ${transformProp} margin: 0 auto;">        
            <div class="w-full h-full" style="background: linear-gradient(-180deg, #000000a4, transparent, transparent, #0000008f, #0000008f, #000000a4); display: flex; align-items: center; justify-content: center;">
                <div class="rounded-lg" style="width: 100%; height: calc(100% - 20px); border: 3px solid ${predominantColor.color100}; margin: 10px;"></div>
            </div>
            
            <div class="w-full text-left absolute top-0 line-top" style="background-color: ${predominantColor.color30}; padding-top: 20px; padding-bottom: 10px; text-align: center; --minha-cor: ${predominantColor.color100};">
                <h3 class="font-bold tracking-tight text-white" style="font-size: 1.3rem">${itemData.name}</h3>
            </div>
            
            <div class="mt-auto p-6 pt-3 md:p-6 w-full text-left absolute bottom-0 line-bottom" style="background-color: ${predominantColor.color30}; --minha-cor: ${predominantColor.color100};">                
                <div class="sheet-card-text-panel">                      
                  <div class="space-y-3 max-h-40 overflow-y-auto pr-2">
                        ${[
                            { label: 'Descrição', value: itemData.effect },
                            { label: 'Aprimorar', value: itemData.enhance, hidden: Boolean(itemData.enhanceCardId) },
                            { label: 'Verdadeiro', value: itemData.true, hidden: Boolean(itemData.trueCardId) }
                        ].filter(section => section.value && !section.hidden).map(section => `
                            <div class="pt-2">
                                <h3 class="text-sm font-semibold flex items-center gap-2">${section.label}</h3>
                                <p class="text-gray-300 text-xs leading-relaxed mt-1 pl-6" style="white-space:pre-line;">${section.value}</p>
                            </div>
                        `).join('')}
                        ${detailsHtml}
                        ${aumentosHtml}
                    </div>
                </div>
            </div>            
        </div>       
    `;

    if (!isModal) return sheetHtml;

    const relatedCards = await getRelatedItemCards(itemData);
    if (relatedCards.length > 1) {
        const inlineLayout = getInlineRelatedLayout(relatedCards.length, aspectRatio);
        const relatedCardWidth = inlineLayout?.cardWidth || finalWidth;
        const relatedCardHeight = inlineLayout?.cardHeight || finalHeight;
        const carouselClass = `spell-carousel-shell${inlineLayout ? ' spell-carousel-shell--inline' : ''}`;
        const carouselStyle = inlineLayout
            ? `width: ${relatedCardWidth * relatedCards.length + inlineLayout.gap * (relatedCards.length - 1)}px; height: ${relatedCardHeight}px; --spell-carousel-gap: ${inlineLayout.gap}px; --spell-related-card-width: ${relatedCardWidth}px;`
            : `width: ${finalWidth}px; height: ${finalHeight}px;`;

        const slidesHtml = (await Promise.all(relatedCards.map(async (relation, index) => {
            const cardHtml = await renderFullItemSheet(relation.card, false, {
                cardWidth: relatedCardWidth,
                cardHeight: relatedCardHeight
            });

            return `
                <div class="spell-carousel-slide${index === 0 ? ' active' : ''}" data-slide-index="${index}">
                    <div class="spell-carousel-label">${relation.label}</div>
                    ${cardHtml}
                </div>
            `;
        }))).join('');

        sheetContainer.innerHTML = `
            <button id="close-item-sheet-btn-${uniqueId}" class="absolute top-4 right-4 bg-red-600 hover:text-white z-50 thumb-btn" style="display:block;">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="${carouselClass}" style="${carouselStyle}">
                ${inlineLayout ? '' : '<button type="button" class="spell-carousel-nav prev" aria-label="Card anterior"><i class="fas fa-chevron-left"></i></button>'}
                <div class="spell-carousel-track">
                    ${slidesHtml}
                </div>
                ${inlineLayout ? '' : '<button type="button" class="spell-carousel-nav next" aria-label="Proximo card"><i class="fas fa-chevron-right"></i></button>'}
                ${inlineLayout ? '' : `<div class="spell-carousel-dots">
                    ${relatedCards.map((relation, index) => `<button type="button" class="spell-carousel-dot${index === 0 ? ' active' : ''}" data-slide-index="${index}" aria-label="${relation.label}"></button>`).join('')}
                </div>`}
            </div>
        `;
    } else {
        sheetContainer.innerHTML = sheetHtml;
    }

    sheetContainer.style.backgroundImage = `url(icons/fundo.svg)`;
    sheetContainer.style.backgroundSize = 'cover';
    sheetContainer.style.backgroundPosition = 'center';
    sheetContainer.classList.remove('hidden');
    setTimeout(() => sheetContainer.classList.add('visible'), 10);

    const closeSheet = () => {
        sheetContainer.classList.remove('visible');
        const handler = () => {
            sheetContainer.classList.add('hidden');
            sheetContainer.innerHTML = '';
            if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
            sheetContainer.removeEventListener('transitionend', handler);
        };
        sheetContainer.addEventListener('transitionend', handler);
    };

    const closeBtn = sheetContainer.querySelector(`#close-item-sheet-btn-${uniqueId}`);
    if (closeBtn) {
        const newBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newBtn, closeBtn);
        newBtn.addEventListener('click', closeSheet);
    }

    const carousel = sheetContainer.querySelector('.spell-carousel-shell');
    if (carousel && !carousel.classList.contains('spell-carousel-shell--inline')) {
        let activeIndex = 0;
        const slides = Array.from(carousel.querySelectorAll('.spell-carousel-slide'));
        const dots = Array.from(carousel.querySelectorAll('.spell-carousel-dot'));
        const showSlide = (nextIndex) => {
            activeIndex = (nextIndex + slides.length) % slides.length;
            slides.forEach((slide, index) => slide.classList.toggle('active', index === activeIndex));
            dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
        };

        carousel.querySelector('.spell-carousel-nav.prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(activeIndex - 1);
        });
        carousel.querySelector('.spell-carousel-nav.next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(activeIndex + 1);
        });
        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                showSlide(parseInt(dot.dataset.slideIndex, 10) || 0);
            });
        });
    }
    
    const overlayHandler = (e) => {
        if (e.target === sheetContainer) {
            closeSheet();
            sheetContainer.removeEventListener('click', overlayHandler);
        }
    };
    sheetContainer.addEventListener('click', overlayHandler);
}
