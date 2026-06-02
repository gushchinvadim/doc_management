// src/components/RaucExport/RaucExportView.jsx
import { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../api/auth';
import './RaucExportView.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const getHeaders = () => ({ 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export default function RaucExportView() {
  const [enrollments, setEnrollments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'group', direction: 'asc' });

  useEffect(() => { fetchEligible(); }, []);

  const fetchEligible = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/rauc/list/`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setEnrollments(data);
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setLoading(false); }
  };

  // 🔹 Сортировка данных (мемоизируем для производительности)
  const sortedEnrollments = useMemo(() => {
    const sorted = [...enrollments];
    const { key, direction } = sortConfig;
    
    sorted.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      
      // 🔹 Обработка null/undefined
      if (valA == null) valA = '';
      if (valB == null) valB = '';
      
      // 🔹 Числовая сортировка для группы (чтобы "10" > "2")
      if (key === 'group') {
        const numA = parseInt(valA) || 0;
        const numB = parseInt(valB) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      
      // 🔹 Сортировка строк (ФИО, даты)
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    // 🔹 Вторичная сортировка по фамилии внутри группы
    if (key === 'group') {
      sorted.sort((a, b) => {
        const nameA = (a.student_name || '').toLowerCase();
        const nameB = (b.student_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    
    return sorted;
  }, [enrollments, sortConfig]);

  // 🔹 Обработчик клика по заголовку для сортировки
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    // 🔹 Выбираем только видимые (отсортированные) записи
    const allIds = sortedEnrollments.map(e => e.id);
    setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      setMsg({ type: 'error', text: 'Выберите хотя бы одну запись' });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/rauc/generate/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ enrollment_ids: selectedIds })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка генерации');
      }
      // Скачивание файла
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RAUC_export_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg({ type: 'success', text: `✅ Экспортировано записей: ${selectedIds.length}` });
      setSelectedIds([]);
      // 🔹 Обновляем список, чтобы галочки появились сразу
      fetchEligible();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <p className="loading">Загрузка данных для экспорта...</p>;

  return (
    <div className="rauc-container">
      <div className="rauc-header">
        <h2>📑 Создать EXEL для РАУЦ</h2>
        <div className="rauc-actions">
          <button className="btn btn-outline" onClick={selectAll}>
            {selectedIds.length === sortedEnrollments.length ? 'Снять все' : 'Выбрать все'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleGenerate}
            disabled={generating || selectedIds.length === 0}
          >
            {generating ? '⏳ Генерация...' : `📥 Экспорт (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {msg.text && <div className={`msg-box msg-${msg.type}`}>{msg.text}</div>}

      <div className="table-wrapper">
        <table className="rauc-table">
          <thead>
            <tr>
              <th className="col-select">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === sortedEnrollments.length && sortedEnrollments.length > 0}
                  onChange={selectAll}
                />
              </th>
              {/* 🔹 Заголовки с сортировкой */}
              <th onClick={() => handleSort('student_name')} className="sortable">
                ФИО {sortConfig.key === 'student_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Модуль</th>
              <th onClick={() => handleSort('group')} className="sortable">
                Группа {sortConfig.key === 'group' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Оценка</th>
              <th onClick={() => handleSort('completed_at')} className="sortable">
                Завершён {sortConfig.key === 'completed_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Локация</th>
              {/* 🔹 Новая колонка: статус экспорта */}
              <th className="col-export">Сертификат создан</th>
            </tr>
          </thead>
          <tbody>
            {sortedEnrollments.length === 0 ? (
              <tr><td colSpan="8" className="empty">Нет завершённых зачислений для экспорта</td></tr>
            ) : sortedEnrollments.map(item => (
              <tr key={item.id} className={selectedIds.includes(item.id) ? 'selected' : ''}>
                <td className="col-select">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                  />
                </td>
                <td>
                  {item.student_name}<br/>
                  <small className="text-muted">СНИЛС: {item.student_snils}</small>
                </td>
                <td>{item.module_code || item.module_title}</td>
                <td><strong>{item.group}</strong></td>
                <td><span className="mark-badge">{item.total_mark}</span></td>
                <td>{item.completed_at}</td>
                <td>{item.location_name}</td>
                {/* 🔹 Галочка ✅ если есть сертификат */}
                <td className="col-export">
                  {item.has_certificate || item.cert_number ? (
                    <span className="export-badge" title={`Сертификат: ${item.cert_number || 'выписан'}`}>
                      ✅
                    </span>
                  ) : (
                    <span className="export-badge pending" title="Сертификат не выписан">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}