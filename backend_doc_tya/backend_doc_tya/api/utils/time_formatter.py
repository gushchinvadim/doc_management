"""Форматирование временных блоков для отображения."""

from .schedule_constants import SLOT_REGISTRY, SLOT_TO_IDX, SLOT_LABELS


def format_detailed_time_block(
        start_slot: str,
        duration_slots: int,
        include_breaks: bool = True,
        separator: str = "\n"
) -> str:
    """
    Форматирует блок времени для отображения.

    :param start_slot: начальный слот ("1".."16")
    :param duration_slots: количество академических часов
    :param include_breaks: включать ли маркеры перерывов
    :param separator: разделитель строк ("\n", "<br>", "; ")
    :return: отформатированная строка
    """
    idx = SLOT_TO_IDX.get(start_slot)
    if idx is None or duration_slots <= 0:
        return ""

    parts = []
    consecutive = 0
    academic_hour = 1
    current_idx = idx

    while academic_hour <= duration_slots and current_idx < len(SLOT_REGISTRY):
        if consecutive == 4 and include_breaks:
            parts.append("🕐 Большой перерыв")
            consecutive = 0
            continue

        slot = SLOT_REGISTRY[current_idx]
        time_range = f"{slot['start'].strftime('%H:%M')}-{slot['end'].strftime('%H:%M')}"
        parts.append(f"{academic_hour} а.ч. — {time_range}")

        academic_hour += 1
        consecutive += 1
        current_idx += 1

    return separator.join(parts)


def format_time_range(start_slot: str, duration_slots: int) -> str:
    """Возвращает строку вида '09:00 – 12:15' с учётом перерывов."""
    idx = SLOT_TO_IDX.get(start_slot)
    if idx is None or duration_slots <= 0:
        return SLOT_LABELS.get(start_slot, "")

    start_time = SLOT_REGISTRY[idx]['start']

    # Находим конец последнего слота
    end_idx = idx
    consecutive = 0
    remaining = duration_slots

    while remaining > 0 and end_idx < len(SLOT_REGISTRY):
        if consecutive == 4:
            end_idx += 1
            consecutive = 0
            continue
        consecutive += 1
        remaining -= 1
        end_idx += 1

    end_time = SLOT_REGISTRY[end_idx - 1]['end'] if end_idx > idx else start_time
    return f"{start_time.strftime('%H:%M')} – {end_time.strftime('%H:%M')}"