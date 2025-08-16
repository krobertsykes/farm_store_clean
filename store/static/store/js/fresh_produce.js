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
      const url = btn.dataset.favUrl || `/favorites/toggle/${pid}/`;
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
    const unit  = (form.dataset.unit || '').trim().toLowerCase();  // ✅ normalize
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
      form.dataset.initialInCart = String(inCart); // ✅ keep dataset in sync
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
          // (YCPS remains hidden while confirm is shown)
        });
        panel.appendChild(row);
      }
      const footer = document.createElement('div'); footer.className='px-3 py-2 text-sm text-gray-700 border-t';
      footer.innerHTML = `<div>Total est. price: <span class="hover-price font-semibold">$${(price*stepInfo().step).toFixed(2)}</span></div><div class="text-gray-500">Final cost by actual weight</div>`;
      panel.appendChild(footer);

      panel.classList.remove('hidden');
      confirm.classList.add('hidden');

      // --- ADDED: hide YCPS while list is open + a11y state ---
      ycps?.classList.add('hidden');
      ycps?.setAttribute('aria-expanded', 'true');

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
        if (panel && !panel.classList.contains('hidden')) { 
          panelSticky = true; 
          return; 
        }
        buildAndOpenList(true); // sticky open (YCPS hidden & aria-expanded set inside)
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
        // --- ADDED: re-show YCPS only if nothing in cart; a11y close state ---
        if (inCart <= 0) ycps?.classList.remove('hidden');
        ycps?.setAttribute('aria-expanded', 'false');
        return;
      }
      buildAndOpenList(false); // opens list (YCPS hidden & aria-expanded set inside)
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

      // --- ADDED: re-show YCPS if nothing in cart; a11y close state ---
      if (inCart <= 0) ycps?.classList.remove('hidden');
      ycps?.setAttribute('aria-expanded', 'false');
    });

    // Esc always collapses (and clears sticky)
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') {
        if(panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
        if(confirm && !confirm.classList.contains('hidden')) confirm.classList.add('hidden');
        // --- ADDED: re-show YCPS if nothing in cart; a11y close state ---
        if (inCart <= 0) ycps?.classList.remove('hidden');
        ycps?.setAttribute('aria-expanded', 'false');
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
      // --- ADDED: hide YCPS + a11y open state since we opened directly here ---
      btn.classList.add('hidden');
      btn.setAttribute('aria-expanded','true');
    }
  });

  // Optional: listen for cart updates to refresh remain on the affected card
  document.addEventListener('cart:updated', (e)=>{
    const {form, js} = e.detail || {};
    const card = form?.closest('[id^="prod-"]");
    const remainEl = card?.querySelector('.remain');
    if (remainEl && typeof js?.remaining !== 'undefined') {
      remainEl.textContent = js.remaining;
    }
  });
});
