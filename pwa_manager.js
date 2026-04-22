import { showTopAlert } from './ui_utils.js';

let deferredInstallPrompt = null;

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        await navigator.serviceWorker.register('./sw.js?v=2', { scope: './' });
    } catch (error) {
        console.error('Falha ao registrar o service worker:', error);
    }
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    window.deferredPwaInstallPrompt = deferredInstallPrompt;
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.deferredPwaInstallPrompt = null;
    showTopAlert('Aplicativo instalado com sucesso.', 3000, 'success');
});

window.promptPwaInstall = async function promptPwaInstall() {
    if (!deferredInstallPrompt) return false;

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    window.deferredPwaInstallPrompt = null;
    return choice.outcome === 'accepted';
};

window.addEventListener('load', () => {
    registerServiceWorker();
});
