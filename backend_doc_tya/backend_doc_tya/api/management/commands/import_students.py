# api/management/commands/import_students.py
import openpyxl
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from api.models import Student


class Command(BaseCommand):
    help = 'Импорт слушателей из Excel (полная структура модели)'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str)

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
        except Exception as e:
            self.stderr.write(f"❌ Не удалось открыть файл: {e}")
            return

        ws = wb.active
        success, errors = 0, 0

        # Пропускаем заголовок (строка 1)
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            try:
                # 🔹 Явное сопоставление с 14 колонками из students.xlsx
                if len(row) < 14:
                    self.stderr.write(f"⚠️ Строка {row_idx}: Недостаточно колонок ({len(row)})")
                    errors += 1
                    continue

                # 📦 Распаковка по индексам (0-13)
                surname = row[0]
                name = row[1]
                patronymic = row[2]
                sex = row[3]
                dob_raw = row[4]
                snils = row[5]
                surname_latin = row[6]
                name_latin = row[7]
                employee_id = row[8]
                dcat_id_raw = row[9]
                citizenship_code_raw = row[10]
                email_raw = row[11]
                is_active_raw = row[12]
                aircraft_type_raw = row[13]

                # 🔹 Валидация обязательных полей
                if not snils or not surname or not name:
                    self.stderr.write(f"⚠️ Строка {row_idx}: Пропущено (нет СНИЛС, Фамилии или Имени)")
                    errors += 1
                    continue

                # 🔹 Очистка строковых полей
                surname = str(surname).strip()
                name = str(name).strip()
                patronymic = str(patronymic).strip() if patronymic else ''
                surname_latin = str(surname_latin).strip() if surname_latin else ''
                name_latin = str(name_latin).strip() if name_latin else ''
                snils = str(snils).replace(' ', '').replace('-', '')
                employee_id = str(employee_id).strip() if employee_id else None

                # 🔹 dcat_id: безопасный int + валидация по choices модели
                dcat_id = None
                if dcat_id_raw is not None and str(dcat_id_raw).strip():
                    try:
                        val = int(str(dcat_id_raw).strip())
                        if val in [1, 2, 3]:  # POSITION_CHOICE
                            dcat_id = val
                        else:
                            self.stderr.write(f"⚠️ Строка {row_idx}: dcat_id={val} вне допустимых значений (1,2,3)")
                    except ValueError:
                        self.stderr.write(f"⚠️ Строка {row_idx}: Неверный формат dcat_id '{dcat_id_raw}'")

                # 🔹 citizenship_code: default 643 по ОКСМ
                citizenship_code = str(citizenship_code_raw).strip() if citizenship_code_raw else '643'

                # 🔹 email: очистка и приведение к пустой строке если нет
                email = str(email_raw).strip() if email_raw else ''
                if email.lower() in ('nan', 'none', 'null', 'нет', ''):
                    email = ''

                # 🔹 Конвертация пола
                sex_map = {'Муж': 'Male', 'Жен': 'Female', 'М': 'Male', 'Ж': 'Female', '1': 'Male', '0': 'Female'}
                sex_clean = sex_map.get(str(sex).strip(), 'Male')

                # 🔹 Конвертация даты рождения (устойчивый парсинг)
                dob = None
                if isinstance(dob_raw, datetime):
                    dob = dob_raw.date()
                elif isinstance(dob_raw, (int, float)):
                    # Excel serial date (fallback)
                    try:
                        from openpyxl.utils import from_excel
                        dob = from_excel(dob_raw, datetime.date).date()
                    except Exception:
                        pass
                else:
                    # Попытка распарсить строку (порядок важен для неоднозначных дат)
                    for fmt in ('%m/%d/%y', '%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y'):
                        try:
                            dob = datetime.strptime(str(dob_raw).strip(), fmt).date()
                            break
                        except ValueError:
                            continue

                if not dob:
                    self.stderr.write(f"⚠️ Строка {row_idx}: Не удалось распознать дату `{dob_raw}`")
                    errors += 1
                    continue

                # 🔹 Булевы поля
                is_active = str(is_active_raw).strip() in ['1', 'True', 'true', 'Да', 'да', '1.0', True]

                # 🔹 Тип ВС
                valid_ac = ['B737NG', 'B737CL', 'B737CL+B737NG', 'A320', 'A321']
                ac_type = str(aircraft_type_raw).strip() if aircraft_type_raw and str(
                    aircraft_type_raw).strip() in valid_ac else None

                # 🔹 Создание или обновление по уникальному СНИЛС
                student, created = Student.objects.update_or_create(
                    snils=snils,
                    defaults={
                        'surname': surname,
                        'name': name,
                        'patronymic': patronymic,
                        'sex': sex_clean,
                        'date_of_birth': dob,
                        'employee_id': employee_id,
                        'is_active': is_active,
                        'aircraft_type': ac_type,
                        'surname_latin': surname_latin,
                        'name_latin': name_latin,
                        'citizenship_code': citizenship_code,
                        'dcat_id': dcat_id,
                        'email': email,
                    }
                )
                status = "✅ Создан" if created else "🔄 Обновлён"
                self.stdout.write(f"{status}: {surname} {name} {patronymic} (СНИЛС: {snils})")
                success += 1

            except IntegrityError as e:
                self.stderr.write(f"❌ Ошибка уникальности в строке {row_idx}: {e}")
                errors += 1
            except Exception as e:
                self.stderr.write(f"❌ Критическая ошибка в строке {row_idx}: {e}")
                errors += 1

        self.stdout.write(self.style.SUCCESS(f'\n📊 Итог: ✅ {success} обработано, ❌ {errors} ошибок'))