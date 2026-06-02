// src/components/Schedule/ScheduleEditor.jsx
import React, { useState, useEffect } from 'react';
import {
  getSchedule, updateScheduleItems, finalizeSchedule,
  resetToDraft, getStaffList, exportScheduleExcel,
  updateScheduleMeta  // 🔹 ДОБАВЛЕНО
} from '../../api/schedule';

const STATUS_LABELS = {
  draft: '📝 Черновик',
  active: '✅ Активно',
  finalized: '🔒 Зафиксировано',
  archived: '📦 Архив'
};

const STATUS_COLORS = {
  draft: '#f0ad4e',
  active: '#5cb85c',
  finalized: '#5bc0de',
  archived: '#777'
};

// 🔹 Константы для пересчета времени на фронте
const LESSON_MIN = 45;
const BREAK_MIN = 5;
const BIG_BREAK = 40;

const PATTERNS = {
  'base-1': { count: 1 },
  'base-2': { count: 2 },
  'base-3': { count: 3 },
  'base-4': { count: 4 },
  'base-5': { count: 5, big_break_after: 4 },  // 🔹 После 4-го часа (перед 5-м)
  'base-6': { count: 6, big_break_after: 4 },  // 🔹 После 4-го часа (перед 5-м)
  'base-7': { count: 7, big_break_after: 4 },  // 🔹 После 4-го часа (перед 5-м)
  'base-8': { count: 8, big_break_after: 4 },  // 🔹 После 4-го часа (перед 5-м)
  'base-9': { count: 9, big_break_after: 4 },  // 🔹 После 4-го часа (перед 5-м)
};

