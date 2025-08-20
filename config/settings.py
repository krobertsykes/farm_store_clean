from pathlib import Path
import os

# ─── BASE DIR ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── SECURITY ─────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") != "0"

# Use a single ALLOWED_HOSTS declaration (don’t duplicate this later).
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

# ─── APPS ─────────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "products",
    "store",
]

# ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # keep before SessionMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# WhiteNoise tuning
if DEBUG:
    # Auto-reload static while developing; use finders to resolve from app/static
    WHITENOISE_AUTOREFRESH = True
    WHITENOISE_USE_FINDERS = True
else:
    # Hashed, compressed assets in production builds
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
    WHITENOISE_MAX_AGE = 31536000  # 1 year cache for hashed files

# ─── URLS / WSGI ──────────────────────────────────────────────────────────────
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# ─── TEMPLATES ────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─── DATABASE ─────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ─── AUTH VALIDATORS ──────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── INTERNATIONALIZATION ─────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/New_York"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# ─── STATIC & MEDIA ───────────────────────────────────────────────────────────
# Dev serves from app static/ and project static/ via finders.
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]  # (optional) project-level static/
STATIC_ROOT = BASE_DIR / "staticfiles"    # collectstatic output (prod-like)

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ─── DEFAULTS ─────────────────────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── AUTH BACKENDS (email-as-username support) ────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "store.auth_backends.EmailBackend",
]

# ─── EMAIL ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@farmstore.local")
ORDER_NOTIFICATION_EMAIL = os.getenv("ORDER_NOTIFICATION_EMAIL", "owner@farmstore.local")
