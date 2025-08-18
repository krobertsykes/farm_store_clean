// fresh_produce.js

// --- helpers ---
function getCSRF(){
  return document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.split('=')[1];
}
function postUpdateQty(url,qty){
  const data=new FormData(); data.append('qty',String(qty));
  return fetch(url,{ method:'POST', headers:{'X-CSRFToken':getCSRF(),'X-Requested-With':'XMLHttpRequest'}, body:data }).then(r=>r.json());
}

window.addEventListener('DOMContentLoaded', () => {
  // Sanity check: open your browser console and you should see this once.
  console.log('fresh_produce.js loaded, DOM ready');

  // --- favorites ---
  document.querySelectorAll('.fav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const pid = btn.dataset.pid;
      const url = btn.dataset.favUrl || `/product/${pid}/favorite/`;
      fetch(url, { method:'POST', headers:{'X-CSRFToken':getCSRF(),'X-Requested-With':'XMLHttpRequest'} })
        .then(r=>r.json())
        .then(js=>{
          if(!js || !js.ok) return;
          const on = !!js.favorited;
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          btn.querySelector('.heart-on')?.classList.toggle('hidden', !on);
          btn.querySelector('.heart-off')?.classList.toggle('hidden', on);

          if(!on && new URLSearchParams(location.search).get('fav') === '1'){
            const card = btn.closest('[id^="prod-"]'); card?.classList.add('opacity-50');
            setTimeout(()=>{ card?.remove(); }, 150);
          }
        })
        .catch(()=>{});
    });
  });

  // --- ratings ---
  document.querySelectorAll('.rate-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const pid = btn.dataset.pid, stars = btn.dataset.stars;
      fetch(`/product/${pid}/rate/`, {
        method: 'POST',
        headers: {'X-CSRFToken': getCSRF(), 'X-Requested-With':'XMLHttpRequest'},
        body: new URLSearchParams({stars})
      })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(js=>{
        const wrap = btn.parentElement;
        wrap.querySelectorAll('.rate-btn').forEach(b=>{
          const k = parseInt(b.dataset.stars,10);
          const svg = b.querySelector('svg');
          if(k <= parseInt(stars,10)){
            svg.setAttribute('fill','#F59E0B'); svg.setAttribute('stroke','none');
          }else{
            svg.setAttribute('fill','none'); svg.setAttribute('stroke','#F59E0B');
          }
        });
        const avgEl = document.querySelector(`.avg-stars[data-pid="${pid}"]`);
        if(js && js.ok && typeof js.avg !== 'undefined' && avgEl){
          const v = Math.round(Number(js.avg)*10)/10;
          avgEl.textContent = v.toFixed(1);
        }
      }).catch(()=>{});
    });
  });

  // --- cart / YCPS / weight list behaviors ---
  document.querySelectorAll('.add-form').forEach(form=>{
    const pid   = form.dataset.pid;
    const unit  = (form.dataset.unit || '').trim().toLowerCase();  // normalize
    const price = Number(form.dataset.price||'0');
    const url   = form.dataset.urlUpdate;
    const stock = Number(form.dataset.stock || '0');
    let inCart  = Number(form.dataset.initialInCart||'0');

    const card     = document.getElementById('prod-'+pid);
    const remainEl = card?.querySelector('.remain');

    const ycps   = form.querySelector('.ycps');
    const stepEl = form.querySelector('.stepper');
    const inc    = form.querySelector('.btn-inc');
    const dec    = form.querySelector('.btn-dec');
    const countEl= form.querySelector('.stepper-count');

    const wStep  = form.querySelector('.weight-stepper');
    const winc   = wStep ? wStep.querySelector('.winc') : null;
    const wdec   = wStep ? wStep.querySelector('.wdec') : null;
    const wqty   = wStep ? wStep.querySelector('.wqty') : null;
    const wunit  = wStep ? wStep.querySelector('.wunit') : null;
    const wcaret = wStep ? wStep.querySelector('.wcaret') : null;

    const panel  = form.querySelector('.weight-panel');
    const confirm= form.querySelector('.weight-confirm');
    const chosen = confirm ? confirm.querySelector('.chosen') : null;
    const est    = confirm ? confirm.querySelector('.est-price') : null;
    const addBtn = confirm ? confirm.querySelector('.btn-add') : null;

    let pickToAdd = 0;
    let panelSticky = false; // keep the list open when opened via YCPS

    function remaining(){ return Math.max(0, stock - inCart); }
    function stepInfo(){
      if(unit==='lb') return {step:0.5, hard:5};
      if(unit==='oz') return {step:1, hard:Infinity};
      if(unit==='kg') return {step:0.25, hard:5};
      return {step:1, hard:Infinity}; // 'ea'
    }
    function fmtQty(q){
      if(unit==='ea') return String(Math.floor(q));
      if(unit==='oz') return String(Math.round(q)) + ' oz';
      const n = Math.round(q*100)/100;
      return String(n.toFixed(2).replace(/\.00$/,'')) + ' ' + unit;
    }
    function setRemainText(v){
      if(!remainEl) return;
      if(unit==='ea'){ remainEl.textContent = String(Math.floor(Number(v)||0)); }
      else { remainEl.textContent = String(v); }
    }

    function syncUI(){
      setRemainText(remaining());
      if(unit==='ea'){
        if(inCart>0){
          stepEl?.classList.remove('hidden');
          ycps?.classList.add('hidden');
          if(countEl) countEl.textContent = String(Math.floor(inCart));
        }else{
          stepEl?.classList.add('hidden');
          ycps?.classList.remove('hidden');
        }
      }else{
        if(inCart>0){
          ycps?.classList.add('hidden');
          panel?.classList.add('hidden');
          confirm?.classList.add('hidden');
          wStep?.classList.remove('hidden');
          if(wqty) wqty.textContent = (unit==='oz') ? String(Math.round(inCart)) : String((Math.round(inCart*100)/100).toFixed(2).replace(/\.00$/,''));
          if(wunit) wunit.textContent = unit;
        }else{
          wStep?.classList.add('hidden');
          ycps?.classList.remove('hidden');
          panel?.classList.add('hidden');
          confirm?.classList.add('hidden');
        }
      }
      if(remaining() <= 0 && inCart <= 0){
        form.remove();
        const out = document.createElement('p'); out.className = 'text-red-600 font-semibold mt-3'; out.innerText = 'Out of stock';
        card?.appendChild(out); card?.classList.add('bg-gray-200','text-gray-500');
      }
    }

    function applyServer(newQty, js){
      inCart = Number(newQty);
      form.dataset.initialInCart = String(inCart); // keep dataset in sync
      const rem = (js && typeof js.remaining !== 'undefined') ? js.remaining : remaining();
      setRemainText(rem);
      const counter = document.getElementById('cart-count');
      if(counter && js && typeof js.cart_total!=='undefined') counter.textContent = js.cart_total;
      syncUI();
    }

    function buildAndOpenList(sticky=false){
      if(unit==='ea') return;
      if(!panel || !confirm) return;
      panel.innerHTML = '';
      const {step, hard} = stepInfo();
      const end = Math.min(stock, hard);
      if(end <= 0){ panel.classList.add('hidden'); return; }

      for(let q=step; q<=end + 1e-9; q=Math.round((q+step)*1000)/1000){
        const row = document.createElement('button');
        row.type='button';
        row.className='block w-full text-left px-3 py-2 hover:bg-yellow-100';
        row.textContent = fmtQty(q);
        row.addEventListener('mouseenter', ()=>{
          const hp = panel.querySelector('.hover-price'); if(hp) hp.textContent = `$${(price*q).toFixed(2)}`;
        });
        row.addEventListener('click', ()=>{
          pickToAdd = Math.min(q, Math.max(0, stock - inCart));
          panel.classList.add('hidden');
          confirm.classList.remove('hidden');
          if(chosen) chosen.textContent = fmtQty(pickToAdd);
          if(est)    est.textContent    = `$${(price*pickToAdd).toFixed(2)}`;
          panelSticky = false; // after picking, allow outside click to close confirm
        });
        panel.appendChild(row);
      }
      const footer = document.createElement('div'); footer.className='px-3 py-2 text-sm text-gray-700 border-t';
      footer.innerHTML = `<div>Total est. price: <span class="hover-price font-semibold">$${(price*stepInfo().step).toFixed(2)}</span></div><div class="text-gray-500">Final cost by actual weight</div>`;
      panel.appendChild(footer);

      panel.classList.remove('hidden');
      confirm.classList.add('hidden');
      panelSticky = sticky;
    }

    syncUI();

    // YCPS: 'ea' increments; by-weight opens list and keeps it open
    ycps?.addEventListener('click', e=>{
      e.preventDefault();
      e.stopPropagation(); // be extra safe vs outside-click handlers
      if(unit === 'ea'){
        const target = Math.min(stock, inCart + 1);
        if(target === inCart) return;
        postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
      }else{
        if (panel && !panel.classList.contains('hidden')) { panelSticky = true; return; }
        buildAndOpenList(true); // sticky open
      }
    });

    // Each stepper
    inc?.addEventListener('click', e=>{
      e.preventDefault();
      const target = Math.min(stock, inCart + 1);
      if(target===inCart) return;
      postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
    });
    dec?.addEventListener('click', e=>{
      e.preventDefault();
      const target = Math.max(0, inCart - 1);
      postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
    });

    function weightStep(){ return stepInfo().step; }

    // Down-arrow toggles the list (non-sticky)
    wcaret?.addEventListener('click', ()=>{
      if (!panel) return;
      if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        confirm?.classList.add('hidden');
        return;
      }
      buildAndOpenList(false);
    });

    addBtn?.addEventListener('click', ()=>{
      if(pickToAdd<=0) return;
      const target = Math.min(stock, inCart + pickToAdd);
      postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
    });

    winc?.addEventListener('click', ()=>{
      const target = Math.min(stock, inCart + weightStep());
      if(target===inCart) return;
      postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
    });
    wdec?.addEventListener('click', ()=>{
      const target = Math.max(0, inCart - weightStep());
      postUpdateQty(url, target).then(js=>{ if(js?.ok) applyServer(target, js); });
    });

    // Outside click — don’t close if sticky (YCPS-opened)
    document.addEventListener('click', (ev)=>{
      const listOpen = panel && !panel.classList.contains('hidden');
      const confirmOpen = confirm && !confirm.classList.contains('hidden');
      if(!listOpen && !confirmOpen) return;
      if(form.contains(ev.target)) return;

      if(listOpen && panelSticky){
        return; // keep open until a choice or Esc
      }

      panel?.classList.add('hidden');
      confirm?.classList.add('hidden');
    });

    // Esc always collapses (and clears sticky)
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') {
        if(panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
        if(confirm && !confirm.classList.contains('hidden')) confirm.classList.add('hidden');
        panelSticky = false;
      }
    });

    form.addEventListener('submit', e=>e.preventDefault());
  });

  // ---------- Delegated YCPS handler (catches any stragglers / future cards) ----------
  document.addEventListener('click', (evt)=>{
    const btn = evt.target.closest('.ycps');
    if (!btn) return;

    // If the per-form handler already ran, do nothing
    if (btn._handledOnce) return;
    btn._handledOnce = true;  // prevent double-processing in this tick
    setTimeout(()=>{ btn._handledOnce = false; }, 0);

    evt.preventDefault();

    const form = btn.closest('.add-form');
    if (!form) return;

    // Re-run the same logic with normalized unit
    const unit  = (form.dataset.unit || '').trim().toLowerCase();
    const url   = form.dataset.urlUpdate;
    const stock = Number(form.dataset.stock || '0');
    let inCart  = Number(form.dataset.initialInCart || '0');

    if (unit === 'ea') {
      const target = Math.min(stock, inCart + 1);
      if(target === inCart) return;
      postUpdateQty(url, target).then(js=>{
        if(js?.ok){
          form.dataset.initialInCart = String(target);
          const event = new CustomEvent('cart:updated', {detail: {form, inCart: target, js}});
          document.dispatchEvent(event);
        }
      });
      return;
    }

    // By-weight fallback: simply toggle the caret (if present) or open panel if not
    const panel  = form.querySelector('.weight-panel');
    const confirm= form.querySelector('.weight-confirm');
    const wcaret = form.querySelector('.wcaret');

    if (wcaret) { wcaret.click(); return; }

    if (panel && confirm) {
      panel.classList.remove('hidden');
      confirm.classList.add('hidden');
      form.dataset.weightPanelSticky = '1';
    }
  });

  // Optional: listen for cart updates to refresh remain on the affected card
  document.addEventListener('cart:updated', (e)=>{
    const {form, js} = e.detail || {};
    const card = form?.closest('[id^="prod-"]');
    const remainEl = card?.querySelector('.remain');
    if (remainEl && typeof js?.remaining !== 'undefined') {
      remainEl.textContent = js.remaining;
    }
  });
});

