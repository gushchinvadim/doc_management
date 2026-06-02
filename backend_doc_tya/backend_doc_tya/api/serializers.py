# api/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Student, Module, Enrollment, Certificate, Section, License, Staff, SectionResult, ScheduleItem
from .utils.schedule_calc import get_schedule_times
from .utils.schedule_constants import SLOT_LABELS
from .models import GroupSchedule,TRAINING_CENTER_CHOICE, LESSON_TIME_CHOICES

# =============================================================================
# МОДУЛЬ (для выпадающего списка)
# =============================================================================
class ModuleSelectSerializer(serializers.ModelSerializer):
    display_label = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ['id', 'code', 'mod_id', 'title', 'display_label']

    def get_display_label(self, obj):
        if obj.code and str(obj.code).strip():
            return f"{obj.code} | {obj.title}"
        return f"{obj.title} ({obj.mod_id})"


# =============================================================================
# СЛУШАТЕЛЬ
# =============================================================================
class StudentSearchSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ['id', 'employee_id', 'surname', 'name', 'patronymic', 'display_name', 'dcat_id',]

    def get_display_name(self, obj):
        return f"{obj.surname} {obj.name} {obj.patronymic or ''}".strip()


class StudentCreateSerializer(serializers.ModelSerializer):
    dcat_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
        max_value=9,
        help_text="Код профессии РАУЦ: 1=Инженер, 2=Пилот, 3=Бортпроводник"
    )

    def validate_dcat_id(self, value):
        if value in ('', None):
            return None
        return value
    class Meta:
        model = Student
        # Разрешаем все поля, кроме авто-полей
        fields = [
            'surname', 'name', 'patronymic', 'sex', 'date_of_birth',
            'snils', 'employee_id', 'surname_latin', 'name_latin',
            'email', 'is_active', 'aircraft_type', 'dcat_id',
        ]

# =============================================================================
# ЗАЧИСЛЕНИЕ (создание записи)
# =============================================================================

class EnrollmentSerializer(serializers.ModelSerializer):
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    student_name = serializers.CharField(source='student.display_name', read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id', 'group', 'module_id', 'module_code', 'module_title',
            'student', 'student_name', 'status', 'start_face_to_face', 'start_sdo'
        ]

class EnrollmentCreateSerializer(serializers.ModelSerializer):
    enrolled_by_name = serializers.CharField(source='enrolled_by.name', read_only=True)


    class Meta:
        model = Enrollment
        fields = [
            'application', 'student', 'module',
            'group', 'number_in_group', 'start_face_to_face', 'completed_at',
            'location', 'enrolled_at', 'enrolled_by_name'
        ]
        read_only_fields = ['enrolled_by', 'status', 'addr_id', 'dept_id']
        extra_kwargs = {

            'completed_at': {'required': False},
            'enrolled_at': {'required': True},
            'start_face_to_face': {'required': True},
            'group': {'required': True},
            'number_in_group': {'required': True},
            'location': {'required': True},
            'application': {'required': True},  # ← Единственное поле "заявка"
        }

    def validate(self, data):
        student = data.get('student')
        module = data.get('module')

        # Проверяем, нет ли уже такой записи
        if Enrollment.objects.filter(student=student, module=module).exists():
            raise serializers.ValidationError(
                {"non_field_errors": ["Этот студент уже зачислен на данный модуль."]}
            )
        return data

    def create(self, validated_data):
        request = self.context['request']
        staff = getattr(request.user, 'staff_profile', None)
        if not staff:
            raise serializers.ValidationError({"enrolled_by": "Профиль сотрудника не найден"})

        validated_data['enrolled_by'] = staff
        validated_data['status'] = 'enrolled'
        return super().create(validated_data)


# =============================================================================
# # ✅ Для списка и просмотра (GET)
# =============================================================================


class SectionJournalSerializer(serializers.ModelSerializer):
    """Сериализатор раздела для журнала"""
    stage_title = serializers.CharField(source='stage.title', read_only=True)
    stage_order = serializers.IntegerField(source='stage.order', read_only=True)

    class Meta:
        model = Section
        fields = [
            'id', 'title', 'order', 'duration_hours',
            'grade_type', 'min_score',
            'stage_title', 'stage_order'
        ]


