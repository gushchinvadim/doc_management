# api/mod.py
# from api.models import Section  # или импортируйте вверху файла
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db import models
from django.db.models import Q, Sum, Count, F, UniqueConstraint
from api.utils.schedule_constants import LESSON_TIME_CHOICES


# =============================================================================
# 1. СЛУШАТЕЛЬ
# =============================================================================
class Student(models.Model):
    AC_TYPE_CHOICES = [
        ("B737NG", "B737NG"),
        ("B737CL", "B737CL"),
        ("B737CL+B737NG", "B737CL+B737NG"),
    ]
    SEX_CHOICE = [
        ("Male", "Муж"),
        ("Female", "Жен"),
    ]

    POSITION_CHOICE = [
        (1, "Инженер (1)"),
        (2, "Пилот (2)"),
        (3, "Бортпроводник (3)"),
    ]

    surname = models.CharField(max_length=50, verbose_name="Фамилия")
    name = models.CharField(max_length=50, verbose_name="Имя")
    patronymic = models.CharField(max_length=50, blank=True, verbose_name="Отчество")
    sex = models.CharField(max_length=10, choices=SEX_CHOICE, verbose_name="Пол")
    date_of_birth = models.DateField(verbose_name="Дата рождения")
    snils = models.CharField(max_length=20, unique=True, verbose_name="СНИЛС")
    surname_latin = models.CharField(max_length=100, blank=True, verbose_name="Фамилия на латинице")
    name_latin = models.CharField(max_length=100, blank=True, verbose_name="Имя на латинице")
    employee_id = models.CharField(max_length=50, unique=True, verbose_name="Табельный номер")
    dcat_id = models.PositiveIntegerField(null=True, blank=True, choices=POSITION_CHOICE, verbose_name="Код профессии РАУЦ")
    citizenship_code = models.CharField(max_length=3, default="643", verbose_name="Код страны гражданства ОКСМ")
    email = models.EmailField(blank=True,verbose_name="Email")
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    aircraft_type = models.CharField(max_length=30, choices=AC_TYPE_CHOICES, blank=True, null=True, verbose_name="Тип ВС")

    class Meta:
        db_table = 'student'
        ordering = ['surname', 'name']
        verbose_name = 'Слушатель'
        verbose_name_plural = 'Слушатели'

    def __str__(self):
        return f"{self.surname} {self.name} ({self.snils})"


# =============================================================================
# 2. ПЕРСОНАЛ
# =============================================================================

class Staff(models.Model):
    # 🔗 Связь с Django User
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_profile',
        verbose_name="Пользователь"
    )

    name = models.CharField(max_length=200, verbose_name="ФИО")
    rauts_id = models.CharField(max_length=10, unique=True, verbose_name="ID персонала в РАУЦ")
    position = models.CharField(max_length=150, verbose_name="Должность")
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    fptitle = models.BooleanField(default=False, verbose_name="Может оформлять документы")
    tptitle = models.BooleanField(default=False, verbose_name="Может подписывать документы")

    class Meta:
        db_table = 'staff'
        ordering = ['name']
        verbose_name = 'Сотрудник АУЦ'
        verbose_name_plural = 'Сотрудники АУЦ'

    def __str__(self):
        return f"{self.name}"


# =============================================================================
# 3. КУРС ПОДГОТОВКИ
# =============================================================================
class Course(models.Model):
    title = models.CharField(max_length=500, verbose_name="Название курса")
    prog_id = models.CharField(max_length=10, verbose_name="ID программы РАУЦ")
    company_code = models.CharField(max_length=200, verbose_name="Код Авиакомпании", help_text="ППП.АУЦ.ХХХ")
    approved = models.CharField(max_length=200, blank=True, verbose_name="Орган утвердивший программу")
    approved_date = models.DateField( blank=True, null=True, verbose_name="Дата утверждения")

    class Meta:
        db_table = 'course'
        ordering = ['title']
        verbose_name = 'Курс подготовки'
        verbose_name_plural = 'Курсы подготовки'

    def __str__(self):
        return f"{self.company_code}"


