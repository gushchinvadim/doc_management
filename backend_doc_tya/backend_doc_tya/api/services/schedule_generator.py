# api/services/schedule_generator.py
from api.models import ScheduleItem, GroupSchedule, ScheduleStatus
from django.utils import timezone


def create_schedule_skeleton(enrollment_id: int) -> GroupSchedule:
    """Создаёт черновик расписания: копирует структуру модуля в ScheduleItem"""
    from api.models import Enrollment, Stage, Section

    enrollment = Enrollment.objects.select_related('module').get(id=enrollment_id)
    module = enrollment.module

    # Создаём заголовок расписания
    gs = GroupSchedule.objects.create(
        enrollment=enrollment,
        status=ScheduleStatus.DRAFT,
        version=1
    )

    # Копируем все разделы модуля в элементы расписания
    items = []
    for stage in module.stages.prefetch_related('sections').all().order_by('order'):
        for section in stage.sections.all().order_by('order'):
            items.append(ScheduleItem(
                group_schedule=gs,
                stage=stage,
                section=section,
                # Остальные поля = None (для ручного заполнения)
                order=section.order
            ))

    ScheduleItem.objects.bulk_create(items, batch_size=500)
    return gs