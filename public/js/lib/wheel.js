import { escapeHtml } from './util.js';

export const WHEEL_COLORS = ['#a855f7', '#ec4899', '#22d3ee', '#34d399', '#fbbf24', '#f43f5e', '#818cf8', '#fb923c'];

export function wheelMarkup(labels, rotation) {
  const n = Math.max(labels.length, 1);
  const slice = 360 / n;
  const gradient = labels.length
    ? labels.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${(slice * i).toFixed(2)}deg ${(slice * (i + 1)).toFixed(2)}deg`).join(', ')
    : '#1a1a2e 0deg 360deg';

  return `
    <div class="wheel-wrap">
      <div class="wheel-pointer">📍</div>
      <div class="wheel" id="wheel" style="transform: rotate(${rotation}deg); background: conic-gradient(${gradient});">
        ${labels.map((label, i) => {
          const angle = slice * (i + 0.5);
          return `<div class="wheel__name" style="transform: rotate(${angle}deg) translate(0, -${Math.min(130, 40 + n * 6)}px);">${escapeHtml(label)}</div>`;
        }).join('')}
        <div class="wheel__center">🎡</div>
      </div>
    </div>
  `;
}

// The pointer is fixed at the top (0deg). Returns the extra rotation (always positive,
// includes a few flourish turns) to add to `currentRotation` so the wheel lands with
// `labels[winnerIndex]`'s slice midpoint under the pointer.
export function targetRotationDelta(currentRotation, labels, winnerIndex) {
  const n = labels.length;
  const slice = 360 / n;
  const targetMod = winnerIndex >= 0
    ? (((360 - slice * (winnerIndex + 0.5)) % 360) + 360) % 360
    : Math.random() * 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  const extraSpins = 3 + Math.floor(Math.random() * 3);
  return extraSpins * 360 + delta;
}

// Spins `wheelEl` (already in the DOM at `currentRotation`) so it lands on `winnerIndex`.
// Applies the rotation on a short delay so the browser commits the starting angle first
// (otherwise the transform can jump straight to the new value with no visible spin).
export function spinWheelTo(wheelEl, currentRotation, labels, winnerIndex, onRotated) {
  setTimeout(() => {
    const delta = targetRotationDelta(currentRotation, labels, winnerIndex);
    const newRotation = currentRotation + delta;
    wheelEl.style.transform = `rotate(${newRotation}deg)`;
    onRotated(newRotation);
  }, 30);
}
