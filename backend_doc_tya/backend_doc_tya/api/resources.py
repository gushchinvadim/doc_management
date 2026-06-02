from import_export import resources, fields, widgets
from import_export.results import Result
from .models import Enrollment, Student, Module, Staff
from django.core.exceptions import ValidationError
from import_export.formats import base_formats
from django.http import HttpResponse
from tablib import Dataset
from import_export import resources, fields
from import_export.widgets import DateWidget, BooleanWidget


class EnrollmentResource(resources.ModelResource):
    student_snils = fields.Field(column_name="СНИЛС", attribute="student", widget=widgets.ForeignKeyWidget(Student, "snils"))
    module_code = fields.Field(column_name="Код модуля", attribute="module", widget=widgets.ForeignKeyWidget(Module, "code"))
    enrolled_by = fields.Field(column_name="ФИО зачислившего", attribute="enrolled_by", widget=widgets.ForeignKeyWidget(Staff, "full_name"))

    class Meta:
        model = Enrollment
        fields = ("id", "student_snils", "module_code", "status", "group", "number_in_group",
                  "application", "enrolled_at", "start_face_to_face", "location", "enrolled_by")
        import_id_fields = ("student_snils", "module_code")
        skip_unchanged = True
        report_skipped = True
        # dry_run включается на уровне view

    def before_import_row(self, row, **kwargs):
        # Нормализация данных из Excel
        row["enrolled_at"] = row.get("enrolled_at", "").replace(".", "-")
        row["status"] = row.get("status", "enrolled").lower()





def export_regulatory_excel(request):
    # Формируем queryset с нужными полями
    qs = Enrollment.objects.select_related("student", "module").filter(
        status__in=["completed", "failed"]
    )

    dataset = Dataset()
    # Фиксированный порядок столбцов под надзорный орган
    dataset.headers = ["СНИЛС", "ФИО", "Код модуля", "Название модуля", "Статус", "Дата зачисления", "Место"]

    for e in qs:
        dataset.append([
            e.student.snils,
            f"{e.student.surname} {e.student.name} {e.student.patronymic or ''}",
            e.module.code,
            e.module.title,
            e.get_status_display(),
            e.enrolled_at.strftime("%d.%m.%Y"),  # ✅ Регламентный формат
            e.get_location_display(),
        ])

    response = HttpResponse(dataset.xlsx,
                            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = 'attachment; filename="regulatory_export.xlsx"'
    return response





class StaffResource(resources.ModelResource):
    is_active = fields.Field(
        attribute='is_active',
        column_name='is_active',
        widget=BooleanWidget()  # Корректно понимает 1/0, True/False, да/нет
    )

    class Meta:
        model = Staff
        import_id_fields = ('rauts_id',)  # При повторной загрузке обновит существующие записи
        fields = ('name', 'rauts_id', 'position', 'is_active')
        skip_unchanged = True
        report_skipped = True


class StudentResource(resources.ModelResource):
    date_of_birth = fields.Field(
        attribute='date_of_birth',
        column_name='date_of_birth',
        widget=DateWidget(format='%m/%d/%y')  # Под формат 1/1/00 из примера
    )
    is_active = fields.Field(
        attribute='is_active',
        column_name='is_active',
        widget=BooleanWidget()
    )

    class Meta:
        model = Student
        import_id_fields = ('employee_id',)  # Используем табельный номер как уникальный ключ
        fields = (
        'surname', 'name', 'patronymic', 'sex', 'date_of_birth', 'snils', 'employee_id', 'is_active', 'aircraft_type')
        skip_unchanged = True
        report_skipped = True

    def before_import_row(self, row, **kwargs):
        """Приводим значения из Excel к формату модели"""
        # Преобразование пола: Excel "Муж/Жен" → модель "Male/Female"
        sex_map = {'Муж': 'Male', 'Жен': 'Female'}
        if 'sex' in row and row['sex'] in sex_map:
            row['sex'] = sex_map[row['sex']]

        return super().before_import_row(row, **kwargs)