// --- YCPS v2: robust hide-on-click using pointerdown + capture; no template changes ---
(function(){
  if (window.__ycps_patch_v2) return;  // avoid double-binding
  window.__ycps_patch_v2 = true;

  function hideListFor(list){
    if(!list) return;
    list.classList.add('hidden');
    const btn = list.parentElement ? list.parentElement.querySelector('.ycps-trigger') : null;
    if(btn) {
      btn.classList.remove('hidden');
      btn.setAttribute('aria-expanded','false');
    }
  }

  // Open on pointerdown with capture so we run even if other handlers stop propagation
  const openHandler = function(evt){
    const trigger = evt.composedPath?.().find(el => el?.classList?.contains?.('ycps-trigger'));
    if(!trigger) return;

    // Prevent other click logic and focus artifacts
    evt.preventDefault();

    // Hide the EXACT button that was clicked
    trigger.classList.add('hidden');
    trigger.setAttribute('aria-expanded','true');

    // Show the sibling listbox within the same wrapper
    const wrapper = trigger.parentElement;
    const list = wrapper ? wrapper.querySelector('.ycps-listbox') : null;
    if(list){
      list.classList.remove('hidden');
      list.setAttribute('tabindex','-1');
      try { list.focus({ preventScroll: true }); } catch(e){ /* no-op */ }
    }
  };

  // Close when picking an option (bubble ok)
  const optionClick = function(evt){
    const opt = evt.target.closest && evt.target.closest('.ycps-option');
    if(!opt) return;
    const list = opt.closest('.ycps-listbox');
    if(!list) return;

    // Optional: mirror choice onto the button label; comment out next 3 lines to keep static text
    const btn = list.parentElement ? list.parentElement.querySelector('.ycps-trigger') : null;
    if(btn && opt.textContent) btn.textContent = opt.textContent.trim();

    hideListFor(list);
  };

  // Click-away: if pointerdown happens outside any open list, close them
  const clickAway = function(evt){
    // Ignore if we're inside a trigger or a listbox
    if (evt.target.closest && (evt.target.closest('.ycps-trigger') || evt.target.closest('.ycps-listbox'))) return;
    document.querySelectorAll('.ycps-listbox:not(.hidden)').forEach(hideListFor);
  };

  // Use capture to beat stopPropagation in other scripts
  document.addEventListener('pointerdown', openHandler, true);
  document.addEventListener('click', optionClick, true);
  document.addEventListener('pointerdown', clickAway, true);
})();

