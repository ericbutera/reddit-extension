document.body.style.border = "5px solid green";

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

    isCommentAndVisible(comment) {
        // todo refactor into comment
        if (!comment) return false;

        let classList = comment.classList;
        if (classList.contains('comment') && !classList.contains('collapsed')) {
            return true;
        }
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
        if (!attempt) {
            // console.log("no parent comment found");
            return;
        }

        //console.log("comment %o", attempt.id);
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

    findChildComment(comment) {
        console.log('findChildComment %o', comment.id);
        /*
        do i have an immediate .child .comment? 

        nextChild = comment.querySelector('.child .comment')  
            note: also data-replies="int count"
            if nextChild != null -> this.comment(nextChild), done!
            */
        try {
            let attempt = comment.querySelector('.child .comment');
            if (this.isComment(comment)) {
                console.log("findChildComment %o found %o", comment.id, attempt);
                return attempt;
            }

            console.log('findChildComment recurse');
            return this.findChildComment(attempt);
        } catch (e) {
            console.log("error %o", e);
        }
    }

    findSiblingComment(comment) {
        console.log("findSiblingComment %o", comment.id);
        try {
            /*
            try to find next comment after self 

            attempt = comment.nextElementSibling = "div.clearfix" while (not comment attempt nextElementSibling)
                attempt.hasClass ".comment"? no, try again
                    attempt = "div.clearfix".nextElementSibiling 
                        attempt.hasClass ".comment" comment found! 
                            this.comment(attempt)
                            */
            let attempt;
            attempt = comment.nextElementSibling;
            if (!attempt) {
                console.log("find sibling: none found, null");
                return false;
            } 
            
            if (this.isCommentAndVisible(attempt)) {
                console.log("find sibling: found comment %o", attempt.id);
                return attempt;
            } 
            
            console.log("find sibling: recurse %o", attempt);
            return this.findSiblingComment(attempt); // recurse
        } catch (e) {
            console.log("error %o", e);
        }
    }

    findParentComment(comment) {
        console.log('findParentComment %o', comment.id);
        /*
        el
        .parentElement // .sitetable .listing
        .parentElement // div.child
        .parentElement // div.comment - current comment's thread parent
        .nextElementSibling // div.clearleft
        .nextElementSibling // div.comment - next comment!
        */
        let up = comment.parentElement;
        console.log('findParentComment up 1 element %o', up);
        if (!up) return false;

        /*
        top level 1
            reply 1a
                reply 2a <-- here, up one finds reply 1 instead of jumping to top level 2
        top level 2
            reply 1a
            reply 2a
                reply 3
            reply 4a
         */
        let parent = up.closest('.comment'); // already viewed node!
        if (parent) {
            console.log('findNextParent(%o) found parent comment: %o', comment.id, parent.id);
            return parent;
        } 

        console.log('findNextParent(%o) = null', comment.id);
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
            
            if (this.isCommentAndVisible(attempt)) {
                console.log("find prev sibling: found comment %o", attempt.id);
                return attempt;
            } 

            console.log("find prev sibling: non comment element found %o", attempt);
            return this.findPreviousSibling(attempt); // recurse up
        } catch (e) {
            console.log("error %o", e);
        }
    }

    upAndNext(comment) {
        console.log('upAndNext %o', comment.id);
        let parent = this.findParentComment(comment);
        if (parent) {
            console.log('upAndNext found parent %o', parent);
            let sibling = this.findSiblingComment(parent);
            if (sibling) {
                console.log('upAndNext find sibling %o [findSiblingComment]', sibling);
                return this.comment(sibling);
            }

            // have to try moving up and next again
            return this.upAndNext(parent);
        }
    }

    moveDown() {
        let comment = this._comment;
        let attempt;
        // TODO refactor like behavior after working

        console.log("moveDown from %o", comment.id);

        if (this.isCollapsed(comment)) {
            // comment is hidden... need to jump to next visible
            console.log("- moveDown detected currrent node is collapsed, finding next sibling");
            attempt = this.findSiblingComment(comment);
            if (attempt) {
                console.log('- moveDown attempt %o', attempt);
                return this.comment(attempt);
            } else {
                console.log('move Down attempt failed %o', attempt);
            }
        }

        // if child commment is collapsed, jump to next sibling

        attempt = this.findChildComment(comment);
        if (attempt && !this.isCollapsed(attempt)) {
            return this.comment(attempt);
        }

        attempt = this.findSiblingComment(comment);
        if (attempt && !this.isCollapsed(attempt)) {
            console.log("- moveDown find sibling %o [findSiblingComment]", attempt);
            return this.comment(attempt);
        }

        console.log('- moveDown, upAndNext...');
        return this.upAndNext(comment);

        /*
        div .nestedlisting                              top level comment container
            div .comment                                first comment
                div .child          
                    div .listing                        reply container for first comment
                        div .comment .noncollapsed      reply 1
                        div .comment .collapsed         hidden reply 2
                        div .comment .noncollapsed      reply 3
            
            div .comment                                top level second comment
                div .child
                    div .listing                        reply container for second comment
                        div .comment .noncollapsed      reply 1 to second comment

        scenerio: first comment selected, move down: `comment`
            - try findChildComment
            - try findSiblingComment
            - no moves left
        */
    }

    moveUp() {
        // 1: find previous sibling
        let attempt;
        let comment = this._comment;

        attempt = this.findPreviousSibling(comment);
        if (attempt) 
            return this.comment(attempt);

        // 2: find parent node
        let parent = this.findParentComment(comment);
        if (parent) {
            this.comment(parent);
        }
    }

    toggleCollapse() {
        if (!this._comment) return;

        let comment = this._comment;
        let expandEl = comment.querySelector(".expand");

        let ev = expandEl.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
        if (!ev) return;

        /*if (this.isCollapsed(comment)) {
            this.moveDown();
            this.clear(comment);
        }*/
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

        let comment = document.querySelector('.nestedlisting .comment');
        console.log("first comment %o", comment.id);
        if (comment)
            this.comment(comment);
    }
}


console.log("making instance");
let m = new Listing();
m.main();

let c = new Comments();
c.main();

console.log("done %o %o", m, new Date());
