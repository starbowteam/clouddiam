// Динамическая проверка авторизации
function checkAuth() {
    if (!currentUser) {
        // Если не авторизован, показываем кнопку входа в hero
        const heroActions = document.querySelector('.hero-actions');
        if (heroActions) {
            heroActions.innerHTML = `
                <button class="btn btn-primary" id="loginViaDiamKeyBtn">
                    <i class="fas fa-key"></i> Войти через DiamKey
                </button>
            `;
        }
        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('createFolderBtn').style.display = 'none';
        document.getElementById('recentPanel').querySelector('#recentFilesList').innerHTML = '<p class="text-muted">Войдите, чтобы увидеть файлы</p>';
        return false;
    } else {
        updateUserInterface();
        return true;
    }
}

function updateUserInterface() {
    const heroActions = document.querySelector('.hero-actions');
    if (heroActions) {
        heroActions.innerHTML = `
            <button class="btn btn-primary" id="uploadBtn"><i class="fas fa-upload"></i> Загрузить файл</button>
            <button class="btn" id="createFolderBtn"><i class="fas fa-folder-plus"></i> Создать папку</button>
        `;
        document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('createFolderBtn').addEventListener('click', openCreateFolderModal);
    }
    loadDashboardData();
}

function redirectToDiamKeyLogin() {
    const currentUrl = window.location.origin + '/oauth.html';
    const redirectUrl = window.location.origin + '?';
    const authUrl = `https://diamkey.ru/oauth.html?redirect=${encodeURIComponent(redirectUrl)}&app=${encodeURIComponent('Diamond Cloud')}`;
    window.location.href = authUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginViaDiamKeyBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', redirectToDiamKeyLogin);
    }

    document.getElementById('logoutSidebarBtn').addEventListener('click', () => {
        localStorage.removeItem('diamond_cloud_user');
        currentUser = null;
        currentTariff = 'free';
        updateAllUI();
        showToast('Вы вышли из Diamond Cloud');
    });
});

function updateAllUI() {
    checkAuth();
    if (typeof loadFiles === 'function') loadFiles();
    if (typeof loadSharedFiles === 'function') loadSharedFiles();
    if (typeof loadStats === 'function') loadStats();
}
