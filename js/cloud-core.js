const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// Конфигурация TeraBox (куки будут обновляться)
const TERABOX_CONFIG = {
    ndus: 'YyganXNpeHuiUdftZ0wWY3B_ijvNTjy01aq9DvLY',
    ndut_fmt: '1A9D6FA0FEB6D74EDE439D4789A257A5804B04A5AC22785FF42A86D2A32FD73B',
    ndut_fmv: 'a0f6d70707b05c039f9c6bba4e66967ec5baea8c065d728abd2f337e2f608753b1a346b044eb4edd56bf1ed738e24d5bdf4441ad13fb9771ff738eedb6d1c0ce7ab25fa52689c11ab20c532977e7dfccc3186bd6bedf48642359fff832e8f9cfe9ec3086347de85a7bcb912a58955828',
    csrfToken: 'ovxun7-RGO4gfZjtqwuirnJv'
};

const TARIFFS = {
    free: { limit: 15 * 1024 * 1024 * 1024, label: 'Free', storageLabel: '15 ГБ' },
    plus: { limit: 150 * 1024 * 1024 * 1024, label: 'Diamond Plus', storageLabel: '150 ГБ' }
};

let currentTariff = 'free';
let db = null;

// Инициализация IndexedDB
const DB_NAME = 'diamond_cloud';
const DB_VERSION = 1;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('files')) {
                const filesStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                filesStore.createIndex('folder', 'folder', { unique: false });
                filesStore.createIndex('name', 'name', { unique: false });
                filesStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('folders')) {
                const foldersStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                foldersStore.createIndex('parent', 'parent', { unique: false });
                foldersStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('shared')) {
                db.createObjectStore('shared', { keyPath: 'fileId' });
            }
            
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            resolve(db);
        };
        
        request.onerror = function(event) {
            console.error('[Cloud] Ошибка IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Утилиты
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m);
}

function showToast(msg) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = 'background:rgba(20,20,25,0.95);color:white;padding:12px 24px;border-radius:30px;margin-bottom:10px;backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);';
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

// Функции для работы с IndexedDB
async function getFiles(folderId = 'root') {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('folder');
        const request = index.getAll(folderId);
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getFolders(parentId = 'root') {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readonly');
        const store = transaction.objectStore('folders');
        const index = store.index('parent');
        const request = index.getAll(parentId);
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getAllFiles() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getSharedFiles() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['shared'], 'readonly');
        const store = transaction.objectStore('shared');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function addFile(fileData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.add(fileData);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addFolder(folderData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        const request = store.add(folderData);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFile(fileId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.delete(fileId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteFolder(folderId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders', 'files'], 'readwrite');
        const foldersStore = transaction.objectStore('folders');
        const filesStore = transaction.objectStore('files');
        
        foldersStore.delete(folderId);
        
        const filesIndex = filesStore.index('folder');
        const filesRequest = filesIndex.getAll(folderId);
        filesRequest.onsuccess = () => {
            const files = filesRequest.result || [];
            files.forEach(f => filesStore.delete(f.id));
        };
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function addSharedLink(fileId, shareData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['shared'], 'readwrite');
        const store = transaction.objectStore('shared');
        const request = store.put({ fileId, ...shareData });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getTotalUsedSpace() {
    const files = await getAllFiles();
    return files.reduce((total, file) => total + (file.size || 0), 0);
}

async function getStorageInfo() {
    const used = await getTotalUsedSpace();
    const limit = TARIFFS[currentTariff].limit;
    const percent = Math.min((used / limit) * 100, 100).toFixed(1);
    return {
        used,
        limit,
        percent,
        usedFormatted: formatBytes(used),
        limitFormatted: TARIFFS[currentTariff].storageLabel,
        tariff: TARIFFS[currentTariff].label
    };
}

// Функция для "шифрования" (анимации)
async function simulateEncryption(file) {
    return new Promise(resolve => {
        const duration = Math.min(file.size / 100000, 3000) + 1000;
        setTimeout(() => {
            resolve(file);
        }, duration);
    });
}

// Проверка OAuth тикета при загрузке страницы
async function checkOAuthTicket() {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('ticket');
    
    if (ticket && !currentUser) {
        try {
            const { data: ticketData, error } = await _supabase
                .from('oauth_tickets')
                .select('login')
                .eq('ticket', ticket)
                .maybeSingle();
            
            if (error || !ticketData) {
                console.error('[Cloud] Неверный тикет');
                return;
            }
            
            const { data: user } = await _supabase
                .from('users')
                .select('login, name, avatar, description, is_plus')
                .eq('login', ticketData.login)
                .maybeSingle();
            
            if (user) {
                currentUser = {
                    login: user.login,
                    name: user.name || user.login,
                    avatar: user.avatar || '',
                    description: user.description || '',
                    is_plus: user.is_plus || false
                };
                
                if (user.is_plus) {
                    currentTariff = 'plus';
                }
                
                localStorage.setItem('diamond_cloud_user', JSON.stringify(currentUser));
                
                // Удаляем тикет
                await _supabase.from('oauth_tickets').delete().eq('ticket', ticket);
                
                // Убираем параметры из URL
                window.history.replaceState(null, null, '/');
            }
        } catch (e) {
            console.error('[Cloud] Ошибка проверки тикета:', e);
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем сохранённую сессию
    const saved = localStorage.getItem('diamond_cloud_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            if (currentUser.is_plus) {
                currentTariff = 'plus';
            }
        } catch(e) {
            console.error('[Cloud] Ошибка парсинга сессии');
        }
    }
    
    // Проверяем OAuth тикет
    await checkOAuthTicket();
    
    // Открываем базу данных
    try {
        await openDatabase();
        console.log('[Cloud] IndexedDB готова');
    } catch (e) {
        console.error('[Cloud] Ошибка IndexedDB:', e);
    }
    
    // Инициализируем интерфейс
    if (typeof initUI === 'function') {
        initUI();
    }
});
