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
    // notify background to persist single add as well
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
function showUndoToast(text, undoFn, timeout = 5000) {
  try {
    // remove existing
    if (__re_toast_el) __re_toast_el.remove();

    const el = document.createElement("div");
    el.className = "re-toast";

    const msg = document.createElement("span");
    msg.className = "re-toast-msg";
    msg.textContent = text;
    el.appendChild(msg);

    const btn = document.createElement("button");
    btn.className = "re-toast-undo";
    btn.textContent = "Undo";
    el.appendChild(btn);

    let removed = false;
    const cleanup = () => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      __re_toast_el = null;
    };

    const timer = setTimeout(() => {
      if (!removed) cleanup();
    }, timeout);

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

    document.body.appendChild(el);
    __re_toast_el = el;
  } catch (e) {
    console.error("showUndoToast error", e);
  }
}

// TODO on refresh, remove current highlight

class Listing {
  //#pos = 0;
  //#total = 0;
  //#links = 0;
  constructor() {
    this._pos = 0;
    //this.total = 0;
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
    return document.querySelectorAll(
      "#siteTable > div.link:not(.promotedlink)",
    );
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
    console.log("refresh found links");
    this.filterIgnoredLinks();
    this._links = this._getLinks();
  }

  register() {
    document.addEventListener("click", (e) => {
      // TODO ensure within .linklisting
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
      // remove from dom
      link.parentNode.removeChild(link);

      // highlight next row
      this.refreshLinks();
      this.moveTo(this.pos());
      //this.removeLink(this.pos()); // TODO remove link from array instead of refetch
      //this.highlight(this.link(), true);
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

      // remove from DOM immediately
      if (parent && removedNode.parentNode) parent.removeChild(removedNode);

      // refresh links and keep position on the next item
      this.refreshLinks();
      this.moveTo(this.pos());

      // show undo toast which will re-insert node and remove from ignored list
      showUndoToast(`${subreddit} ignored`, async () => {
        try {
          // remove from ignored list
          removeIgnoredSub(subreddit);
          // re-insert DOM node if possible
          if (parent) parent.insertBefore(removedNode, nextSibling);
          // re-refresh links so navigation works
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

    // TODO https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Implement_a_settings_page
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
    // todo refactor into comment
    return comment.classList.contains("collapsed");
  }

  getData(comment) {
    // todo refactor into comment
    return comment.dataset;
  }

  highlight(comment, enable) {
    // todo refactor into comment
    if (!comment) return; // TODO clean

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
      let attempt;
      attempt = comment.nextElementSibling;
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
      let attempt;
      attempt = comment.previousElementSibling;
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
    // 1: find previous sibling
    let attempt;
    let comment = this._comment;

    attempt = this.findPreviousSibling(comment);
    if (attempt) return this.comment(attempt);

    // 2: find parent node
    attempt = this.findParent(comment);
    if (attempt) return this.comment(attempt);

    // it might be nice to say if parent found, jump to last comment?
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

  setDebugIds() {
    let comments = document.querySelectorAll(
      ".nestedlisting .comment:not(.has-debug)",
    );
    comments.forEach(function (comment) {
      let debug = document.createElement("div");
      debug.style =
        "display: inline-block; max-width: 100px; border: 1px solid #ccc; border-radius: 3px; background-color: #eee; padding: 1px 4px 1px 4px;";
      debug.innerText = comment.id;

      let author = comment.querySelector(".author");
      author.parentElement.appendChild(debug);

      comment.classList.add("has-debug");
    });
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

    this.setDebugIds();

    let comment = document.querySelector(".nestedlisting .comment");
    if (comment) this.comment(comment);
  }
}

// Initialize extension after loading settings
async function init() {
  try {
    await loadIgnoredSubs();

    // Only run Listing logic if on a listing page
    if (document.querySelector("#siteTable")) {
      let m = new Listing();
      m.main();
    }

    // Only run Comments logic if on a comment page
    if (document.querySelector(".nestedlisting")) {
      let c = new Comments();
      c.main();
    }
  } catch (e) {
    console.error("Initialization error:", e);
  }
}

init();
