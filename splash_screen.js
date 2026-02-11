document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');

    setTimeout(() => {
        splashScreen.classList.add('hidden');
        mainContent.style.visibility = 'visible';
        mainContent.style.opacity = '1';
    }, 2500); // Corresponde à duração da animação
});
