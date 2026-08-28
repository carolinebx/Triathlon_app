// Simple persistence layer: localStorage for instant local cache + a Google Apps
// Script "Web App" (backed by a Google Sheet) as the real, cross-device data store.
//
// Setup: deploy google-apps-script/Code.gs as a Web App (see README.md), then put
// the resulting URL in a .env file as VITE_SHEETS_API_URL. Without that URL the
// app still works fully, it just stays local to this device.

const LOCAL_KEY = 'triathlon-coach-state';
const API_URL = import.meta.env.VITE_SHEETS_API_URL || '';

export function hasRemote() {
  return Boolean(API_URL);
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveLocal(state) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (e) {
    // opslag vol of niet beschikbaar — negeren, Sheets-sync blijft de bron van waarheid
  }
}

export async function loadRemote() {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}?key=triathlon-state`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.value) return null;
    return JSON.parse(data.value);
  } catch (e) {
    console.warn('Kon geen data ophalen uit Google Sheets, val terug op lokale data.', e);
    return null;
  }
}

export async function saveRemote(state) {
  if (!API_URL) return false;
  try {
    // Content-Type text/plain voorkomt een CORS-preflight (OPTIONS), die Apps
    // Script webapps niet afhandelen.
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: 'triathlon-state', value: JSON.stringify(state) }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Kon niet opslaan naar Google Sheets.', e);
    return false;
  }
}
