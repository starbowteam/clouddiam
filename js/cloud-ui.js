let currentPage = 'home';
let currentFolder = 'root';
let folderHistory = ['root'];
let particleCanvas, particleCtx, particles = [];

function initUI() {
    // Частицы
    particleCanvas = document.getElementById('particleCanvas');
    if (particleCanvas) {
        particleCtx = particleCanvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * particleCanvas.width,
                y: Math.random() * particleCanvas.height,
                radius: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.5 + 0.2
            });
        }
        animateParticles();
    }

    // Навигация по страницам
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            const page = icon.dataset.page;
            navigateToPage(page);
        });
    });

    // Быстрые действия
    document.querySelectorAll('.quick-action-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            if (action === 'upload') document.getElementById('fileInput').click();
            else if (action === 'folder') openCreateFolderModal();
            else if (action === 'share') navigateToPage('shared');
            else if (action === 'search') {
                navigateToPage('files');
                setTimeout(() => document.getElementById('filesSearch').focus(), 200);
            }
        });
    });

    // Загрузка файлов
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileUpload);

    // Кнопки на странице файлов
    document.getElementById('uploadBtn2')?.addEventListener('click', () => fileInput.click());
    document.getElementById('createFolderBtn2')?.addEventListener('click', openCreateFolderModal);

    // Поиск на странице файлов
    document.getElementById('filesSearch')?.addEventListener('input', filterFiles);

    // Сортировка
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadFiles(btn.dataset.sort);
        });
    });

    // Закрытие панели прогресса
    document.getElementById('closeUploadProgress')?.addEventListener('click', () => {
        document.getElementById('uploadProgressPanel').style.display = 'none';
    });

    // Сохранение папки
    document.getElementById('saveFolderBtn')?.addEventListener('click', createFolder);

    // Копирование ссылки
    document.getElementById('copyShareLink')?.addEventListener('click', () => {
        const input = document.getElementById('shareLinkInput');
        input.select();
        document.execCommand('copy');
        showToast('Ссылка скопирована');
    });

    // Начальная загрузка
    checkAuth();
}

function resizeCanvas() {
    if (!particleCanvas) return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}

function animateParticles() {
    if (!particleCtx) return;
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > particleCanvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > particleCanvas.height) p.speedY *= -1;
        particleCtx.beginPath();
        particleCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        particleCtx.fillStyle = `rgba(126,168,212,${p.opacity})`;
        particleCtx.fill();
    });
    requestAnimationFrame(animateParticles);
}

function navigateToPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.sidebar-icon[data-page]').forEach(icon => {
        icon.classList.remove('active');
        if (icon.dataset.page === page) icon.classList.add('active');
    });

    if (page === 'files') loadFiles();
    else if (page === 'shared') loadSharedFiles();
    else if (page === 'stats') loadStats();
    else if (page === 'home') loadDashboardData();
}

