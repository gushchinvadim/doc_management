from django.contrib.auth.admin import UserAdmin
from django.template.response import TemplateResponse
from .utils.import_excel import import_staff_excel, import_students_excel, logger
from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django import forms
from django.core.management import call_command
from django.conf import settings
from io import StringIO
import os
from django.contrib.auth.models import User
from .resources import StaffResource, StudentResource
from .models import Course, Module, Stage, Section, License, Staff, Student, Enrollment, Certificate, SubSection, \
    GroupSchedule


# 🔹 Кастомизация заголовков админки
admin.site.site_header = "Doc Management NordStar | Администрирование АУЦ"  # Верхний заголовок (слева в шапке)
admin.site.site_title = "Doc Management Training center NordStar"                        # Заголовок вкладки браузера
admin.site.index_title = "Добро пожаловать в панель управления Training center NordStar" # Приветствие на главной странице админки


# ─── Инлайны (1 уровень вложенности, стандарт Django) ───
class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1
    fields = ('mod_id', 'code', 'title', 'duration')

class StageInline(admin.TabularInline):
    model = Stage
    extra = 1
    fields = ('order', 'title', 'description')


class SectionInline(admin.TabularInline):
    model = Section
    extra = 1
    fields = ('order', 'title', 'duration_hours', 'grade_type', 'min_score')

    # 🔹 Показываем код модуля в inline (опционально)
    def get_readonly_fields(self, request, obj=None):
        # Если нужно добавить отображение кода модуля в inline
        return self.fields if obj else self.fields


class ExcelImportForm(forms.Form):
    excel_file = forms.FileField(
        label="Файл Excel (.xlsx)",
        help_text="Поддерживается структура: COMPANY_CODE, COURSE, MODULE, MOD_ID, STAGE, SECTION, ORDER, GRADE_TYPE, MIN_SCORE, ATTACHMENT_NUMBER",
    )

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('company_code', 'title', 'prog_id')
    search_fields = ('company_code', 'title')
    inlines = [ModuleInline]  # если используете инлайны

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-excel/', self.admin_site.admin_view(self.import_excel_view), name='course_import_excel'),
        ]
        return custom_urls + urls

    def import_excel_view(self, request):
        if request.method == 'POST':
            form = ExcelImportForm(request.POST, request.FILES)
            if form.is_valid():
                uploaded_file = request.FILES['excel_file']
                tmp_dir = os.path.join(settings.BASE_DIR, 'tmp_uploads')
                os.makedirs(tmp_dir, exist_ok=True)
                tmp_path = os.path.join(tmp_dir, uploaded_file.name)

                with open(tmp_path, 'wb+') as destination:
                    for chunk in uploaded_file.chunks():
                        destination.write(chunk)

                try:
                    out = StringIO()
                    # 🔁 Вызываем вашу готовую команду
                    call_command('import_courses', tmp_path, stdout=out)
                    messages.success(request, f"✅ Импорт завершён:\n{out.getvalue()}")
                except Exception as e:
                    messages.error(request, f"❌ Ошибка импорта: {str(e)}")
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
                return redirect('admin:api_course_changelist')
        else:
            form = ExcelImportForm()

        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': 'Импорт курсов из Excel',
            'opts': self.model._meta,
        }
        return render(request, 'admin/api/course_import.html', context)

# ─── Модуль ───
@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'course', 'mod_id', 'duration', 'attachment_number')
    list_filter = ('code',)
    search_fields = ('code', 'title', 'mod_id', )
    inlines = [StageInline]

# ─── Этап ───
@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display = ('title', 'get_module_code', 'order')
    list_filter = ('module__code',)
    search_fields = ('title', 'module__code')
    inlines = [SectionInline]

    @admin.display(description='Код модуля', ordering='module__code')
    def get_module_code(self, obj):
        return obj.module.code if obj.module else '—'

# ─── Раздел ───
@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'stage', 'order', 'grade_type', 'min_score', 'duration_hours')
    list_filter = ('grade_type', 'stage')
    search_fields = ('title',)

# ─── Подраздел ───
@admin.register(SubSection)
class SubSectionAdmin(admin.ModelAdmin):
    list_display = ('section', 'title', 'order', 'duration_hours')
    list_filter = ('title', 'order', 'duration_hours')
    search_fields = ('section', 'title')

# ─── Лицензии ───
@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ('favt_cert_number', 'favt_cert_date', 'license_number', 'license_date')
    list_filter = ('favt_cert_number', 'license_number',)
    search_fields = ('favt_cert_number', 'license_number',)


