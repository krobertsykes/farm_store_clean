from decimal import Decimal
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, redirect, render
from django.views import View
from django.views.generic import ListView, TemplateView
from products.models import Category, Product, ProductReview
from .models import Order, OrderItem, Coupon, Profile
from .forms import SignupForm, ProfileForm, ReviewForm, CheckoutForm, CouponForm

def _cart(session):
    return session.setdefault("cart", {})

def _cart_total_items(session):
    return sum(Decimal(q) for q in _cart(session).values())

class CatalogueView(ListView):
    template_name         = "store/product_list.html"
    context_object_name   = "categories"

    def get_queryset(self):
        return Category.objects.prefetch_related("products__images").all()

    def get_context_data(self, **kwargs):
        ctx    = super().get_context_data(**kwargs)
        sess   = self.request.session
        cart   = _cart(sess)

        has_oos = any(
            p.stock_qty <= 0
            for cat in ctx["categories"] for p in cat.products.all()
        )

        oos_param = self.request.GET.get("oos")
        if oos_param is not None:
            desired = (oos_param == "1")
            show_oos = desired and has_oos
            sess["show_oos"] = show_oos
        else:
            show_oos = bool(sess.get("show_oos", False)) and has_oos

        ever_in_stock = set(sess.get("ever_in_stock", []))

        for cat in ctx["categories"]:
            visible = []
            for p in cat.products.all():
                in_cart   = Decimal(cart.get(str(p.pk), "0"))
                remaining = max(p.stock_qty - in_cart, Decimal("0"))

                p.in_cart   = in_cart
                p.remaining = remaining
                p.unit_str  = {"ea": "each", "lb": "/lb", "oz": "/oz", "kg": "/kg"}.get(p.unit, "each")
                p.avg_stars = round(p.avg_rating or 0, 1)

                if p.stock_qty > 0:
                    ever_in_stock.add(p.pk)

                if show_oos or remaining > 0 or in_cart > 0 or (p.pk in ever_in_stock):
                    visible.append(p)
            cat.visible_products = visible

        sess["ever_in_stock"] = list(ever_in_stock)
        sess.modified = True

        ctx.update({
            "show_oos":        show_oos,
            "has_oos":         has_oos,
            "weight_choices":  [Decimal("0.25"), Decimal("0.5"), Decimal("1"), Decimal("2"), Decimal("5")],
            "cart_item_total": _cart_total_items(sess),
            "review_form":     ReviewForm(),
        })
        return ctx

def add_to_cart(request, pk):
    product = get_object_or_404(Product, pk=pk)
    try:
        qty = Decimal(request.POST.get("qty", "1"))
    except Exception:
        return HttpResponseBadRequest("Bad qty")

    if product.unit == "ea":
        if qty < 1:
            qty = Decimal("1")
        qty = Decimal(int(qty))

    cart    = _cart(request.session)
    current = Decimal(cart.get(str(pk), "0"))
    allowed = max(product.stock_qty - current, Decimal("0"))
    qty     = max(Decimal("0"), min(qty, allowed))

    if qty > 0:
        cart[str(pk)] = str(current + qty)
        request.session.modified = True

    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        new_abs   = Decimal(cart.get(str(pk), "0"))
        remaining = max(product.stock_qty - new_abs, Decimal("0"))
        total_qty = _cart_total_items(request.session)
        return JsonResponse({
            "ok":         True,
            "remaining":  str(remaining),
            "in_cart":    str(new_abs),
            "cart_total": str(total_qty),
        })

    return redirect("store:catalogue")

def remove_from_cart(request, pk):
    _cart(request.session).pop(str(pk), None)
    request.session.modified = True
    return redirect("store:cart")

def update_qty(request, pk):
    cart = _cart(request.session)
    try:
        qty = Decimal(request.POST.get("qty", "0"))
    except Exception:
        return HttpResponseBadRequest("Bad qty")
    product = get_object_or_404(Product, pk=pk)

    if product.unit == "ea" and qty > 0:
        qty = Decimal(int(qty))

    if qty <= 0:
        cart.pop(str(pk), None)
        new_abs  = Decimal("0")
        remaining = product.stock_qty
    else:
        qty = min(qty, product.stock_qty)
        cart[str(pk)] = str(qty)
        new_abs  = qty
        remaining = max(product.stock_qty - qty, Decimal("0"))

    request.session.modified = True
    total_qty = _cart_total_items(request.session)

    return JsonResponse({
        "ok":         True,
        "remaining":  str(remaining),
        "in_cart":    str(new_abs),
        "cart_total": str(total_qty),
    })