class EnrollmentJournalSerializer(serializers.ModelSerializer):
    """Сериализатор зачисления для журнала оценок"""

    # 🔹 Поля с кастомными методами
    student_name = serializers.SerializerMethodField()
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    sections = serializers.SerializerMethodField()
    journal_number = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'student_name', 'group', 'application', 'number_in_group',
            'module_code', 'module_title', 'journal_number', 'sections',
            # 🔹 Важно: статус и даты для корректного отображения на фронте
            'status', 'completed_at', 'total_mark'
        ]

    # 🔹 МЕТОД 1: Получение ФИО слушателя
    def get_student_name(self, obj):
        student = obj.student
        parts = [student.surname, student.name, student.patronymic or '']
        return ' '.join(p for p in parts if p).strip()

    # 🔹 МЕТОД 2: Получение разделов модуля через Stage
    def get_sections(self, obj):
        sections = Section.objects.filter(
            stage__module=obj.module
        ).select_related('stage').order_by('stage__order', 'order')
        return SectionJournalSerializer(sections, many=True).data

    # 🔹 МЕТОД 3: Формирование номера журнала
    def get_journal_number(self, obj):
        return f"{obj.group}-{obj.application}"


# =============================================================================
# # ✅ Для редактирования (PATCH)
# =============================================================================

class EnrollmentUpdateSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    location_name = serializers.CharField(source='get_location_display', read_only=True)
    enrolled_by_name = serializers.CharField(source='enrolled_by.name', read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id', 'student', 'student_name', 'module', 'module_code', 'module_title',
            'group', 'number_in_group', 'application', 'status',
            'completed_at', 'location', 'location_name', 'enrolled_at',
            'start_face_to_face', 'enrolled_by_name'
        ]
        # Разрешаем менять всё, кроме системных и ID
        read_only_fields = ['id', 'student', 'module', 'enrolled_by', 'addr_id', 'dept_id',
                            'module_code', 'module_title', 'student_name', 'location_name', 'enrolled_by_name']
        extra_kwargs = {
            'student': {'read_only': True},
            'module': {'read_only': True},
            'enrolled_at': {'read_only': False},  # или уберите, если хотите разрешить смену даты
            'start_face_to_face': {'read_only': False},  # или уберите, если нужно редактировать
            'location': {'read_only': False},  # location меняет addr_id/dept_id автоматически
        }
    def get_student_name(self, obj):
        return f"{obj.student.surname} {obj.student.name}".strip()

    def validate(self, data):
        instance = self.instance
        new_status = data.get('status', instance.status if instance else None)

        # 1️⃣ Если статус "completed", обязательны оценка и дата
        if new_status == 'completed':

            if not data.get('completed_at'):
                raise serializers.ValidationError({"completed_at": "Для статуса 'Успешно завершен' необходима дата завершения."})

        # 2️⃣ Блокируем изменение ключевых полей, если обучение уже завершено
        if instance and instance.status == 'completed':
            locked_fields = ['group', 'number_in_group', 'application', 'enrolled_at', 'start_face_to_face', 'location']
            for field in locked_fields:
                if field in data and str(data[field]) != str(getattr(instance, field)):
                    raise serializers.ValidationError({field: "Нельзя изменить после завершения обучения."})

        return data


# =============================================================================
# # ✅ЭКСПОРТ EXEL РАУЦ
# =============================================================================


class CertificateEnrollmentSerializer(serializers.ModelSerializer):
    """Сериализатор для экспорта зачислений с сертификатами в РАУЦ"""

    student_name = serializers.SerializerMethodField()
    student_snils = serializers.CharField(source='student.snils', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    course_title = serializers.CharField(source='module.course.title', read_only=True)
    student_dcat_id = serializers.IntegerField(source='student.dcat_id', read_only=True)
    location_name = serializers.SerializerMethodField()
    has_certificate = serializers.SerializerMethodField()
    # 🔹 Данные сертификата (берём первый успешный)
    cert_number = serializers.SerializerMethodField()
    prepared_by_rauts_id = serializers.SerializerMethodField()
    approved_by_rauts_id = serializers.SerializerMethodField()

    # 🔹 Данные из SectionResult (берём первое/последнее)
    section_ngroup = serializers.SerializerMethodField()
    section_completed_at = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'student_name', 'student_snils', 'module_code', 'module_title',
            'course_title', 'group', 'application', 'number_in_group',
            'completed_at', 'location_name','start_sdo',
            # 🔹 Поля для экспорта в РАУЦ
            'cert_number', 'prepared_by_rauts_id', 'approved_by_rauts_id',
            'section_ngroup', 'section_completed_at', 'has_certificate', 'student_dcat_id',
        ]

    def get_student_name(self, obj):
        s = obj.student
        return f"{s.surname} {s.name} {s.patronymic or ''}".strip()

    def get_location_name(self, obj):
        loc_map = getattr(obj.__class__, 'LOCATION_MAP', {})
        return loc_map.get(obj.location, {}).get('name', obj.location)

    # 🔹 Сертификат: берём первый успешный
    def get_cert_number(self, obj):
        cert = obj.certificates.filter(cert_type='successful').first()
        return cert.cert_number if cert else None

    def get_prepared_by_rauts_id(self, obj):
        cert = obj.certificates.filter(cert_type='successful').first()
        return cert.prepared_by.rauts_id if cert and cert.prepared_by else None

    def get_approved_by_rauts_id(self, obj):
        cert = obj.certificates.filter(cert_type='successful').first()
        return cert.approved_by.rauts_id if cert and cert.approved_by else None

    # 🔹 SectionResult: берём первое (или можно last())
    def get_section_ngroup(self, obj):
        sr = obj.section_results.first()
        return sr.ngroup if sr else None

    def get_section_completed_at(self, obj):
        sr = obj.section_results.filter(completed_at__isnull=False).order_by('-completed_at').first()
        return sr.completed_at.isoformat() if sr and sr.completed_at else None

    def get_has_certificate(self, obj):
        return obj.certificates.filter(cert_type='successful').exists()

