const DEFAULT_API_BASE = (() => {
    if (typeof window === 'undefined') return 'https://glow-runner-backend.onrender.com';
    const origin = window.location.origin;
    if (origin && origin !== 'null' && origin !== 'http://localhost:3000') return origin.replace(/\/$/, '');
    return 'https://glow-runner-backend.onrender.com';
})();

function resolveApiBase() {
    if (typeof window !== 'undefined' && window.__API_URL__) {
        return String(window.__API_URL__).replace(/\/$/, '');
    }
    return DEFAULT_API_BASE;
}

function normalizePath(path) {
    if (!path || path === '/') return '';
    return String(path).replace(/^\/+/, '').replace(/\/+$/, '');
}

function snapshotFromValue(value) {
    return {
        exists() {
            return value !== null && value !== undefined && !(typeof value === 'object' && Object.keys(value).length === 0 && !Array.isArray(value));
        },
        val() {
            return value;
        },
        forEach(callback) {
            if (!value || typeof value !== 'object') return false;
            const entries = Array.isArray(value) ? value.map((item, index) => ({ key: String(index), val: item })) : Object.entries(value).map(([key, val]) => ({ key, val }));
            entries.forEach((entry) => {
                const child = { key: entry.key, val: () => entry.val, exists: () => entry.val !== undefined, forEach: () => false };
                callback({ key: () => entry.key, val: () => entry.val, exists: () => true, forEach: () => false });
            });
            return true;
        }
    };
}

export function initializeApp() {
    return { apiBase: resolveApiBase() };
}

export function getDatabase(app) {
    return app;
}

export function ref(db, path) {
    return { db, path: normalizePath(path) };
}

export function query(reference, ...queryParts) {
    return { ...reference, queryParts };
}

export function orderByChild(child) {
    return { type: 'orderByChild', child };
}

export function limitToLast(limit) {
    return { type: 'limitToLast', limit };
}

export function onDisconnect(reference) {
    return { remove() { return Promise.resolve(); } };
}

async function readFromServer(reference, queryParts = []) {
    const params = new URLSearchParams();
    if (reference && reference.path) params.set('path', reference.path);
    queryParts.forEach((part) => {
        if (part && part.type === 'orderByChild') params.set('orderByChild', part.child);
        if (part && part.type === 'limitToLast') params.set('limitToLast', String(part.limit));
    });
    const url = `${resolveApiBase()}/api/db${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`Server DB error: ${response.status}`);
    }
    return response.json();
}

export async function get(reference) {
    const data = await readFromServer(reference);
    return snapshotFromValue(data);
}

export async function set(reference, value) {
    const response = await fetch(`${resolveApiBase()}/api/db/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: reference.path, value })
    });
    if (!response.ok) throw new Error(`Set failed: ${response.status}`);
    return snapshotFromValue(value);
}

export async function update(reference, value) {
    const response = await fetch(`${resolveApiBase()}/api/db/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: reference.path, value })
    });
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
    return snapshotFromValue(value);
}

export async function remove(reference) {
    const response = await fetch(`${resolveApiBase()}/api/db/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: reference.path })
    });
    if (!response.ok) throw new Error(`Remove failed: ${response.status}`);
    return true;
}

export async function push(reference, value) {
    const response = await fetch(`${resolveApiBase()}/api/db/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: reference.path, value })
    });
    if (!response.ok) throw new Error(`Push failed: ${response.status}`);
    return response.json();
}

export function onValue(reference, callback) {
    const run = async () => {
        try {
            const payload = await readFromServer(reference, reference.queryParts || []);
            callback(snapshotFromValue(payload));
        } catch (error) {
            callback(snapshotFromValue(null));
            console.warn('server-db onValue failed:', error);
        }
    };
    run();
    return () => {};
}

window.initializeApp = initializeApp;
window.getDatabase = getDatabase;
window.ref = ref;
window.query = query;
window.orderByChild = orderByChild;
window.limitToLast = limitToLast;
window.onValue = onValue;
window.set = set;
window.get = get;
window.update = update;
window.onDisconnect = onDisconnect;