# =============================================================================
# 4. МОДУЛЬ
# =============================================================================
class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='modules', verbose_name="Курс")
    title = models.CharField(max_length=500, verbose_name="Название модуля")
    mod_id = models.CharField(max_length=10, verbose_name="ID модуля РАУЦ")
    code = models.CharField(max_length=50, blank=True, verbose_name="Код модуля", help_text="ППП.АУЦ.ХХ - М.Х")
    duration = models.DecimalField(max_digits=6, decimal_places=2, verbose_name="Плановые часы")
    attachment_number = models.PositiveIntegerField(default=0, verbose_name="Номер приложения для выписки сертификата")

    class Meta:
        db_table = 'module'
        ordering = ['title']
        verbose_name = 'Модуль'
        verbose_name_plural = 'Модули'

    def __str__(self):
        return f"{self.title} ({self.course.title})"


# =============================================================================
# 5. ЭТАП
# =============================================================================
class Stage(models.Model):
    module = models.ForeignKey(Module, on_delete=models.PROTECT, related_name='stages', verbose_name="Модуль")
    title = models.CharField(max_length=500, verbose_name="Название этапа")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядковый номер")
    description = models.TextField(blank=True, verbose_name="Описание")


    class Meta:
        db_table = 'stage'
        ordering = ['module', 'order']
        verbose_name = 'Этап'
        verbose_name_plural = 'Этапы'
        constraints = [
            UniqueConstraint(fields=['module', 'order'], name='unique_stage_order_per_module')
        ]

    def __str__(self):
        return f"{self.title} ({self.module.title})"


# =============================================================================
# 6. РАЗДЕЛ (ДИСЦИПЛИНА)
# =============================================================================
class Section(models.Model):
    GRADE_TYPE_CHOICES = [
        ('numeric', 'Числовая оценка'),
        ('binary', 'Бинарная (Зачтено/Не зачтено)'),
        ('none', 'Без оценки'),
    ]

    DETAIL_CHOICES = [
        ('sdo', 'Самостоятельная подготовка в СДО'),
        ('sim', '1 час - брифинг (лекция)\n4 часа - тренажерная подготовка\n1 час - дебрифинг (лекция)'),
        ('base-1', '1 урок (09:00 - 09:45)'),
        ('base-2', '2 урока (09:00 - 10:35)'),
        ('base-3', '3 урока (09:00 - 11:25)'),
        ('base-4', '4 урока (09:00 - 12:15)'),
        ('base-5', '5 уроков + большой перерыв 40 мин'),
        ('base-6', '6 уроков + большой перерыв 40 мин'),
        ('base-7', '7 уроков + большой перерыв 40 мин'),
        ('base-8', '8 уроков + большой перерыв 40 мин'),
        ('base-9', '9 уроков + большой перерыв 40 мин'),
        ('none', 'Не задано'),
    ]

    stage = models.ForeignKey(Stage, on_delete=models.PROTECT, related_name='sections', verbose_name="Этап")
    title = models.CharField(max_length=500, verbose_name="Название раздела/дисциплины")
    duration_hours = models.DecimalField(max_digits=6, decimal_places=2, verbose_name="Плановые часы")
    grade_type = models.CharField(max_length=10, choices=GRADE_TYPE_CHOICES, default='none',
                                  verbose_name="Тип оценки")
    min_score = models.PositiveIntegerField(null=True, blank=True, verbose_name="Минимальная оценка")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядковый номер")

    # 🔹 Ключевое поле: хранит только код паттерна
    detail = models.CharField(
        max_length=50,
        choices=DETAIL_CHOICES,
        default='sdo',
        verbose_name="Тип расписания"
    )

    class Meta:
        db_table = 'section'
        ordering = ['stage', 'order']
        verbose_name = 'Раздел'
        verbose_name_plural = 'Разделы'

    def __str__(self):
        return f"{self.title} ({self.duration_hours} ч.)"
# =============================================================================
# 6. ПОДРАЗДЕЛ (СЕСИЯ)
# =============================================================================

class SubSection(models.Model):
    section = models.ForeignKey(
        "Section",
        on_delete=models.CASCADE,
        related_name="subsections",
        verbose_name="Родительский раздел"
    )
    title = models.CharField(null=True, blank=True, max_length=500, verbose_name="Название подраздела/сессии")
    duration_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name="Часы")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядковый номер")

    class Meta:
        db_table = "subsection"
        ordering = ["section", "order"]
        verbose_name = "Подраздел/Сессия"
        verbose_name_plural = "Подразделы/Сессии"

    def __str__(self):
        return f"{self.title} ({self.section.stage})"

# =============================================================================
# 7. ЗАЧИСЛЕНИЕ НА МОДУЛЬ
# =============================================================================