class ImportAdminMixin:
    """Миксин для добавления кнопки и вьюхи импорта"""
    import_func = None  # Переопределяется в дочерних классах

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import/', self.admin_site.admin_view(self.import_view),
                 name=f'{self.model._meta.app_label}_{self.model._meta.model_name}_import'),
        ]
        return custom_urls + urls

    def import_view(self, request):
        # Обработка POST (загрузка файла)
        if request.method == 'POST':
            file = request.FILES.get('file')
            if not file or not file.name.endswith('.xlsx'):
                messages.error(request, 'Пожалуйста, загрузите корректный .xlsx файл.')
                return redirect('.')

            try:
                c, u, e, errors_list = self.import_func(file)
                if e > 0:
                    err_text = " | ".join(errors_list[:3])  # Показываем первые 3 ошибки
                    messages.warning(request, f'⚠️ Импорт: создано {c}, обновлено {u}, ошибок {e}. {err_text}')
                else:
                    messages.success(request, f'✅ Импорт завершен! Создано: {c} | Обновлено: {u}')
            except Exception as exc:
                logger.exception(f"[Import] Critical error: {exc}")
                messages.error(request, f'❌ Ошибка импорта: {exc}')

            # Редирект на список объектов
            return redirect('admin:api_{}_changelist'.format(self.model._meta.model_name))

        # Обработка GET (показ формы) — минимальный контекст
        context = self.admin_site.each_context(request)
        model_name = self.model._meta.model_name
        app_label = self.model._meta.app_label

        context.update({
            'title': f'Импорт: {self.model._meta.verbose_name_plural}',
            'opts': self.model._meta,
            'model_name': model_name,
            'changelist_url': f'admin:{app_label}_{model_name}_changelist',
        })
        return render(request, 'admin/api/import_data.html', context)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['import_url'] = f'admin:{self.model._meta.app_label}_{self.model._meta.model_name}_import'
        return super().changelist_view(request, extra_context)

# ─── Персонал АУЦ ───
class StaffInline(admin.StackedInline):
    model = Staff
    can_delete = False
    verbose_name_plural = 'Профиль сотрудника'
    fields = ('name', 'rauts_id', 'position', 'is_active')
    readonly_fields = ('rauts_id',)  # rauts_id менять нельзя

class CustomUserAdmin(UserAdmin):
    inlines = (StaffInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active')
    search_fields = ('username', 'email')

# Перерегистрируем User, чтобы видеть профиль сотрудника прямо в форме пользователя
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

@admin.register(Staff)
class StaffAdmin(ImportAdminMixin, admin.ModelAdmin):
    import_func = staticmethod(import_staff_excel)
    list_display = ('name', 'position', 'rauts_id', 'is_active', 'fptitle', 'tptitle',)
    list_filter = ('name', 'position', 'rauts_id', 'is_active', 'fptitle', 'tptitle',)
    search_fields = ('name', 'position', 'rauts_id', 'is_active', 'fptitle', 'tptitle',)

# ─── Слушатели ───
@admin.register(Student)
class StudentAdmin(ImportAdminMixin, admin.ModelAdmin):
    import_func = staticmethod(import_students_excel)
    list_display = ('surname', 'name', 'patronymic', 'sex', 'date_of_birth', 'snils', 'employee_id', 'aircraft_type', 'is_active', 'surname_latin', 'name_latin', 'dcat_id',)
    list_filter = ('surname', 'citizenship_code','aircraft_type', 'is_active', 'dcat_id')
    search_fields = ('surname', 'citizenship_code','aircraft_type','is_active', 'dcat_id')


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        'student', 'get_module_code', 'status', 'group', 'number_in_group',
        'application', 'enrolled_at', 'start_face_to_face', 'completed_at',
        'enrolled_by', 'location', 'addr_id', 'dept_id'
    )
    # 🔹 Фильтр по коду модуля (вместо объекта ForeignKey)
    list_filter = ('student', 'module__code', 'status', 'addr_id')

    # 🔹 Поиск по фамилии/СНИЛС слушателя и коду модуля (прямой поиск по FK запрещён)
    search_fields = ('student__surname', 'student__name', 'student__snils', 'module__code', 'status', 'addr_id')

    @admin.display(description='Код модуля', ordering='module__code')
    def get_module_code(self, obj):
        return obj.module.code if obj.module else '—'

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):

    list_display = ('enrollment', 'cert_type','cert_number', 'issued_at', 'prepared_by', 'approved_by', 'file_path', 'comment', )
    list_filter = ('enrollment', 'cert_type','cert_number', 'issued_at', 'prepared_by', 'approved_by', 'file_path', 'comment', )
    search_fields = ('cert_type','cert_number', 'issued_at', 'prepared_by', 'approved_by',)



@admin.register(GroupSchedule)
class GroupScheduleAdmin(admin.ModelAdmin):
    list_display = ('get_group', 'get_module_code', 'curator', 'director', 'status', 'version', 'created_at')
    list_filter = ('status', 'enrollment__module__code')
    search_fields = ('enrollment__group', 'enrollment__module__title')
    readonly_fields = ('created_at', 'updated_at', 'start_date_prop')
    raw_id_fields = ('enrollment', 'curator', 'director')  # Ускоряет работу при большом количестве записей

    @admin.display(description='Группа', ordering='enrollment__group')
    def get_group(self, obj):
        return obj.group if obj.group else '—'

    @admin.display(description='Код модуля', ordering='enrollment__module__code')
    def get_module_code(self, obj):
        return obj.module.code if obj.module else '—'

    @admin.display(description='Дата начала')
    def start_date_prop(self, obj):
        return obj.start_date