const fmt = (minutes) => {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

// 🔹 Функция пересчета расписания на фронте
const getScheduleTimes = (detailCode, startTime = '09:00') => {
  if (detailCode === 'sdo') return 'СДО';
  if (detailCode === 'sim') return '1 час - брифинг (лекция)\n4 часа - тренажерная подготовка\n1 час - дебрифинг (лекция)';

  const cfg = PATTERNS[detailCode];
  if (!cfg) return '';

  const [h, m] = startTime.split(':').map(Number);
  let current = h * 60 + m;
  const slots = [];

  for (let i = 1; i <= cfg.count; i++) {
    const end = current + LESSON_MIN;
    slots.push(`${i} час - ${fmt(current)} - ${fmt(end)}`);
    current = end;

    if (i < cfg.count) {
      // 🔹 Большой перерыв после 4-го часа (перед 5-м)
      if (cfg.big_break_after && i === cfg.big_break_after) {
        slots.push(`Большой перерыв - ${BIG_BREAK} мин`);
        current += BIG_BREAK;
      } else {
        slots.push(`Перерыв - ${BREAK_MIN} мин`);
        current += BREAK_MIN;
      }
    }
  }

  return slots.join('\n');
};

export default function ScheduleEditor({ scheduleId, enrollmentId, onBack }) {
  const [schedule, setSchedule] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editedItems, setEditedItems] = useState({});
  const [startDate, setStartDate] = useState('');
  const [curatorId, setCuratorId] = useState(null);
  const [directorId, setDirectorId] = useState(null);

  useEffect(() => {
    loadData();
  }, [scheduleId]);

    const loadData = async () => {
    setLoading(true);
    setError('');
    try {
        const [sched, staffList] = await Promise.all([
        getSchedule(scheduleId),
        getStaffList()
        ]);
        setSchedule(sched);
        setStaff(staffList);
        if (sched.items?.[0]?.date) {
        setStartDate(sched.items[0].date);
        }
        // 🔹 Устанавливаем куратора и директора
        setCuratorId(sched.curator || null);
        setDirectorId(sched.director || null);
    } catch (err) {
        setError(`❌ ${err.message}`);
    } finally {
        setLoading(false);
    }
    };

  const handleFieldChange = (itemId, field, value) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value }
    }));
  };

  const getItemValue = (item, field) => {
    if (editedItems[item.id]?.[field] !== undefined) {
      return editedItems[item.id][field];
    }
    return item[field];
  };

  const getItemStartTime = (item) => {
    return getItemValue(item, 'start_time') || '09:00';
  };

  const getItemEffectiveDetail = (item) => {
    return getItemValue(item, 'override_detail') || item.effective_detail;
  };

  const getItemTimeString = (item) => {
    const startTime = getItemStartTime(item);
    const detailCode = getItemEffectiveDetail(item);
    return getScheduleTimes(detailCode, startTime);
  };

    const handleSave = async () => {
    const itemsToUpdate = Object.entries(editedItems).map(([id, changes]) => ({
        id: parseInt(id),
        ...changes
    }));

    const hasCuratorDirectorChanges = 
        curatorId !== (schedule.curator || null) || 
        directorId !== (schedule.director || null);

    if (itemsToUpdate.length === 0 && !hasCuratorDirectorChanges) {
        setSuccess('Нет изменений для сохранения');
        setTimeout(() => setSuccess(''), 2000);
        return;
    }

    setSaving(true);
    setError('');
    try {
        // 🔹 1. Сохраняем куратора и директора (если изменились)
        if (hasCuratorDirectorChanges) {
        const updated = await updateScheduleMeta(scheduleId, {
            curator: curatorId,
            director: directorId
        });
        setSchedule(updated);
        setCuratorId(updated.curator || null);
        setDirectorId(updated.director || null);
        }

        // 🔹 2. Сохраняем элементы расписания (если есть изменения)
        if (itemsToUpdate.length > 0) {
        const updated = await updateScheduleItems(scheduleId, itemsToUpdate);
        setSchedule(updated);
        setCuratorId(updated.curator || null);
        setDirectorId(updated.director || null);
        }

        setEditedItems({});
        setSuccess('✅ Сохранено');
        setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
        setError(`❌ ${err.message}`);
    } finally {
        setSaving(false);
    }
    };

  const handleAutoFillDates = () => {
    if (!startDate) {
      setError('Укажите дату начала');
      return;
    }

    const items = schedule.items || [];
    const updates = {};
    let currentDate = new Date(startDate);

    items.forEach(item => {
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      updates[item.id] = {
        ...(updates[item.id] || {}),
        date: currentDate.toISOString().split('T')[0]
      };

      currentDate.setDate(currentDate.getDate() + 1);
    });

    setEditedItems(prev => {
      const merged = { ...prev };
      Object.entries(updates).forEach(([id, changes]) => {
        merged[id] = { ...(merged[id] || {}), ...changes };
      });
      return merged;
    });
  };

  const handleFinalize = async () => {
    if (!window.confirm('Утвердить расписание? После этого редактирование будет заблокировано.')) return;
    try {
      const updated = await finalizeSchedule(scheduleId);
      setSchedule(updated);
      setEditedItems({});
      setSuccess('✅ Расписание утверждено');
    } catch (err) {
      setError(`❌ ${err.message}`);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportScheduleExcel(enrollmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_${schedule.module_code}_${schedule.group_name}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`❌ ${err.message}`);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Вернуть расписание в черновик?')) return;
    try {
      const updated = await resetToDraft(scheduleId);
      setSchedule(updated);
    } catch (err) {
      setError(`❌ ${err.message}`);
    }
  };

  if (loading) return <div className="loading">Загрузка расписания...</div>;
  if (!schedule) return <div>Расписание не найдено</div>;

  const isFinalized = schedule.status === 'finalized';
// 🔹 Проверяем изменения: items + куратор + директор
  const hasChanges = Object.keys(editedItems).length > 0 
  || curatorId !== (schedule.curator || null)
  || directorId !== (schedule.director || null);

  const groupedItems = {};
  (schedule.items || []).sort((a, b) => a.order - b.order).forEach(item => {
    const stageId = item.stage;
    if (!groupedItems[stageId]) {
      groupedItems[stageId] = {
        title: item.stage_title,
        order: item.stage__order || 0,
        items: []
      };
    }
    groupedItems[stageId].items.push(item);
  });

  const sortedStages = Object.entries(groupedItems).sort(
    ([, a], [, b]) => a.order - b.order
  );



  return (
    <div style={{ padding: 20 }}>
      <button onClick={onBack} style={{ marginBottom: 10 }}>← Назад</button>

      <div style={{
        background: '#f8f9fa', padding: 15, borderRadius: 8,
        marginBottom: 20, border: '1px solid #dee2e6'
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          📅 {schedule.module_code} — {schedule.module_title}
        </h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.95em' }}>
          <span><b>Группа:</b> {schedule.group_name}</span>
          <span>
            <b>Статус:</b>{' '}
            <span style={{
              background: STATUS_COLORS[schedule.status],
              color: '#fff', padding: '2px 8px', borderRadius: 4
            }}>
              {STATUS_LABELS[schedule.status]}
            </span>
          </span>
          <span><b>Версия:</b> {schedule.version}</span>
          {schedule.curator_name && <span><b>Куратор:</b> {schedule.curator_name}</span>}
        </div>
      </div>
    <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid #dee2e6' }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95em' }}>
          <b>👤 Куратор:</b>
          <select
            value={curatorId || ''}
            onChange={e => setCuratorId(e.target.value ? parseInt(e.target.value) : null)}
            style={inputStyle}
          >
            <option value="">— не назначен —</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name || s.name}</option>
            ))}
          </select>
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em' }}>
          <b>✅ Утверждающий (Директор):</b>
          <select
            value={directorId || ''}
            onChange={e => setDirectorId(e.target.value ? parseInt(e.target.value) : null)}
            style={inputStyle}
          >
            <option value="">— не назначен —</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name || s.name}</option>
            ))}
          </select>
        </label>
        
      </div>
    </div>
      <div style={{
        display: 'flex', gap: 10, marginBottom: 15,
        flexWrap: 'wrap', alignItems: 'center'
      }}>
        {!isFinalized && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95em'  }}>
              Дата начала:
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="form-control"
                style={{ width: 'auto' }}
              />
            </label>
            <button onClick={handleAutoFillDates} className="btn-secondary">
              📅 Автозаполнить даты
            </button>
                <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="btn-primary"
                >
                {saving 
                    ? '💾 Сохранение...' 
                    : `💾 Сохранить${hasChanges ? ` (${
                        Object.keys(editedItems).length + 
                        (curatorId !== (schedule.curator || null) ? 1 : 0) + 
                        (directorId !== (schedule.director || null) ? 1 : 0)
                    })` : ''}`
                }
                </button>
            <button onClick={handleFinalize} className="btn-success">
              🔒 Утвердить
            </button>
          </>
        )}
        {isFinalized && (
          <button onClick={handleReset} className="btn-warning">
            ↩️ Вернуть в черновик
          </button>
        )}
        <button onClick={handleExport} className="btn-info">
          📥 Excel
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: 10 }}>{success}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: '#fff', fontSize: '0.9em'
        }}>
          <thead>
            <tr style={{ background: '#343a40', color: '#fff' }}>
              <th style={thStyle}>№</th>
              <th style={thStyle}>Дата</th>
              <th style={thStyle}>Время</th>
              <th style={thStyle}>Раздел</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Расписание</th>
              <th style={thStyle}>Инструктор</th>
              <th style={thStyle}>Место</th>
              <th style={thStyle}>🔒</th>
            </tr>
          </thead>
          <tbody>
            {sortedStages.map(([stageId, stage]) => (
              <React.Fragment key={stageId}>
                <tr style={{ background: '#e2efda' }}>
                  <td colSpan={8} style={{
                    padding: 8, fontWeight: 'bold',
                    border: '1px solid #ccc'
                  }}>
                    📚 {stage.title}
                  </td>
                </tr>
                {stage.items.map((item, idx) => {
                  const isLocked = item.is_locked || isFinalized;
                  const isEdited = !!editedItems[item.id];
                  const timeString = getItemTimeString(item);

                  return (
                    <tr key={item.id} style={{
                      background: isEdited ? '#fff3cd' : (idx % 2 ? '#f8f9fa' : '#fff')
                    }}>
                      <td style={tdStyle}><strong>{item.order}</strong></td>
                      <td style={tdStyle}>
                        <input
                          type="date"
                          value={getItemValue(item, 'date') || ''}
                          onChange={e => handleFieldChange(item.id, 'date', e.target.value)}
                          disabled={isLocked}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="time"
                          value={getItemStartTime(item)}
                          onChange={e => handleFieldChange(item.id, 'start_time', e.target.value)}
                          disabled={isLocked}
                          style={{ ...inputStyle, width: 100 }}
                        />
                      </td>
                      <td style={tdStyle}>{item.section_title}</td>
                      <td style={{ ...tdStyle, fontSize: '0.8em', lineHeight: '1.3' }}>
                        {timeString ? (
                          <pre style={{ 
                            margin: 0, 
                            whiteSpace: 'pre-wrap', 
                            fontFamily: 'inherit',
                            fontSize: '0.9em'
                          }}>
                            {timeString}
                          </pre>
                        ) : (
                          <span style={{ color: '#999' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={getItemValue(item, 'instructor_id') || ''}
                          onChange={e => handleFieldChange(
                            item.id, 'instructor_id',
                            e.target.value ? parseInt(e.target.value) : null
                          )}
                          disabled={isLocked}
                          style={inputStyle}
                        >
                          <option value="">— не назначен —</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={getItemValue(item, 'location') || ''}
                          onChange={e => handleFieldChange(item.id, 'location', e.target.value)}
                          disabled={isLocked}
                          style={inputStyle}
                        >
                          <option value="">—</option>
                          <option value="SDO">СДО</option>
                          <option value="DME_508">Домодедово, 508</option>
                          <option value="DME_509">Домодедово, 509</option>
                          <option value="KJA_408">Красноярск, 408</option>
                          <option value="KJA_403">Красноярск, 403</option>
                          <option value="S7 Training">S7 Training</option>
                          <option value="Aeroflot">Аэрофлот</option>
                          <option value="UIGA">УИГА</option>
                          <option value="SPBGUGA">СПбГУГА</option>
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={getItemValue(item, 'is_locked') || false}
                          onChange={e => handleFieldChange(item.id, 'is_locked', e.target.checked)}
                          disabled={isFinalized}
                        />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: 8, border: '1px solid #ccc',
  textAlign: 'center', fontSize: '0.85em'
};

const tdStyle = {
  padding: 6, border: '1px solid #ccc',
  verticalAlign: 'middle'
};

const inputStyle = {
  width: '100%', padding: 4,
  border: '1px solid #ccc', borderRadius: 3,
  fontSize: '0.9em'
};