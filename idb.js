// ═══════════════════════════════════════════════════════════════════════════════
// STAP IndexedDB Wrapper — Persistent storage for materials & proofs
// Replaces localStorage for large datasets with async, structured storage.
// Never throws — returns empty arrays/null on failure for resilient UI.
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    var DB_NAME = 'stap_ops_hub';
    var DB_VERSION = 1;
    var STORES = {
        materials: { keyPath: 'id', indexes: ['campaignId', 'status'] },
        proofs:    { keyPath: 'id', indexes: ['campaignId', 'client'] }
    };

    var dbPromise = null;

    // ─── Open / Upgrade ──────────────────────────────────────────────────────
    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise(function(resolve, reject) {
            if (!window.indexedDB) {
                console.warn('⚠️ IndexedDB not available — falling back to in-memory');
                resolve(null);
                return;
            }

            var request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                var db = event.target.result;
                Object.keys(STORES).forEach(function(storeName) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        var store = db.createObjectStore(storeName, { keyPath: STORES[storeName].keyPath });
                        STORES[storeName].indexes.forEach(function(idx) {
                            store.createIndex(idx, idx, { unique: false });
                        });
                        console.log('📦 Created IDB store:', storeName);
                    }
                });
            };

            request.onsuccess = function(event) {
                console.log('✅ IndexedDB opened:', DB_NAME);
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error('❌ IndexedDB open failed:', event.target.error);
                resolve(null); // Never reject — degrade gracefully
            };
        });

        return dbPromise;
    }

    // ─── Transaction Helper ──────────────────────────────────────────────────
    function withStore(storeName, mode, callback) {
        return openDB().then(function(db) {
            if (!db) return null;
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, mode);
                    var store = tx.objectStore(storeName);
                    var result = callback(store);

                    tx.oncomplete = function() { resolve(result._value || result); };
                    tx.onerror = function(e) {
                        console.warn('IDB transaction error:', e.target.error);
                        resolve(null);
                    };
                } catch (e) {
                    console.warn('IDB transaction exception:', e);
                    resolve(null);
                }
            });
        });
    }

    // ─── CRUD Operations ─────────────────────────────────────────────────────

    function getAll(storeName) {
        return withStore(storeName, 'readonly', function(store) {
            var items = [];
            var wrapper = { _value: items };
            var request = store.openCursor();
            request.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    items.push(cursor.value);
                    cursor.continue();
                }
            };
            return wrapper;
        }).then(function(result) {
            return result || [];
        });
    }

    function get(storeName, key) {
        return withStore(storeName, 'readonly', function(store) {
            var wrapper = { _value: null };
            var request = store.get(key);
            request.onsuccess = function() { wrapper._value = request.result || null; };
            return wrapper;
        });
    }

    function put(storeName, item) {
        return withStore(storeName, 'readwrite', function(store) {
            store.put(item);
            return { _value: true };
        }).then(function(result) {
            return result !== null;
        });
    }

    function putAll(storeName, items) {
        if (!items || !items.length) return Promise.resolve(true);
        return withStore(storeName, 'readwrite', function(store) {
            items.forEach(function(item) { store.put(item); });
            return { _value: true };
        }).then(function(result) {
            return result !== null;
        });
    }

    function deleteItem(storeName, key) {
        return withStore(storeName, 'readwrite', function(store) {
            store.delete(key);
            return { _value: true };
        }).then(function(result) {
            return result !== null;
        });
    }

    function clear(storeName) {
        return withStore(storeName, 'readwrite', function(store) {
            store.clear();
            return { _value: true };
        }).then(function(result) {
            return result !== null;
        });
    }

    function getAllByIndex(storeName, indexName, value) {
        return withStore(storeName, 'readonly', function(store) {
            var items = [];
            var wrapper = { _value: items };
            var index = store.index(indexName);
            var request = index.openCursor(IDBKeyRange.only(value));
            request.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    items.push(cursor.value);
                    cursor.continue();
                }
            };
            return wrapper;
        }).then(function(result) {
            return result || [];
        });
    }

    // ─── Migration: localStorage → IDB ───────────────────────────────────────

    function migrateFromLocalStorage(storeName, localStorageKey) {
        return getAll(storeName).then(function(existing) {
            if (existing.length > 0) {
                console.log('📦 IDB store "' + storeName + '" already has', existing.length, 'items — skipping migration');
                return false; // Already migrated
            }

            try {
                var raw = localStorage.getItem(localStorageKey);
                if (!raw) return false;

                var data = JSON.parse(raw);
                if (!Array.isArray(data) || data.length === 0) return false;

                // Ensure each item has an id
                var items = data.map(function(item, idx) {
                    if (!item.id) item.id = 'migrated_' + idx + '_' + Date.now();
                    return item;
                });

                return putAll(storeName, items).then(function(success) {
                    if (success) {
                        localStorage.removeItem(localStorageKey);
                        console.log('✅ Migrated', items.length, 'items from localStorage "' + localStorageKey + '" → IDB "' + storeName + '"');
                    }
                    return success;
                });
            } catch (e) {
                console.warn('Migration failed for', localStorageKey, ':', e);
                return false;
            }
        });
    }

    // ─── Storage Health ──────────────────────────────────────────────────────

    function checkStorageHealth() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return Promise.resolve({ usage: 0, quota: 0, percent: 0, warning: false, critical: false });
        }

        return navigator.storage.estimate().then(function(estimate) {
            var usage = estimate.usage || 0;
            var quota = estimate.quota || 0;
            var percent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
            return {
                usage: usage,
                quota: quota,
                percent: percent,
                usageMB: Math.round(usage / 1048576 * 10) / 10,
                quotaMB: Math.round(quota / 1048576),
                warning: percent >= 80,
                critical: percent >= 90
            };
        });
    }

    function exportAll() {
        return Promise.all([
            getAll('materials'),
            getAll('proofs')
        ]).then(function(results) {
            return { materials: results[0], proofs: results[1] };
        });
    }

    function importAll(data) {
        var promises = [];
        if (data.materials) promises.push(putAll('materials', data.materials));
        if (data.proofs) promises.push(putAll('proofs', data.proofs));
        return Promise.all(promises).then(function() { return true; });
    }

    function pruneOlderThan(storeName, days) {
        var cutoff = Date.now() - (days * 86400000);
        return getAll(storeName).then(function(items) {
            var toDelete = items.filter(function(item) {
                var ts = item.uploadDate || item.createdAt || item.timestamp;
                return ts && new Date(ts).getTime() < cutoff;
            });
            if (toDelete.length === 0) return 0;
            return withStore(storeName, 'readwrite', function(store) {
                toDelete.forEach(function(item) { store.delete(item.id); });
                return { _value: toDelete.length };
            });
        }).then(function(count) {
            if (count > 0) console.log('🧹 Pruned', count, 'old items from', storeName);
            return count || 0;
        });
    }

    // ─── Public API ──────────────────────────────────────────────────────────
    window.STAP_IDB = {
        getAll: getAll,
        get: get,
        put: put,
        putAll: putAll,
        delete: deleteItem,
        clear: clear,
        getAllByIndex: getAllByIndex,
        migrateFromLocalStorage: migrateFromLocalStorage,
        checkStorageHealth: checkStorageHealth,
        exportAll: exportAll,
        importAll: importAll,
        pruneOlderThan: pruneOlderThan
    };

})(window);
