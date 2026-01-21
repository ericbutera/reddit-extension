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

function sortSubs(arr) {
  return arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function renderList() {
  const ul = document.getElementById("subsList");
  ul.innerHTML = "";
  const sorted = sortSubs([...currentSubs]);
  for (const name of sorted) {
    const li = document.createElement("li");
    li.className = "sub-item";
    const span = document.createElement("span");
    span.textContent = name;
    span.className = "sub-name";
    if (stagedRemoves.includes(name)) span.classList.add("staged-remove");
    // event delegation will handle clicks on buttons
    li.appendChild(span);
    ul.appendChild(li);
  }
}

function renderPendingList() {
  const ul = document.getElementById("pendingList");
  ul.innerHTML = "";

  // show removals first
  for (const name of sortSubs([...stagedRemoves])) {
    const li = document.createElement("li");
    li.className = "pending-item remove";
    li.textContent = "- " + name;
    li.dataset.name = name;
    ul.appendChild(li);
  }

  // then adds
  for (const name of sortSubs([...stagedAdds])) {
    const li = document.createElement("li");
    li.className = "pending-item add";
    li.textContent = "+ " + name;
    li.dataset.name = name;
    ul.appendChild(li);
  }
}

async function load() {
  const resp = await sendMessageAsync({ action: "getIgnoredSubs" });
  if (resp && resp.success && Array.isArray(resp.subs)) {
    currentSubs = resp.subs.slice();
  } else {
    currentSubs = [];
  }
  renderList();
}

async function doExport() {
  const resp = await sendMessageAsync({ action: "exportIgnoredSubs" });
  if (resp && resp.success) {
    const blob = new Blob([resp.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ignored-subreddits.json";
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

async function doImportFile(file) {
  try {
    const txt = await readFileAsText(file);
    let arr;
    try {
      arr = JSON.parse(txt);
    } catch (_) {
      // fallback: try newline-separated
      arr = txt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(arr)) throw new Error("Imported data is not an array");
    const resp = await sendMessageAsync({
      action: "importIgnoredSubs",
      subs: arr,
    });
    if (resp && resp.success) {
      await load();
      alert("Imported successfully");
    } else {
      alert("Import failed");
    }
  } catch (e) {
    alert("Error importing: " + (e && e.message));
  }
}
function setup() {
  document.getElementById("export").addEventListener("click", doExport);
  document
    .getElementById("import")
    .addEventListener("click", () => document.getElementById("file").click());
  document.getElementById("file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) doImportFile(file);
    e.target.value = "";
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
      alert("Saved changes");
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