# =============================================================================
# # ✅СЕРТИФИКАТЫ
# =============================================================================


class CertificatePreviewSerializer(serializers.ModelSerializer):
    """Сериализатор для предпросмотра сертификата (без сохранения)"""

    # 🔹 Поля с кастомными методами
    student_name = serializers.SerializerMethodField()
    module_code = serializers.CharField(source='enrollment.module.code', read_only=True)
    module_title = serializers.CharField(source='enrollment.module.title', read_only=True)
    course_name = serializers.CharField(source='enrollment.module.course.title', read_only=True)
    total_hours = serializers.DecimalField(source='enrollment.module.duration', max_digits=6, decimal_places=2,
                                           read_only=True)
    location_name = serializers.SerializerMethodField()
    cert_number_preview = serializers.SerializerMethodField()
    license_data = serializers.SerializerMethodField()
    section_results = serializers.SerializerMethodField()

    # 🔹 Опции для выбора подписантов (берутся из context)
    prepared_by_options = serializers.SerializerMethodField()
    approved_by_options = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            # Поля для формы
            'enrollment', 'cert_type', 'comment',
            # Поля для предпросмотра (read-only)
            'student_name', 'module_code', 'module_title', 'course_name',
            'total_hours', 'location_name', 'cert_number_preview',
            'license_data', 'section_results',
            # Опции подписантов
            'prepared_by_options', 'approved_by_options',
        ]
        read_only_fields = [
            'cert_number_preview', 'license_data', 'section_results',
            'prepared_by_options', 'approved_by_options'
        ]

    # 🔹 МЕТОД 1: ФИО слушателя
    def get_student_name(self, obj):
        student = obj.enrollment.student
        return f"{student.surname} {student.name} {student.patronymic or ''}".strip()

    # 🔹 МЕТОД 2: Название локации
    def get_location_name(self, obj):
        loc_map = getattr(obj.enrollment.__class__, 'LOCATION_MAP', {})
        return loc_map.get(obj.enrollment.location, {}).get('name', obj.enrollment.location)

    # 🔹 МЕТОД 3: Превью номера сертификата
    def get_cert_number_preview(self, obj):
        enr = obj.enrollment
        return f"{enr.group}-{enr.application}-{enr.number_in_group}"

    # 🔹 МЕТОД 4: Данные лицензии
    def get_license_data(self, obj):
        license_obj = License.objects.first()
        if license_obj:
            return {
                'license_number': license_obj.license_number,
                'license_date': license_obj.license_date.isoformat() if license_obj.license_date else None,
                'favt_cert_number': license_obj.favt_cert_number,
                'favt_cert_date': license_obj.favt_cert_date.isoformat() if license_obj.favt_cert_date else None,
            }
        return None

    # 🔹 МЕТОД 5: Результаты разделов для snapshot
    def get_section_results(self, obj):
        results = SectionResult.objects.filter(
            enrollment=obj.enrollment
        ).select_related('section').values(
            'section__title', 'grade', 'is_passed', 'hours_completed'
        )
        return list(results)

    # 🔹 МЕТОД 6: Опции "Подготовил" (из context)
    def get_prepared_by_options(self, obj):
        return self.context.get('prepared_by_options', [])

    # 🔹 МЕТОД 7: Опции "Утвердил" (из context)
    def get_approved_by_options(self, obj):
        return self.context.get('approved_by_options', [])


class CertificateCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания сертификата"""

    cert_number = serializers.CharField(read_only=True)
    issued_at = serializers.DateField(read_only=True)

    class Meta:
        model = Certificate
        fields = [
            'id', 'enrollment', 'cert_type', 'cert_number', 'issued_at',
            'prepared_by', 'approved_by', 'file_path', 'results_snapshot', 'comment'
        ]
        read_only_fields = ['cert_number', 'issued_at', 'file_path', 'results_snapshot']

    def validate(self, attrs):
        enrollment = attrs.get('enrollment')
        cert_type = attrs.get('cert_type')

        # 🔹 Проверка на дубликат (более понятное сообщение)
        existing = Certificate.objects.filter(enrollment=enrollment, cert_type=cert_type).first()
        if existing:
            type_display = {'successful': '«Успешное прохождение»', 'attendance': '«Справка о прослушивании»'}.get(
                cert_type, cert_type)
            raise serializers.ValidationError(
                {'cert_type': f'Сертификат {type_display} уже выписан для этого зачисления (№{existing.cert_number}).'}
            )

        # 🔹 Проверка: зачисление должно быть завершено с оценкой
        if enrollment.status != 'completed' or enrollment.total_mark <= 0:
            raise serializers.ValidationError(
                {'enrollment': 'Сертификат можно выписать только для успешно завершённого модуля'}
            )

        # 🔹 Проверка на дубликат (enrollment + cert_type)
        if Certificate.objects.filter(enrollment=enrollment, cert_type=cert_type).exists():
            raise serializers.ValidationError(
                {'cert_type': f'Сертификат типа "{cert_type}" уже выписан для этого зачисления'}
            )

        return attrs

    def create(self, validated_data):
        # 🔹 Авто-генерация номера сертификата
        enrollment = validated_data['enrollment']
        validated_data['cert_number'] = f"{enrollment.group}-{enrollment.application}-{enrollment.number_in_group}"

        # 🔹 results_snapshot заполнится в модели Certificate.save()
        return super().create(validated_data)

# =============================================================================
# # ✅
# =============================================================================

class EnrollmentListSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_snils = serializers.CharField(source='student.snils', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    certificate = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'student_name', 'student_snils', 'module_code', 'module_title',
            'group', 'completed_at', 'status', 'application', 'certificate',
        ]

        read_only_fields = fields

    def get_student_name(self, obj):
        return f"{obj.student.surname} {obj.student.name} {obj.student.patronymic or ''}".strip()

    def get_certificate(self, obj):
        # Безопасный доступ к сертификату
        cert = getattr(obj, 'certificates', None)
        if cert:
            cert = cert.first()
        else:
            cert = getattr(obj, 'certificate_set', None)
            if cert: cert = cert.first()

        if not cert:
            return None

        return {
            'id': cert.id,
            'cert_number': cert.cert_number or '',
            # Поддержка CharField или FileField
            'file_path': getattr(cert, 'file_path', None) or (
                cert.file.url if hasattr(cert, 'file') and cert.file else None
            )
        }


# =============================================================================
# # РАСПИСАНИЕ
# =============================================================================


class GenerateScheduleInputSerializer(serializers.Serializer):
    enrollment_id = serializers.IntegerField(min_value=1)
    start_date = serializers.DateField()
    day_start_slot = serializers.ChoiceField(choices=[str(i) for i in range(1, 17)])
    excluded_dates = serializers.ListField(
        child=serializers.DateField(), required=False, default=list
    )
    mode = serializers.ChoiceField(
        choices=["auto", "semi_auto"], default="auto"
    )

class RegenerateScheduleInputSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["full_reset", "update_dates", "fill_gaps"])
    day_start_slot = serializers.ChoiceField(
        choices=[str(i) for i in range(1, 17)], required=False
    )
    excluded_dates = serializers.ListField(
        child=serializers.DateField(), required=False, default=list
    )

class ScheduleItemUpdateInputSerializer(serializers.Serializer):
    instructor_id = serializers.IntegerField(required=False, allow_null=True)
    location = serializers.ChoiceField(
        choices=TRAINING_CENTER_CHOICE, required=False, allow_null=True
    )
    is_locked = serializers.BooleanField(required=False)
    date = serializers.DateField(required=False, allow_null=True)
    time_slot = serializers.ChoiceField(
        choices=LESSON_TIME_CHOICES, required=False, allow_null=True
    )

class ScheduleItemBulkUpdateInputSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1)
    fields = serializers.DictField(required=True)

class FinalizeScheduleInputSerializer(serializers.Serializer):
    acknowledge_conflicts = serializers.BooleanField(default=False)


class ScheduleItemSerializer(serializers.ModelSerializer):
    """Сериализатор для элемента расписания"""
    stage_title = serializers.CharField(source='stage.title', read_only=True)
    section_title = serializers.CharField(source='section.title', read_only=True)
    section_detail = serializers.CharField(source='section.detail', read_only=True)
    instructor_name = serializers.SerializerMethodField()
    location_display = serializers.CharField(source='get_location_display', read_only=True)
    effective_detail = serializers.CharField(read_only=True)
    time_string = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleItem
        fields = [
            'id', 'order', 'date', 'start_time', 'is_locked',
            'stage', 'stage_title',
            'section', 'section_title', 'section_detail',
            'instructor', 'instructor_name',
            'location', 'location_display',
            'override_detail', 'effective_detail', 'time_string'
        ]
        read_only_fields = [
            'id', 'stage', 'section', 'stage_title', 'section_title',
            'section_detail', 'instructor_name', 'location_display',
            'effective_detail', 'time_string'
        ]

    def get_instructor_name(self, obj):
        """Получаем имя инструктора"""
        if not obj.instructor:
            return None

        # Используем поле name из модели Staff
        if hasattr(obj.instructor, 'name') and obj.instructor.name:
            return obj.instructor.name

        # Если есть связь с user
        if hasattr(obj.instructor, 'user') and obj.instructor.user:
            user = obj.instructor.user
            parts = []
            if user.first_name:
                parts.append(user.first_name)
            if user.last_name:
                parts.append(user.last_name)
            return ' '.join(parts) if parts else user.username

        return f"Сотрудник #{obj.instructor.id}"

    def get_time_string(self, obj):
        start = obj.start_time or "09:00"
        return get_schedule_times(obj.effective_detail, start_time=start)


class GroupScheduleSerializer(serializers.ModelSerializer):
    items = ScheduleItemSerializer(many=True, read_only=True)
    module_title = serializers.CharField(source='enrollment.module.title', read_only=True)
    module_code = serializers.CharField(source='enrollment.module.code', read_only=True)
    group_name = serializers.CharField(source='enrollment.group', read_only=True)

    # 🔹 Добавляем куратора и директора с именами
    curator = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.all(), required=False, allow_null=True)
    curator_name = serializers.SerializerMethodField()
    director = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.all(), required=False, allow_null=True)
    director_name = serializers.SerializerMethodField()

    # Список всех сотрудников для выбора
    staff_list = serializers.SerializerMethodField()

    class Meta:
        model = GroupSchedule
        fields = [
            'id', 'enrollment', 'curator', 'director',
            'status', 'version',
            'module_title', 'module_code', 'group_name',
            'curator_name', 'director_name', 'staff_list',
            'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'items', 'staff_list']

    def get_curator_name(self, obj):
        if obj.curator and hasattr(obj.curator, 'name'):
            return obj.curator.name
        return None

    def get_director_name(self, obj):
        if obj.director and hasattr(obj.director, 'name'):
            return obj.director.name
        return None

    def get_staff_list(self, obj):
        """Возвращает список всех сотрудников для выбора"""
        staff = Staff.objects.filter(is_active=True).order_by('name')
        return [{
            'id': s.id,
            'name': s.name if hasattr(s, 'name') else str(s)
        } for s in staff]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # 🔹 Сортируем items по order
        if 'items' in data:
            data['items'] = sorted(data['items'], key=lambda x: x['order'])
        return data

class ScheduleItemUpdateSerializer(serializers.Serializer):
    """Для обновления одного элемента"""
    id = serializers.IntegerField()
    date = serializers.DateField(required=False, allow_null=True)
    start_time = serializers.CharField(max_length=5, required=False, allow_null=True)
    instructor_id = serializers.IntegerField(required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_locked = serializers.BooleanField(required=False)


class ScheduleItemBulkUpdateSerializer(serializers.Serializer):
    """Для массового обновления"""
    items = ScheduleItemUpdateSerializer(many=True)


class GroupScheduleCreateSerializer(serializers.Serializer):
    """Для создания черновика расписания"""
    enrollment_id = serializers.IntegerField()
    start_date = serializers.DateField(required=False, allow_null=True)

    def validate_enrollment_id(self, value):
        from api.models import Enrollment
        if not Enrollment.objects.filter(id=value).exists():
            raise serializers.ValidationError("Enrollment not found")
        return value
