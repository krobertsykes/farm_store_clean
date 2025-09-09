// fresh_produce.js — CLEAN (no YCPS overlay scripts)

// --- helpers ---
function getCSRF(){
  return document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.split('=')[1];
}
function postUpdateQty(url,qty){
  const data=new FormData(); data.append('qty',String(qty));
  return fetch(url,{ method:'POST', headers:{'X-CSRFToken':getCSRF(),'X-Requested-With':'XMLHttpRequest'}, body:data }).then(r=>r.json());
}
// Visually disable/enable a button
function setDisabled(el, on){
  if(!el) return;
  el.toggleAttribute('disabled', !!on);
  el.setAttribute('aria-disabled', on ? 'true' : 'false');
  el.classList.toggle('opacity-50', !!on);
  el.classList.toggle('cursor-not-allowed', !!on);
}
// Small helpers to manage YCPS visibility robustly
function showYCPS(btn){
  if(!btn) return;
  btn.classList.remove('hidden','ycps-hide');
  btn.style.removeProperty('display');              // undo any inline display:none!important
  btn.setAttribute('aria-expanded','false');
}
function hideYCPS(btn){
  if(!btn) return;
  btn.classList.add('hidden');
  btn.style.removeProperty('display');              // we use classes; keep inline clean
  btn.setAttribute('aria-expanded','true');
}