# Единый справочник локаций
LOCATION_MAP: dict[str, dict[str, str] | dict[str, str]] = {
    "KJA": {"name": "Красноярск", "addr": "174", "dept": ""},
    "DME": {"name": "Домодедово", "addr": "176", "dept": "37"},
}



class Enrollment(models.Model):
    STATUS_CHOICES = [
        ("enrolled", "Зачислен"),
        ("in_progress", "В процессе"),
        ("completed", "Успешно завершен"),
        ("failed", "Не завершен"),
    ]
    student = models.ForeignKey("Student", on_delete=models.PROTECT, related_name="enrollments")
    module = models.ForeignKey("Module", on_delete=models.PROTECT, related_name="enrollments")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="enrolled", db_index=True)
    group = models.CharField(max_length=30, verbose_name="Номер группы", help_text="123.2026")
    number_in_group = models.PositiveIntegerField(verbose_name="Порядковый номер в группе")
    application = models.CharField(max_length=30, verbose_name="Номер заявки")
    enrolled_at = models.DateField(default=timezone.now, verbose_name="Дата зачисления")
    start_sdo = models.DateField(default=timezone.now, verbose_name="Дата начала занятий в СДО")
    start_face_to_face = models.DateField(default=timezone.now, verbose_name="Дата начала очных занятий")
    completed_at = models.DateField(null=True, blank=True, verbose_name="Дата завершения")
    enrolled_by = models.ForeignKey("Staff", on_delete=models.PROTECT, related_name="enrollments_made", verbose_name="Зачислил сотрудник")
    location = models.CharField(max_length=3, choices=[(k, v["name"]) for k, v in LOCATION_MAP.items()])
    addr_id = models.CharField(max_length=10, editable=False, verbose_name="Код места проведения")
    dept_id = models.CharField(max_length=10, blank=True, editable=False, verbose_name="Филиал")

    class Meta:
        db_table = "enrollment"
        indexes = [
            models.Index(fields=["status", "location"], name="idx_enroll_status_loc"),
            models.Index(fields=["enrolled_at"], name="idx_enroll_date"),
        ]
        constraints = [
            UniqueConstraint(fields=["student", "module"], name="unique_student_module_enrollment")
        ]
        verbose_name = 'Назначение'
        verbose_name_plural = 'Назначения'

    def save(self, *args, **kwargs):
        if self.location:
            self.addr_id = LOCATION_MAP[self.location]["addr"]
            self.dept_id = LOCATION_MAP[self.location]["dept"]
        super().save(*args, **kwargs)

    @property
    def is_completed(self):

        # Подсчёт пройденных разделов
        stats = self.section_results.aggregate(
            total=Count("id"),
            passed=Count("id", filter=Q(is_passed=True) | Q(hours_completed__gte=F("section__duration_hours")))
        )

        # 🔹 ИСПРАВЛЕНО: получаем общее количество разделов модуля через Stage
        total_sections = Section.objects.filter(
            stage__module=self.module
        ).count()

        return total_sections > 0 and stats["passed"] == total_sections and stats["passed"] == stats["total"]

    def __str__(self):
        return f"{self.student} → {self.module} ({self.get_status_display()})"



# =============================================================================
# РАСПИСАНИЕ
# =============================================================================

class ScheduleStatus(models.TextChoices):
    DRAFT = 'draft', 'Черновик'
    ACTIVE = 'active', 'Активно'
    FINALIZED = 'finalized', 'Зафиксировано'
    ARCHIVED = 'archived', 'Архив'


TRAINING_CENTER_CHOICE = [
    ("SDO", "СДО"),
    ("DME_508", "Домодедово, мкр. Авиационный, ул. Ильюшина, 2а, ауд. 508"),
    ("DME_509", "Домодедово, мкр. Авиационный, ул. Ильюшина, 2а, ауд. 509"),
    ("KJA_408", "Красноярск, ул. Маерчака, 000 ауд. 408"),
    ("KJA_403", "Красноярск, ул. Маерчака, 000 ауд. 403"),
    ("S7 Training", "Домодедово, пос. Битягово, строение 1"),
    ("Aeroflot", "Москва, аэропорт Шереметьево"),
    ("UIGA", "Ульяновск, УИГА"),
    ("SPBGUGA", "Санкт Петербург, СПБГУГА"),
]


