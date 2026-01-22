// options.js - handles import/export and editing ignored subreddits

function sendMessageAsync(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp) => {
      resolve(resp);
    });
  });
}

let currentSubs = [];
let stagedAdds = [];
let stagedRemoves = [];
let statsMap = {};

async function load() {
  const resp = await sendMessageAsync({ action: "getIgnoredSubs" });
  if (resp && resp.success && Array.isArray(resp.subs)) {
    currentSubs = resp.subs.slice();
  } else {
    currentSubs = [];
  }
  renderList();
  await loadStats();
}

async function loadStats() {
  const resp = await sendMessageAsync({ action: "getStats" });
  statsMap = {};
  if (resp && resp.success && Array.isArray(resp.stats)) {
    for (const row of resp.stats) {
      statsMap[row.name] = row.count || 0;
    }
  }
  // re-render list so badges update
  renderList();
  // Populate stats panel with top 10 blocked subreddits, using the same badge template
  try {
    const statsContainer = document.querySelector("#statsTable");
    if (statsContainer) {
      const rows = Object.keys(statsMap).map((k) => ({
        name: k,
        count: statsMap[k],
      }));
      rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      const top = rows.slice(0, 10).map((r) => ({
        name: r.name,
        count: String(r.count || 0),
        dataName: r.name,
      }));
      // render into the stats container (works for UL or TABLE as container)
      renderTemplateList("#statsTable", "tpl-sub-item", top);
    }
  } catch (e) {
    console.warn("populate stats panel failed", e);
  }
}

