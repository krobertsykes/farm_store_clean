# products/forms.py
from django import forms
from .models import Product

class ProductAdminForm(forms.ModelForm):
    """
    Narrow widgets for price/sale_price so 'xxx.xx' fits nicely in changelist and forms.
    """
    class Meta:
        model = Product
        fields = "__all__"
        widgets = {
            "price": forms.NumberInput(attrs={"step": "0.01", "style": "width:7ch; text-align:right;"}),
            "sale_price": forms.NumberInput(attrs={"step": "0.01", "style": "width:7ch; text-align:right;"}),
        }
