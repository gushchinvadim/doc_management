// src/components/Certificate/CertificateViews/course_02/CertificateView-02-M1.jsx

import { useState, useEffect } from 'react';
// import '../../CertificateView.css';

const MODULE_CONFIG = {
  title: "📜 ППП.АУЦ.02 - М.1",
  apiModuleCode: "ППП.АУЦ.02 - М.1",  // 🔹 Точное совпадение с БД
  template: "content_c02_m1"           // 🔹 Для отладки/расширения
};

export default function CertificateView02M1() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printWindows, setPrintWindows] = useState({});

  const API_MODULE_CODE = MODULE_CONFIG.apiModuleCode;

  const loadEnrollments = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('No auth token');
      
      const encodedCode = encodeURIComponent(API_MODULE_CODE);
      const response = await fetch(
        `/api/enrollments/list/?status=completed&module_code=${encodedCode}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setEnrollments(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEnrollments(); }, [API_MODULE_CODE]);

  // 🔹 Открытие окна печати с заглушкой
  const openPrintWindow = (enrollmentId) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      alert('❌ Браузер заблокировал всплывающее окно.');
      return null;
    }
    
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Загрузка сертификата...</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; align-items: center; justify-content: center; 
              height: 100vh; margin: 0; background: #f8f9fa; color: #333;
            }
            .loader { text-align: center; animation: pulse 1.5s infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
          </style>
        </head>
        <body>
          <div class="loader">
            <h2>🖨️ Загрузка сертификата...</h2>
            <p>Пожалуйста, подождите</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setPrintWindows(prev => ({ ...prev, [enrollmentId]: printWindow }));
    return printWindow;
  };

  // 🔹 Предпросмотр + печать
  const handlePreviewAndPrint = async (enrollmentId) => {
    const token = localStorage.getItem('access_token');
    
    try {
      const response = await fetch(`/api/certificates/${enrollmentId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const htmlContent = await response.text();
      
      const returnUrl = window.location.href;
      document.write(htmlContent);
      document.close();
      
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 2000);
        }, 300);
      }, { once: true });
      
    } catch (err) {
      console.error('Print failed:', err);
      alert('❌ Не удалось открыть сертификат');
      window.location.reload();
    }
  };

  const handleClosePreview = (enrollmentId) => {
    const win = printWindows[enrollmentId];
    if (win && !win.closed) {
      win.close();
      setPrintWindows(prev => {
        const next = { ...prev };
        delete next[enrollmentId];
        return next;
      });
    }
  };

  useEffect(() => {
    return () => {
      Object.values(printWindows).forEach(win => {
        if (!win.closed) win.close();
      });
    };
  }, [printWindows]);

  const handleSaveToDB = async (enrollmentId) => {
    const token = localStorage.getItem('access_token');
    try {
      const response = await fetch('/api/certificates/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enrollment_id: enrollmentId,
          module_code: API_MODULE_CODE,
          cert_type: 'successful'
        })
      });
      
      const result = await response.json();
      if (response.ok) {
        alert(`✅ Сертификат ${result.cert_number} сохранён в системе`);
        await loadEnrollments();
      } else {
        alert(`❌ Ошибка: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      console.error('Save to DB failed:', err);
      alert('❌ Ошибка сети при сохранении');
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="certificate-view">
      <h2>{MODULE_CONFIG.title}</h2>
      
      {enrollments.length === 0 ? (
        <p className="no-data">Нет готовых записей для этого модуля</p>
      ) : (
        <table className="enrollments-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Группа</th>
              <th>Оценка</th>
              <th>Завершён</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map(enr => {
              const certData = enr.certificate;
              const hasCertificate = !!certData?.file_path;
              const isPrinting = printWindows[enr.id] && !printWindows[enr.id].closed;

              return (
                <tr key={enr.id} className={hasCertificate ? 'has-certificate' : ''}>
                  <td>{enr.student_name}</td>
                  <td>{enr.group}</td>
                  <td>
                    <span className={`mark ${enr.total_mark > 0 ? 'positive' : 'negative'}`}>
                      {enr.total_mark}
                    </span>
                  </td>
                  <td>{enr.completed_at ? new Date(enr.completed_at).toLocaleDateString('ru-RU') : '-'}</td>
                  
                  <td className="certificate-status">
                    {hasCertificate ? (
                      <span className="checkmark" title="Сертификат выписан">✓</span>
                    ) : (
                      <span className="no-cert" title="Сертификат не выписан">—</span>
                    )}
                  </td>
                  
                  <td className="actions">
                    {hasCertificate ? (
                      <>
                        <button 
                          className="btn-view"
                          onClick={() => handlePreviewAndPrint(enr.id)}
                          disabled={isPrinting}
                        >
                          {isPrinting ? '⏳ Загрузка...' : '👁️ Просмотр / Печать'}
                        </button>
                        {isPrinting && (
                          <button className="btn-cancel" onClick={() => handleClosePreview(enr.id)}>✕</button>
                        )}
                        {!certData?.saved_to_db && (
                          <button className="btn-save" onClick={() => handleSaveToDB(enr.id)}>💾 Сохранить</button>
                        )}
                      </>
                    ) : (
                      <button 
                        className="btn-generate"
                        onClick={() => handlePreviewAndPrint(enr.id)}
                        disabled={enr.total_mark <= 0 || isPrinting}
                      >
                        {isPrinting ? '⏳ Загрузка...' : '🔍 Предпросмотр и печать'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}