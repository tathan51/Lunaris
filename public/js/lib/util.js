export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

const STORAGE_KEY = 'lunaris-session';

export function saveSession(data) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function clearSession() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

export function toast(message, type = 'info', duration = 3200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function on(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((node) => node.addEventListener(event, handler));
}

export function qs(root, selector) {
  return root.querySelector(selector);
}
