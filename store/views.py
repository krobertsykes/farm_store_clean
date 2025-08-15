from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Dict, Any, List, Tuple

from django.conf import settings
from django.contrib import messages  # left here for other pages; not used for coupon flashes
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.db.models import Avg, Count, Q
from django.http import HttpRequest, HttpResponse, JsonResponse, Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from products.models import Product
from .forms import SignupForm, ProfileForm, CouponForm, CheckoutForm
from .models import Rating, Coupon, Order, OrderItem, Profile


# --- Helpers ---

def _get_cart(session) -> Dict[str, Dict[str, Any]]:
    """Ensure cart exists and is a dict; reset if it somehow became another type."""
    cart = session.get("cart")
    if not isinstance(cart, dict):
        cart = {}
        session["cart"] = cart
        session.modified = True
    return cart

def _entry_qty(entry) -> Decimal:
    """Read qty from either new dict shape {'qty': ...} or legacy raw number/string."""
    if isinstance(entry, dict):
        try:
            return Decimal(str(entry.get("qty", "0") or "0"))
        except Exception:
            return Decimal("0")
    try:
        return Decimal(str(entry))
    except Exception:
        return Decimal("0")

def _cart_item_count(cart: Dict[str, Any]) -> str:
    total = Decimal("0")
    for entry in cart.values():
        total += _entry_qty(entry)
    return str(total)

def _effective_price(p: Product) -> Decimal:
    sp = getattr(p, "sale_price", None)
    price = getattr(p, "price", Decimal("0"))
    if sp and sp < price:
        return sp
    return price

def _remaining_for(p: Product) -> Decimal:
    # Using product.stock_qty minus in-cart qty (as tracked on the product object)
    stock = Decimal(str(getattr(p, "stock_qty", "0") or "0"))
    in_cart = Decimal(str(getattr(p, "in_cart", 0) or "0"))
    return max(Decimal("0"), stock - in_cart)

def _ensure_profile(user):
    prof, _ = Profile.objects.get_or_create(user=user)
    return prof

def _get_favorites(session) -> set[str]:
    fav = session.get("favorites")
    if not isinstance(fav, list):
        fav = []
        session["favorites"] = fav
        session.modified = True
    return {str(x) for x in fav}

def _set_favorites(session, fav_ids: set[str]) -> None:
    session["favorites"] = list(fav_ids)
    session.modified = True

def _format_percent(dec: Decimal) -> str:
    """
    Return a human string without scientific notation.
    10 -> '10', 12.5 -> '12.5', 12.34 -> '12.34'
    """
    dec = Decimal(dec)
    if dec == dec.to_integral_value():
        return str(int(dec))
    # trim trailing zeros
    s = f"{dec.quantize(Decimal('0.01'))}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s

def _coupon_description(coupon: Coupon) -> str:
    parts: List[str] = []
    if coupon.percent_off and coupon.percent_off > 0:
        parts.append(f"{_format_percent(coupon.percent_off)}% off")
    if coupon.amount_off and coupon.amount_off > 0:
        parts.append(f"${coupon.amount_off.quantize(Decimal('0.01'))} off")
    return " + ".join(parts) if parts else "discount"


# --- Public pages ---

