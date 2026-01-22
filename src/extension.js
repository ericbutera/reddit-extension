console.info("loading RE ext.");

let IGNORED_SUBS = [];
const DEFAULT_IGNORED_SUBS = [];

// Storage helper functions
async function loadIgnoredSubs() {
  try {
    const result = await sendMessageAsync({ action: "getIgnoredSubs" });
    if (result?.success && Array.isArray(result.subs)) {
      IGNORED_SUBS = result.subs;
      console.info("Loaded %d ignored subs", IGNORED_SUBS.length);
    } else {
      await saveIgnoredSubs(DEFAULT_IGNORED_SUBS);
    }
  } catch (e) {
    console.error("Error loading ignored subs:", e);
  }
}

async function saveIgnoredSubs(subs) {
  try {
    const resp = await sendMessageAsync({ action: "setIgnoredSubs", subs });
    if (resp?.success) {
      IGNORED_SUBS = subs;
    }
  } catch (e) {
    console.error("Error saving ignored subs:", e);
  }
}

function addIgnoredSub(subreddit) {
  if (!IGNORED_SUBS.includes(subreddit)) {
    const newSubs = [...IGNORED_SUBS, subreddit];
    saveIgnoredSubs(newSubs);
    sendMessageAsync({ action: "addIgnoredSub", name: subreddit });
  }
}

function removeIgnoredSub(subreddit) {
  const newSubs = IGNORED_SUBS.filter((sub) => sub !== subreddit);
  saveIgnoredSubs(newSubs);
  sendMessageAsync({ action: "removeIgnoredSub", name: subreddit });
}

async function sendMessageAsync(message) {
  try {
    return await browser.runtime.sendMessage(message);
  } catch (e) {
    console.error("Messaging error:", e);
    return null;
  }
}

// show a temporary toast with Undo action
let __re_toast_el = null;
/**
 * Ensure the toast template exists in the document. Inserts a <template>
 * with id `re-toast-tpl` if not present.
 */
function ensureToastTemplate() {
  if (document.getElementById("re-toast-tpl")) return;
  try {
    const tpl = document.createElement("template");
    tpl.id = "re-toast-tpl";
    tpl.innerHTML = `
      <div class="re-toast">
        <span class="re-toast-msg" data-field="msg"></span>
        <button class="re-toast-undo" data-field="btn">Undo</button>
      </div>
    `;
    document.documentElement.appendChild(tpl);
  } catch (e) {
    console.error("ensureToastTemplate error", e);
  }
}