class GroupSchedule(models.Model):
    enrollment = models.ForeignKey("Enrollment", on_delete=models.CASCADE, related_name='group_schedules',
                                   verbose_name="Зачисление")

    # 🔹 ДОБАВЛЕНО: чтобы соответствовать базе данных
    group_code = models.CharField(max_length=100, null=True, blank=True, verbose_name="Код/Название группы")

    curator = models.ForeignKey("Staff", on_delete=models.PROTECT, related_name="curator_schedules", null=True,
                                blank=True, verbose_name="Куратор")
    director = models.ForeignKey("Staff", on_delete=models.PROTECT, related_name="director_schedules", null=True,
                                 blank=True, verbose_name="Руководитель")
    status = models.CharField(max_length=20, choices=ScheduleStatus.choices, default=ScheduleStatus.DRAFT,
                              db_index=True)
    version = models.PositiveIntegerField(default=1, verbose_name="Версия")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def module(self):
        return self.enrollment.module if self.enrollment else None

    @property
    def group(self):
        return self.enrollment.group if self.enrollment else None

    @property
    def start_date(self):
        return self.enrollment.enrolled_at if self.enrollment else None

    class Meta:
        db_table = "group_schedule"
        ordering = ["-created_at"]
        verbose_name = "Расписание группы"
        verbose_name_plural = "Расписания групп"

    def __str__(self):
        module_code = self.module.code if self.module else "Без модуля"
        return f"{self.group} | {module_code} (v{self.version})"


class ScheduleItem(models.Model):
    group_schedule = models.ForeignKey(
        GroupSchedule, on_delete=models.CASCADE,
        related_name="items", verbose_name="Расписание"
    )
    stage = models.ForeignKey("Stage", on_delete=models.PROTECT, related_name="schedule_items")
    section = models.ForeignKey("Section", on_delete=models.PROTECT, related_name="schedule_items")

    # 🔹 Ручные параметры
    date = models.DateField(null=True, blank=True, verbose_name="Дата")
    start_time = models.CharField(
        max_length=5, null=True, blank=True,
        verbose_name="Время начала", help_text="Формат: ЧЧ:ММ"
    )
    instructor = models.ForeignKey(
        "Staff", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_schedule_items", verbose_name="Преподаватель"
    )
    location = models.CharField(
        max_length=200, null=True, blank=True,
        choices=TRAINING_CENTER_CHOICE, verbose_name="Место"
    )
    order = models.IntegerField(default=0, verbose_name="Порядок")
    is_locked = models.BooleanField(default=False, verbose_name="Зафиксировано")

    #  Переопределение типа (если нужно отойти от стандарта модуля)
    override_detail = models.CharField(
        max_length=10, choices=getattr(Section, 'DETAIL_CHOICES', []),
        null=True, blank=True, verbose_name="Переопределить тип"
    )

    class Meta:
        db_table = "schedule_item"
        ordering = ["group_schedule", "stage__order", "section__order"]
        verbose_name = "Элемент расписания"
        verbose_name_plural = "Элементы расписания"

    def __str__(self):
        return f"{self.section.title} ({self.date or '—'})"

    def clean(self):
        from django.core.exceptions import ValidationError
        import re
        if self.start_time and not re.match(r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', self.start_time):
            raise ValidationError({'start_time': 'Неверный формат. Используйте ЧЧ:ММ (например, 11:00)'})

    @property
    def effective_detail(self):
        return self.override_detail or self.section.detail

# =============================================================================
# 8. РЕЗУЛЬТАТЫ РАЗДЕЛОВ (вместо ModuleProgress)
# =============================================================================

class SectionResult(models.Model):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='section_results', verbose_name="Зачисление")
    section = models.ForeignKey(Section, on_delete=models.PROTECT, verbose_name="Раздел")
    hours_completed = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name="Фактические часы")
    grade = models.PositiveIntegerField(null=True, blank=True, verbose_name="Оценка")
    is_passed = models.BooleanField(null=True, blank=True, verbose_name="Зачтено (для бинарных/итоговых)")
    completed_at = models.DateField(null=True, blank=True, verbose_name="Дата сдачи")
    total_mark = models.PositiveIntegerField(null=True, blank=True, verbose_name="Итоговая аттестация(Экзамен)")
    evaluator = models.ForeignKey(Staff, on_delete=models.PROTECT, related_name='evaluated_sections', verbose_name="Оценил", null=True, blank=True)
    ngroup = models.CharField(max_length=50, verbose_name="Номер журнала", help_text="Номер группы+Номер заявки")

    class Meta:
        db_table = 'section_result'
        verbose_name = 'Результат раздела'
        verbose_name_plural = 'Результаты разделов'
        constraints = [
            UniqueConstraint(fields=['enrollment', 'section'], name='unique_enrollment_section_result')
        ]
        ordering = ['section__stage__order', 'section__order']

    def __str__(self):
        return f"{self.section.title}: {self.grade or 'Нет'} | {self.is_passed or '-'}"

    def clean(self):
        super().clean()
        if self.section.grade_type == 'binary' and self.is_passed is None:
            raise ValidationError({'is_passed': 'Для бинарных разделов обязательно указать статус зачёта.'})
        if self.section.grade_type == 'numeric' and self.grade is None:
            raise ValidationError({'grade': 'Для числовых разделов обязательно указать оценку.'})

