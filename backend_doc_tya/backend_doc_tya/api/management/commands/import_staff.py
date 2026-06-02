import os
from django.core.management.base import BaseCommand, CommandError
from api.models import Staff
import openpyxl


class Command(BaseCommand):
    help = 'Импорт персонала из Excel файла'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Путь к файлу .xlsx')

    def handle(self, *args, **options):
        file_path = options['file_path']
        if not os.path.exists(file_path):
            raise CommandError(f'❌ Файл не найден: {file_path}')

        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        # Пропускаем заголовок (min_row=2)
        rows = list(sheet.iter_rows(min_row=2, values_only=True))

        created = updated = errors = 0

        for row in rows:
            if not any(row):  # Пропуск пустых строк
                continue

            try:
                name, rauts_id, position, is_active_raw = row[0], row[1], row[2], row[3]

                # Безопасное преобразование в bool
                is_active = bool(int(is_active_raw)) if is_active_raw is not None else True

                obj, is_created = Staff.objects.update_or_create(
                    rauts_id=str(rauts_id),
                    defaults={
                        'name': str(name).strip(),
                        'position': str(position).strip(),
                        'is_active': is_active
                    }
                )
                if is_created:
                    created += 1
                else:
                    updated += 1
            except Exception as e:
                errors += 1
                self.stderr.write(self.style.ERROR(f'⚠️ Ошибка в строке {row}: {e}'))

        self.stdout.write(self.style.SUCCESS(
            f'✅ Импорт персонала завершен.\n'
            f'   Создано: {created} | Обновлено: {updated} | Ошибок: {errors}'
        ))