// --- YCPS v2.1: ensure inline display toggles too (belt & suspenders) ---
(function(){
  if (window.__ycps_patch_v2_1) return;
  window.__ycps_patch_v2_1 = true;

  function showList(list){
    if(!list) return;
    list.classList.remove('hidden');
    list.style.display = '';
    list.setAttribute('tabindex','-1');
    try { list.focus({ preventScroll: true }); } catch(e){}
  }
  function hideList(list){
    if(!list) return;
    list.classList.add('hidden');
    list.style.display = 'none';
  }
  function showBtn(btn){
    if(!btn) return;
    btn.classList.remove('hidden');
    btn.style.display = '';
    btn.setAttribute('aria-expanded','false');
  }
  function hideBtn(btn){
    if(!btn) return;
    btn.classList.add('hidden');
    btn.style.display = 'none';
    btn.setAttribute('aria-expanded','true');
  }

  document.addEventListener('pointerdown', function(evt){
    const trigger = evt.composedPath?.().find(el => el?.classList?.contains?.('ycps-trigger'));
    if(!trigger) return;
    evt.preventDefault();
    hideBtn(trigger);
    const list = trigger.parentElement ? trigger.parentElement.querySelector('.ycps-listbox') : null;
    showList(list);
  }, true);

  document.addEventListener('click', function(evt){
    const opt = evt.target.closest && evt.target.closest('.ycps-option');
    if(!opt) return;
    const list = opt.closest('.ycps-listbox');
    const btn  = list && list.parentElement ? list.parentElement.querySelector('.ycps-trigger') : null;
    // optional label reflect
    if(btn && opt.textContent) btn.textContent = opt.textContent.trim();
    hideList(list);
    showBtn(btn);
  }, true);

  document.addEventListener('pointerdown', function(evt){
    if (evt.target.closest && (evt.target.closest('.ycps-trigger') || evt.target.closest('.ycps-listbox'))) return;
    document.querySelectorAll('.ycps-listbox:not(.hidden)').forEach(l => {
      const btn = l.parentElement ? l.parentElement.querySelector('.ycps-trigger') : null;
      hideList(l);
      showBtn(btn);
    });
  }, true);
})();

