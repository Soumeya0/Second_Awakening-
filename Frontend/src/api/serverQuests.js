// With the backend on, today's quests are written by Gemini (GET /api/quests/today). The local rotation still
// decides the categories and rewards; the server's title and description replace the placeholder text.
import { useEffect, useState } from 'react';
import { API_ENABLED, api } from './client.js';

// { [categoryId]: server quest } for the given game day; empty when the backend is off or unreachable.
export function useServerQuests(date, enabled = true) {
  const [byCategory, setByCategory] = useState({});
  useEffect(() => {
    if (!API_ENABLED || !enabled) return;
    let alive = true;
    api.todaysQuests()
      .then((qs) => { if (alive) setByCategory(Object.fromEntries(qs.map((q) => [q.category, q]))); })
      .catch((err) => console.warn('Server quests unavailable, using local titles:', err.message));
    return () => { alive = false; };
  }, [date, enabled]);
  return byCategory;
}

export const withServerText = (quests, byCategory) => quests.map((q) => {
  const s = byCategory[q.id];
  return s ? { ...q, title: s.title, description: s.description } : q;
});

// Sends the picked categories (in pick order: they decide the rotation) so the server can generate quests.
export async function syncCategories({ chosen, look, name, answers }) {
  if (!API_ENABLED) return;
  try {
    await api.onboard({ chosen, look, name, answers });
  } catch (err) {
    if (err.status === 409) await api.updateMe({ chosen }).catch((e) => console.warn('Could not update categories:', e.message));
    else console.warn('Could not onboard on the server:', err.message);
  }
}
