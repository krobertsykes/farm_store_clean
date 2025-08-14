from __future__ import annotations
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("store.urls", namespace="store")),
    path("accounts/", include("store.auth_urls", namespace="accounts")),
]

# Serve uploaded media in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
