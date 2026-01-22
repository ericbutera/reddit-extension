// background.js - service worker handling IndexedDB for ignored subreddits

const DB_NAME = "reddit_ext_db";
const DB_VERSION = 2;
const STORE_NAME = "ignoredSubs";
const STATS_STORE = "stats";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
      if (!db.objectStoreNames.contains(STATS_STORE)) {
        const s = db.createObjectStore(STATS_STORE, { keyPath: "name" });
        s.createIndex("count", "count", { unique: false });
      }
    };
    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Generic helper to handle IndexedDB boilerplate
 */
async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    // The callback performs the actual store operation
    const result = callback(store, tx);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);

    // Handle specific request errors if the callback returns a request
    if (result instanceof IDBRequest) {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    }
  });
}
const getAllIgnoredSubs = () =>
  withStore(STORE_NAME, "readonly", (s) => s.getAll()).then((res) =>
    res.map((r) => r.name),
  );

async function setAllIgnoredSubs(subs) {
  return withStore(STORE_NAME, "readwrite", (store) => {
    store.clear();
    for (const name of subs) store.put({ name });
    return true;
  });
}

const addIgnoredSub = (name) =>
  withStore(STORE_NAME, "readwrite", (s) => s.put({ name }));

const removeIgnoredSub = (name) =>
  withStore(STORE_NAME, "readwrite", (s) => s.delete(name));

const exportIgnoredSubs = async () =>
  JSON.stringify(await getAllIgnoredSubs(), null, 2);
const getAllStats = () =>
  withStore(STATS_STORE, "readonly", (s) => s.getAll()).then((res) =>
    res.map((r) => ({ name: r.name, count: r.count || 0 })),
  );
function incrementStat(name, delta = 1) {
  if (!name) return;
  __pending_stats[name] = (__pending_stats[name] || 0) + delta;
  scheduleFlushPendingStats();
}

const resetStats = () => withStore(STATS_STORE, "readwrite", (s) => s.clear());

const clearStat = (name) =>
  withStore(STATS_STORE, "readwrite", (s) => s.delete(name));

async function importIgnoredSubsFromArray(arr) {
  if (!Array.isArray(arr)) throw new Error("import expects array");
  await setAllIgnoredSubs(arr);
  return true;
}

// In-memory pending stats buffer to batch writes from messages
let __pending_stats = {};
let __pending_stats_timer = null;
const PENDING_FLUSH_MS = 1500;
function scheduleFlushPendingStats() {
  if (__pending_stats_timer) return;
  __pending_stats_timer = setTimeout(() => {
    flushPendingStats().catch((e) => console.error("Flush failed", e));
  }, PENDING_FLUSH_MS);
}

async function flushPendingStats() {
  clearTimeout(__pending_stats_timer);
  __pending_stats_timer = null;

  const statsToFlush = { ...__pending_stats };
  __pending_stats = {};

  if (Object.keys(statsToFlush).length === 0) return;

  // 2. Perform batch update in a single transaction
  return withStore(STATS_STORE, "readwrite", (store) => {
    for (const [name, delta] of Object.entries(statsToFlush)) {
      const getReq = store.get(name);
      getReq.onsuccess = () => {
        const rec = getReq.result || { name, count: 0 };
        rec.count += delta;
        store.put(rec);
      };
    }
  });
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  try {
    switch (message && message.action) {
      case "getIgnoredSubs": {
        const subs = await getAllIgnoredSubs();
        return { success: true, subs };
      }
      case "setIgnoredSubs": {
        await setAllIgnoredSubs(message.subs || []);
        return { success: true };
      }
      case "addIgnoredSub": {
        await addIgnoredSub(message.name);
        return { success: true };
      }
      case "removeIgnoredSub": {
        await removeIgnoredSub(message.name);
        return { success: true };
      }
      case "exportIgnoredSubs": {
        const json = await exportIgnoredSubs();
        return { success: true, data: json };
      }
      case "getStats": {
        const stats = await getAllStats();
        return { success: true, stats };
      }
      case "incrementStat": {
        incrementStat(message.name, message.delta || 1);
        return { success: true };
      }
      case "incrementStatsBulk": {
        const stats = message.stats || {};
        for (const [name, delta] of Object.entries(stats)) {
          incrementStat(name, delta);
        }
        return { success: true };
      }
      case "resetStats": {
        await resetStats();
        return { success: true };
      }
      case "clearStat": {
        await clearStat(message.name);
        return { success: true };
      }
      case "flushPendingStats": {
        try {
          await flushPendingStats();
          return { success: true };
        } catch (e) {
          return { success: false, error: e?.message };
        }
      }
      case "importIgnoredSubs": {
        await importIgnoredSubsFromArray(message.subs || []);
        return { success: true };
      }
      default:
        return { success: false, error: "unknown action" };
    }
  } catch (e) {
    console.error("Background Error:", e);
    return { success: false, error: e?.message || "Internal error" };
  }
});

if (typeof browser !== "undefined" && browser.runtime?.onSuspend) {
  browser.runtime.onSuspend.addListener(() => {
    console.debug("onSuspend: flushing pending stats");
    flushPendingStats(); // Final attempt to save before the plugin sleeps
  });
}
