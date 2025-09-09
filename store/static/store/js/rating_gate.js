window.__rating_gate_file_ver = "gate-v1.2";  // bump this number when you save
console.log("[rating_gate] version", window.__rating_gate_file_ver);

// === rating_gate.js — greys out unpurchased stars, shows tooltip, blocks POST ===
(() => {
  if (window.__rating_gate_installed) return;
  window.__rating_gate_installed = true;

  // Tripwire so you can confirm it's executing:
  window.__rating_gate_file_ver = "gate-v1";
  console.log("[rating_gate] loaded:", window.__rating_gate_file_ver);

  // Styles for grey stars + tooltip
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
    if (!wrap) return;
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

  const install = () => {
    ensureStyles();
    paintAll();

    // Keep painted if DOM re-renders
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes?.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches?.(".rate-wrap")) paintWrap(n);
          n.querySelectorAll?.(".rate-wrap").forEach(paintWrap);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // HARD GUARD: block disallowed rating clicks before any POST happens
    document.addEventListener("click", (evt) => {
      const btn = evt.target.closest?.(".rate-btn");
      if (!btn) return;
      const w = wrapOf(btn);
      if (!w) return;
      if (!canRate(w) && starVal(btn) > userStars(w)) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        const t = tipFor(w); t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 900);
      }
    }, true);

    window.__rg_repaint = paintAll;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();

// === rating_submit (delegated) — post & repaint immediately ===
(() => {
  if (window.__rating_submit_installed) return;
  window.__rating_submit_installed = true;
  console.log("[rating_submit] installed");

  function getCookie(name) {
    try {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    } catch(_) {}
    return '';
  }
  function getCSRF() {
    return getCookie('csrftoken') || document.querySelector('input[name=csrfmiddlewaretoken]')?.value || '';
  }
  const FILLED = '<svg class="w-5 h-5" viewBox="0 0 20 20" fill="#F59E0B" xmlns="http://www.w3.org/2000/svg"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.036a1 1 0 00-1.176 0l-2.802 2.036c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z"/></svg>';
  const EMPTY  = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21 12 17.77 5.82 21 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  document.addEventListener('click', function(evt) {
    const btn = evt.target.closest && evt.target.closest('.rate-btn');
    if (!btn) return;
    evt.preventDefault();

    const wrap = btn.closest('.rate-wrap');
    if (!wrap) return;

    const pid = btn.dataset.pid;
    const stars = parseInt(btn.dataset.stars || '0', 10);
    if (!pid || !stars) return;

    // Disallow only if gating would have blocked (we are in bubble phase; the gate captured earlier)
    const canRate = (wrap.dataset.canRate === '1');
    const current = parseInt(wrap.dataset.userStars || '0', 10);
    if (!canRate && stars > current) return;

    fetch(`/product/${pid}/rate/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCSRF(), 'X-Requested-With': 'XMLHttpRequest' },
      body: (()=>{ const f=new FormData(); f.append('stars', String(stars)); return f; })()
    })
    .then(r => r.json())
    .then(js => {
      if (!js || !js.ok) return;

      // Update local state + repaint
      wrap.dataset.userStars = String(stars);
      wrap.querySelectorAll('.rate-btn').forEach(b => {
        const k = parseInt(b.dataset.stars || '0', 10);
        b.innerHTML = (k <= stars) ? FILLED : EMPTY;
      });

      // Update avg display if present
      const avgEl = document.querySelector(`.avg-stars[data-pid="${pid}"]`);
      if (avgEl && typeof js.avg === 'number') {
        avgEl.textContent = (Math.round(js.avg * 10) / 10).toFixed(1);
      }
    })
    .catch(()=>{});
  });
})();
