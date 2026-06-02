# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import EnrollmentViewSet

router = DefaultRouter()
router.register(r'enrollments', EnrollmentViewSet, basename='enrollment')
router.register(r'schedules', views.GroupScheduleViewSet, basename='schedule')

urlpatterns = [
    # 🔐 Авторизация
    path('auth/login/', views.staff_login, name='staff_login'),
    path('auth/me/', views.current_user, name='current_user'),

    # 👥 Слушатели + модули
    path('students/', views.create_student, name='create_student'),
    path('students/search/', views.search_students, name='student_search'),
    path('students/import-excel/', views.import_students_view, name='import_students'),
    path('modules/', views.module_list, name='module_list'),

    # ✅ ЗАЧИСЛЕНИЯ: переносим ручные функции на другие пути
    path('enrollments/create/', views.create_enrollment, name='enrollment_create'),
    # 🔹 Импорт Excel
    path('enrollments/import-excel/', views.enrollment_import_excel, name='enrollment_import_excel'),
    # 🔹 Группы для селектора
    path('enrollments/groups/', views.get_enrollment_groups, name='get_enrollment_groups'),
    # 🔹 Перезачисление
    path('enrollments/<int:pk>/reenroll/', views.reenroll_enrollment, name='reenroll_enrollment'),

    # 🔹 Список зачислений (журнал, экспорт) — оставляем как есть
    path('enrollments/list/', views.enrollment_list, name='enrollment-list'),
    path('enrollments/journal/', views.journal_enrollments_list, name='journal_list'),
    path('enrollments/<int:pk>/update/', views.enrollment_journal_detail, name='enrollment_update_journal'),
    path('enrollments/generate-journal/', views.generate_journal_html, name='generate_journal_html'),
    path("", include(router.urls)),

    # 🔹 Журнал: структура и результаты
    path('journals/<int:enrollment_id>/structure/', views.journal_structure, name='journal_structure'),
    path('journals/results/', views.journal_results_save, name='journal_results_save'),

    # 🔹 Сертификаты
    path('certificates/eligible/', views.certificates_eligible_list, name='certificates_eligible'),
    path('certificates/staff/', views.certificate_staff_list, name='certificate_staff'),
    path('certificates/<int:pk>/preview/', views.certificate_preview, name='certificate_preview'),
    path('certificates/', views.certificate_create, name='certificate_create'),

    # 🔹 Экспорт РАУЦ
    path('rauc/list/', views.rauc_export_list, name='rauc_list'),
    path('rauc/generate/', views.generate_rauc_excel_view, name='rauc_generate'),

    # 🔹 Расписание (ручные функции)


    path('schedules/export-to-folder/', views.export_schedule_to_folder, name='export_schedule_to_folder'),



    # 🔹 Персонал
    path('staff/', views.get_staff_list, name='get_staff_list'),

    # 🔹 Папки групп
    path('groups/folders/', views.list_group_folders, name='list_group_folders'),

    path('', include(router.urls)),


]