# =============================================================================
# 9. СЕРТИФИКАТ
# =============================================================================

class Certificate(models.Model):
    TYPE_CHOICES = [
        ('successful', 'Успешное прохождение'),
        ('attendance', 'Справка о прослушивании'),
    ]

    enrollment = models.ForeignKey(
        "Enrollment", on_delete=models.PROTECT,
        related_name="certificates", verbose_name="Зачисление/Модуль"
    )
    cert_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name="Тип сертификата")
    cert_number = models.CharField(max_length=100, unique=True, verbose_name="Номер сертификата")
    issued_at = models.DateField(auto_now_add=True, verbose_name="Дата выдачи")

    prepared_by = models.ForeignKey(
        "Staff", on_delete=models.PROTECT, related_name="prepared_certificates",
        limit_choices_to={"fptitle": True, "is_active": True}, verbose_name="Подготовил"
    )
    approved_by = models.ForeignKey(
        "Staff", on_delete=models.PROTECT, related_name="approved_certificates",
        limit_choices_to={"tptitle": True, "is_active": True}, verbose_name="Утвердил"
    )

    file_path = models.FileField(upload_to="certificates/%Y/%m/", blank=True, verbose_name="Файл сертификата")
    comment = models.TextField(blank=True, verbose_name="Примечание")

    class Meta:
        db_table = "certificate"
        verbose_name = "Сертификат"
        verbose_name_plural = "Сертификаты"
        ordering = ["-issued_at"]
        constraints = [
            models.UniqueConstraint(fields=["enrollment", "cert_type"], name="one_cert_per_enrollment_type")
        ]

    def __str__(self):
        return f"Сертификат №{self.cert_number} | {self.enrollment.student}"

    # api/mod.py

    def save(self, *args, **kwargs):
        if not self.pk:  # только при первом создании
            try:
                stats = self.enrollment.section_results.aggregate(
                    total_hours=Sum("hours_completed"),
                    passed_count=Count("id", filter=Q(is_passed=True))
                )
                total_h = float(stats.get("total_hours") or 0)
                passed_c = stats.get("passed_count") or 0
            except Exception:
                total_h, passed_c = 0.0, 0

            # 🔹 Безопасное получение ФИО (защита от None при первом сохранении)
            prepared_name = getattr(self.prepared_by, 'name', 'Не указано')
            approved_name = getattr(self.approved_by, 'name', 'Не указано')

            self.results_snapshot = {
                "total_hours": total_h,
                "passed_sections": passed_c,
                "issued_by_staff": {
                    "prepared": prepared_name,
                    "approved": approved_name,
                },
                "generated_at": timezone.now().isoformat()
            }
        super().save(*args, **kwargs)

# =============================================================================
# 10. ЛИЦЕНЗИИ ФАВТ МИНОБРА
# =============================================================================
class License(models.Model):

    favt_cert_number = models.CharField(max_length=100, blank=True, verbose_name="Номер сертификата ФАВТ")
    favt_cert_date = models.DateField(default=timezone.now, blank=True, null=True, verbose_name="Дата выдачи сертификата ФАВТ")
    license_number = models.CharField(max_length=100, blank=True, verbose_name="Лицензия Минобразования")
    license_date = models.DateField(default=timezone.now, blank=True, verbose_name="Дата выдачи лицензии Минобразования")


    class Meta:
        db_table = 'license'
        verbose_name = 'Лицензия АУЦ'
        verbose_name_plural = 'Лицензии АУЦ'

    def __str__(self):
        return f"{self.favt_cert_number} ({self.license_number})"

