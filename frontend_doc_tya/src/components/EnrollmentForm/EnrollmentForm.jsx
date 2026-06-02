// src/components/EnrollmentForm/EnrollmentForm.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { getModules, searchStudents, createEnrollment } from '../../api/enrollment';
import { useAuth } from '../../hooks/useAuth';
import { getToken } from '../../api/auth';
import './EnrollmentForm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function EnrollmentForm({ onSuccess }) {
  const { user } = useAuth();
  
  // 🔹 Состояния формы (ручное создание)
  const [formData, setFormData] = useState({
    application: '',
    group: '',
    module_id: '',
    enrolled_at: '',
    start_sdo: '', 
    start_face_to_face: '',
    completed_at: '',
    location: 'KJA',

  });

  // 🔹 Поиск и выбор слушателей
  const [studentInput, setStudentInput] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 🔹 Состояния импорта из Excel
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  
  // 🔹 Общие состояния
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const searchTimeout = useRef(null);
  const wrapperRef = useRef(null);

  // ─── Загрузка модулей ─────────────────────────────────────
  useEffect(() => {
    getModules()
      .then(data => {
        const modulesList = Array.isArray(data) ? data : data.results || [];
        setModules(modulesList);
      })
      .catch(err => {
        console.error('[Modules] Error:', err);
        setMsg({ type: 'error', text: 'Ошибка загрузки модулей' });
      });
  }, []);

  // ─── Закрытие дропдауна при клике вне ─────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Поиск слушателей (debounce) ──────────────────────────
