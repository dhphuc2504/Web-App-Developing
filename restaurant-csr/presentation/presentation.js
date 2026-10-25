(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const prev = document.querySelector('#prev'), next = document.querySelector('#next');
  const jump = document.querySelector('#jump');
  let current = 0;
  document.body.classList.add('js', 'controls-open');
  function show(index, updateHash = true) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => { slide.classList.toggle('active', i === current); });
    prev.disabled = current === 0; next.disabled = current === slides.length - 1;
    jump.value = String(current);
    document.querySelector('#count').textContent = `${current + 1} / ${slides.length}`;
    document.querySelector('.progress i').style.width = `${(current + 1) / slides.length * 100}%`;
    if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
    window.scrollTo(0, 0);
  }
  function fromHash() { const n = Number(location.hash.replace('#slide-', '')); show(Number.isInteger(n) && n > 0 ? n - 1 : 0, false); }
  prev.onclick = () => show(current - 1); next.onclick = () => show(current + 1);
  jump.onchange = () => show(Number(jump.value));
  document.querySelector('#print').onclick = () => window.print();
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.toLowerCase() === 'c' && !event.target.closest('input,select,textarea')) {
      event.preventDefault();
      const visible = document.body.classList.toggle('controls-open');
      if (!visible && document.activeElement.closest('.controls')) document.activeElement.blur();
      return;
    }
    if (event.key === 'Escape') {
      document.body.classList.remove('controls-open');
      if (document.activeElement.closest('.controls')) document.activeElement.blur();
      return;
    }
    if (event.target.closest('input,select,textarea,button,a')) return;
    if (['ArrowRight','PageDown',' '].includes(event.key)) {event.preventDefault(); show(current + 1);}
    if (['ArrowLeft','PageUp'].includes(event.key)) {event.preventDefault(); show(current - 1);}
    if (event.key === 'Home') {event.preventDefault(); show(0);}
    if (event.key === 'End') {event.preventDefault(); show(slides.length - 1);}
  });
  window.addEventListener('hashchange', fromHash); fromHash();
})();
