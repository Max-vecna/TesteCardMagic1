import { saveData } from './local_db.js';
import { saveSpellCard, editSpell, removeSpell, exportSpell, importSpell } from './magic_manager.js';

export async function saveAttackCard(form) {
    return saveSpellCard(form, 'ataque');
}

export async function editAttack(attackId) {
    return editSpell(attackId);
}

export async function removeAttack(attackId) {
    return removeSpell(attackId);
}

export async function exportAttack(attackId) {
    return exportSpell(attackId);
}

export async function importAttack(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed && (parsed.type === 'ataque' || parsed.type === 'magia' || parsed.type === 'habilidade')) {
        const blob = new Blob([text], { type: 'application/json' });
        const f = new File([blob], file.name, { type: 'application/json' });
        return importSpell(f, 'ataques');
    }

    const nowId = Date.now().toString();
    const effect = {
        id: nowId,
        name: parsed?.name || '',
        description: parsed?.description || '',

        circle: 0,
        execution: parsed?.execution || '',
        manaCost: 0,
        range: parsed?.range || '',
        target: parsed?.target || '',
        duration: parsed?.duration || '',
        resistencia: parsed?.resistencia || '',
        enhance: parsed?.enhance || '',
        true: parsed?.true || '',
        aumentos: Array.isArray(parsed?.aumentos) ? parsed.aumentos : [],

        type: 'ataque',
        characterId: parsed?.characterId || '',
        categoryId: parsed?.categoryId || '',

        acerto: parsed?.acerto || '',
        dano: parsed?.dano || '',
        critico: parsed?.critico || '',
        danoSemMana: parsed?.danoSemMana || '',

        image: parsed?.image || null,
        imageMimeType: parsed?.imageMimeType || null,
        enhanceImage: parsed?.enhanceImage || null,
        enhanceImageMimeType: parsed?.enhanceImageMimeType || null,
        trueImage: parsed?.trueImage || null,
        trueImageMimeType: parsed?.trueImageMimeType || null,
        predominantColor: parsed?.predominantColor || null
    };

    await saveData('rpgEffects', effect);
    return effect;
}
