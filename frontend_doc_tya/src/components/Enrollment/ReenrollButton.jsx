// src/components/Enrollment/ReenrollButton.jsx
import { useState } from 'react';
import { getToken } from '../../api/auth';
import './ReenrollButton.css';

export default function ReenrollButton({ enrollmentId, onReenroll }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleClick = async () => {
    if (!window.confirm('⚠️ Перезачислить слушателя на этот модуль?\nСтарая запись сохранится в истории.')) return;
    
    setLoading(true);
    setMsg('');
    try {
      const token = getToken();
      const res = await fetch(`/api/enrollments/${enrollmentId}/reenroll/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      
      setMsg('✅ Успешно перезачислен');
      if (onReenroll) onReenroll(); // Обновить список в родительском компоненте
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reenroll-wrapper">
      <button 
        onClick={handleClick} 
        disabled={loading}
        className="btn-reenroll"
        title="Перезачислить на модуль"
      >
        {loading ? '⏳...' : '🔄 Перезачислить'}
      </button>
      {msg && <span className={`reenroll-msg ${msg.startsWith('✅') ? 'success' : 'error'}`}>{msg}</span>}
    </div>
  );
}