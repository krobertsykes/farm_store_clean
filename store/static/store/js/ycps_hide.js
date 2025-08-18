// YCPS: hide the clicked "+" after dropdown opens (clean, no logs)
(function(){
  if (window.__ycps_hider_ver) return;
  window.__ycps_hider_ver = "v1";

  // Ensure a CSS rule that always wins
  if (!document.getElementById('ycps-hide-style')) {
    const st = document.createElement('style');
    st.id = 'ycps-hide-style';
    st.textContent = '.ycps-hide{display:none!important}';
    document.head.appendChild(st);
  }

  const BTN = 'button.ycps';
  const afterApp = fn => requestAnimationFrame(() => setTimeout(fn, 60));

  const hide = (btn) => {
    if (!btn) return;
    btn.classList.add('ycps-hide');
    btn.style.setProperty('display','none','important'); // beats Tailwind etc.
    btn.setAttribute('aria-expanded','true');
  };

  // Let your app open the dropdown first, then hide "+"
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;
    afterApp(() => {
      hide(b);
      // keep it hidden through quick re-renders
      const mo = new MutationObserver(() => hide(b));
      mo.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
      setTimeout(() => mo.disconnect(), 1500);
    });
  }, false);

  // Backup: if click is swallowed, hide shortly after pointerdown (still non-blocking)
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;
    setTimeout(() => hide(b), 120);
  }, true);
})();