async function loadDashboardData() {
    if (!currentUser) return;
    try {
        const files = await getAllFiles();
        const folders = await getFolders();
        const storageInfo = await getStorageInfo();

        // Статистика
        document.querySelector('.hero-stat:nth-child(1) .number').textContent = files.length;
        document.querySelector('.hero-stat:nth-child(2) .number').textContent = folders.length;

        // Прогресс-бар
        document.getElementById('storageUsed').textContent = storageInfo.usedFormatted;
        document.getElementById('storageLimit').textContent = storageInfo.limitFormatted;
        document.getElementById('storagePercent').textContent = storageInfo.percent + '%';
        document.getElementById('storageFill').style.width = storageInfo.percent + '%';

        // План
        const planBadge = document.querySelector('.storage-plan-badge');
        if (planBadge) planBadge.textContent = storageInfo.tariff;

        // Недавние файлы
        const recentFiles = [...files].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
        const recentList = document.getElementById('recentFilesList');
        if (recentFiles.length > 0) {
            recentList.innerHTML = recentFiles.map(f => `
                <div class="file-row" onclick="navigateToPage('files')">
                    <div class="file-icon"><i class="fas fa-file"></i></div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(f.name)}</div>
                        <div class="file-meta">${formatBytes(f.size)} · ${formatDate(f.createdAt)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            recentList.innerHTML = '<p class="text-muted">Нет недавних файлов</p>';
        }

        // Трафик (заглушка)
        document.getElementById('trafficUsed').textContent = formatBytes(Math.random() * 100 * 1024 * 1024);
    } catch (e) {
        console.error('[UI] Ошибка загрузки данных:', e);
    }
}

function openCreateFolderModal() {
    if (!currentUser) {
        showToast('Войдите в систему');
        return;
    }
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderModalTitle').innerHTML = '<i class="fas fa-folder-plus"></i> Новая папка';
    openModal('folderModal');
}

async function createFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) {
        showToast('Введите название папки');
        return;
    }
    try {
        await addFolder({
            name,
            parent: currentFolder,
            createdAt: Date.now()
        });
        closeModal('folderModal');
        showToast('Папка создана');
        loadFiles();
        loadDashboardData();
    } catch (e) {
        console.error('[UI] Ошибка создания папки:', e);
        showToast('Ошибка создания папки');
    }
}

let currentSort = 'name';

async function loadFiles(sortBy = currentSort) {
    if (!currentUser) return;
    currentSort = sortBy;
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '<p class="text-muted">Загрузка...</p>';

    try {
        const folders = await getFolders(currentFolder);
        const files = await getFiles(currentFolder);

        let items = [...folders.map(f => ({ ...f, type: 'folder' })), ...files.map(f => ({ ...f, type: 'file' }))];

        // Сортировка
        if (sortBy === 'name') {
            items.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'date') {
            items.sort((a, b) => b.createdAt - a.createdAt);
        } else if (sortBy === 'size') {
            items.sort((a, b) => (b.size || 0) - (a.size || 0));
        }

        // Хлебные крошки
        updateBreadcrumbs();

        if (items.length === 0) {
            filesList.innerHTML = '<p class="text-muted">Пусто</p>';
            return;
        }

        filesList.innerHTML = items.map(item => {
            if (item.type === 'folder') {
                return `
                    <div class="folder-item" onclick="openFolder('${item.id}', '${escapeHtml(item.name)}')">
                        <div class="folder-icon"><i class="fas fa-folder"></i></div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(item.name)}</div>
                            <div class="file-meta">Папка</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="file-item">
                        <div class="file-icon"><i class="fas fa-file"></i></div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(item.name)}</div>
                            <div class="file-meta">
                                <span>${formatBytes(item.size)}</span>
                                <span>${formatDate(item.createdAt)}</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button onclick="downloadFile(${item.id})" title="Скачать"><i class="fas fa-download"></i></button>
                            <button onclick="shareFile(${item.id})" title="Поделиться"><i class="fas fa-share-alt"></i></button>
                            <button onclick="deleteFileItem(${item.id})" title="Удалить"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    } catch (e) {
        filesList.innerHTML = '<p class="text-muted">Ошибка загрузки</p>';
        console.error(e);
    }
}

function openFolder(folderId, folderName) {
    currentFolder = folderId;
    folderHistory.push(folderId);
    loadFiles();
}

function updateBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    let html = `<span class="breadcrumb active" data-folder="root"><i class="fas fa-home"></i> Главная</span>`;
    if (currentFolder !== 'root') {
        html += `<span class="breadcrumb-separator">/</span><span class="breadcrumb active">Папка</span>`;
    }
    breadcrumbs.innerHTML = html;
    breadcrumbs.querySelectorAll('.breadcrumb[data-folder="root"]').forEach(bc => {
        bc.addEventListener('click', () => {
            currentFolder = 'root';
            folderHistory = ['root'];
            loadFiles();
        });
    });
}