// === YCPS DIAGNOSTIC BLACK BOX (overlay + logs) ===
// Hides only the clicked "+" AFTER your app opens the list.
// Adds outlines + logs so you can see what's bound/hidden.
// Safe: does not block your dropdown logic.
(function(){
  if (window.__ycps_bb_overlay) return; // avoid double-binding
  window.__ycps_bb_overlay = true;

  // Selectors (expand if your class changes)
  const BTN_SEL = 'button.ycps';

  // Ensure our hide CSS exists once
  if (!document.getElementById('ycps-hide-style')) {
    const st = document.createElement('style');
    st.id = 'ycps-hide-style';
    st.textContent = `.ycps-hide{display:none!important}`;
    document.head.appendChild(st);
  }

  // Hide helper with overlay log
  function hide(btn){
    if (!btn) return;
    console.log('[YCPS] HIDE →', btn);    // hover log to see page overlay
    btn.classList.add('ycps-hide');
    btn.style.setProperty('display','none','important'); // beats Tailwind flex/etc
    btn.setAttribute('aria-expanded','true');
  }

  // Bind per-button listeners (with outline + attach log)
  function bind(btn){
    if (!btn || btn.__ycpsBoundOverlay) return;
    btn.__ycpsBoundOverlay = true;

    // Visual: outline so you know which buttons are targeted
    btn.style.outline = '2px solid #00aaff';
    console.log('[YCPS] ATTACH →', btn);  // hover log to highlight on page

    // Let the page open the dropdown, then hide the "+"
    btn.addEventListener('click', () => {
      requestAnimationFrame(() => hide(btn));
    }, false);

    // Backup: if click is swallowed / async render, hide shortly after pointerdown
    btn.addEventListener('pointerdown', () => {
      setTimeout(() => hide(btn), 120);
    }, true);
  }

  // Bind current buttons
  const initial = Array.from(document.querySelectorAll(BTN_SEL));
  console.log(`[YCPS] INIT: found ${initial.length} ycps button(s)`, initial);
  initial.forEach(bind);

  // Bind future buttons (re-renders, pagination, etc.)
  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes && m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.(BTN_SEL)) bind(n);
        n.querySelectorAll?.(BTN_SEL).forEach(bind);
      });
    });
  });
  mo.observe(document.body, { childList:true, subtree:true });

  // Delegation fallback (fires even if a new button slipped past observer)
  document.addEventListener('click', (e)=>{
    const b = e.target.closest && e.target.closest(BTN_SEL);
    if (!b) return;
    // ensure it's bound at first use
    bind(b);
  }, true);

  console.log('[YCPS] Diagnostic black box (overlay+logs) installed');
})();