class CartView(View):
    template_name = "store/cart.html"

    def get(self, request):
        cart     = _cart(request.session)
        products = Product.objects.filter(pk__in=cart.keys()).prefetch_related("images")

        items, subtotal = [], Decimal("0")
        for p in products:
            qty       = Decimal(cart[str(p.pk)])
            remaining = max(p.stock_qty - qty, Decimal("0"))
            unit_price = p.effective_price
            line_tot  = unit_price * qty
            subtotal += line_tot
            items.append({
                "product":    p,
                "qty":        qty,
                "remaining":  remaining,
                "unit_price": unit_price,
                "line_total": line_tot,
            })

        coupon_code = request.session.get("coupon_code")
        discount    = Decimal("0")
        coupon_obj  = None
        if coupon_code:
            try:
                coupon_obj = Coupon.objects.get(code__iexact=coupon_code)
                if coupon_obj.is_valid():
                    if coupon_obj.amount_off:
                        discount += Decimal(coupon_obj.amount_off)
                    if coupon_obj.percent_off:
                        discount += (subtotal * Decimal(coupon_obj.percent_off) / Decimal(100))
                else:
                    messages.warning(request, "Coupon is not valid.")
            except Coupon.DoesNotExist:
                request.session.pop("coupon_code", None)

        total = max(Decimal("0"), subtotal - discount)

        return render(request, self.template_name, {
            "items":           items,
            "subtotal":        subtotal,
            "discount":        discount,
            "total":           total,
            "coupon":          coupon_obj,
            "coupon_form":     CouponForm(initial={"code": coupon_code} if coupon_code else None),
        })

@login_required
def rate_product(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method == "POST":
        stars = int(request.POST.get("stars", "5"))
        text  = request.POST.get("text", "")
        ProductReview.objects.update_or_create(
            product=product, user=request.user,
            defaults={"stars": stars, "text": text}
        )
        messages.success(request, "Thanks for your rating!")
    return redirect("store:catalogue")

class CheckoutView(View):
    template_name = "store/checkout.html"

    def get(self, request):
        initial = {}
        if request.user.is_authenticated:
            initial["email"] = request.user.email
            if hasattr(request.user, "profile"):
                initial["phone"] = request.user.profile.phone
        return render(request, self.template_name, {"form": CheckoutForm(initial=initial)})

    def post(self, request):
        form = CheckoutForm(request.POST)
        cart = _cart(request.session)
        if not cart:
            messages.error(request, "Your cart is empty.")
            return redirect("store:cart")

        if not request.user.is_authenticated and not request.POST.get('email'):
            messages.error(request, "Please provide an email for guest checkout.")
            return render(request, self.template_name, {"form": form})

        if form.is_valid():
            products = Product.objects.filter(pk__in=cart.keys()).prefetch_related("images")
            if not products:
                messages.error(request, "Your cart is empty.")
                return redirect("store:cart")

            items, subtotal = [], Decimal("0")
            for p in products:
                qty = Decimal(cart[str(p.pk)])
                price = p.effective_price
                line_total = price * qty
                items.append((p, qty, price, line_total))
                subtotal += line_total

            coupon = None
            discount = Decimal("0")
            coupon_code = request.session.get("coupon_code")
            if coupon_code:
                try:
                    coupon = Coupon.objects.get(code__iexact=coupon_code)
                    if coupon.is_valid():
                        if coupon.amount_off:
                            discount += Decimal(coupon.amount_off)
                        if coupon.percent_off:
                            discount += (subtotal * Decimal(coupon.percent_off) / Decimal(100))
                except Coupon.DoesNotExist:
                    coupon = None

            total = max(Decimal("0"), subtotal - discount)

            order = Order.objects.create(
                user = request.user if request.user.is_authenticated else None,
                guest_email = None if request.user.is_authenticated else form.cleaned_data.get("email"),
                phone = form.cleaned_data.get("phone") or "",
                coupon = coupon,
                payment_method = form.cleaned_data['payment_method'],
                paid = (form.cleaned_data['payment_method'] == Order.PaymentMethod.CASH),
                subtotal = subtotal,
                discount = discount,
                total    = total,
            )
            for (p, qty, price, line_total) in items:
                OrderItem.objects.create(
                    order=order, product=p, qty=qty, unit=p.unit, price=price, line_total=line_total
                )
                p.stock_qty = max(Decimal("0"), p.stock_qty - qty)
                p.save()

            request.session["cart"] = {}
            request.session.pop("coupon_code", None)
            request.session.modified = True

            recipient = order.user.email if order.user else order.guest_email
            subject = f"Order #{order.id} confirmation"
            body = f"Thanks for your order!\n\nOrder #{order.id}\nTotal: ${order.total}\n"
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [recipient])
            send_mail(f"New order #{order.id}", f"Total ${order.total}", settings.DEFAULT_FROM_EMAIL, [settings.ORDER_NOTIFICATION_EMAIL])

            return redirect("store:order_thanks", order_id=order.id)

        return render(request, self.template_name, {"form": form})

def apply_coupon(request):
    form = CouponForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        request.session["coupon_code"] = form.cleaned_data['code'].strip()
        request.session.modified = True
    return redirect("store:cart")

class OrderThankYouView(TemplateView):
    template_name = "store/thanks.html"

class SignupView(View):
    template_name = "store/auth/signup.html"

    def get(self, request):
        return render(request, self.template_name, {"form": SignupForm()})

    def post(self, request):
        form = SignupForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Account created. Please sign in.")
            return redirect("accounts:login")
        return render(request, self.template_name, {"form": form})

class ProfileView(LoginRequiredMixin, View):
    template_name = "store/auth/profile.html"

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        form = ProfileForm(user=request.user, instance=profile)
        return render(request, self.template_name, {"form": form})

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        form = ProfileForm(request.POST, user=request.user, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect("accounts:profile")
        return render(request, self.template_name, {"form": form})

class OrderHistoryView(LoginRequiredMixin, TemplateView):
    template_name = "store/auth/orders.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["orders"] = (request := self.request).user.orders.prefetch_related("items__product__images").order_by("-created_at")
        return ctx
