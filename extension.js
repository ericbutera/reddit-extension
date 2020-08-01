
console.log("loading RE ext.");

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
        if (this._links)
            return this._links.length;

        return 0;
    }

    link() {
        if (this._links[this._pos])
            return this._links[this._pos];

        return false;
    }

    links() {
        return this._links;
    }

    removeLink(pos) {
        this._links.splice(pos, 1);
    }

    refreshLinks() {
        // TODO ensure only listing page links
        this._links = document.querySelectorAll('#siteTable > div.link:not(.promotedlink)');
    }

    register() {
        document.addEventListener('click', (e) => {
            // TODO ensure within .linklisting 
            this.tryFindLink(e.target);
        });

        document.addEventListener('keydown', (e) => {
            this.handleKeys(e);
        });
    }

    tryFindLink(el) {
        let attempt = el.closest('.link');
        if (!attempt) {
            return;
        }

        const self = this;
        this._links.forEach((link, index) => {
            if (link == attempt)
                self.moveTo(index);
        });
    }

    handleKeys(e) {
        let pos = this.pos();
        let total = this.total();

        if (e.keyCode == 36) //home
            this.moveTo(0);

        if (e.keyCode == 35) // end
            this.moveTo(total -  1);

        if (e.key == 'j')  // down
            this.moveTo(pos + 1); 

        if (e.key == 'k') // up
            this.moveTo(pos - 1); 

        if (e.key == 'h')
            this.hideLink();
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
            link.style.backgroundColor = 'yellow';
        } else {
            link.style.backgroundColor = 'unset';
        }
    }

    hideLink() {
        let link = this.link();
        let hide = this._getHideEl(link);
        if (!hide) {
            return false;
        } 

        let res = hide.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }))
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
     * Fetch the 'hide' link to click
     * @param {HTMLElement} link 
     */
    _getHideEl(link) {
        return link.querySelector('a[data-event-action="hide"]');
    }

    main() {
        console.log("listing main");
        this.register();
        this.refreshLinks();
        this.moveTo(0); //this.highlight(this.link(), true);
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

    comments() { return this_.list; }
    total() { return this._list.length; }
    pos() { return this._pos; }

    clear(comment) {
        //console.debug("moving off comment %o", comment.id);
        this.highlight(comment, false);
    }

    comment(comment) {
        if (comment == this._comment) {
            //console.log("detected same selected comment %o", comment.id);
            return;
        }

        console.debug("selecting new comment %o", comment);

        if (this._comment) 
            this.clear(this._comment);

        this._comment = comment;
        this.highlight(comment, true);
    }

    isComment(comment) {
        if (comment && comment.classList.contains('comment'))
            return true;

        return false;
    }

    isCollapsed(comment) {
        // todo refactor into comment
        return comment.classList.contains('collapsed');
    }

    getData(comment) {
        // todo refactor into comment
        return comment.dataset;
    }

    highlight(comment, enable) {
        // todo refactor into comment
        if (!comment) return; // TODO clean

        if (enable) {
            //console.log("adding highlight to %o", comment.id);
            comment.style.borderLeft = '3px solid yellow';
        } else {
            //console.log("removing highlight from %o", comment.id);
            comment.style.borderLeft = 'unset';
        }
    }

    tryFindComment(el) {
        let attempt = el.closest('.comment');
        if (!attempt) return false;

        this.comment(attempt);
    }

    handleKeys(e) {
        console.debug("handle key  %o", e);

        if (this._comment) {
            if (e.key == 'x')
                this.toggleCollapse();

            if (e.key == 'j') 
                this.moveDown();

            if (e.key == 'k')
                this.moveUp();
        }
    }

    findChild(comment) {
        console.log('findChild %o', comment.id);

        try {
            let attempt = comment.querySelector('.child .comment');
            if (this.isComment(attempt)) {
                console.log("findChild %o found %o", comment.id, attempt.id);
                return attempt;
            }

            if (attempt) {
                console.log('findChild recurse');
                return this.findChild(attempt);
            }
        } catch (e) {
            console.log("error %o", e);
        }

        return false;
    }

    findParent(comment) {
        console.log('findParent %o', comment.id);

        try {
            let up = comment.parentElement;
            console.log('findParent up 1 element %o', up);
            if (!up) return false;

            let parent = up.closest('.comment'); // already viewed node!
            if (parent) {
                console.log('findNextParent(%o) found parent comment: %o', comment.id, parent.id);
                return parent;
            } 

            console.log('findNextParent(%o) = null', comment.id);
        } catch (e) {
            console.log("error %o", e);
        }
        return false;
    }

    findNextSibling(comment) {
        // try to find next comment after self 
        console.log("findNextSibling %o", comment.id);
        try {
            let attempt;
            attempt = comment.nextElementSibling;
            if (!attempt) {
                console.log("find sibling: none found, null");
                return false;
            } 
            
            if (this.isComment(attempt)) {
                console.log("find sibling: found comment %o", attempt.id);
                return attempt;
            } 
            
            console.log("find sibling: recurse %o", attempt);
            return this.findNextSibling(attempt); // recurse
        } catch (e) {
            console.log("error %o", e);
        }

        return false;
    }

    findPreviousSibling(comment) {
        try {
            console.log('findPreviousSibling %o', comment.id);
            let attempt;
            attempt = comment.previousElementSibling;
            if (!attempt) {
                console.log("find prev sibling: none found, null");
                return false;
            } 
            
            if (this.isComment(attempt)) {
                console.log("find prev sibling: found comment %o", attempt.id);
                return attempt;
            } 

            console.log("find prev sibling: non comment element found %o", attempt);
            return this.findPreviousSibling(attempt); // recurse up
        } catch (e) {
            console.log("error %o", e);
        }

        return false;
    }

    upAndNext(comment) {
        console.log('upAndNext %o', comment.id);
        let parent = this.findParent(comment);
        if (!parent) return; 

        console.log('upAndNext found parent %o', parent);
        let sibling = this.findNextSibling(parent);
        if (sibling) {
            console.log('upAndNext find sibling %o [findNextSibling]', sibling);
            return this.comment(sibling);
        }

        this.upAndNext(parent);
    }

    moveDown() {
        let comment = this._comment;
        let attempt;
        console.log("moveDown from %o", comment.id);

        if (!this.isCollapsed(comment)) {
            attempt = this.findChild(comment);
            if (attempt)
                return this.comment(attempt);
        }

        attempt = this.findNextSibling(comment);
        if (attempt) 
            return this.comment(attempt);

        this.upAndNext(comment);
    }

    moveUp() {
        // 1: find previous sibling
        let attempt;
        let comment = this._comment;

        attempt = this.findPreviousSibling(comment);
        if (attempt) 
            return this.comment(attempt);

        // 2: find parent node
        attempt = this.findParent(comment);
        if (attempt)
            return this.comment(attempt);

        // it might be nice to say if parent found, jump to last comment?
    }

    toggleCollapse() {
        if (!this._comment) return;

        let comment = this._comment;
        let expandEl = comment.querySelector(".expand");

        let ev = expandEl.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
    }

    setDebugIds() {
        let comments = document.querySelectorAll('.nestedlisting .comment:not(.has-debug)');
        comments.forEach(function(comment){
            let debug = document.createElement('div');
            debug.style="display: inline-block; max-width: 100px; border: 1px solid #ccc; border-radius: 3px; background-color: #eee; padding: 1px 4px 1px 4px;"
            debug.innerText = comment.id;

            let author = comment.querySelector('.author');
            author.parentElement.appendChild(debug);

            console.log("comment %o debug %o", comment.id, debug);
            comment.classList.add('has-debug');
        });
    }

    register() {
        document.addEventListener('click', (e) => {
            //console.log("click %o", e);
            this.tryFindComment(e.target);
        });

        document.addEventListener('keydown', (e) => {
            this.handleKeys(e);
        });
    }

    main() {
        console.log("comment main...");
        this.register();

        this.setDebugIds();

        let comment = document.querySelector('.nestedlisting .comment');
        if (comment)
            this.comment(comment);
    }
}



try {
    console.log("making instance");
    let m = new Listing();
    m.main();

    let c = new Comments();
    c.main();

    console.log("done %o %o", m, new Date());
} catch(e) {
    console.log("err %o", e);
}
