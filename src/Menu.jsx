import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { useTheme } from './context/ThemeContext';

function Menu() {
  const { user, logout } = useAuth();
  const { totalCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор');
  const isStaff = user && (user.role_id === 2 || user.role_title?.includes('Сотрудник'));
  const isStaffOrAdmin = isMainAdmin || isStaff;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="topbar-header">
      <div className="topbar-left">
        <NavLink to="/available-services" className="brand-title">
          УСЛУГИ
        </NavLink>

        <nav className="nav-group">
          <NavLink
            to="/available-services"
            className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
          >
            Каталог
          </NavLink>

          <NavLink
            to="/reviews"
            className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
          >
            Отзывы
          </NavLink>

          {!isMainAdmin && (
            <NavLink
              to="/cart"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
            >
              Корзина
              {totalCount > 0 && <span className="nav-cart-badge">{totalCount}</span>}
            </NavLink>
          )}

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
          >
            Личный кабинет
          </NavLink>

          {isStaffOrAdmin && (
            <NavLink
              to="/appointments"
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
            >
              Управление
            </NavLink>
          )}
        </nav>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={toggleTheme}
          title="Сменить цветовую тему"
        >
          {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
        </button>

        {user && (
          <div className="user-profile-widget">
            <div className="user-info-text">
              <span className="user-name">
                {isMainAdmin
                  ? 'Админ'
                  : `${user.first_name || 'Пользователь'} ${user.second_name || ''}`.trim()}
              </span>
              <div className="user-subinfo">
                <span className="user-role-badge">
                  {user.role_title || (user.role_id === 1 ? 'Администратор' : 'Клиент')}
                </span>
                {user.discount_percentage > 0 && (
                  <span className="user-coupon-badge">
                    Скидка {user.discount_percentage}%
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-topbar-logout"
              onClick={handleLogout}
              title="Выйти из аккаунта"
            >
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Menu;