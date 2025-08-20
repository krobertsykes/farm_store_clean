window.__rating_gate_file_ver = "gate-v1.001";  // bump this number when you save
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
