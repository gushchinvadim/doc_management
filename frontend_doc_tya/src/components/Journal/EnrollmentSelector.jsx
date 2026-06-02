// src/components/Journal/EnrollmentSelector.jsx
import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';

export default function EnrollmentSelector({ value, onChange, moduleFilter = null }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        const token = getToken();
        // 🔹 ИСПРАВЛЕНО: Убираем фильтр status или разрешаем все нужные статусы
        // Показываем: зачислен, в процессе, завершен (чтобы можно было редактировать)
        let url = '/api/enrollments/list/?status__in=enrolled,in_progress,completed'; 
        
        if (moduleFilter) {
          url += `&module_code__icontains=${encodeURIComponent(moduleFilter)}`;
        }
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setEnrollments(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error('Enrollment fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEnrollments();
  }, [moduleFilter]);

  if (loading) return <div style={{padding: 12}}>Загрузка списка...</div>;

  return (
    <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16}}>
      <label>Выберите слушателя:</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{padding: '8px 12px', borderRadius: 6, border: '1px solid #ced4da', flex: 1}}
      >
        <option value="">— Выберите зачисление —</option>
        {enrollments.map(enr => (
          <option key={enr.id} value={enr.id}>
            {/* Добавили отображение текущего статуса в списке */}
            {enr.student_name} | {enr.group}-{enr.application} | [{enr.status}]
          </option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  selector: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', background: '#f8f9fa', borderRadius: 8,
    marginBottom: 16, flexWrap: 'wrap'
  },
  selectorLabel: { fontSize: 14, fontWeight: 500, color: '#333' },
  select: {
    flex: 1, minWidth: 200, padding: '8px 12px',
    border: '1px solid #ced4da', borderRadius: 6, fontSize: 14, background: '#fff'
  },
  clearBtn: {
    padding: '6px 10px', background: '#dc3545', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12
  }
};