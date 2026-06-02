LESSON_MIN = 45
BREAK_MIN = 5
BIG_BREAK = 40  # Большой перерыв после 4 часов

PATTERNS = {
    'base-1': {'count': 1},
    'base-2': {'count': 2},
    'base-3': {'count': 3},
    'base-4': {'count': 4},
    'base-5': {'count': 5, 'big_break_after': 3},  # После 4-го часа (индекс 3)
    'base-6': {'count': 6, 'big_break_after': 3},
    'base-7': {'count': 7, 'big_break_after': 3},
    'base-8': {'count': 8, 'big_break_after': 3},
    'base-9': {'count': 9, 'big_break_after': 3},
}


def _fmt(minutes):
    """Форматирует минуты в ЧЧ:ММ"""
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def get_schedule_times(detail_code, start_time="09:00"):
    """Возвращает строку с расписанием"""
    if detail_code == 'sdo':
        return "СДО"

    if detail_code == 'sim':
        return "1 час - брифинг (лекция)\n4 часа - тренажерная подготовка\n1 час - дебрифинг (лекция)"

    cfg = PATTERNS.get(detail_code)
    if not cfg:
        return ""

    h, m = map(int, start_time.split(':'))
    current = h * 60 + m
    slots = []

    for i in range(1, cfg['count'] + 1):
        end = current + LESSON_MIN
        # 🔹 ИСПРАВЛЕНО: "час" вместо "пара"
        slots.append(f"{i} час - {_fmt(current)} - {_fmt(end)}")
        current = end

        if i < cfg['count']:
            # 🔹 Добавляем большой перерыв после 4-го часа
            if cfg.get('big_break_after') and i == cfg['big_break_after']:
                slots.append(f"Большой перерыв - {BIG_BREAK} мин")
                current += BIG_BREAK
            else:
                slots.append(f"Перерыв - {BREAK_MIN} мин")
                current += BREAK_MIN

    return "\n".join(slots)