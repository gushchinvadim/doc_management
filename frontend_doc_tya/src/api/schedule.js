import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const authHeaders = () => ({
  'Authorization': `Bearer ${getToken()}`,
  'Content-Type': 'application/json'
});

// Создание черновика расписания
export const createScheduleDraft = async (enrollmentId, startDate = null) => {
  const res = await fetch(`${API_URL}/schedules/create-draft/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ enrollment_id: enrollmentId, start_date: startDate })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Получение расписания по ID
export const getSchedule = async (scheduleId) => {
  const res = await fetch(`${API_URL}/schedules/${scheduleId}/`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Получение расписания по enrollment_id
export const getScheduleByEnrollment = async (enrollmentId) => {
  const res = await fetch(`${API_URL}/schedules/by-enrollment/${enrollmentId}/`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
};

// Массовое обновление элементов
export const updateScheduleItems = async (scheduleId, items) => {
  const res = await fetch(`${API_URL}/schedules/${scheduleId}/update-items/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Утверждение расписания
export const finalizeSchedule = async (scheduleId) => {
  const res = await fetch(`${API_URL}/schedules/${scheduleId}/finalize/`, {
    method: 'POST',
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Ошибка утверждения');
  }
  return res.json();
};

// Сброс в черновик
export const resetToDraft = async (scheduleId) => {
  const res = await fetch(`${API_URL}/schedules/${scheduleId}/reset-to-draft/`, {
    method: 'POST',
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Обновление куратора и директора
export const updateScheduleMeta = async (scheduleId, { curator, director }) => {
  const res = await fetch(`${API_URL}/schedules/${scheduleId}/update-meta/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ curator, director })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Список преподавателей
export const getStaffList = async () => {
  const res = await fetch(`${API_URL}/schedules/staff-list/`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Экспорт в Excel (новое имя)
export const exportScheduleExcel = async (enrollmentId) => {
  const res = await fetch(`${API_URL}/schedules/export-excel/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ enrollment_id: enrollmentId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
};

// 🔹 ДОБАВЛЕНО: Старое имя для обратной совместимости
export const exportSchedule = exportScheduleExcel;