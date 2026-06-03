# Doc Management System

Система управления документами и расписанием для учебного центра.

## Структура проекта/Технологии

- `backend_doc_tya/` — Django 5.x, Django REST Framework
- `frontend_doc_tya/` — React + Vite frontend
- `database/` - SQLite /PostgreSQL

## Функциональность

- 📅 Генерация и редактирование расписания учебных групп
- 👥 Управление слушателями, группами и зачислениями
- 📥 Экспорт расписания в Excel
- 🏆 Выпуск сертификатов
- 📑 Отчёты для ФИС ФРДО и РАУЦ


## Установка

### Backend
```bash
cd backend_doc_tya
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
---
```
### Frontend
```bash
cd frontend_doc_tya
yarn install
yarn dev
---
```

## 👤 Автор / Author

**Вадим Гущин / Vadim Gushchin**  
📧 [gushchinvadim@gmail.com](mailto:gushchinvadim@gmail.com)  
💻 [github.com/gushchinvadim](https://github.com/gushchinvadim)

## 📄 Лицензия / License

Этот проект распространяется под лицензией [MIT](LICENSE).