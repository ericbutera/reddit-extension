// background.js - service worker handling IndexedDB for ignored subreddits

const DB_NAME = "reddit_ext_db";
const DB_VERSION = 1;
const STORE_NAME = "ignoredSubs";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };
    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

async function getAllIgnoredSubs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const names = req.result.map((r) => r.name);
      resolve(names);
    };
    req.onerror = () => reject(req.error);
  });
}

async function setAllIgnoredSubs(subs) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    // clear then add
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      for (const name of subs) {
        store.put({ name });
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function addIgnoredSub(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ name });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function removeIgnoredSub(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(name);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function exportIgnoredSubs() {
  const subs = await getAllIgnoredSubs();
  return JSON.stringify(subs, null, 2);
}

async function importIgnoredSubsFromArray(arr) {
  if (!Array.isArray(arr)) throw new Error("import expects array");
  await setAllIgnoredSubs(arr);
  return true;
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