function filterFiles() {
    const term = document.getElementById('filesSearch').value.toLowerCase();
    document.querySelectorAll('.file-item, .folder-item').forEach(item => {
        const name = item.querySelector('.file-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(term) ? '' : 'none';
    });
}

async function handleFileUpload(event) {
    if (!currentUser) {
        showToast('Войдите в систему');
        return;
    }
    const files = event.target.files;
    if (!files.length) return;

    const storageInfo = await getStorageInfo();
    let totalSize = 0;
    for (let file of files) totalSize += file.size;

    if (storageInfo.used + totalSize > storageInfo.limit) {
        showToast('Недостаточно места в хранилище');
        return;
    }

    const progressPanel = document.getElementById('uploadProgressPanel');
    const progressList = document.getElementById('uploadProgressList');
    progressPanel.style.display = 'block';
    progressList.innerHTML = '';

    for (let file of files) {
        const item = document.createElement('div');
        item.className = 'upload-progress-item';
        item.innerHTML = `
            <i class="fas fa-file"></i>
            <span>${escapeHtml(file.name)}</span>
            <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
        `;
        progressList.appendChild(item);

        const fill = item.querySelector('.progress-fill');
        // Симуляция загрузки
        for (let i = 0; i <= 100; i += Math.random() * 20 + 10) {
            await new Promise(r => setTimeout(r, 100));
            fill.style.width = Math.min(i, 100) + '%';
        }
        fill.style.width = '100%';

        // Симуляция шифрования
        const encryptLabel = document.createElement('span');
        encryptLabel.textContent = ' 🔒 Шифрую...';
        encryptLabel.style.color = 'var(--accent)';
        item.appendChild(encryptLabel);
        await new Promise(r => setTimeout(r, 800));

        // Сохраняем в IndexedDB
        const reader = new FileReader();
        const fileData = await new Promise((resolve) => {
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result,
                    folder: currentFolder,
                    createdAt: Date.now()
                });
            };
            reader.readAsDataURL(file);
        });

        const fileId = await addFile(fileData);

        // Имитация отправки в TeraBox (фоновая)
        try {
            await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, fileSize: file.size, userId: currentUser.login })
            });
            encryptLabel.textContent = ' ☁️ Отправлено в облако';
        } catch (e) {
            encryptLabel.textContent = ' ⚠️ Локально';
        }
    }

    showToast('Загрузка завершена');
    loadFiles();
    loadDashboardData();
    event.target.value = '';
}

async function downloadFile(fileId) {
    if (!currentUser) return;
    const files = await getFiles(currentFolder);
    const file = files.find(f => f.id === fileId);
    if (!file || !file.data) {
        showToast('Файл не найден');
        return;
    }

    const a = document.createElement('a');
    a.href = file.data;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function shareFile(fileId) {
    if (!currentUser) return;
    // Генерируем публичную ссылку (имитация через Vercel функцию)
    const shareUrl = `${window.location.origin}/api/download?fileId=${fileId}&userId=${currentUser.login}`;
    document.getElementById('shareLinkInput').value = shareUrl;
    openModal('shareModal');
    // Сохраняем информацию о шаринге локально
    addSharedLink(fileId, { url: shareUrl, createdAt: Date.now() });
    loadSharedFiles();
}

async function deleteFileItem(fileId) {
    if (!currentUser || !confirm('Удалить файл?')) return;
    try {
        await deleteFile(fileId);
        showToast('Файл удалён');
        loadFiles();
        loadDashboardData();
    } catch (e) {
        showToast('Ошибка удаления');
    }
}

async function loadSharedFiles() {
    if (!currentUser) return;
    const sharedList = document.getElementById('sharedFilesList');
    try {
        const shared = await getSharedFiles();
        if (shared.length === 0) {
            sharedList.innerHTML = '<p class="text-muted">Нет опубликованных файлов</p>';
            return;
        }
        sharedList.innerHTML = shared.map(s => `
            <div class="file-row">
                <div class="file-icon"><i class="fas fa-link"></i></div>
                <div class="file-info">
                    <div class="file-name">Файл #${s.fileId}</div>
                    <div class="file-meta">${formatDate(s.createdAt)}</div>
                </div>
                <button class="btn" onclick="navigator.clipboard.writeText('${s.url}')"><i class="fas fa-copy"></i></button>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

async function loadStats() {
    if (!currentUser) return;
    try {
        const files = await getAllFiles();
        const folders = await getFolders();
        const storageInfo = await getStorageInfo();
        const shared = await getSharedFiles();

        document.getElementById('statFolders').textContent = folders.length;
        document.getElementById('statFiles').textContent = files.length;
        document.getElementById('statStorage').textContent = storageInfo.usedFormatted;
        document.getElementById('statDownloads').textContent = shared.length;
    } catch (e) {
        console.error(e);
    }
}
