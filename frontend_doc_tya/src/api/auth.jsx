const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const login = async (rauts_id, password) => {
  const res = await fetch(`${API_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rauts_id, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка авторизации');
  return data;
};

export const getToken = () => localStorage.getItem('access_token');
export const setToken = (token) => localStorage.setItem('access_token', token);
export const clearToken = () => localStorage.removeItem('access_token');