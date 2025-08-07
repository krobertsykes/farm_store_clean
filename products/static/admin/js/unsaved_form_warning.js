// static/admin/js/unsaved_form_warning.js
(function() {
  // Wait for the admin form to load
  document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector("form");
    if (!form) return;

    let isDirty = false;
    // Mark form as dirty on any change
    form.addEventListener("change", () => { isDirty = true; });

    // When the form is submitted, clear the dirty flag
    form.addEventListener("submit", () => { isDirty = false; });

    // Warn on unload if dirty
    window.addEventListener("beforeunload", function(e) {
      if (isDirty) {
        const msg = "You have unsaved changes—are you sure you want to leave?";
        e.returnValue = msg;
        return msg;
      }
    });
  });
})();
