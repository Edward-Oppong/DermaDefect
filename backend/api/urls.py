from django.urls import path
from .views import AnalyseView, HealthView, GeneratePdfView

urlpatterns = [
    path('health',  HealthView.as_view(),  name='health'),
    path('analyse', AnalyseView.as_view(), name='analyse'),
    path('pdf',     GeneratePdfView.as_view(), name='pdf'),
]