console.log('%c YCPS FILE LIVE v11','background:#222;color:#0f0;padding:2px 4px');
window.__ycps_file_ver = 'v11';

// --- YCPS: hide the clicked "+" after dropdown opens (clean, no logs) ---
(function(){
  if (window.__ycps_bb_clean) return;
  window.__ycps_bb_clean = true;

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
    btn.style.setProperty('display','none','important');
    btn.setAttribute('aria-expanded','true');
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;
    afterApp(() => {
      hide(b);
      const mo = new MutationObserver(() => hide(b));
      mo.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
      setTimeout(() => mo.disconnect(), 1500);
    });
  }, false);

  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;
    setTimeout(() => hide(b), 120);
  }, true);
})();

// ===== YCPS FILE LIVE v9 =====
console.log('%c YCPS FILE LIVE v9','background:#222;color:#0f0;padding:2px 4px');
window.__ycps_file_ver = 'v9';

// --- YCPS: hide the clicked "+" after dropdown opens (clean, no logs) ---
(function(){
  if (window.__ycps_file_v9) return;   // guard so we don't double-bind
  window.__ycps_file_v9 = true;

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
    btn.style.setProperty('display','none','important'); // beats Tailwind flex/etc
    btn.setAttribute('aria-expanded','true');
  };

  // Let the page open the list first, then hide the "+"
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;

    afterApp(() => {
      hide(b);

      // If the card re-renders right after, keep it hidden briefly
      const mo = new MutationObserver(() => hide(b));
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class','style']
      });
      setTimeout(() => mo.disconnect(), 1500);
    });
  }, false);

  // Backup: if click gets swallowed, hide shortly after pointerdown (still non-blocking)
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest(BTN);
    if (!b) return;
    setTimeout(() => hide(b), 120);
  }, true);
})();
