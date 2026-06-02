// src/components/Journal/JournalForm.jsx
import React from 'react';
import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';
import './JournalForm.css';

export default function JournalForm({ enrollmentId, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({});
  const [currentStatus, setCurrentStatus] = useState('');
  const [completedAt, setCompletedAt] = useState('');

  // 🔹 Загрузка структуры модуля
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/journals/${enrollmentId}/structure/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        
        setData(json);
        setCurrentStatus(json.status);
        setCompletedAt(json.completed_at || '');

        // 🔹 Инициализируем результаты разделов
        const initial = {};
        json.sections.forEach(sec => {
          const existing = json.existing_results[sec.id] || {};
          initial[sec.id] = {
            section: sec.id,
            hours_completed: existing.hours_completed ?? (sec.duration_hours || 0),
            grade: existing.grade ?? null,
            is_passed: existing.is_passed ?? null,
            completed_at: existing.completed_at ?? null,
            ngroup: json.journal_number
          };
        });
        setResults(initial);
      } catch (err) {
        console.error('Journal load error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (enrollmentId) fetchData();
  }, [enrollmentId]);

  // 🔹 Вспомогательная функция: получить итоговую оценку из таблицы
  const getFinalModuleGrade = () => {
    const finalSection = data.sections?.find(sec => 
      sec.title.toLowerCase().includes('итоговая оценка')
    );
    if (!finalSection) return null;
    const val = results[finalSection.id]?.grade;
    return val !== undefined && val !== null ? parseFloat(val) : null;
  };

  // 🔹 ЛОКАЛЬНОЕ изменение статуса (БЕЗ отправки на сервер)
  const handleStatusChange = (newStatus) => {
    setCurrentStatus(newStatus);
    if (newStatus === 'completed') {
      if (!completedAt) {
        setCompletedAt(new Date().toISOString().split('T')[0]);
      }
    } else {
      setCompletedAt('');
    }
  };

  // 🔹 Сохранение всего: разделов + статуса/даты/оценки модуля
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();

      // 1. Сохраняем результаты по разделам
      const resultsRes = await fetch('/api/journals/results/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          results: Object.values(results)
        })
      });
      if (!resultsRes.ok) {
        const errData = await resultsRes.json();
        throw new Error(errData.message || 'Ошибка сохранения разделов');
      }

      // 2. Сохраняем статус, дату и итоговую оценку модуля
      const finalGrade = getFinalModuleGrade();
      const enrollmentBody = { status: currentStatus };

      if (currentStatus === 'completed') {
        enrollmentBody.completed_at = completedAt || new Date().toISOString().split('T')[0];
        if (finalGrade !== null) {
          enrollmentBody.total_mark = Math.round(finalGrade);
        }
      } else {
        enrollmentBody.completed_at = null;
        enrollmentBody.total_mark = null;
      }

      const enrollRes = await fetch(`/api/enrollments/${enrollmentId}/update/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(enrollmentBody)
      });
      if (!enrollRes.ok) {
        const errData = await enrollRes.json();
        throw new Error(errData.status?.[0] || errData.total_mark?.[0] || 'Ошибка сохранения статуса');
      }

      alert('✅ Журнал и статус успешно сохранены');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Ошибка сохранения: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Универсальный обработчик изменений полей разделов
  const handleChange = (sectionId, field, value) => {
    setResults(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [field]: value
      }
    }));
  };

  // 🔹 Рендер поля оценки
  const renderGradeInput = (section, value) => {
    switch (section.grade_type) {
      case 'numeric':
        return (
          <input
            type="number"
            step="0.01"
            min={section.min_score || 0}
            max="5"
            value={value.grade ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(section.id, 'grade', val === '' ? null : parseFloat(val));
            }}
            placeholder={`≥${section.min_score || 0}`}
            className="journal-input"
          />
        );
      case 'binary':
        return (
          <select
            value={value.is_passed === null ? '' : value.is_passed}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(section.id, 'is_passed', val === '' ? null : val === 'true');
            }}
            className="journal-select"
          >
            <option value="">—</option>
            <option value="true">✅ Зачтено</option>
            <option value="false">❌ Не зачтено</option>
          </select>
        );
      default:
        return <span className="journal-dash">—</span>;
    }
  };

  if (loading) return <div className="journal-loading">Загрузка журнала...</div>;
  if (!data) return <div className="journal-error">Не удалось загрузить данные</div>;

  // 🔹 Группировка разделов по этапам
  const sectionsByStage = data.sections.reduce((acc, sec) => {
    const key = `${sec.stage_order}-${sec.stage_title}`;
    if (!acc[key]) acc[key] = { title: sec.stage_title, order: sec.stage_order, sections: [] };
    acc[key].sections.push(sec);
    return acc;
  }, {});

  const studentName = data.student_name || (data.student ? `${data.student.surname || ''} ${data.student.name || ''}`.trim() : '—');

  return (
    <div className="journal-form">
      <div className="journal-header">
        <h3>📖 Журнал оценок</h3>
        <div className="journal-meta">
          <p><strong>Слушатель:</strong> {studentName}</p>
          <p><strong>Модуль:</strong> {data.module_code} — {data.module_title}</p>
          <p><strong>№ журнала:</strong> {data.journal_number}</p>
          {completedAt && <p><strong>Завершён:</strong> {new Date(completedAt).toLocaleDateString('ru-RU')}</p>}
        </div>
      </div>

      <table className="journal-table">
        <thead>
          <tr>
            <th>Раздел</th>
            <th>Часы (план/факт)</th>
            <th>Оценка</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(sectionsByStage).map(stage => (
            <React.Fragment key={stage.order}>
              <tr className="stage-row">
                <td colSpan="4" className="stage-title">
                  <strong>{stage.title}</strong>
                </td>
              </tr>
              {stage.sections.map(sec => {
                const val = results[sec.id] || {};
                return (
                  <tr key={sec.id} className="row">
                    <td className="td">
                      {sec.order}. {sec.title}
                      {sec.grade_type === 'binary' && <span className="journal-badge">бинар</span>}
                    </td>
                    <td className="td">
                      {sec.duration_hours || '—'} /{' '}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={val.hours_completed ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleChange(sec.id, 'hours_completed', v === '' ? 0 : parseFloat(v));
                        }}
                        className="journal-input-small"
                        disabled={saving}
                      />
                    </td>
                    <td className="td">
                      {renderGradeInput(sec, val)}
                    </td>
                    <td className="td">
                      <input
                        type="date"
                        value={val.completed_at || ''}
                        onChange={(e) => handleChange(sec.id, 'completed_at', e.target.value === '' ? null : e.target.value)}
                        className="journal-input-small"
                        disabled={saving}
                      />
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* 🔹 Управление статусом и датой */}
      <div className="journal-actions">
        <div className="status-control">
          <label className="status-label">Статус зачисления:</label>
          <select 
            value={currentStatus} 
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`status-select status-${currentStatus}`}
            disabled={saving}
          >
            <option value="enrolled">Зачислен</option>
            <option value="in_progress">В процессе</option>
            <option value="completed">Завершен</option>
            <option value="failed">Не завершен</option>
          </select>
          
          {currentStatus === 'completed' && (
            <div className="completed-at-control">
              <label className="date-label">Дата:</label>
              <input
                type="date"
                value={completedAt || ''}
                onChange={(e) => setCompletedAt(e.target.value || null)}
                className="journal-input-small"
                disabled={saving}
              />
            </div>
          )}
        </div>
      </div>

      <div className="journal-footer">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="journal-btn-save"
        >
          {saving ? '⏳ Сохранение...' : '💾 Сохранить журнал'}
        </button>
      </div>
    </div>
  );
}