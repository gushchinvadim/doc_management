import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken, clearToken } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      // Здесь позже добавите проверку токена через /auth/verify/
      setUser({ loggedIn: true, token });
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setToken(token);
    setUser({ ...userData, loggedIn: true });
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);