from django.urls import path
from django.contrib.auth import views as auth_views
from .views import SignupView, ProfileView, OrderHistoryView

app_name = 'accounts'

urlpatterns = [
    path('login/',  auth_views.LoginView.as_view(template_name='store/auth/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='/'), name='logout'),
    path('password-change/', auth_views.PasswordChangeView.as_view(template_name='store/auth/password_change.html'), name='password_change'),
    path('password-change/done/', auth_views.PasswordChangeDoneView.as_view(template_name='store/auth/password_change_done.html'), name='password_change_done'),

    path('signup/',  SignupView.as_view(), name='signup'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('orders/',  OrderHistoryView.as_view(), name='orders'),
]
