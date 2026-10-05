// This script handles gestures only. The server validates, saves, and renders each move.
const form = document.querySelector('#move-form');
const status = document.querySelector('#room-status');
const cards = [...document.querySelectorAll('.student-card')];
let selected;
let gesture;
let saving = false;
let suppressClick = false;

function select(card) {
  selected = card;
  cards.forEach(item => item.setAttribute('aria-pressed', String(item === card)));
  if (!form) return;
  const seat = card.closest('.seat');
  form.elements.id.value = card.dataset.studentId;
  form.elements.row.value = seat.dataset.row;
  form.elements.column.value = seat.dataset.column;
  status.textContent = `${card.dataset.studentId} selected. Choose a destination seat to move or swap.`;
}

function move(seat) {
  if (!form || !selected || saving) return;
  if (seat === selected.closest('.seat')) return;
  form.elements.id.value = selected.dataset.studentId;
  form.elements.row.value = seat.dataset.row;
  form.elements.column.value = seat.dataset.column;
  form.requestSubmit();
}

form?.addEventListener('submit', () => {
  saving = true;
  status.textContent = 'Saving position…';
  document.body.classList.add('saving');
});

for (const seat of document.querySelectorAll('.seat')) {
  seat.querySelector('button').addEventListener('click', () => {
    if (suppressClick || saving) return;
    const card = seat.querySelector('.student-card');
    if (selected && selected.closest('.seat') !== seat) move(seat);
    else if (card) select(card);
    else status.textContent = 'Select a student first, then choose an empty seat.';
  });
}

for (const card of cards) {
  const popup = card.parentElement.querySelector('.student-popup');
  function showPopup() {
    if (gesture?.dragging || saving) return;
    const bounds = card.getBoundingClientRect();
    popup.classList.add('visible');
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    popup.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`;
    popup.style.top = `${bounds.bottom + height + 12 < window.innerHeight ? bounds.bottom + 8 : Math.max(8, bounds.top - height - 8)}px`;
  }
  const hidePopup = () => popup.classList.remove('visible');
  card.addEventListener('pointerenter', showPopup);
  card.addEventListener('pointerleave', hidePopup);
  card.addEventListener('focus', showPopup);
  card.addEventListener('blur', hidePopup);
  card.addEventListener('pointerdown', event => {
    if (event.button !== 0 || saving) return;
    gesture = { card, x: event.clientX, y: event.clientY, dragging: false, pointerId: event.pointerId };
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener('pointermove', event => {
    if (!gesture || gesture.card !== card) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) {
      gesture.dragging = true;
      select(card);
      hidePopup();
      card.classList.add('dragging');
    }
    if (!gesture.dragging) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.seat');
    document.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target'));
    target?.classList.add('drop-target');
  });
  function finish(event, cancelled = false) {
    if (!gesture || gesture.card !== card) return;
    const dragged = gesture.dragging;
    gesture = undefined;
    card.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target'));
    if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
    if (dragged) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (!cancelled) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.seat');
        if (target) move(target);
        else status.textContent = 'Move cancelled. Drop onto a classroom seat to save a position.';
      }
    }
  }
  card.addEventListener('pointerup', event => finish(event));
  card.addEventListener('pointercancel', event => finish(event, true));
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.student-popup.visible').forEach(popup => popup.classList.remove('visible'));
  if (gesture) {
    gesture.card.classList.remove('dragging');
    if (gesture.card.hasPointerCapture(gesture.pointerId)) gesture.card.releasePointerCapture(gesture.pointerId);
    gesture = undefined;
  }
  document.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target'));
  selected = undefined;
  cards.forEach(card => card.setAttribute('aria-pressed', 'false'));
  status.textContent = 'Selection cleared. Choose a student to move.';
});
window.addEventListener('scroll', () => document.querySelectorAll('.student-popup.visible').forEach(popup => popup.classList.remove('visible')), true);
window.addEventListener('resize', () => document.querySelectorAll('.student-popup.visible').forEach(popup => popup.classList.remove('visible')));
