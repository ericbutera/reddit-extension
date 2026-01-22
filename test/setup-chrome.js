// Lightweight chrome mock for Jest unit tests (no external deps)
global.chrome = {
	runtime: {
		sendMessage: jest.fn((msg, cb) => {
			// default safe responses for common actions used by unit tests
			const action = msg && msg.action;
			switch (action) {
				case 'getIgnoredSubs':
					return cb && cb({ success: true, subs: [] });
				case 'getStats':
					return cb && cb({ success: true, stats: [] });
				default:
					return cb && cb({ success: false });
			}
		}),
		onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
	},
	tabs: {
		query: jest.fn().mockResolvedValue([]),
		create: jest.fn(),
		sendMessage: jest.fn(),
	},
	storage: {
		local: {
			get: jest.fn((keys, cb) => cb && cb({})),
			set: jest.fn((obj, cb) => cb && cb()),
		},
		sync: {
			get: jest.fn((keys, cb) => cb && cb({})),
			set: jest.fn((obj, cb) => cb && cb()),
		},
	},
	permissions: {
		contains: jest.fn().mockResolvedValue(false),
		request: jest.fn().mockResolvedValue(false),
	},
};
