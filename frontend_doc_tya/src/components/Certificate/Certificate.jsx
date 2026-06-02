// src/components/Certificate/Certificate.jsx
import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';
import CertificateViewGeneric from './CertificateViewGeneric'; // 🔹 Новый универсальный компонент
import './Certificate.css';

export default function Certificate() {
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [certType, setCertType] = useState('successful');

  // 🔹 Загрузка списка доступных зачислений
  useEffect(() => {
    const fetchEligible = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/certificates/eligible/?cert_type=${certType}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setEnrollments(data);
      } catch (err) {
        console.error('Eligible fetch error:', err);
        setEnrollments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEligible();
  }, [certType]);

  // 🔹 Сброс выбора при смене типа сертификата
  useEffect(() => {
    setSelectedEnrollment(null);
  }, [certType]);

  if (loading) return <div className="loading">Загрузка списка...</div>;

  return (
    <div className="certificate-main-container">
      <h1>🏆 Выписать сертификат</h1>
      
      {/* 🔹 Выбор типа сертификата */}
      <div className="cert-type-selector">
        <label>Тип сертификата:</label>
        <select 
          value={certType} 
          onChange={(e) => setCertType(e.target.value)}
          className="cert-select"
        >
          <option value="successful">✅ Успешное прохождение</option>
          <option value="attendance">📄 Справка о прослушивании</option>
        </select>
      </div>

      {/* 🔹 Выбор зачисления */}
      <div className="enrollment-selector">
        <label>Выберите слушателя:</label>
        <select
          value={selectedEnrollment?.id || ''}
          onChange={(e) => {
            const enr = enrollments.find(x => x.id === Number(e.target.value));
            setSelectedEnrollment(enr || null);
          }}
          className="cert-select"
        >
          <option value="">— Выберите из списка —</option>
          {enrollments.map(enr => (
            <option key={enr.id} value={enr.id}>
              {enr.student_name} | {enr.module_code} | {enr.group}-{enr.application} | Оценка: {enr.total_mark}
            </option>
          ))}
        </select>
      </div>

      {/* 🔹 Рендер формы сертификата */}
      {selectedEnrollment ? (
        <CertificateViewGeneric 
          enrollment={selectedEnrollment}
          certType={certType}
          onSuccess={() => {
            setSelectedEnrollment(null); // Сброс после успешного создания
            // Можно обновить список, если нужно
          }}
        />
      ) : (
        <div className="placeholder">
          <p>👈 Выберите слушателя из списка выше, чтобы начать выписку сертификата</p>
        </div>
      )}
    </div>
  );
}