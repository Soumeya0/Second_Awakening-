// Backend calls. Off unless VITE_API_ENABLED=true, so the app still runs on local state alone.
// In dev, Vite proxies /api to the backend (vite.config.js); in production VITE_API_URL can point elsewhere.
const BASE = import.meta.env.VITE_API_URL || '';
export const API_ENABLED = import.meta.env.VITE_API_ENABLED === 'true';

// Auth0 plugs in here: setTokenGetter(() => getAccessTokenSilently()).
let getToken = null;
export function setTokenGetter(fn) { getToken = fn; }

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (getToken) headers.Authorization = `Bearer ${await getToken()}`;
  else if (import.meta.env.VITE_DEV_USER) headers['x-dev-user'] = import.meta.env.VITE_DEV_USER; // backend AUTH_DISABLED=true only
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export const api = {
  todaysQuests: () => request('/api/quests/today'),
  startQuest: (id) => request(`/api/quests/${id}/start`, { method: 'POST' }),
  uploadVitals: (id, readings) => request(`/api/quests/${id}/vitals`, { method: 'POST', body: { readings } }),
  questVitals: (id) => request(`/api/quests/${id}/vitals`),
  stats: (days = 30) => request(`/api/stats?days=${days}`),
  history: (month) => request(`/api/stats/history?month=${month}`),
  dbStats: () => request('/api/stats/db'),
};

// The server quest for today's category, started so vitals can be attached to it. null if unavailable.
export async function startServerQuest(categoryId) {
  if (!API_ENABLED) return null;
  try {
    const quest = (await api.todaysQuests()).find((q) => q.category === categoryId);
    if (!quest || quest.status === 'completed') return null;
    if (quest.status === 'pending') await api.startQuest(quest.id);
    return quest.id;
  } catch (err) {
    console.warn('Backend quest unavailable, vitals stay local:', err.message);
    return null;
  }
}
