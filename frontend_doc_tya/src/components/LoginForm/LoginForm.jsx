import { useState } from 'react';
import { login as apiLogin } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginForm() {
  const [rauts_id, setRauts] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiLogin(rauts_id, password);
      login(res.user, res.access);
      navigate('/home');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Вход в систему</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input 
          placeholder="Табельный номер" 
          value={rauts_id} 
          onChange={e => setRauts(e.target.value)} 
          required 
          style={{ width: '100%', padding: 8, marginBottom: 10 }}
        />
        <input 
          type="password" 
          placeholder="Пароль" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
          style={{ width: '100%', padding: 8, marginBottom: 10 }}
        />
        <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Войти
        </button>
      </form>
    </div>
  );
}