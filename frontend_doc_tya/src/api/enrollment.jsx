// src/api/enrollment.jsx
import { getToken } from './auth';
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const authHeaders = () => ({ 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export const getModules = async () => {
  const res = await fetch(`${API_URL}/modules/`, { headers: { Authorization: authHeaders().Authorization } });
  return res.json();
};

export const searchStudents = async (surname) => {
  const res = await fetch(`${API_URL}/students/search/?surname=${encodeURIComponent(surname)}`, { headers: { Authorization: authHeaders().Authorization } });
  return res.json();
};

export const createEnrollment = async (data) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
  const token = getToken();
  
  // 🔹 ИЗМЕНЕНО: /enrollments/ → /enrollments/create/
  const res = await fetch(`${API_URL}/enrollments/create/`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || result.detail || 'Ошибка сохранения');
  return result;
};


/**
 * Получает список зачислений по модулю
 * Возвращает массив в формате: [{ id, group, module_id, module_code, status, ... }]
 */
export const getEnrollmentsByModule = async (moduleId, status = 'enrolled') => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
  const token = getToken();
  
  const url = `${API_URL}/enrollments/?module_id=${moduleId}&status=${status}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  
  const data = await res.json();
  
  // Нормализация (как в EnrollmentForm)
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.data && Array.isArray(data.data)) return data.data;
  
  return [];
};