// Optional sync with the self-hosted server (see server/server.js).
// Without a server the app works purely from localStorage.

const TOKEN_KEY = 'decision-randomizer:sync-password';

export class AuthError extends Error {}

export function createSyncClient({ storage, baseUrl = new URL('./', location.href) }) {
  const apiUrl = path => new URL(`api/${path}`, baseUrl);

  function getPassword() {
    try { return storage.getItem(TOKEN_KEY); } catch { return null; }
  }
  function setPassword(password) {
    try {
      if (password) storage.setItem(TOKEN_KEY, password);
      else storage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable; stay signed out */ }
  }

  async function request(path, options = {}) {
    const password = getPassword();
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(password ? { Authorization: `Bearer ${password}` } : {}),
        ...options.headers,
      },
      cache: 'no-store',
    });
    if (response.status === 401) throw new AuthError('Wrong sync password.');
    return response;
  }

  return {
    getPassword,
    setPassword,

    // Resolves true when this page is served by a server with sync turned on.
    async isAvailable() {
      try {
        const response = await fetch(apiUrl('health'), { cache: 'no-store' });
        if (!response.ok) return false;
        const body = await response.json();
        return body.sync === true;
      } catch {
        return false;
      }
    },

    async pull() {
      const response = await request('state');
      if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
      return response.json();
    },

    // Sends tasks and history, based on server version `baseVersion`.
    // Returns { ok: true, version } or, if another device saved first,
    // { ok: false, state } with the server's current state.
    async push(data, baseVersion) {
      const response = await request('state', {
        method: 'PUT',
        body: JSON.stringify({ ...data, baseVersion }),
      });
      if (response.status === 409) return { ok: false, state: (await response.json()).state };
      if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
      const { version } = await response.json();
      return { ok: true, version };
    },
  };
}
