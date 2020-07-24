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
            console.log("set position to %o", this._pos);
        }

        console.log("get position: [%o]", this._pos);
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
        console.log("get links %o", this._links);
        return this._links;
    }

    removeLink(pos) {
        this._links.splice(pos, 1);
        console.log("removed entry %o array %o", pos, this._links.length);
    }

    refreshLinks() {
        console.log("fetching links...");
        this._links = document.querySelectorAll('#siteTable > div.link:not(.promotedlink)');
        console.log("...found links %o", this._links);
    }

    register() {
        document.addEventListener('click', (e) => {
            console.log("click %o", e);
            this.tryFindLink(e.target);
        });

        document.addEventListener('keydown', (e) => {
            this.handleKeys(e);
        });
    }

    tryFindLink(el) {
        let attempt = el.closest('.link');
        if (!attempt) {
            console.log("no parent link found");
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

        console.debug("handle key pos %o total %o %o", pos, total, e);

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
        console.log("attempting move to %o", position);
        let total = this.total();

        if (position >= total || position < 0) {
            console.log("position %o out of bounds, ignoring", position);
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
            console.log("adding highlight to %o", link.id);
            link.style.backgroundColor = 'yellow';
        } else {
            console.log("removing highlight from %o", link.id);
            link.style.backgroundColor = 'unset';
        }
    }

    hideLink() {
        let link = this.link();
        console.log("hide link %o", link.id);

        let hide = this._getHideEl(link);
        if (!hide) {
            console.error('Unable to locate hide button for link %o', link);
            return false;
        } 

        const ev = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });

        let res = hide.dispatchEvent(ev);
        console.log("dispatch result %o", res);

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
        console.log("main...");
        this.refreshLinks();
        this.moveTo(0); //this.highlight(this.link(), true);

        console.log("links %o total %o", this.links(), this.total());
        console.log("position %o", this.pos());
    }
}

class Comments {

    constructor() {

    }

    getComments() {
        this._list = document.querySelectorAll('#siteTable > div.link:not(.promotedlink)');
    }
}


console.log("making instance");
let m = new Listing();
m.register();
m.main();


let c = new Comments() 
c.register();

console.log("done %o %o", m, new Date());
