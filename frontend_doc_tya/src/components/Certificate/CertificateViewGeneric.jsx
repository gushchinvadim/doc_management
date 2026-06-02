// src/components/Certificate/CertificateViewGeneric.jsx
import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';
import './CertificateViewGeneric.css';

export default function CertificateViewGeneric({ enrollment, certType, onSuccess }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 🔹 Состояния для формы
  const [preparedBy, setPreparedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [comment, setComment] = useState('');

  // 🔹 Загрузка данных для предпросмотра + списков подписантов
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        const [previewRes, staffRes] = await Promise.all([
          fetch(`/api/certificates/${enrollment.id}/preview/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/certificates/staff/', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        if (!previewRes.ok || !staffRes.ok) throw new Error('Failed to fetch');
        
        const preview = await previewRes.json();
        const staff = await staffRes.json();
        
        setPreviewData(preview);
        
        // 🔹 Авто-выбор первого доступного подписанта (если есть)
        if (staff.prepared_by?.length) setPreparedBy(staff.prepared_by[0].id);
        if (staff.approved_by?.length) setApprovedBy(staff.approved_by[0].id);
        
      } catch (err) {
        console.error('Certificate preview error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (enrollment?.id) fetchData();
  }, [enrollment]);

  // 🔹 Сохранение сертификата
  const handleSave = async () => {


  if (!certType || !['successful', 'attendance'].includes(certType)) {
    alert('❌ Выберите тип сертификата: "Успешное прохождение" или "Справка о прослушивании"');
    return;
  }
  
  if (!preparedBy || !approvedBy) {
    alert('❌ Выберите подготовившего и утвердившего сотрудника');
    return;
  }
  if (!preparedBy || !approvedBy) {
      alert('❌ Выберите подготовившего и утвердившего сотрудника');
      return;
    }
    
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch('/api/certificates/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enrollment: enrollment.id,
          cert_type: certType,
          prepared_by: Number(preparedBy),
          approved_by: Number(approvedBy),
          comment: comment || ''
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        alert(`✅ Сертификат №${result.cert_number} успешно создан!`);
        if (onSuccess) onSuccess();
      } else {
        // 🔹 Обработка ошибок валидации
        const errorMsg = Object.values(result).flat().join('\n');
        alert(`❌ Ошибка: ${errorMsg || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Ошибка сети при сохранении');
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Предпросмотр (открывает сгенерированный HTML в новом окне)
  const handlePreview = async () => {
    try {
      const token = getToken();
      const res = await fetch(`/api/certificates/${enrollment.id}/preview/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      
      const html = await res.text();
      const win = window.open('', '_blank');
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      console.error('Preview error:', err);
      alert('❌ Не удалось открыть предпросмотр');
    }
  };

  if (loading) return <div className="loading">Загрузка данных...</div>;
  if (!previewData) return <div className="error">Не удалось загрузить данные</div>;

  return (
    <div className="certificate-view-generic">
      {/* 🔹 Шапка с информацией */}
      <div className="cert-header">
        <h3>📜 Предпросмотр сертификата</h3>
        <div className="cert-meta">
          <p><strong>Слушатель:</strong> {previewData.student_name}</p>
          <p><strong>Модуль:</strong> {previewData.module_code} — {previewData.module_title}</p>
          <p><strong>Курс:</strong> {previewData.course_name}</p>
          <p><strong>Часов:</strong> {previewData.total_hours}</p>
          <p><strong>Номер сертификата:</strong> {previewData.cert_number_preview}</p>
        </div>
      </div>

      {/* 🔹 Блок лицензии */}
      {previewData.license_data && (
        <div className="cert-license">
          <p>Лицензия № {previewData.license_data.license_number} от {previewData.license_data.license_date?.slice(0,10)}<br/>
          Сертификат АУЦ № {previewData.license_data.favt_cert_number} от {previewData.license_data.favt_cert_date?.slice(0,10)}</p>
        </div>
      )}

      {/* 🔹 Форма выбора подписантов */}
      <div className="cert-form">
        <div className="form-row">
          <label>Подготовил:</label>
          <select 
            value={preparedBy} 
            onChange={(e) => setPreparedBy(e.target.value)}
            className="cert-select"
            disabled={saving}
          >
            <option value="">— Выберите —</option>
            {previewData.prepared_by_options?.map(staff => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
        </div>
        
        <div className="form-row">
          <label>Утвердил:</label>
          <select 
            value={approvedBy} 
            onChange={(e) => setApprovedBy(e.target.value)}
            className="cert-select"
            disabled={saving}
          >
            <option value="">— Выберите —</option>
            {previewData.approved_by_options?.map(staff => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
        </div>
        
        <div className="form-row">
          <label>Примечание:</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="cert-textarea"
            placeholder="Необязательно"
            disabled={saving}
            rows={3}
          />
        </div>
      </div>

      {/* 🔹 Кнопки действий */}
      <div className="cert-actions">
        <button 
          onClick={handlePreview}
          className="btn-preview"
          disabled={saving}
        >
          👁️ Предпросмотр
        </button>
        
        <button 
          onClick={handleSave}
          className="btn-save"
          disabled={saving || !preparedBy || !approvedBy}
        >
          {saving ? '⏳ Генерация...' : '💾 Сохранить сертификат'}
        </button>
      </div>
    </div>
  );
}