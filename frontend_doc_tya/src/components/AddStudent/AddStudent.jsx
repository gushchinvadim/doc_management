// src/components/AddStudent/AddStudent.jsx
import { useState } from 'react';
import { getToken } from '../../api/auth';
import './AddStudent.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// 🔹 Начальная форма с ВСЕМИ полями модели + правильные дефолты
const initialForm = {
  surname: '', 
  name: '', 
  patronymic: '', 
  sex: 'Male',
  date_of_birth: '', 
  snils: '', 
  employee_id: '',
  surname_latin: '', 
  name_latin: '', 
  email: '',
  is_active: true, 
  aircraft_type: '', 
  dcat_id: '',  // Строка для select, при отправке конвертируем в int|null
  citizenship_code: '643'  // 🔹 Новое поле с дефолтом по ОКСМ
};

export default function AddStudent() {
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // 🔹 Состояния для импорта из Excel
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // 🔹 Обработчик выбора файла
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setImportFile(file);
      setImportResult(null);
      setMsg({ type: '', text: '' });
    } else {
      setMsg({ type: 'error', text: '❌ Пожалуйста, выберите файл .xlsx или .xls' });
      setImportFile(null);
    }
  };

  // 🔹 Отправка файла на сервер
  const handleImport = async () => {
    if (!importFile) {
      setMsg({ type: 'error', text: '❌ Выберите файл для импорта' });
      return;
    }
    
    setImporting(true);
    setMsg({ type: '', text: '' });
    setImportResult(null);
    
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', importFile);
      
      const res = await fetch(`${API_URL}/students/import-excel/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка сервера');
      }
      
      setImportResult(data);
      setMsg({ 
        type: 'success', 
        text: `✅ Импорт завершён: +${data.summary.created} создано, ~${data.summary.updated} обновлено` 
      });
      
      setImportFile(null);
      document.getElementById('excel-input').value = '';
      
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  // 🔹 Сохранение одного слушателя (обновлённая логика)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const token = getToken();
      
      // 🔹 Подготовка payload: конвертация типов под модель
      const payload = {
        ...formData,
        // dcat_id: конвертируем в int или null (модель ожидает PositiveIntegerField)
        dcat_id: formData.dcat_id ? Number(formData.dcat_id) : null,
        // citizenship_code: оставляем как строку (CharField)
        citizenship_code: formData.citizenship_code || '643',
        // email: пустая строка допустима
        email: formData.email?.trim() || '',
        // aircraft_type: пустая строка → null
        aircraft_type: formData.aircraft_type || null
      };

      const res = await fetch(`${API_URL}/students/`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        const errors = typeof data === 'object' 
          ? Object.values(data).flat().join('\n') 
          : 'Ошибка сервера';
        throw new Error(errors);
      }

      setMsg({ type: 'success', text: '✅ Слушатель успешно добавлен!' });
      setFormData(initialForm);
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-student-container">
      <h2>➕ Слушатели</h2>
      
      {msg.text && <div className={`msg-box msg-${msg.type}`}>{msg.text}</div>}

      {/* 🔹 Секция импорта из Excel */}
      <section className="import-section">
        <h3>📥 Массовый импорт из Excel</h3>
        
        <div className="import-box">
          <input 
            id="excel-input"
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleFileChange}
            disabled={importing}
            className="file-input"
          />
          
          {importFile && (
            <p className="file-info">📄 Выбран: <strong>{importFile.name}</strong></p>
          )}
          
          <div className="import-actions">
            <button 
              onClick={handleImport} 
              disabled={importing || !importFile}
              className={`btn-import ${importing ? 'loading' : ''}`}
            >
              {importing ? '⏳ Обработка...' : '🚀 Загрузить и импортировать'}
            </button>
            
            <a 
              href="/templates/students_template.xlsx" 
              download
              className="btn-template"
            >
              📋 Скачать шаблон Excel
            </a>
          </div>
        </div>
        
        {/* 🔹 Результаты импорта */}
        {importResult && (
          <div className="import-result">
            <h4>📊 Результаты:</h4>
            <ul>
              <li>✅ Создано: <strong>{importResult.summary.created}</strong></li>
              <li>🔄 Обновлено: <strong>{importResult.summary.updated}</strong></li>
              <li>❌ Ошибки: <strong>{importResult.summary.errors}</strong></li>
            </ul>
            
            {importResult.error_details?.length > 0 && (
              <details>
                <summary>🔍 Подробности ошибок (первые 20)</summary>
                <ul className="error-list">
                  {importResult.error_details.map((err, idx) => (
                    <li key={idx} className="error-item">⚠️ {err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <hr className="divider" />

      {/* 🔹 Форма добавления одного слушателя */}
      <section className="single-form">
        <h3>✏️ Добавить вручную</h3>
        
        <form onSubmit={handleSubmit} className="student-form">
          <fieldset>
            <legend>👤 Основные данные</legend>
            <div className="form-grid">
              <label>Фамилия *</label>
              <input name="surname" value={formData.surname} onChange={handleChange} required />
              
              <label>Имя *</label>
              <input name="name" value={formData.name} onChange={handleChange} required />
              
              <label>Отчество</label>
              <input name="patronymic" value={formData.patronymic} onChange={handleChange} />
              
              <label>Пол *</label>
              <select name="sex" value={formData.sex} onChange={handleChange}>
                <option value="Male">Муж</option>
                <option value="Female">Жен</option>
              </select>
              
              <label>Дата рождения *</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
              
              <label>СНИЛС *</label>
              <input name="snils" value={formData.snils} onChange={handleChange} required placeholder="123-456-789 00" />
              
              <label>Табельный номер *</label>
              <input name="employee_id" value={formData.employee_id} onChange={handleChange} required />
            </div>
          </fieldset>

          <fieldset>
            <legend>✈️ Дополнительные данные</legend>
            <div className="form-grid">
              <label>Фамилия (лат.)</label>
              <input name="surname_latin" value={formData.surname_latin} onChange={handleChange} placeholder="IVANOV" />
              
              <label>Имя (лат.)</label>
              <input name="name_latin" value={formData.name_latin} onChange={handleChange} placeholder="IVAN" />
              
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="user@example.com" />
              
              {/* 🔹 Новое поле: Код гражданства ОКСМ */}
              <label>Код гражданства (ОКСМ)</label>
              <select name="citizenship_code" value={formData.citizenship_code} onChange={handleChange}>
                <option value="643">🇷🇺 Россия (643)</option>
                <option value="112">🇧🇾 Беларусь (112)</option>
                <option value="398">🇰🇿 Казахстан (398)</option>
                <option value="860">🇺🇿 Узбекистан (860)</option>
                <option value="276">🇩🇪 Германия (276)</option>
                <option value="840">🇺🇸 США (840)</option>
                <option value="826">🇬🇧 Великобритания (826)</option>
                <option value="250">🇫🇷 Франция (250)</option>
                <option value="724">🇪🇸 Испания (724)</option>
                <option value="380">🇮🇹 Италия (380)</option>
                <option value="156">🇨🇳 Китай (156)</option>
                <option value="792">🇹🇷 Турция (792)</option>
                <option value="784">🇦🇪 ОАЭ (784)</option>
              </select>
              
              <label>Тип ВС</label>
              <select name="aircraft_type" value={formData.aircraft_type} onChange={handleChange}>
                <option value="">— Не выбрано —</option>
                <option value="B737NG">B737NG</option>
                <option value="B737CL">B737CL</option>
                <option value="B737CL+B737NG">B737CL+B737NG</option>
              </select>
              
              <label>Код профессии РАУЦ</label>
              <select name="dcat_id" value={formData.dcat_id} onChange={handleChange}>
                <option value="">— Не выбрано —</option>
                <option value="1">Инженер (1)</option>
                <option value="2">Пилот (2)</option>
                <option value="3">Бортпроводник (3)</option>
              </select>

              <label className="checkbox-label">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                Активен
              </label>
            </div>
          </fieldset>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? '⏳ Сохранение...' : '💾 Сохранить слушателя'}
          </button>
        </form>
      </section>
    </div>
  );
}