# # backend_doc_tya/api/management/commands/import_courses.py
import os
from django.core.management.base import BaseCommand, CommandError
from api.utils.import_excel import import_courses_excel

class Command(BaseCommand):
    help = 'Импорт структуры курсов из Excel (через единый utils)'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Абсолютный путь к .xlsx файлу')

    def handle(self, *args, **options):
        file_path = options['file_path']
        if not os.path.exists(file_path):
            raise CommandError(f'❌ Файл не найден: {file_path}')

        with open(file_path, 'rb') as f:
            c, u, e, errors_list = import_courses_excel(f)

        if e > 0:
            self.stderr.write(self.style.WARNING(f'⚠️ Создано: {c} | Обновлено: {u} | Ошибок: {e}'))
            for err in errors_list[:5]:
                self.stderr.write(self.style.ERROR(f'   - {err}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ Импорт завершён! Создано: {c} | Обновлено: {u}'))