// 🔹 Обновлённая функция поиска (универсальная)
// 🔹 Обновлённая функция поиска (рабочая версия)
const handleStudentInput = useCallback((val) => {
  setStudentInput(val);
  setStudents([]);
  setShowDropdown(false);
  
  if (val.trim().length >= 2) {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const token = getToken();
        
        // ✅ Правильный эндпоинт (подтверждён тестом)
        const url = `${API_URL}/students/search/?q=${encodeURIComponent(val)}`;
        console.log('[Search] Request URL:', url); // 🔹 Дебаг
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[Search] Response status:', res.status); // 🔹 Дебаг
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        console.log('[Search] Raw response:', data); // 🔹 Дебаг: увидим формат
        
        // 🔹 Нормализация: поддерживаем разные форматы ответа
        let results = [];
        if (Array.isArray(data)) {
          results = data;
        } else if (data?.results && Array.isArray(data.results)) {
          results = data.results;  // DRF пагинация
        } else if (data?.data && Array.isArray(data.data)) {
          results = data.data;     // Кастомный формат
        }
        
        console.log('[Search] Parsed results:', results); // 🔹 Дебаг
        
        // 🔹 Исключаем уже выбранных
        const filtered = results.filter(s => 
          !selectedStudents.some(sel => sel.id === s.id)
        );
        
        setStudents(filtered);
        setShowDropdown(filtered.length > 0);
        
      } catch (err) {
        console.error('[Student Search] Error:', err);
        setMsg({ type: 'error', text: 'Ошибка поиска слушателей' });
      }
    }, 300);
  }
}, [selectedStudents]);

  // ─── Добавление/удаление слушателя из группы ──────────────
  const addStudentToGroup = (student) => {
    if (!selectedStudents.some(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, student]);
    }
    setStudentInput('');
    setStudents([]);
    setShowDropdown(false);
  };

  const removeStudentFromGroup = (studentId) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  // ─── Изменение полей формы ────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (['number_in_group'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ─── 🔹 Импорт из Excel: предпросмотр ─────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setImportFile(file);
      setImportPreview(null);
      setMsg({ type: '', text: '' });
    } else {
      setMsg({ type: 'error', text: '❌ Пожалуйста, выберите файл .xlsx или .xls' });
      setImportFile(null);
    }
  };

  const handlePreview = async () => {
    if (!importFile) {
      setMsg({ type: 'error', text: '❌ Выберите файл для импорта' });
      return;
    }
    
    setImporting(true);
    setMsg({ type: '', text: '' });
    
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', 'preview');
      
      const res = await fetch(`${API_URL}/enrollments/import-excel/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      
      setImportPreview(data);
      setMsg({ 
        type: 'success', 
        text: `✅ Файл проверен: ${data.valid_count} валидных записей` 
      });
      
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  const handleCommit = async () => {
    if (!importPreview) return;
    
    setImporting(true);
    setMsg({ type: '', text: '' });
    
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', 'commit');
      
      const res = await fetch(`${API_URL}/enrollments/import-excel/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      
      setMsg({ 
        type: 'success', 
        text: `✅ Импорт завершён: +${data.created} зачислено` 
      });
      
      // Сброс
      setImportFile(null);
      setImportPreview(null);
      document.getElementById('enroll-excel-input').value = '';
      
      // В handleCommit, вместо onSuccess({ stay: true }):
      if (onSuccess) {
        // Вызываем onSuccess, но предотвращаем редирект через 100мс
        setTimeout(() => {
          // Если после onSuccess страница начала уходить — отменяем
          if (window.location.pathname !== '/enrollments') {
            window.history.pushState({}, '', window.location.href);
          }
        }, 100);
        onSuccess();
      }
      
    } catch (err) {
      setMsg({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  // ─── 🔹 Ручное создание группы ────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    // Валидация
    if (selectedStudents.length === 0) return setMsg({ type: 'error', text: 'Добавьте хотя бы одного слушателя' });
    if (!formData.group) return setMsg({ type: 'error', text: 'Укажите номер группы' });
    if (!formData.module_id) return setMsg({ type: 'error', text: 'Выберите модуль' });
    if (!formData.start_face_to_face) return setMsg({ type: 'error', text: 'Укажите дату начала очных занятий' });
    if (!formData.enrolled_at) return setMsg({ type: 'error', text: 'Укажите дату зачисления' });

    setLoading(true);
    
    try {
      const moduleId = parseInt(String(formData.module_id).trim(), 10);
      if (!moduleId) throw new Error('Не удалось преобразовать ID модуля');

      // Создаём зачисление для каждого слушателя
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        const payload = {
          application: String(formData.application).trim() || `GRP-${formData.group}-${i + 1}`,
          student: student.id,
          module: moduleId,
          group: String(formData.group).trim(),
          number_in_group: i + 1,
          enrolled_at: formData.enrolled_at,
          start_sdo: formData.start_sdo || null,
          start_face_to_face: formData.start_face_to_face,
          completed_at: formData.completed_at || null,
          location: formData.location,

          enrolled_by: user?.id
        };

        await createEnrollment(payload);
      }

      setMsg({ 
        type: 'success', 
        text: `✅ Группа "${formData.group}" создана! Зачислено: ${selectedStudents.length}` 
      });
      
      // Сброс формы
      setFormData({
        application: '', group: '', module_id: '',
        start_face_to_face: '', completed_at: '', enrolled_at: '', start_sdo: '', 
        location: 'KJA'
      });
      setSelectedStudents([]);
      setStudentInput('');
      
      if (onSuccess) onSuccess();
      
    } catch (err) {
      console.error('[Enrollment] Error:', err);
      setMsg({ type: 'error', text: err.message || 'Ошибка сохранения группы' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Рендер ───────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="add-student-container">
      <h2>👥 Создание группы обучения</h2>
      
      {msg.text && <div className={`msg-box msg-${msg.type}`}>{msg.text}</div>}

      {/* 🔹 Секция импорта из Excel */}
      <section className="import-section">
        <h3>📥 Массовое зачисление из Excel</h3>
        
        <div className="import-box">
          <input 
            id="enroll-excel-input"
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
              type="button" 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePreview(); }}
              disabled={importing || !importFile}
              className={`btn-import ${importing ? 'loading' : ''}`}
            >
              {importing ? '⏳ Обработка...' : '🚀 Загрузить и импортировать'}
            </button>
            
            {importPreview && (
              <button 
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCommit(); }}
                disabled={importing || importPreview.valid_count === 0}
                className="btn-commit"
              >
                💾 Зачислить ({importPreview.valid_count})
              </button>
            )}
            
            <a 
              href="/templates/enrollments_template.xlsx" 
              download
              className="btn-template"
            >
              📋 Скачать шаблон Excel
            </a>
          </div>
        </div>
        
        {/* Результаты предпросмотра */}
        {importPreview && (
          <div className="import-result">
            <h4>📊 Результаты проверки:</h4>
            <ul>
              <li>✅ Валидных: <strong>{importPreview.valid_count}</strong></li>
              <li>❌ Ошибок: <strong>{importPreview.results?.filter(r => r.status === 'error').length || 0}</strong></li>
            </ul>
            
            {importPreview.results?.slice(0, 10).map(r => (
              <div key={r.row} className={`preview-row ${r.status}`}>
                {r.status === 'error' 
                  ? `❌ Строка ${r.row}: ${r.error}` 
                  : `✅ ${r.student || 'Запись'}`}
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="divider" />

      {/* 🔹 Форма ручного создания */}
      <section className="single-form">
        <h3>✏️ Создать вручную</h3>
        
        <form onSubmit={handleSubmit} className="student-form">
          {/* Группа: номер, заявка, локация */}
          <fieldset>
            <legend>📋 Данные группы</legend>
            <div className="form-grid">
              <label>Номер группы *</label>
              <input
                type="text"
                name="group"
                value={formData.group}
                onChange={handleChange}
                required
                placeholder="Например: 001.2026"
              />
              
              <label>Номер заявки</label>
              <input
                type="text"
                name="application"
                value={formData.application}
                onChange={handleChange}
                placeholder="Например: СЗ/3-123"
              />
              
              <label>Локация *</label>
              <select name="location" value={formData.location} onChange={handleChange}>
                <option value="KJA">Красноярск</option>
                <option value="DME">Домодедово</option>
              </select>
            </div>
          </fieldset>

          {/* 🔹 Выбор слушателей */}
          <fieldset>
            <legend>👥 Слушатели в группе</legend>
            <div className="form-grid">
              <div className="search-container" style={{ gridColumn: '1 / -1' }}>
                <label>Добавить слушателя *</label>
                <input
                  type="text"
                  value={studentInput}
                  onChange={(e) => handleStudentInput(e.target.value)}
                  placeholder="Введите фамилию (мин. 2 символа)..."
                />
                {showDropdown && students.length > 0 && (
                  <ul className="search-dropdown">
                    {students.map(s => (
                      <li
                        key={s.id}
                        onClick={() => addStudentToGroup(s)}
                        className="search-dropdown-item"
                      >
                        {s.display_name} (таб. {s.employee_id})
                      </li>
                    ))}
                  </ul>
                )}
                
                {/* Чипсы выбранных */}
                <div className="selected-students">
                  {selectedStudents.length > 0 ? (
                    selectedStudents.map(s => (
                      <span key={s.id} className="student-chip">
                        {s.display_name}
                        <button
                          type="button"
                          className="remove-chip"
                          onClick={() => removeStudentFromGroup(s.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="empty-selection">Слушатели не добавлены</span>
                  )}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Модуль и даты */}
          <fieldset>
            <legend>📅 Модуль и сроки</legend>
            <div className="form-grid">
              <label>Модуль *</label>
              <select name="module_id" value={formData.module_id} onChange={handleChange} required className="form-select">
                <option value="">-- Выберите модуль --</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title}
                  </option>
                ))}
              </select>
              
              <label>Дата зачисления *</label>
              <input type="date" name="enrolled_at" value={formData.enrolled_at} onChange={handleChange} required />

              {/* 👇 НОВОЕ ПОЛЕ: Начало занятий в СДО */}
              <label>Начало в СДО</label>
              <input 
                type="date" 
                name="start_sdo" 
                value={formData.start_sdo} 
                onChange={handleChange}
                placeholder="Опционально"
              />
              
              <label>Начало очных занятий *</label>
              <input type="date" name="start_face_to_face" value={formData.start_face_to_face} onChange={handleChange} required />
              

              
              <label>Завершение (опционально)</label>
              <input type="date" name="completed_at" value={formData.completed_at} onChange={handleChange} />
            </div>
          </fieldset>

          {/* Футер */}
          <div className="form-footer">
            <span className="form-footer-info">
              Создал: <strong>{user?.name || user?.username}</strong> | 
              Слушателей: <strong>{selectedStudents.length}</strong>
            </span>
            <button
              type="submit"
              disabled={loading || selectedStudents.length === 0}
              className="btn-submit"
            >
              {loading ? '⏳ Создание...' : `📥 Создать группу (${selectedStudents.length})`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}