document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('actions-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    const sidebar1 = document.getElementById('actions-sidebar-1');
    const sidebarToggle1 = document.getElementById('sidebar-toggle-1');

    if (sidebar1 && sidebarToggle1) {
        sidebarToggle1.addEventListener('click', () => {
            sidebar1.classList.toggle('active');
        });
    }
});
