(function() {
  document.addEventListener("DOMContentLoaded", function() {
    // Find the real admin form (exclude logout & search forms)
    const forms = Array.from(document.querySelectorAll("form")).filter(f =>
      f.id !== "logout-form" && f.id !== "search-form"
    );
    if (!forms.length) return;
    const form = forms[0];

    let isDirty = false;
    form.addEventListener("input", () => { isDirty = true; }, true);
    form.addEventListener("change", () => { isDirty = true; }, true);
    form.addEventListener("submit", () => { isDirty = false; }, true);

    document.addEventListener("click", function(e) {
      if (!isDirty) return;
      const link = e.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#") || href === "") return;

      e.preventDefault();
      e.stopImmediatePropagation();

      // Custom in-page modal
      showUnsavedModal(() => {
        isDirty = false;
        window.location.href = href;
      });
    }, true);
  });

  function showUnsavedModal(onContinue) {
    if (document.getElementById("unsaved-modal-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "unsaved-modal-overlay";
    Object.assign(overlay.style, {
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 10000,
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff", padding: "20px", borderRadius: "6px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.3)", maxWidth: "400px",
      textAlign: "center", fontFamily: "Arial, sans-serif",
    });
    box.innerHTML = `
      <p style="margin-bottom:20px; font-size:16px;">
        You haven’t saved your changes. Continue anyway?
      </p>
    `;

    const btnContainer = document.createElement("div");
    Object.assign(btnContainer.style, { display: "flex", justifyContent: "space-around" });

    const btnContinue = document.createElement("button");
    btnContinue.textContent = "Continue";
    Object.assign(btnContinue.style, {
      padding: "8px 16px", background: "#4CAF50", color: "#fff",
      border: "none", borderRadius: "4px", cursor: "pointer"
    });
    btnContinue.addEventListener("click", () => {
      document.body.removeChild(overlay);
      onContinue();
    });

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Cancel";
    Object.assign(btnCancel.style, {
      padding: "8px 16px", background: "#f44336", color: "#fff",
      border: "none", borderRadius: "4px", cursor: "pointer"
    });
    btnCancel.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    btnContainer.appendChild(btnContinue);
    btnContainer.appendChild(btnCancel);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
})();
