document.body.style.border = "5px solid green";

// globals
let pos = 0;
let total = 0;
let links = [];

console.log("registered keydown");

const getLinks = () => {
    // use global for now
    links = document.querySelectorAll('div .link:not(.promotedlink)');
    console.log("fetching links %o", links);
    //return links;
};

const register = () => {
    document.addEventListener('click', (e) => {
        console.log("click %o", e);
    })

    document.addEventListener('keydown', (e) => {
        console.log("current link %o", getLink(pos));
        console.log("handle key %o pos  %o total %o", e, pos, total);

        if (e.keyCode == 36) {
            // home (reset to 0)
        }

        if (e.keyCode == 36) {
            // end (set to total)
        }

        if (e.key == 'j') {
            // down
            if (pos > total) return;
            console.log("j pressed moving pos %o to %o", pos, (pos + 1))

            pos++;
            positionUpdated();
        }

        if (e.key == 'k') {
            // up
            if (pos == 0) return;
            console.log('k pressed moving pos %o to %o', pos, (pos - 1));

            pos--;
            positionUpdated();
        }

        if (e.key == 'h') {
            // hide
            console.log('h pressed');
            hideLink();
        }
    });
};

const positionUpdated = () => {
    // use `pos`
    console.log("position updated %o of %o \nlink %o", pos, total, getLink(pos));
};

const hideLink = () => {
    let link = getLink(pos);
    console.log("hiding link %o %o", pos, link);
    try {
        const ev = new MouseEvent('click', {
            view: window, 
            bubbles: true, 
            cancelable: true 
        });

        console.log("dispatching click %o on %o", ev, link);
        let hide = link.querySelector('a[data-event-action="hide"]');
        console.log("Hide %o", hide);
        if (!hide) {
            console.error('Unable to locate hide button for link %o', link);
            return;
        } else {
            let res = hide.dispatchEvent(ev);
            console.log("dispatch result %o", res);
            if (res) {
                // remove successful, remove link from links
                getLinks();
                // reapply position to this list
            }
        }
    } catch (e) {
        console.log("error %o", e);
    }
};

const getLink = (pos) => {
    return links[pos];
}

const main = () => {
    register();

    getLinks();
    pos = 0;
    total = links.length;

    console.log("links %o total %o", links, links.length);
    console.log("position %o", pos);

};

main();
