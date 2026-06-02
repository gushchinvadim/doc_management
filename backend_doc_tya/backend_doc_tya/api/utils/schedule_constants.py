"""Константы и вспомогательные структуры для работы с временными слотами."""

LESSON_TIME_CHOICES = [

    ("0", "СДО"),
    ("1", "09:00 - 09:45"),
    ("2", "09:50 - 10:35"),
    ("3", "10:40 - 11:25"),
    ("4", "11:30 - 12:15"),
    ("5", "12:20 - 13:05"),
    ("6", "13:10 - 13:55"),
    ("7", "14:00 - 14:45"),
    ("8", "14:50 - 15:35"),
    ("9", "15:40 - 16:25"),
    ("10", "16:30 - 17:15"),
    ("11", "17:20 - 18:05"),
    ("12", "18:10 - 18:55"),
    ("13", "19:00 - 19:45"),
    ("14", "19:50 - 20:35"),
    ("15", "20:40 - 21:25"),
    ("16", "21:30 - 22:15"),
]


def _build_slot_registry():
    """Парсит LESSON_TIME_CHOICES в структурированный регистр."""
    import re
    from datetime import time

    registry = []
    for key, label in LESSON_TIME_CHOICES:
        match = re.match(r"(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})", label)
        if match:
            registry.append({
                "key": key,
                "label": label,
                "start": time(int(match.group(1)), int(match.group(2))),
                "end": time(int(match.group(3)), int(match.group(4))),
            })
    return registry


# 🔹 Предрассчитанные словари
SLOT_REGISTRY = _build_slot_registry()
SLOT_ORDER = [s["key"] for s in SLOT_REGISTRY]
SLOT_TO_IDX = {s["key"]: i for i, s in enumerate(SLOT_REGISTRY)}
IDX_TO_SLOT = {i: s["key"] for i, s in enumerate(SLOT_REGISTRY)}
SLOT_LABELS = {s["key"]: s["label"] for s in SLOT_REGISTRY}

# 🔹 АЛИАС для обратной совместимости
SLOT_LOOKUP = SLOT_LABELS  # ✅ Добавлено!