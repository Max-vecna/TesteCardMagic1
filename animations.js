/**
 * Aplica o posicionamento matemático 3D aos itens de um container.
 * Chame esta função logo após criar/renderizar os mini cards no DOM.
 * * @param {string} selector - O seletor do container (ex: '.relationships-grid-slide.expanded')
 */
export function apply3DCarouselEffect(selector = '.relationships-grid-slide.expanded') {
    const container = document.querySelector(selector);
    if (!container) return;

    const items = Array.from(container.children);
    const numberOfItems = items.length;
    
    if (numberOfItems === 0) return;

    // 360 graus dividido pelo número de cartas
    const angle = 360 / numberOfItems;
    
    // Largura aproximada do card + um espaçamento
    // Se seus cards tem 60px, usamos 70px para dar um respiro
    const cardWidth = 70; 

    // Fórmula para calcular a distância do centro (Raio/Z-Axis)
    // tz = (largura / 2) / tan(PI / numero_items)
    // Adicionamos Math.max(100, ...) para garantir que mesmo com poucas cartas, 
    // elas não fiquem coladas no centro.
    let tz = Math.round((cardWidth / 2) / Math.tan(Math.PI / numberOfItems));
    
    // Ajuste de segurança: se tiver poucas cartas (ex: 3), o círculo fica muito pequeno.
    // Forçamos um raio mínimo de 120px.
    if (tz < 120) tz = 120;

    items.forEach((item, index) => {
        // Aplica a rotação e a profundidade
        item.style.transform = `rotateY(${index * angle}deg) translateZ(${tz}px)`;
        
        // Garante que o estilo base não sobrescreva o transform
        item.style.position = 'absolute';
    });
}