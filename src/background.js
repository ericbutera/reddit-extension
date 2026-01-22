// background.js - service worker handling IndexedDB for ignored subreddits
console.log("background service worker loaded");

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
  withStore(STORE_NAME, "readonly", (s) => s.getAll()).then((res) => res.map((r) => r.name));

async function setAllIgnoredSubs(subs) {
  return withStore(STORE_NAME, "readwrite", (store) => {
    store.clear();
    for (const name of subs) store.put({ name });
    return true;
  });
}

const addIgnoredSub = (name) => withStore(STORE_NAME, "readwrite", (s) => s.put({ name }));

const removeIgnoredSub = (name) => withStore(STORE_NAME, "readwrite", (s) => s.delete(name));

const exportIgnoredSubs = async () => JSON.stringify(await getAllIgnoredSubs(), null, 2);
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

const clearStat = (name) => withStore(STATS_STORE, "readwrite", (s) => s.delete(name));

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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message && message.action) {
        case "getIgnoredSubs": {
          const subs = await getAllIgnoredSubs();
          sendResponse({ success: true, subs });
          return;
        }
        case "setIgnoredSubs": {
          await setAllIgnoredSubs(message.subs || []);
          sendResponse({ success: true });
          return;
        }
        case "addIgnoredSub": {
          await addIgnoredSub(message.name);
          sendResponse({ success: true });
          return;
        }
        case "removeIgnoredSub": {
          await removeIgnoredSub(message.name);
          sendResponse({ success: true });
          return;
        }
        case "exportIgnoredSubs": {
          const json = await exportIgnoredSubs();
          sendResponse({ success: true, data: json });
          return;
        }
        case "getStats": {
          const stats = await getAllStats();
          sendResponse({ success: true, stats });
          return;
        }
        case "incrementStat": {
          incrementStat(message.name, message.delta || 1);
          sendResponse({ success: true });
          return;
        }
        case "incrementStatsBulk": {
          const stats = message.stats || {};
          for (const [name, delta] of Object.entries(stats)) {
            incrementStat(name, delta);
          }
          sendResponse({ success: true });
          return;
        }
        case "resetStats": {
          await resetStats();
          sendResponse({ success: true });
          return;
        }
        case "clearStat": {
          await clearStat(message.name);
          sendResponse({ success: true });
          return;
        }
        case "flushPendingStats": {
          try {
            await flushPendingStats();
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, error: e?.message });
          }
          return;
        }
        case "importIgnoredSubs": {
          await importIgnoredSubsFromArray(message.subs || []);
          sendResponse({ success: true });
          return;
        }
        default:
          sendResponse({ success: false, error: "unknown action" });
      }
    } catch (e) {
      console.error("Background Error:", e);
      sendResponse({ success: false, error: e?.message || "Internal error" });
    }
  })();
  return true; // Keep the message channel open for async response
});

if (typeof browser !== "undefined" && browser.runtime?.onSuspend) {
  browser.runtime.onSuspend.addListener(() => {
    console.debug("onSuspend: flushing pending stats");
    flushPendingStats(); // Final attempt to save before the plugin sleeps
  });
}
