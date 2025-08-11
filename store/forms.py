from __future__ import annotations

from datetime import timedelta
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Profile, Coupon


class SignupForm(UserCreationForm):
    email = forms.EmailField(required=True)
    phone = forms.CharField(required=False)

    class Meta:
        model = User
        fields = ("email", "phone", "password1", "password2")

    def save(self, commit=True):
        # Use email as username
        user = super().save(commit=False)
        email = self.cleaned_data["email"]
        user.username = email
        user.email = email
        if commit:
            user.save()
            Profile.objects.update_or_create(
                user=user,
                defaults={
                    "phone": self.cleaned_data.get("phone") or "",
                    "signup_discount_ends_at": timezone.now() + timedelta(days=30),
                },
            )
        return user


class ProfileForm(forms.ModelForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = Profile
        fields = ("phone",)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user")
        super().__init__(*args, **kwargs)
        # Initialize email from user
        self.fields["email"].initial = self.user.email

    def save(self, commit=True):
        prof = super().save(commit=False)
        self.user.email = self.cleaned_data["email"]
        self.user.username = self.user.email
        if commit:
            self.user.save()
            prof.user = self.user
            prof.save()
        return prof


class CouponForm(forms.Form):
    code = forms.CharField(max_length=50)

    def clean_code(self):
        return Coupon.normalize(self.cleaned_data["code"])


PAYMENT_CHOICES = [
    ("card", "Credit/Debit Card"),
    ("cash", "Cash on pickup"),
    ("paypal", "PayPal"),
]


class CheckoutForm(forms.Form):
    email = forms.EmailField()
    phone = forms.CharField(required=False)
    payment_method = forms.ChoiceField(choices=PAYMENT_CHOICES)