def catalogue(request: HttpRequest) -> HttpResponse:
    # Query params
    q = (request.GET.get("q") or "").strip()
    show_oos = request.GET.get("oos") == "1"
    show_fav = request.GET.get("fav") == "1"

    products_qs = Product.objects.all().select_related("category")

    # Search filter: name or category name
    if q:
        products_qs = products_qs.filter(
            Q(name__icontains=q) | Q(category__name__icontains=q)
        )

    # Ratings maps
    ratings = Rating.objects.values("product_id").annotate(avg=Avg("stars"))
    avg_map = {r["product_id"]: r["avg"] or 0 for r in ratings}

    user_map: Dict[int, int] = {}
    if request.user.is_authenticated:
        your_ratings = (
            Rating.objects.filter(user=request.user)
            .values("product_id")
            .annotate(stars=Avg("stars"))
        )
        user_map = {r["product_id"]: int(r["stars"]) for r in your_ratings}

    cart = _get_cart(request.session)
    fav_ids = _get_favorites(request.session)

    categories_dict: Dict[Any, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "description": "", "visible_products": []}
    )

    # Build product objects with in_cart/remaining/ratings/favorite flags
    for p in products_qs:
        pid = str(p.id)
        in_cart = _entry_qty(cart.get(pid, 0))
        setattr(p, "in_cart", in_cart)
        setattr(p, "remaining", _remaining_for(p))
        # Default average to 5.0 when no ratings
        setattr(p, "avg_stars", Decimal(str(avg_map.get(p.id, 5))))
        setattr(p, "user_stars", user_map.get(p.id, 0))
        setattr(p, "is_favorite", pid in fav_ids)

        cat = getattr(p, "category", None)
        key = cat.id if cat else 0
        if key not in categories_dict:
            categories_dict[key]["name"] = getattr(cat, "name", "All Products" if key == 0 else str(cat))
            categories_dict[key]["description"] = getattr(cat, "description", "")
            categories_dict[key]["visible_products"] = []
        categories_dict[key]["visible_products"].append(p)

    # Hide OOS when requested (but keep items that are in the cart visible)
    if not show_oos:
        for c in categories_dict.values():
            c["visible_products"] = [
                p for p in c["visible_products"]
                if (Decimal(str(getattr(p, "remaining"))) > 0) or (Decimal(str(getattr(p, "in_cart") or "0")) > 0)
            ]

    # Filter by favorites toggle
    if show_fav:
        for c in categories_dict.values():
            c["visible_products"] = [p for p in c["visible_products"] if getattr(p, "is_favorite", False)]

    # has_oos for the current (searched) subset, unfiltered by show_oos
    has_oos = any(
        Decimal(str(getattr(p, "stock_qty", "0") or "0")) <= 0
        for p in products_qs
    )

    # Drop empty categories after filters
    categories = [c for c in categories_dict.values() if c["visible_products"]]

    return render(
        request,
        "store/product_list.html",
        {
            "categories": categories,
            "show_oos": show_oos,
            "has_oos": has_oos,
            "q": q,
            "show_fav": show_fav,
            "cart_item_total": _cart_item_count(cart),  # keep header cart count accurate
        },
    )


# --- Cart ---

def cart_view(request: HttpRequest) -> HttpResponse:
    cart = _get_cart(request.session)

    items: List[Dict[str, Any]] = []
    subtotal = Decimal("0")
    modified = False  # if we see legacy entries, rewrite them into normalized dicts

    for pid, entry in list(cart.items()):
        qty = _entry_qty(entry)
        if not isinstance(entry, dict) or "qty" not in entry or str(entry["qty"]) != str(qty):
            cart[str(pid)] = {"qty": str(qty)}
            modified = True

        p = get_object_or_404(Product, pk=int(pid))
        unit_price = _effective_price(p)
        line_total = (unit_price * qty).quantize(Decimal("0.01"))

        # Remaining display (no decimals for 'ea')
        rem_raw = max(Decimal("0"), Decimal(str(getattr(p, "stock_qty", 0))) - qty)
        remaining = int(rem_raw) if getattr(p, "unit", "ea") == "ea" else rem_raw

        items.append(
            {
                "product": p,
                "qty": qty,
                "remaining": remaining,
                "line_total": line_total,
                "unit_price": unit_price,
            }
        )
        subtotal += line_total

    if modified:
        request.session.modified = True

    # Coupon (stored on session)
    discount = Decimal("0")
    code = request.session.get("coupon_code") or ""
    coupon = None
    coupon_desc = ""
    if code:
        coupon = Coupon.objects.filter(code=code).first()
        if coupon and coupon.is_valid_now():
            if coupon.percent_off:
                discount += (subtotal * (coupon.percent_off / Decimal("100"))).quantize(Decimal("0.01"))
            discount += coupon.amount_off
            coupon_desc = _coupon_description(coupon)

    total = max(Decimal("0"), subtotal - discount)

    # Inline-only coupon messages (pop from session)
    coupon_error = request.session.pop("coupon_error", "")
    coupon_success = request.session.pop("coupon_success", "")

    # Prefill "Place Order" (if/when you render it on cart page)
    initial = {}
    if request.user.is_authenticated:
        initial["email"] = request.user.email
        prof = _ensure_profile(request.user)
        initial["phone"] = prof.phone
    checkout_form = CheckoutForm(initial=initial)

    return render(
        request,
        "store/cart.html",
        {
            "items": items,
            "subtotal": subtotal,
            "discount": discount,
            "total": total,
            "coupon": coupon,
            "coupon_desc": coupon_desc,
            "coupon_form": CouponForm(),
            "checkout_form": checkout_form,
            "cart_item_total": _cart_item_count(cart),
            "coupon_error": coupon_error,
            "coupon_success": coupon_success,
        },
    )


