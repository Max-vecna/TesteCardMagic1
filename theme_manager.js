document.addEventListener('DOMContentLoaded', () => {
    const themeSwitchers = document.querySelectorAll('#theme-switcher, #theme-switcher-mobile');
    const body = document.body;

    /**
     * Aplica o tema selecionado ao corpo do documento e o salva no localStorage.
     * @param {string} theme - O tema a ser aplicado ('dark' ou 'light').
     */
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark');
        } else {
            body.classList.remove('dark');
        }
        
        themeSwitchers.forEach(switcher => {
            const icon = switcher.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        });

        localStorage.setItem('theme', theme);
    };

    const switchTheme = () => {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    };

    themeSwitchers.forEach(switcher => {
        switcher.addEventListener('click', switchTheme);
    });


    // Aplica o tema salvo na carga inicial
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Padrão para escuro
    applyTheme(savedTheme);
});
