/**
 * Vitest 全局 mock：chrome 扩展 API
 */
global.chrome = {
  storage: {
    local: {
      get: () => {},
      set: () => {},
      remove: () => {},
    }
  },
  runtime: {
    onMessage: { addListener: () => {} },
    onConnect: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    connect: () => ({
      onMessage: { addListener: () => {} },
      onDisconnect: { addListener: () => {} },
      postMessage: () => {},
      disconnect: () => {},
    }),
    sendMessage: () => Promise.resolve(),
    lastError: null,
  }
};

global.fetch = () => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
});