async function showUndoToast(text, undoFn, timeout = 5000) {
  try {
    ensureToastTemplate();

    // remove existing
    if (__re_toast_el) __re_toast_el.remove();

    const tpl = document.getElementById("re-toast-tpl");
    if (!tpl) return;
    const frag = tpl.content.cloneNode(true);
    const el = frag.querySelector(".re-toast") || frag.firstElementChild;
    const msgEl = frag.querySelector("[data-field=msg]");
    const btn = frag.querySelector("[data-field=btn]");

    if (msgEl) msgEl.textContent = text;

    let removed = false;
    const cleanup = () => {
      try {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
      __re_toast_el = null;
    };

    const timer = setTimeout(() => {
      if (!removed) cleanup();
    }, timeout);

    if (btn) {
      btn.addEventListener("click", async () => {
        if (removed) return;
        removed = true;
        clearTimeout(timer);
        try {
          await undoFn();
        } catch (e) {
          console.error("undo error", e);
        }
        cleanup();
      });
    }

    document.body.appendChild(el);
    __re_toast_el = el;
  } catch (e) {
    console.error("showUndoToast error", e);
  }
}

class Listing {
  constructor() {
    this._pos = 0;
    this._links = [];
  }

  pos(pos) {
    if (pos != undefined) {
      this._pos = pos;
    }
    return this._pos;
  }

  total() {
    if (this._links) return this._links.length;
    return 0;
  }

  link() {
    if (this._links[this._pos]) return this._links[this._pos];
    return false;
  }

  links() {
    return this._links;
  }

  removeLink(pos) {
    this._links.splice(pos, 1);
  }

  _getLinks() {
    return document.querySelectorAll("#siteTable > div.link:not(.promotedlink)");
  }

  filterIgnoredLinks() {
    this._getLinks().forEach((row) => {
      try {
        const subreddit = row.dataset["subreddit"];
        const ignored = IGNORED_SUBS.includes(subreddit);
        if (ignored) {
          row.parentNode.removeChild(row);
        }
      } catch (e) {
        console.error("unable to parse link: %o", e);
      }
    });
  }

  refreshLinks() {
    this.filterIgnoredLinks();
    this._links = this._getLinks();
  }

  register() {
    document.addEventListener("click", (e) => {
      this.tryFindLink(e.target);
    });

    document.addEventListener("keydown", (e) => {
      this.handleKeys(e);
    });
  }

  tryFindLink(el) {
    let attempt = el.closest(".link");
    if (!attempt) {
      return;
    }

    const self = this;
    this._links.forEach((link, index) => {
      if (link == attempt) self.moveTo(index);
    });
  }

  handleKeys(e) {
    // TODO: allow configurable bindings
    let pos = this.pos();
    let total = this.total();

    if (e.keyCode == 36)
      //home
      this.moveTo(0);

    if (e.keyCode == 35)
      // end
      this.moveTo(total - 1);

    if (e.key == "j")
      // down
      this.moveTo(pos + 1);

    if (e.key == "k")
      // up
      this.moveTo(pos - 1);

    if (e.key == "h") this.hideLink();

    if (e.key == "i") this.ignoreSubreddit();
  }

  moveTo(position) {
    let total = this.total();

    if (position >= total || position < 0) {
      return;
    }

    // TODO bounds check
    let oldLink = this.link();
    this.highlight(oldLink, false);

    this.pos(position);
    let link = this.link();
    this.highlight(link, true);
  }

  highlight(link, enable) {
    if (!link) return; // TODO clean

    if (enable) {
      link.style.backgroundColor = "yellow";
    } else {
      link.style.backgroundColor = "unset";
    }
  }

  hideLink() {
    let link = this.link();
    let hide = this._getHideEl(link);
    if (!hide) {
      return false;
    }

    let res = hide.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    if (res) {
      // record stat for this hide (send to background which will batch writes)
      try {
        const subreddit = link.dataset && link.dataset.subreddit;
        if (subreddit)
          sendMessageAsync({
            action: "incrementStat",
            name: subreddit,
            delta: 1,
          });
      } catch (e) {
        console.error("failed to send stat", e);
      }

      // remove from dom
      link.parentNode.removeChild(link);

      // highlight next row
      this.refreshLinks();
      this.moveTo(this.pos());
    }
  }

  /**
   * Ignore the subreddit for the currently highlighted link.
   * Persists the subreddit to ignored list and removes the row from the DOM.
   */
  ignoreSubreddit() {
    const link = this.link();
    if (!link) return false;

    try {
      const subreddit = link.dataset && link.dataset.subreddit;
      if (!subreddit) return false;

      // preserve DOM node and position for potential undo
      const parent = link.parentNode;
      const nextSibling = link.nextSibling;
      const removedNode = link;

      addIgnoredSub(subreddit);
      try {
        sendMessageAsync({
          action: "incrementStat",
          name: subreddit,
          delta: 1,
        });
      } catch (e) {
        console.error("sendMessage failed", e);
      }

      if (parent && removedNode.parentNode) parent.removeChild(removedNode);

      this.refreshLinks();
      this.moveTo(this.pos());

      showUndoToast(`${subreddit} ignored`, async () => {
        try {
          removeIgnoredSub(subreddit);
          try {
            await sendMessageAsync({
              action: "incrementStat",
              name: subreddit,
              delta: -1,
            });
            await sendMessageAsync({ action: "flushPendingStats" });
          } catch (e) {
            console.error("undo stat failed", e);
          }
          if (parent) parent.insertBefore(removedNode, nextSibling);
          this.refreshLinks();
          return true;
        } catch (e) {
          console.error("undo restore error", e);
          return false;
        }
      });

      return true;
    } catch (e) {
      console.error("ignoreSubreddit error", e);
      return false;
    }
  }

  /**
   * Fetch the 'hide' link to click
   * @param {HTMLElement} link
   */
  _getHideEl(link) {
    return link.querySelector('a[data-event-action="hide"]');
  }

  main() {
    this.register();
    this.refreshLinks();
    this.moveTo(0);
  }
}

class Comments {
  constructor() {
    this._list = [];
    this._pos = 0;
    this._comment = undefined;
  }

  comments() {
    return this_.list;
  }
  total() {
    return this._list.length;
  }
  pos() {
    return this._pos;
  }

  clear(comment) {
    this.highlight(comment, false);
  }

  comment(comment) {
    if (comment == this._comment) {
      return;
    }

    if (this._comment) this.clear(this._comment);

    this._comment = comment;
    this.highlight(comment, true);
  }

  isComment(comment) {
    if (comment && comment.classList.contains("comment")) return true;
    return false;
  }

  isCollapsed(comment) {
    return comment.classList.contains("collapsed");
  }

  getData(comment) {
    return comment.dataset;
  }

  highlight(comment, enable) {
    if (!comment) return;

    if (enable) {
      comment.style.borderLeft = "3px solid yellow";
    } else {
      comment.style.borderLeft = "unset";
    }
  }

  tryFindComment(el) {
    let attempt = el.closest(".comment");
    if (!attempt) return false;
    this.comment(attempt);
  }

  handleKeys(e) {
    if (this._comment) {
      if (e.key == "x") this.toggleCollapse();
      if (e.key == "j") this.moveDown();
      if (e.key == "k") this.moveUp();
    }
  }

  findChild(comment) {
    try {
      let attempt = comment.querySelector(".child .comment");
      if (this.isComment(attempt)) {
        return attempt;
      }

      if (attempt) {
        return this.findChild(attempt);
      }
    } catch (e) {
      console.error("findChild error %o", e);
    }

    return false;
  }

  findParent(comment) {
    try {
      let up = comment.parentElement;
      if (!up) return false;

      let parent = up.closest(".comment"); // already viewed node!
      if (parent) {
        return parent;
      }
    } catch (e) {
      console.error("findParent error %o", e);
    }
    return false;
  }

  findNextSibling(comment) {
    try {
      let attempt = comment.nextElementSibling;
      if (!attempt) {
        return false;
      }

      if (this.isComment(attempt)) {
        return attempt;
      }
      return this.findNextSibling(attempt); // recurse
    } catch (e) {
      console.error("error %o", e);
    }

    return false;
  }

  findPreviousSibling(comment) {
    try {
      let attempt = comment.previousElementSibling;
      if (!attempt) {
        return false;
      }

      if (this.isComment(attempt)) {
        return attempt;
      }

      return this.findPreviousSibling(attempt); // recurse up
    } catch (e) {
      console.error("error %o", e);
    }

    return false;
  }

  upAndNext(comment) {
    let parent = this.findParent(comment);
    if (!parent) return;

    let sibling = this.findNextSibling(parent);
    if (sibling) {
      return this.comment(sibling);
    }

    this.upAndNext(parent);
  }

  moveDown() {
    let comment = this._comment;
    let attempt;

    if (!this.isCollapsed(comment)) {
      attempt = this.findChild(comment);
      if (attempt) return this.comment(attempt);
    }

    attempt = this.findNextSibling(comment);
    if (attempt) return this.comment(attempt);

    this.upAndNext(comment);
  }

  moveUp() {
    let attempt;
    let comment = this._comment;

    attempt = this.findPreviousSibling(comment);
    if (attempt) return this.comment(attempt);

    attempt = this.findParent(comment);
    if (attempt) return this.comment(attempt);
  }

  toggleCollapse() {
    if (!this._comment) return;

    let comment = this._comment;
    let expandEl = comment.querySelector(".expand");

    let ev = expandEl.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  register() {
    document.addEventListener("click", (e) => {
      this.tryFindComment(e.target);
    });

    document.addEventListener("keydown", (e) => {
      this.handleKeys(e);
    });
  }

  main() {
    this.register();

    let comment = document.querySelector(".nestedlisting .comment");
    if (comment) this.comment(comment);
  }
}

async function init() {
  try {
    await loadIgnoredSubs();

    if (document.querySelector("#siteTable")) {
      let m = new Listing();
      m.main();
    }

    if (document.querySelector(".nestedlisting")) {
      let c = new Comments();
      c.main();
    }
  } catch (e) {
    console.error("Initialization error:", e);
  }
}

init();
