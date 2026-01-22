// Helper to inject a simple chrome mock backed by an in-memory store
async function injectChromeMock(page, initialState = { subs: [], stats: {} }) {
  await page.addInitScript(({ initial }) => {
    const state = { subs: Array.isArray(initial.subs) ? initial.subs.slice() : [], stats: initial.stats || {} };
    function statsArray() {
      return Object.keys(state.stats).map((k) => ({ name: k, count: state.stats[k] }));
    }

    window.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          const action = msg && msg.action;
          switch (action) {
            case 'getIgnoredSubs':
              return cb && cb({ success: true, subs: state.subs.slice() });
            case 'setIgnoredSubs':
              state.subs = Array.isArray(msg.subs) ? msg.subs.slice() : [];
              return cb && cb({ success: true });
            case 'getStats':
              return cb && cb({ success: true, stats: statsArray() });
            case 'incrementStat':
              state.stats[msg.name] = (state.stats[msg.name] || 0) + (msg.delta || 1);
              return cb && cb({ success: true });
            case 'incrementStatsBulk':
              for (const [k, v] of Object.entries(msg.stats || {})) state.stats[k] = (state.stats[k] || 0) + v;
              return cb && cb({ success: true });
            case 'exportIgnoredSubs':
              return cb && cb({ success: true, data: JSON.stringify(state.subs) });
            default:
              return cb && cb({ success: false, error: 'unknown action' });
          }
        },
      },
      storage: {
        local: {
          get: (keys, cb) => cb && cb({}),
          set: (obj, cb) => cb && cb(),
        },
      },
    };
  }, { initial: initialState });
}

module.exports = { injectChromeMock };
