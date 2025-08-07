from decimal import Decimal
from django.http        import JsonResponse, HttpResponseBadRequest
from django.shortcuts   import get_object_or_404, redirect, render
from django.views       import View
from django.views.generic import ListView
from products.models    import Category, Product

def _cart(session):
    """Return cart dict {product_id: str_qty} and ensure it exists."""
    return session.setdefault("cart", {})

def _cart_total_items(session):
    """Total quantity (may include fractions for weight items)."""
    return sum(Decimal(q) for q in _cart(session).values())

# ───────────────────────────── Catalogue ──────────────────────────────────────
class CatalogueView(ListView):
    template_name         = "store/product_list.html"
    context_object_name   = "categories"

    def get_queryset(self):
        return Category.objects.prefetch_related("products__images").all()

    def get_context_data(self, **kwargs):
        ctx      = super().get_context_data(**kwargs)
        show_oos = self.request.GET.get("oos") == "1"
        cart     = _cart(self.request.session)

        # 1) Detect if any product is currently out of stock
        has_oos = False
        for cat in ctx["categories"]:
            for p in cat.products.all():
                rem = p.stock_qty - Decimal(cart.get(str(p.pk), "0"))
                if rem <= 0:
                    has_oos = True
                    break
            if has_oos:
                break

        # 2) Build each category’s visible_products list
        for cat in ctx["categories"]:
            prods = list(cat.products.all())
            if not show_oos:
                prods = [
                    p for p in prods
                    if (p.stock_qty - Decimal(cart.get(str(p.pk), "0"))) > 0
                ]
            for p in prods:
                in_cart     = Decimal(cart.get(str(p.pk), "0"))
                remaining   = max(p.stock_qty - in_cart, Decimal("0"))
                p.in_cart   = in_cart
                p.remaining = remaining
            cat.visible_products = prods

        ctx.update({
            "show_oos":        show_oos,
            "has_oos":         has_oos,
            "weight_choices":  [
                Decimal("0.25"), Decimal("0.5"),
                Decimal("1"),    Decimal("2"),
                Decimal("5")
            ],
            "cart_item_total": _cart_total_items(self.request.session),
        })
        return ctx

# ────────────────────────── Cart operations ───────────────────────────────────
def add_to_cart(request, pk):
    """
    POST qty → add/clamp to stock.
    Ajax returns JSON so the catalogue page updates in place.
    """
    product = get_object_or_404(Product, pk=pk)
    try:
        qty = Decimal(request.POST.get("qty", "1"))
    except Exception:
        return HttpResponseBadRequest("Bad qty")

    cart    = _cart(request.session)
    current = Decimal(cart.get(str(pk), "0"))
    allowed = max(product.stock_qty - current, Decimal("0"))
    qty     = max(Decimal("0"), min(qty, allowed))

    if qty > 0:
        cart[str(pk)] = str(current + qty)
        request.session.modified = True

    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        remaining = max(product.stock_qty - Decimal(cart[str(pk)]), Decimal("0"))
        total_qty = _cart_total_items(request.session)
        return JsonResponse({
            "ok":         True,
            "remaining":  str(remaining),
            "in_cart":    cart[str(pk)],
            "cart_total": str(total_qty),
        })

    return redirect("store:catalogue")

def remove_from_cart(request, pk):
    _cart(request.session).pop(str(pk), None)
    request.session.modified = True
    return redirect("store:cart")

def update_qty(request, pk):
    """
    Ajax: set qty for pk, clamp to stock, then return:
      - ok
      - remaining stock
      - updated cart_total (sum of all items)
    """
    cart = _cart(request.session)
    try:
        qty = Decimal(request.POST.get("qty", "0"))
    except Exception:
        return HttpResponseBadRequest("Bad qty")
    product = get_object_or_404(Product, pk=pk)

    if qty <= 0:
        cart.pop(str(pk), None)
        remaining = product.stock_qty
    else:
        qty = min(qty, product.stock_qty)
        cart[str(pk)] = str(qty)
        remaining = max(product.stock_qty - qty, Decimal("0"))

    request.session.modified = True
    total_qty = _cart_total_items(request.session)

    return JsonResponse({
        "ok":         True,
        "remaining":  str(remaining),
        "cart_total": str(total_qty),
    })

# ───────────────────────────── CartView ───────────────────────────────────────
class CartView(View):
    template_name = "store/cart.html"

    def get(self, request):
        cart     = _cart(request.session)
        products = Product.objects.filter(pk__in=cart.keys()) \
                                  .prefetch_related("images")

        items, total = [], Decimal("0")
        for p in products:
            qty      = Decimal(cart[str(p.pk)])
            remaining= max(p.stock_qty - qty, Decimal("0"))
            line_tot = p.price * qty
            total   += line_tot
            items.append({
                "product":    p,
                "qty":        qty,
                "remaining":  remaining,
                "line_total": line_tot,
            })

        return render(request, self.template_name, {
            "items":           items,
            "total":           total,
            "cart_item_total": _cart_total_items(request.session),
        })