window.addEventListener('DOMContentLoaded', () => {
// --- Favorites toggle link state ---
const favStateEl = document.getElementById('fav-state');
let favCount = 0;
if (favStateEl) {
  const n = parseInt(favStateEl.dataset.count || '0', 10);
  favCount = isNaN(n) ? 0 : n;
}
function updateFavToggleLink() {
  const link = document.getElementById('fav-toggle-link');
  const disabled = document.getElementById('fav-toggle-disabled');
  const onFavFilter = new URLSearchParams(location.search).get('fav') === '1';
  if (onFavFilter) return;

  if (favCount > 0) {
    if (!link && disabled) {
      const a = document.createElement('a');
      a.id = 'fav-toggle-link';
      a.textContent = 'Only favorites';
      a.className = 'text-sm underline text-gray-700';
      const params = new URLSearchParams(location.search);
      params.set('fav','1');
      a.href = `?${params.toString()}`;
      disabled.replaceWith(a);
    }
  } else {
    if (!disabled && link) {
      const s = document.createElement('span');
      s.id = 'fav-toggle-disabled';
      s.textContent = 'Only favorites';
      s.className = 'text-sm text-gray-400 cursor-not-allowed';
      link.replaceWith(s);
    }
  }
}
document.addEventListener('favorite:toggled', (e) => {
  const on = !!(e.detail && e.detail.favorited);
  favCount += on ? 1 : -1;
  if (favCount < 0) favCount = 0;
  updateFavToggleLink();
});
updateFavToggleLink();

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
          
          // inform header to update immediately
          document.dispatchEvent(new CustomEvent('favorite:toggled', {
          detail: { favorited: on }
        }));

          if(!on && new URLSearchParams(location.search).get('fav') === '1'){
            const card = btn.closest('[id^="prod-"]'); card?.classList.add('opacity-50');
            setTimeout(()=>{ card?.remove(); }, 150);
          }
        })
        .catch(()=>{});
    });
  });

  // --- ratings (single gate, deduped) ---
  (()=>{
    if (window.__rating_gate_installed) return;
    window.__rating_gate_installed = true;

    const ensureStyles = () => {
      if (document.getElementById("rating-gate-style")) return;
      const st = document.createElement("style");
      st.id = "rating-gate-style";
      st.textContent = `
        .rate-wrap{position:relative}
        .rate-disabled svg, .rate-disabled svg *{ fill:none!important; stroke:#9CA3AF!important; opacity:.8; }
        .rate-tip{ position:absolute; left:50%; top:-1.25rem; transform:translate(-50%,-6px);
          background:rgba(17,24,39,.92); color:#fff; padding:4px 8px; border-radius:6px;
          font-size:12px; white-space:nowrap; pointer-events:none; opacity:0;
          transition:opacity .15s ease, transform .15s ease; }
        .rate-tip.show{ opacity:1; transform:translate(-50%,-10px); }
      `;
      document.head.appendChild(st);
    };

    const wrapOf  = b => b.closest(".rate-wrap") || b.parentElement;
    const canRate = w => (w?.dataset?.canRate === "1");
    const userStars = w => parseInt(w?.dataset?.userStars || "0", 10);
    const starVal = b => parseInt(b.dataset.stars || "0", 10);
    const tipFor = w => {
      let t = w.querySelector(".rate-tip");
      if (!t){ t=document.createElement("div"); t.className="rate-tip";
               t.textContent="Rating a product requires purchase."; w.appendChild(t); }
      return t;
    };

    const paintWrap = (wrap) => {
      const allow = canRate(wrap), you = userStars(wrap);
      wrap.querySelectorAll(".rate-btn").forEach(btn => {
        const k = starVal(btn);
        if (!allow && k > you) {
          if (!btn.classList.contains("rate-disabled")) {
            btn.classList.add("rate-disabled");
            if (!btn.__rgBound) {
              btn.__rgBound = true;
              const show = ()=> tipFor(wrap).classList.add("show");
              const hide = ()=> tipFor(wrap).classList.remove("show");
              btn.addEventListener("mouseenter", show);
              btn.addEventListener("mouseleave", hide);
              btn.addEventListener("click", () => { show(); setTimeout(hide, 900); });
            }
          }
        } else {
          btn.classList.remove("rate-disabled");
        }
      });
    };

    const paintAll = () => document.querySelectorAll(".rate-wrap").forEach(paintWrap);
    ensureStyles(); paintAll();

    new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes?.forEach(n=>{
        if (n.nodeType!==1) return;
        if (n.matches?.(".rate-wrap")) paintWrap(n);
        n.querySelectorAll?.(".rate-wrap").forEach(paintWrap);
      }));
    }).observe(document.body, { childList:true, subtree:true });

    // Block disallowed posts early
    document.addEventListener("click",(evt)=>{
      const btn = evt.target.closest?.(".rate-btn");
      if(!btn) return;
      const w = wrapOf(btn);
      if(!w) return;
      if(!canRate(w) && starVal(btn) > userStars(w)){
        evt.preventDefault();
        evt.stopImmediatePropagation();
        const t = tipFor(w); t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 900);
      }
    }, true);
  })();

  // --- cart / YCPS / weight list behaviors (clean) ---
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
          hideYCPS(ycps);
          if(countEl) countEl.textContent = String(Math.floor(inCart));
        }else{
          stepEl?.classList.add('hidden');
          showYCPS(ycps);
        }
      }else{
        if(inCart>0){
          hideYCPS(ycps);
          panel?.classList.add('hidden');
          confirm?.classList.add('hidden');
          wStep?.classList.remove('hidden');
          if(wqty)  wqty.textContent  = (unit==='oz') ? String(Math.round(inCart)) : String((Math.round(inCart*100)/100).toFixed(2).replace(/\.00$/,''));
          if(wunit) wunit.textContent = unit;
        }else{
          wStep?.classList.add('hidden');
          showYCPS(ycps);
          panel?.classList.add('hidden');
          confirm?.classList.add('hidden');
        }
      }
        // NEW: Disable the weight stepper "+" when nothing remains
       if (unit !== 'ea') {
          setDisabled(winc, remaining() <= 0);
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
      const end = Math.min(remaining(), hard);
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

    // YCPS click
    // YCPS click
ycps?.addEventListener('click', e=>{
  e.preventDefault();
  e.stopPropagation();

  // Hide the YCPS button immediately
  hideYCPS(ycps);

  if (unit === 'ea') {
    // --- EA FLOW (unchanged) ---
    const target = Math.min(stock, inCart + 1);
    if (target === inCart) { showYCPS(ycps); return; }
    stepEl?.classList.remove('hidden');
    if (countEl) countEl.textContent = String(Math.floor(inCart + 1));
    postUpdateQty(url, target).then(js => {
      if (js?.ok) applyServer(target, js);
      else showYCPS(ycps);
    });
    return;
  }

  // --- BY-WEIGHT FLOW ---
  // If required nodes aren’t in this card, fall back to caret behavior
  if (!panel || !confirm) {
    // Some cards may render a compact version; let the caret toggle it
    wcaret?.click();
    return;
  }

  // If the list is already open, mark sticky and exit (don’t re-render)
  if (!panel.classList.contains('hidden')) {
    panelSticky = true;
    return;
  }

  // Force the exact desired UI state:
  // 1) open ONLY the list
  // 2) keep confirm and stepper hidden
  // 3) mark sticky so outside clicks don’t close it right away
  buildAndOpenList(true);            // builds options + shows panel, hides confirm inside
  wStep?.classList.add('hidden');    // keep weight stepper hidden while list is open
  confirm?.classList.add('hidden');  // ensure confirm is hidden until a weight is picked
  panel?.classList.remove('hidden'); // make sure list is visible
});


    // Each stepper (ea)
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

    // Weight caret toggles the list (non-sticky)
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
    if (winc?.disabled) return;  // NEW: do nothing if disabled
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
      if(listOpen && panelSticky) return; // keep open until a choice or Esc
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

  // Delegated YCPS fallback (for any future cards injected later)
  document.addEventListener('click', (evt)=>{
    const btn = evt.target.closest('.ycps');
    if (!btn) return;

    // If the per-form handler bound, let it win
    if (btn._handledOnce) return;
    btn._handledOnce = true;
    setTimeout(()=>{ btn._handledOnce = false; }, 0);

    evt.preventDefault();

    const form = btn.closest('.add-form');
    if (!form) return;

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

    // By-weight fallback: toggle caret or open panel
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

  // Update remain when we hear a cart update
  document.addEventListener('cart:updated', (e)=>{
    const {form, js} = e.detail || {};
    const card = form?.closest('[id^="prod-"]');
    const remainEl = card?.querySelector('.remain');
    if (remainEl && typeof js?.remaining !== 'undefined') {
      remainEl.textContent = js.remaining;
    }
  });
});
