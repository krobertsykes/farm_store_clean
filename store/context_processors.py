from __future__ import annotations
from decimal import Decimal
from typing import Dict, Any

def cart_item_total(request) -> Dict[str, Any]:
    cart = request.session.get("cart", {})
    total_items = Decimal("0")
    for pid, entry in cart.items():
        try:
            total_items += Decimal(str(entry.get("qty", 0)))
        except Exception:
            pass
    return {"cart_item_total": str(total_items)}
