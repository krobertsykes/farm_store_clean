/**
 * Admin “live preview” for any <input type="file"> inside inline form-rows.
 * Works for both CategoryImageInline & ProductImageInline.
 */
function makePreview(input) {
  const img = input.closest('tr').querySelector('img.preview-target');
  if (!img) return;
  const reader = new FileReader();
  reader.onload = e => { img.src = e.target.result; };
  reader.readAsDataURL(input.files[0]);
}

document.addEventListener('DOMContentLoaded', () => {
  // add target <img> to all existing inline rows
  document.querySelectorAll(
    'tr.dynamic-categoryimage, tr.dynamic-productimage'
  ).forEach(tr => {
    if (!tr.querySelector('img.preview-target')) {
      const td = tr.querySelector('td.field-preview');
      if (td) td.innerHTML =
        '<img class="preview-target" style="height:60px;max-width:80px;border-radius:4px">';
    }
  });

  // delegate change-listener to the whole admin form
  document.body.addEventListener('change', e => {
    if (e.target.matches('input[type="file"]'))
      makePreview(e.target);
  });
});
