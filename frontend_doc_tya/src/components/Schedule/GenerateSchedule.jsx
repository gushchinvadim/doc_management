import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';
import {
  createScheduleDraft, getScheduleByEnrollment, exportScheduleExcel
} from '../../api/schedule';
import ScheduleEditor from './ScheduleEditor';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function GenerateSchedule({ onBack }) {
  const [modules, setModules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selMod, setSelMod] = useState('');
  const [selEnr, setSelEnr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Состояние редактора
  const [editorScheduleId, setEditorScheduleId] = useState(null);
  const [editorEnrollmentId, setEditorEnrollmentId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/modules/`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => setModules(Array.isArray(d) ? d : d.results || []));
  }, []);

  useEffect(() => {
    if (!selMod) { setEnrollments([]); return; }
    fetch(`${API_URL}/enrollments/?module_id=${selMod}&status=enrolled`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(d => setEnrollments(Array.isArray(d) ? d : d.results || []));
  }, [selMod]);

  // Открытие/создание черновика
  const handleOpenEditor = async () => {
    if (!selEnr) return setError('Выберите группу');
    setLoading(true);
    setError('');

    try {
      // Сначала пробуем найти существующее расписание
      let schedule = await getScheduleByEnrollment(selEnr);

      if (!schedule) {
        // Создаём новый черновик
        schedule = await createScheduleDraft(parseInt(selEnr));
      }

      setEditorScheduleId(schedule.id);
      setEditorEnrollmentId(selEnr);
    } catch (err) {
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Экспорт в Excel
  const handleExport = async () => {
    if (!selEnr) return setError('Выберите группу');
    setLoading(true);
    setError('');
    try {
      const blob = await exportScheduleExcel(selEnr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_${selMod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Если открыт редактор — показываем его
  if (editorScheduleId) {
    return (
      <ScheduleEditor
        scheduleId={editorScheduleId}
        enrollmentId={editorEnrollmentId}
        onBack={() => {
          setEditorScheduleId(null);
          setEditorEnrollmentId(null);
        }}
      />
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onBack} style={{ marginBottom: 10 }}>← Назад</button>
      <h2>📅 Расписание</h2>

      <div style={{
        display: 'flex', gap: 10, marginBottom: 15,
        flexWrap: 'wrap', alignItems: 'center'
      }}>
        <select
          value={selMod}
          onChange={e => { setSelMod(e.target.value); setSelEnr(''); }}
          className="form-select"
          style={{ minWidth: 250 }}
        >
          <option value="">Выберите модуль</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.code} - {m.title}</option>
          ))}
        </select>

        <select
          value={selEnr}
          onChange={e => setSelEnr(e.target.value)}
          className="form-select"
          disabled={!selMod}
          style={{ minWidth: 200 }}
        >
          <option value="">Выберите группу</option>
          {enrollments.map(e => (
            <option key={e.id} value={e.id}>{e.group}</option>
          ))}
        </select>

        <button
          onClick={handleOpenEditor}
          disabled={loading || !selEnr}
          className="btn-primary"
        >
          {loading ? '⏳ Загрузка...' : '✏️ Открыть редактор'}
        </button>

        <button
          onClick={handleExport}
          disabled={loading || !selEnr}
          className="btn-info"
        >
          📥 Скачать Excel
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{
        background: '#e7f3ff', padding: 15, borderRadius: 8,
        border: '1px solid #b3d9ff', marginTop: 10
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>ℹ️ Как это работает</h4>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Выберите модуль и группу</li>
          <li>Нажмите <b>«Открыть редактор»</b> — создастся черновик расписания</li>
          <li>Заполните даты, инструкторов, места проведения</li>
          <li>Используйте <b>«Автозаполнить даты»</b> для быстрой расстановки</li>
          <li>Нажмите <b>«Сохранить»</b> для сохранения изменений</li>
          <li>Нажмите <b>«Утвердить»</b> для фиксации расписания</li>
          <li>Экспортируйте в Excel в любой момент</li>
        </ol>
      </div>
    </div>
  );
}