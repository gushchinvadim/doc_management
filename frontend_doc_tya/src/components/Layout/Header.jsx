// src/components/Layout/Header.jsx
import './Layout.css';
import logoNordstar from '../../assets/logo-nordstar.png';

export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      {/* 🔹 Левая часть: Логотип */}
      <div className="header-left">
        <img src={logoNordstar} alt="NordStar АУЦ" className="header-logo-img" />
      </div>

      {/* 🔹 Центральная часть: Заголовок */}
      <div className="header-center">
        <h1 className="header-title">АУЦ Учебная часть</h1>
      </div>

      {/* 🔹 Правая часть: Пользователь + Выход */}
      <div className="header-right">
        <span className="header-username">👤 {user?.name || 'Пользователь'}</span>
        <button className="header-logout-btn" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </header>
  );
}