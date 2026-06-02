// src/components/Schedule/ScheduleExportButton.jsx
import { useState } from 'react';
import { getToken } from '../../api/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function ScheduleExportButton({ moduleId, moduleName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!moduleId) {
      setError('Выберите модуль');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const url = `${API_URL}/schedules/export-excel/?module_id=${moduleId}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Ошибка экспорта');
      }
      
      // Скачивание файла
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `schedule_${moduleName || 'export'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      console.error('Export error:', err);
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="schedule-export">
      <button
        className="btn-export"
        onClick={handleExport}
        disabled={loading || !moduleId}
        title="Скачать пустой шаблон расписания по структуре модуля"
      >
        {loading ? '⏳ Генерация...' : '📥 Экспорт расписания (Excel)'}
      </button>
      
      {error && <div className="export-error">{error}</div>}
    </div>
  );
}