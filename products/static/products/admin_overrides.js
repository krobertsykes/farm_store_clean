(function () {
  function toIntString(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return String(Math.round(n));
  }

  // NEW: soft-check sale_price < price in any admin row/container
  function validateSaleVsPrice(container) {
    try {
      const price = container.querySelector('input[name$="-price"], #id_price');
      const sale  = container.querySelector('input[name$="-sale_price"], #id_sale_price');
      if (!price || !sale) return;

      sale.classList.remove("is-price-warning");
      sale.removeAttribute("title");

      const pv = parseFloat(price.value);
      const sv = parseFloat(sale.value);
      if (!isNaN(pv) && !isNaN(sv) && sv > 0 && sv >= pv) {
        sale.classList.add("is-price-warning");
        sale.title = "Sale price should be less than the base price.";
      }
    } catch (_) {
      /* no-op */
    }
  }

  // NEW: attach blur listeners so validation runs when fields change
  function attachSalePriceValidation(container) {
    ["price", "sale_price"].forEach(function (suffix) {
      const input =
        container.querySelector('input[name$="-'+ suffix +'"]') ||
        container.querySelector('#id_' + suffix);
      if (input) {
        input.addEventListener("blur", function () {
          validateSaleVsPrice(container);
        });
      }
    });
  }

  function applyToRow(row) {
    if (!row) return;
    // Changelist inline row names look like: form-0-unit, form-0-stock_qty
    const unit = row.querySelector('select[name$="-unit"], #id_unit');
    const qty  = row.querySelector('input[name$="-stock_qty"], #id_stock_qty');
    if (unit && qty) {
      if (unit.value === "ea") {
        qty.value = toIntString(qty.value);
        qty.setAttribute("step", "1");
      } else {
        // leave as-is for non-each units
        // (optionally: qty.setAttribute("step", "0.25"))
      }
    }

    // NEW: wire price helpers on every processed row/container
    attachSalePriceValidation(row);
    validateSaleVsPrice(row);
  }

  function init() {
    // Changelist: iterate all editable rows
    document.querySelectorAll(".inline-related, tr.form-row, tr").forEach(applyToRow);

    // Change form: single record edit page
    applyToRow(document);

    // React to unit changes (both pages)
    document.addEventListener("change", function (e) {
      if (e.target && (e.target.matches('select[name$="-unit"]') || e.target.id === "id_unit")) {
        const row = e.target.closest(".inline-related, tr") || document;
        applyToRow(row);
      }
    });

    // If user adds new inline rows dynamically (admin adds another product row)
    document.body.addEventListener("click", function (e) {
      if (e.target && e.target.closest(".add-row a, .grp-add-handler")) {
        setTimeout(function () {
          const rows = document.querySelectorAll(".inline-related");
          if (rows.length) applyToRow(rows[rows.length - 1]);
        }, 0);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
