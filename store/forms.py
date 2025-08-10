from django import forms
from django.contrib.auth import get_user_model
from products.models import ProductReview
from .models import Profile, Order

User = get_user_model()

class SignupForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput)
    phone    = forms.CharField(max_length=32, required=False)

    class Meta:
        model  = User
        fields = ('email', 'password')

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def save(self, commit=True):
        user = User(username=self.cleaned_data['email'], email=self.cleaned_data['email'])
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
            Profile.objects.get_or_create(user=user, defaults={'phone': self.cleaned_data.get('phone', '')})
        return user

class ProfileForm(forms.ModelForm):
    email = forms.EmailField()
    class Meta:
        model  = Profile
        fields = ('phone',)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super().__init__(*args, **kwargs)
        self.fields['email'].initial = self.user.email

    def save(self, commit=True):
        self.user.email = self.cleaned_data['email'].strip().lower()
        self.user.username = self.user.email
        if commit:
            self.user.save()
            return super().save(commit=True)
        return super().save(commit=False)

class ReviewForm(forms.ModelForm):
    class Meta:
        model  = ProductReview
        fields = ('stars', 'text')

class CouponForm(forms.Form):
    code = forms.CharField(max_length=40)

class CheckoutForm(forms.Form):
    email   = forms.EmailField(required=False)  # required for guests
    phone   = forms.CharField(max_length=32, required=False)
    payment_method = forms.ChoiceField(choices=Order.PaymentMethod.choices)
