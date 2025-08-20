// === ycps_gate tripwire (proves THIS file executed) ===
window.__ycps_ping = (window.__ycps_ping || 0) + 1;
window.__rating_gate_file_ver = "gate-v2";

/* =========================
   YCPS: hide the clicked "+" after dropdown opens (guarded)
   ========================= */
(function () {
  if (window.__ycps_hider_ver) return;
  window.__ycps_hider_ver = "v1";

  // Ensure a CSS rule that always wins
  if (!document.getElementById("ycps-hide-style")) {
    const st = document.createElement("style");
    st.id = "ycps-hide-style";
    st.textContent = ".ycps-hide{display:none!important}";
    document.head.appendChild(st);
  }

  const BTN = "button.ycps";
  const afterApp = (fn) => requestAnimationFrame(() => setTimeout(fn, 60));

  const hide = (btn) => {
    if (!btn) return;
    btn.classList.add("ycps-hide");
    btn.style.setProperty("display", "none", "important");
    btn.setAttribute("aria-expanded", "true");
  };

  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest(BTN);
      if (!b) return;
      afterApp(() => {
        hide(b);
        const mo = new MutationObserver(() => hide(b));
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"],
        });
        setTimeout(() => mo.disconnect(), 1500);
      });
    },
    false
  );

  // backup if click is swallowed
  document.addEventListener(
    "pointerdown",
    (e) => {
      const b = e.target.closest && e.target.closest(BTN);
      if (!b) return;
      setTimeout(() => hide(b), 120);
    },
    true
  );
})();

/* =========================
   Live pluralization for Remaining units (guarded)
   ========================= */
(() => {
  if (window.__remain_units_live) return;
  window.__remain_units_live = true;

  const baseWord = (u) =>
    u === "lb" ? "pound" : u === "oz" ? "ounce" : u === "kg" ? "kilogram" : "";
  const numFrom = (t) => {
    const m = String(t || "").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  };

  function updateFor(remEl) {
    const card = remEl.closest('[id^="prod-"]') || document;
    const unitEl = card.querySelector(".remain-unit");
    if (!unitEl) return;
    const unit = unitEl.dataset.unit;
    const n = numFrom(remEl.textContent);
    unitEl.textContent = baseWord(unit) + (n === 1 ? "" : "s");
  }

  function watch(remEl) {
    if (!remEl || remEl.__remainBound) return;
    remEl.__remainBound = true;
    updateFor(remEl);
    const mo = new MutationObserver(() => updateFor(remEl));
    mo.observe(remEl, { childList: true, characterData: true, subtree: true });
  }

  document.querySelectorAll(".remain").forEach(watch);
  const moAll = new MutationObserver((m) => {
    m.forEach((x) => {
      x.addedNodes &&
        x.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches?.(".remain")) watch(n);
          n.querySelectorAll?.(".remain").forEach(watch);
        });
    });
  });
  moAll.observe(document.body, { childList: true, subtree: true });
})();

/* =========================
   Rating gate: grey unfilled stars for non-purchasers (robust + observer)
   ========================= */
(() => {
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

  const wrapOf = (b) => b.closest(".rate-wrap") || b.parentElement;
  const canRate = (w) => w?.dataset?.canRate === "1";
  const userStars = (w) => parseInt(w?.dataset?.userStars || "0", 10);
  const starVal = (b) => parseInt(b.dataset.stars || "0", 10);
  const tipFor = (w) => {
    let t = w.querySelector(".rate-tip");
    if (!t) {
      t = document.createElement("div");
      t.className = "rate-tip";
      t.textContent = "Rating a product requires purchase.";
      w.appendChild(t);
    }
    return t;
  };

  const paintWrap = (wrap) => {
    if (!wrap) return;
    const allow = canRate(wrap),
      you = userStars(wrap);
    wrap.querySelectorAll(".rate-btn").forEach((btn) => {
      const k = starVal(btn);
      if (!allow && k > you) {
        if (!btn.classList.contains("rate-disabled")) {
          btn.classList.add("rate-disabled");
          if (!btn.__rgBound) {
            btn.__rgBound = true;
            const show = () => tipFor(wrap).classList.add("show");
            const hide = () => tipFor(wrap).classList.remove("show");
            btn.addEventListener("mouseenter", show);
            btn.addEventListener("mouseleave", hide);
            btn.addEventListener("click", () => {
              show();
              setTimeout(hide, 900);
            });
          }
        }
      } else {
        btn.classList.remove("rate-disabled");
      }
    });
  };

  const paintAll = () =>
    document.querySelectorAll(".rate-wrap").forEach(paintWrap);

  const install = () => {
    ensureStyles();
    paintAll();

    // Observe DOM additions AND attribute flips on wrappers
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.type === "attributes" && m.target.matches?.(".rate-wrap")) {
          paintWrap(m.target);
        }
        m.addedNodes?.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches?.(".rate-wrap")) paintWrap(n);
          n.querySelectorAll?.(".rate-wrap").forEach(paintWrap);
        });
      });
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-user-stars", "data-can-rate", "class", "style"],
    });

    // Block disallowed rating clicks before other handlers
    document.addEventListener(
      "click",
      (evt) => {
        const btn = evt.target.closest?.(".rate-btn");
        if (!btn) return;
        const w = wrapOf(btn);
        if (!w) return;
        if (!canRate(w) && starVal(btn) > userStars(w)) {
          evt.preventDefault();
          evt.stopImmediatePropagation();
          const t = tipFor(w);
          t.classList.add("show");
          setTimeout(() => t.classList.remove("show"), 900);
        }
      },
      true
    );

    // Expose repaint helper for Console
    window.__rg_repaint = paintAll;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();