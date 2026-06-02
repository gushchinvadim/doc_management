import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getToken } from '../api/auth';
import { exportSchedule } from '../api/schedule'; // 🔹 Новый API-слой
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import EnrollmentForm from '../components/EnrollmentForm/EnrollmentForm';
import RaucExportView from '../components/RaucExport/RaucExportView';
import JournalForm from '../components/Journal/JournalForm';
import EnrollmentSelector from '../components/Journal/EnrollmentSelector';
import AddStudent from '../components/AddStudent/AddStudent';
import Certificate from '../components/Certificate/Certificate';
import GroupFolder from '../components/GroupFolder/GroupFolder';
// 🔹 Заменяем старый компонент на новый редактор
// import ScheduleExportButton from '../components/Schedule/ScheduleExportButton';
import './HomePage.css';
import { getEnrollmentsByModule } from '../api/enrollment';
import GenerateSchedule from '../components/Schedule/GenerateSchedule';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// Заглушки для дашборда (без изменений)
const DashboardView = () => (
  <div className="placeholder">
    <h2>📊 Панель управления</h2>
    <p>Сводка по курсам, слушателям и активным зачислениям появится здесь.</p>
  </div>
);

const FisFrdoExelView = () => (
  <div className="placeholder">
    <h2>📑 EXEL для ФИС ФРДО</h2>
    <p>📑 EXEL для ФИС ФРДО появится здесь.</p>
  </div>
);

const ExecutionGroup = () => (
  <div className="placeholder">
    <h2>🧾 Выполнение</h2>
    <p>🧾 Выполнение появится здесь.</p>
  </div>
);

const MENU_ITEMS = [
  { id: 'dashboard', label: '📊 Главная' },
  { id: 'add-student', label: '📝 Слушатели' }, 
  { id: 'enrollment', label: '📝 Группа' },
  { id: 'generate-schedule', label: '📅 Расписание' },
  { id: 'execution-group', label: '🧾 Выполнение' },
  { id: 'journal', label: '✅ Завершить обучение' },
  { id: 'certificate', label: '🏆 Выписать сертификат' },
  { id: 'rauts-exel', label: '📑 EXEL для РАУЦ' },
  { id: 'fisfrdo-exel', label: '📑 EXEL для ФИС ФРДО' },
  { id: 'group-folder', label: '🗂️ Папки групп' },
];

// 🔹 Вспомогательный компонент для выбора зачисления (упрощённый)
function EnrollmentPicker({ moduleId, value, onChange, disabled }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEnrollments = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getEnrollmentsByModule(moduleId);
      setEnrollments(data);
    } catch (err) {
      setError('Не удалось загрузить список групп');
      console.error('Ошибка загрузки зачислений:', err);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  if (loading) return <div className="loading-small">⏳ Загрузка групп...</div>;
  if (error) return <div className="error-small">❌ {error}</div>;

  return (
    <select 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      className="form-select"
      disabled={disabled || enrollments.length === 0}
    >
      <option value="">-- Выберите группу --</option>
      {enrollments.map(enr => (
        <option key={enr.id} value={enr.id}>
          {enr.group} {enr.module_code ? `• ${enr.module_code}` : ''}
        </option>
      ))}
    </select>
  );
}

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // 🔹 Для журнала (без изменений)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
  
  // 🔹 Для расписания — УПРОЩЕНО: одна переменная вместо четырёх
  const [scheduleModuleId, setScheduleModuleId] = useState('');
  const [scheduleEnrollmentId, setScheduleEnrollmentId] = useState(null);
  
  // 🔹 Для модулей (если используется в других вкладках)
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);

  // 🔹 Проверка авторизации
  useEffect(() => {
    const token = getToken();
    if (!user?.loggedIn && !token) {
      logout();
      navigate('/');
      return;
    }
    setLoading(false);
  }, [user, logout, navigate]);

  // 🔹 Загрузка списка модулей (для селектора в расписании)
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_URL}/modules/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setModules(data);
        }
      } catch (err) {
        console.error('❌ Ошибка загрузки модулей:', err);
      } finally {
        setLoadingModules(false);
      }
    };
    fetchModules();
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  // 🔹 Сброс состояний при смене вкладки
  useEffect(() => {
    if (activeView !== 'schedule-group') {
      setScheduleModuleId('');
      setScheduleEnrollmentId(null);
    }
    if (activeView !== 'journal') {
      setSelectedEnrollmentId(null);
    }
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case 'add-student': 
        return <AddStudent />;
        
      case 'enrollment': 
        return <EnrollmentForm onSuccess={() => setActiveView('dashboard')} />;
        
      case 'journal':
        return (
          <div>
            <EnrollmentSelector 
              value={selectedEnrollmentId}
              onChange={setSelectedEnrollmentId}
              moduleFilter="ППП.АУЦ.02"
            />
            {selectedEnrollmentId ? (
              <JournalForm 
                enrollmentId={selectedEnrollmentId} 
                onSuccess={() => {
                  setSelectedEnrollmentId(null);
                  setActiveView('dashboard');
                }} 
              />
            ) : (
              <div className="placeholder">
                <p>👈 Выберите зачисление из списка выше, чтобы открыть журнал</p>
              </div>
            )}
          </div>
        );
        
      case 'certificate':
        return <Certificate />;

      // 🔹 НОВЫЙ БЛОК: Расписание с ScheduleEditor
// В HomePage.jsx, внутри case 'schedule-group':

      case 'generate-schedule':
        return <GenerateSchedule onBack={() => setActiveView('dashboard')} />;
        
      case 'rauts-exel': 
        return <RaucExportView />;

      case 'fisfrdo-exel': 
        return <FisFrdoExelView />;

      case 'group-folder': 
        return <GroupFolder />;

      case 'execution-group':
        return <ExecutionGroup />;
          
      default:
        return <DashboardView />;
    }
  };

  if (loading) return <div className="loading">Загрузка системы...</div>;

  return (
    <div className="home-page">
      <Header user={user} onLogout={handleLogout} />
      <div className="home-container">
        <aside className="sidebar">
          {MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`menu-btn ${activeView === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </aside>
        
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
      <Footer />
    </div>
  );
}