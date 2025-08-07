// C:\code\farm_store\templates\store\cart.js

// Auto-submit the cart form when qty changes:
// – on blur, or
// – one second after last keystroke.

(() => {
  const form = document.getElementById("cart-form");
  if (!form) return;

  let timer = null;
  form.querySelectorAll(".js-qty").forEach(inp => {
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => form.submit(), 1000);
    });
    inp.addEventListener("blur", () => form.submit());
  });
})();
