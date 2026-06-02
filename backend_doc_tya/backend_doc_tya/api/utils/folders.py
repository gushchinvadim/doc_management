# api/utils/folders.py
import os
from django.conf import settings


def ensure_group_folder(group_code):
    """Создаёт папку media/groups/{group_code}/, если её нет"""
    # Безопасность: убираем опасные символы
    safe_code = str(group_code).strip().replace('/', '_').replace('\\', '_')
    if not safe_code:
        raise ValueError("Код группы не может быть пустым")

    # Полный путь
    folder_path = os.path.join(settings.MEDIA_ROOT, 'groups', safe_code)

    # Создаём (exist_ok=True — не ошибка, если уже есть)
    os.makedirs(folder_path, exist_ok=True)

    return folder_path