def cart_update_qty(request: HttpRequest, product_id: int) -> JsonResponse:
    if request.method != "POST":
        raise Http404()

    cart = _get_cart(request.session)
    qty = Decimal(str(request.POST.get("qty", "0") or "0"))
    qty = max(Decimal("0"), qty)

    p = get_object_or_404(Product, pk=product_id)
    stock = Decimal(str(getattr(p, "stock_qty", "0") or "0"))
    # clamp
    if qty > stock:
        qty = stock

    if qty == 0:
        cart.pop(str(product_id), None)
    else:
        cart[str(product_id)] = {"qty": str(qty)}  # normalized shape

    request.session.modified = True

    # Remaining = stock - qty
    remaining = max(Decimal("0"), stock - qty)
    if getattr(p, "unit", "ea") == "ea":
        remaining_str = str(int(remaining))
    else:
        remaining_str = str(remaining)

    return JsonResponse({"ok": True, "remaining": remaining_str, "cart_total": _cart_item_count(cart)})


def cart_remove(request: HttpRequest, product_id: int) -> HttpResponse:
    cart = _get_cart(request.session)
    cart.pop(str(product_id), None)
    request.session.modified = True
    return redirect("store:cart")


# --- Coupons ---

def apply_coupon(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        return redirect("store:cart")

    form = CouponForm(request.POST)
    if not form.is_valid():
        # Inline-only messages: store in session and redirect
        request.session["coupon_error"] = "Invalid coupon."
        return redirect("store:cart")

    code_norm = form.cleaned_data["code"]  # normalized (upper)
    # Empty means "remove"
    if code_norm == "":
        request.session["coupon_code"] = ""
        request.session["coupon_success"] = "Coupon removed."
        return redirect("store:cart")

    c = Coupon.objects.filter(code__iexact=code_norm).first()
    if not c:
        request.session["coupon_error"] = f"Coupon {code_norm} not found"
        request.session["coupon_code"] = ""
        return redirect("store:cart")
    if not c.is_valid_now():
        request.session["coupon_error"] = f"Coupon {c.code} expired"
        request.session["coupon_code"] = ""
        return redirect("store:cart")

    # Store canonical casing and success text
    request.session["coupon_code"] = c.code
    request.session["coupon_success"] = f"Coupon {c.code} has been applied for {_coupon_description(c)}"
    return redirect("store:cart")


# --- Ratings & Reviews ---

@login_required
def rate_product(request: HttpRequest, product_id: int) -> JsonResponse:
    if request.method != "POST":
        raise Http404()
    try:
        stars = int(request.POST.get("stars", 0))
    except Exception:
        stars = 0
    if stars < 1 or stars > 5:
        return JsonResponse({"ok": False, "error": "Invalid rating"}, status=400)

    product = get_object_or_404(Product, pk=product_id)

    # Must have purchased in the past
    has_purchased = OrderItem.objects.filter(order__user=request.user, product=product).exists()
    if not has_purchased:
        return JsonResponse({"ok": False, "error": "Purchase required"}, status=403)

    Rating.objects.update_or_create(
        product=product,
        user=request.user,
        defaults={"stars": stars},
    )

    # Return fresh average so the UI can update immediately
    new_avg = Rating.objects.filter(product=product).aggregate(avg=Avg("stars")).get("avg") or 0
    return JsonResponse({"ok": True, "avg": float(new_avg)})


def reviews_detail(request: HttpRequest, product_id: int) -> HttpResponse:
    product = get_object_or_404(Product, pk=product_id)
    reviews = Rating.objects.filter(product=product).select_related("user")

    # breakdown
    counts = Rating.objects.filter(product=product).values("stars").annotate(c=Count("id"))
    total = sum(r["c"] for r in counts) or 1
    dist: List[Tuple[int, int, float]] = []
    for s in range(5, 0, -1):
        c = next((r["c"] for r in counts if r["stars"] == s), 0)
        dist.append((s, c, (c * 100.0) / total))

    avg = reviews.aggregate(avg=Avg("stars")).get("avg") or 0

    return render(
        request,
        "store/reviews_detail.html",
        {
            "product": product,
            "reviews": reviews,
            "avg": avg,
            "breakdown": dist,
        },
    )


# --- Auth/Account ---

def signup_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Welcome! Your 10% new-customer discount is active for 30 days.")
            return redirect("store:catalogue")
    else:
        form = SignupForm()
    return render(request, "store/auth/signup.html", {"form": form})


@login_required
def profile_view(request: HttpRequest) -> HttpResponse:
    prof = _ensure_profile(request.user)
    if request.method == "POST":
        form = ProfileForm(request.POST, instance=prof, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect("accounts:profile")
    else:
        form = ProfileForm(instance=prof, user=request.user)
    return render(request, "store/auth/profile.html", {"form": form})


@login_required
def orders_view(request: HttpRequest) -> HttpResponse:
    orders = Order.objects.filter(user=request.user).prefetch_related("items__product")
    return render(request, "store/auth/orders.html", {"orders": orders})


# --- Checkout ---

def _compute_totals_from_session_cart(request: HttpRequest):
    cart = _get_cart(request.session)
    items = []
    subtotal = Decimal("0")
    for pid, entry in cart.items():
        p = get_object_or_404(Product, pk=int(pid))
        qty = _entry_qty(entry)
        unit_price = _effective_price(p)
        line_total = (unit_price * qty).quantize(Decimal("0.01"))
        items.append((p, qty, unit_price, line_total))
        subtotal += line_total

    # Coupon
    discount = Decimal("0")
    coupon = None
    code = request.session.get("coupon_code")
    if code:
        coupon = Coupon.objects.filter(code=code).first()
        if coupon and coupon.is_valid_now():
            if coupon.percent_off:
                discount += (subtotal * (coupon.percent_off / Decimal("100"))).quantize(Decimal("0.01"))
            discount += coupon.amount_off

    # New customer discount 10% if within 30 days
    if request.user.is_authenticated:
        prof = _ensure_profile(request.user)
        if prof.signup_discount_ends_at and timezone.now() <= prof.signup_discount_ends_at:
            discount += (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))

    total = max(Decimal("0"), subtotal - discount)
    return items, subtotal, discount, total, coupon


def checkout_view(request: HttpRequest) -> HttpResponse:
    items, subtotal, discount, total, coupon = _compute_totals_from_session_cart(request)

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            order = Order.objects.create(
                user=request.user if request.user.is_authenticated else None,
                email=form.cleaned_data["email"],
                phone=form.cleaned_data.get("phone") or "",
                coupon=coupon,
                subtotal=subtotal,
                discount_total=discount,
                total=total,
                payment_method=form.cleaned_data["payment_method"],
            )
            for p, qty, unit_price, line_total in items:
                OrderItem.objects.create(
                    order=order,
                    product=p,
                    qty=qty,
                    unit=getattr(p, "unit", "ea"),
                    unit_price=unit_price,
                    line_total=line_total,
                )
                # Update inventory after placing order
                p.stock_qty = max(Decimal("0"), Decimal(str(p.stock_qty or 0)) - qty)
                p.save(update_fields=["stock_qty"])

            # Clear cart
            request.session["cart"] = {}
            request.session["coupon_code"] = ""
            request.session.modified = True

            # Email (simple)
            try:
                send_mail(
                    subject=f"Order #{order.pk} confirmation",
                    message=f"Thanks for your order #{order.pk}. Total: ${order.total}",
                    from_email=None,
                    recipient_list=[order.email],
                    fail_silently=True,
                )
                admin_mail = getattr(settings, "ORDER_NOTIFICATION_EMAIL", None) or getattr(settings, "DEFAULT_FROM_EMAIL", None)
                if admin_mail:
                    send_mail(
                        subject=f"New order #{order.pk}",
                        message=f"Total: ${order.total}",
                        from_email=None,
                        recipient_list=[admin_mail],
                        fail_silently=True,
                    )
            except Exception:
                pass

            return redirect("store:thanks", order_id=order.pk)
    else:
        initial = {}
        if request.user.is_authenticated:
            initial["email"] = request.user.email
            prof = _ensure_profile(request.user)
            initial["phone"] = prof.phone
        form = CheckoutForm(initial=initial)

    return render(
        request,
        "store/checkout.html",
        {
            "form": form,
            "subtotal": subtotal,
            "discount": discount,
            "total": total,
            "coupon": coupon,
        },
    )


def thanks_view(request: HttpRequest, order_id: int) -> HttpResponse:
    return render(request, "store/thanks.html", {"order_id": order_id})


# --- Favorites (session-based) ---

@login_required
def toggle_favorite(request: HttpRequest, product_id: int) -> JsonResponse:
    if request.method != "POST":
        raise Http404()
    _ = get_object_or_404(Product, pk=product_id)
    fav_ids = _get_favorites(request.session)
    pid = str(product_id)
    if pid in fav_ids:
        fav_ids.remove(pid)
        favorited = False
    else:
        fav_ids.add(pid)
        favorited = True
    _set_favorites(request.session, fav_ids)
    return JsonResponse({"ok": True, "favorited": favorited})