async function doExport() {
  const resp = await sendMessageAsync({ action: "getIgnoredSubs" });
  if (resp && resp.success && Array.isArray(resp.subs)) {
    const text = resp.subs.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ignored-subreddits.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } else {
    alert("Export failed");
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
/**
 * Parse raw import text into an array of normalized subreddit names.
 * Accepts JSON array or newline-separated text. Returns an array of unique, trimmed names.
 */
function parseImport(text) {
  if (!text) return [];
  let arr = [];
  try {
    arr = JSON.parse(text);
    if (!Array.isArray(arr)) arr = [];
  } catch (_) {
    arr = text
      .split(/\r?\n/)
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  }
  // normalize names (remove optional leading /r/ and whitespace) and dedupe
  const normalized = arr
    .map((s) =>
      String(s || "")
        .replace(/^\/?r\//i, "")
        .trim(),
    )
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

/**
 * Import raw text by parsing and staging names into Pending Changes.
 * Keeps UI updates and alerts centralized.
 */
async function importFile(text) {
  try {
    const names = parseImport(text);
    for (const name of names) {
      const remIdx = stagedRemoves.indexOf(name);
      if (remIdx !== -1) {
        stagedRemoves.splice(remIdx, 1);
      } else if (!currentSubs.includes(name) && !stagedAdds.includes(name)) {
        stagedAdds.push(name);
      }
    }
  } catch (err) {
    alert("Error importing: " + (err && err.message));
  }
}

/**
 * Render a list of items using a <template> with `data-field` placeholders.
 * Each item is an object whose keys map to `data-field` attributes inside the template.
 * Optional `class` string will be added to the template root element, and
 * optional `dataName` will be written to `data-name` on the root element.
 */
function renderTemplateList(containerSelector, templateId, items) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = "";
  const tpl = document.getElementById(templateId);
  if (!tpl) return;
  for (const item of items) {
    const frag = tpl.content.cloneNode(true);
    const root = frag.firstElementChild;
    for (const k of Object.keys(item)) {
      const el = frag.querySelector(`[data-field="${k}"]`);
      if (el) el.textContent = item[k];
    }
    if (item.class && root) root.classList.add(...item.class.split(" "));
    if (item.dataName && root) root.dataset.name = item.dataName;
    container.appendChild(frag);
  }
}

function renderList() {
  const sorted = sortSubs([...currentSubs]);
  const items = sorted.map((name) => {
    const count = statsMap[name] || 0;
    const item = {
      name: name,
      count: `${count}`,
      dataName: name,
      class: stagedRemoves.includes(name) ? "staged-remove" : "",
    };
    return item;
  });
  renderTemplateList("#subsList", "tpl-sub-item", items);
}

function renderPendingList() {
  const removals = sortSubs([...stagedRemoves]).map((name) => ({
    text: `- ${name}`,
    dataName: name,
    class: "remove pending-item",
  }));
  const adds = sortSubs([...stagedAdds]).map((name) => ({
    text: `+ ${name}`,
    dataName: name,
    class: "add pending-item",
  }));
  renderTemplateList("#pendingList", "tpl-pending-item", [
    ...removals,
    ...adds,
  ]);
}

async function handleFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const txt = await readFileAsText(file);
    await importFile(txt);
    renderList();
    renderPendingList();
    e.target.value = "";
  } catch (err) {
    alert("Error importing: " + (err && err.message));
  }
}

function sortSubs(arr) {
  return arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function setup() {
  document.getElementById("export").addEventListener("click", doExport);
  document
    .getElementById("import")
    .addEventListener("click", () => document.getElementById("file").click());
  document.getElementById("file").addEventListener("change", handleFileSelect);

  document.getElementById("deleteAll").addEventListener("click", () => {
    // stage removal of all current items
    stagedRemoves = Array.from(new Set([...stagedRemoves, ...currentSubs]));
    // if any of these were staged adds, unstage them
    stagedAdds = stagedAdds.filter((a) => !stagedRemoves.includes(a));
    renderList();
    renderPendingList();
  });

  document.getElementById("addBtn").addEventListener("click", async () => {
    const val = document.getElementById("addInput").value.trim();
    if (!val) return;
    const normalized = val.replace(/^\/?r\//i, "").trim();
    if (!normalized) return;
    // if currently staged for removal, unstage that instead
    const removeIndex = stagedRemoves.indexOf(normalized);
    if (removeIndex !== -1) {
      stagedRemoves.splice(removeIndex, 1);
    } else if (
      !currentSubs.includes(normalized) &&
      !stagedAdds.includes(normalized)
    ) {
      stagedAdds.push(normalized);
    }
    document.getElementById("addInput").value = "";
    renderList();
    renderPendingList();
  });

  // allow Enter to add
  document.getElementById("addInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("addBtn").click();
    }
  });

  // delegated click handler on main list: stage removals (or unstage if already staged)
  document.getElementById("subsList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    let name = null;
    if (btn && btn.dataset && btn.dataset.name) {
      name = btn.dataset.name;
    } else {
      const span = e.target.closest(".sub-name");
      if (span) name = span.textContent && span.textContent.trim();
    }
    if (!name) return;

    // if it's staged as an add, remove that staging
    const addIndex = stagedAdds.indexOf(name);
    if (addIndex !== -1) {
      stagedAdds.splice(addIndex, 1);
    } else {
      const remIndex = stagedRemoves.indexOf(name);
      if (remIndex !== -1) {
        stagedRemoves.splice(remIndex, 1);
      } else {
        stagedRemoves.push(name);
      }
    }

    renderList();
    renderPendingList();
  });

  // delegated click handler on pending list to unstage
  document.getElementById("pendingList").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li || !li.dataset) return;
    const name = li.dataset.name;
    if (!name) return;
    // remove from either stagedAdds or stagedRemoves
    const aIdx = stagedAdds.indexOf(name);
    if (aIdx !== -1) stagedAdds.splice(aIdx, 1);
    const rIdx = stagedRemoves.indexOf(name);
    if (rIdx !== -1) stagedRemoves.splice(rIdx, 1);
    renderList();
    renderPendingList();
  });

  document.getElementById("saveChanges").addEventListener("click", async () => {
    // apply staged changes
    let newSubs = currentSubs.filter((s) => !stagedRemoves.includes(s));
    for (const a of stagedAdds) {
      if (!newSubs.includes(a)) newSubs.push(a);
    }
    newSubs = sortSubs([...new Set(newSubs)]);
    const resp = await sendMessageAsync({
      action: "setIgnoredSubs",
      subs: newSubs,
    });
    if (resp && resp.success) {
      stagedAdds = [];
      stagedRemoves = [];
      currentSubs = newSubs.slice();
      renderList();
      renderPendingList();
      await loadStats();
    } else {
      alert("Save failed");
    }
  });

  document.getElementById("discardChanges").addEventListener("click", () => {
    stagedAdds = [];
    stagedRemoves = [];
    renderList();
    renderPendingList();
  });

  load();
}

document.addEventListener("DOMContentLoaded", setup);
