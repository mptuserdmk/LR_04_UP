import { NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';

function AdminPanel() {
  const { logout, user } = useAuth();
  const { totalCount } = useCart();

  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор');

  return (
    <nav className="admin-panel">
      <div className="admin-panel__header">
        <h2>{isMainAdmin ? 'Панель управления' : 'Панель персонала'}</h2>
        <span className="badge badge-default">
          {user?.role_title || 'Администратор'}
        </span>
      </div>

      <div className="admin-panel__section">
        <span className="admin-section-title">Клиентская зона</span>
        <NavLink
          to="/available-services"
          className={({ isActive }) => (isActive ? 'nav-link active store-link' : 'nav-link store-link')}
        >
          Каталог услуг
        </NavLink>
        <NavLink
          to="/reviews"
          className={({ isActive }) => (isActive ? 'nav-link active store-link' : 'nav-link store-link')}
        >
          Отзывы
        </NavLink>
        <NavLink
          to="/cart"
          className={({ isActive }) => (isActive ? 'nav-link active store-link' : 'nav-link store-link')}
        >
          Корзина {totalCount > 0 && <span className="nav-counter">{totalCount}</span>}
        </NavLink>
      </div>

      <div className="admin-panel__section">
        <span className="admin-section-title">Операционные данные</span>
        <NavLink to="/appointments" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Записи клиентов
        </NavLink>
        <NavLink to="/appointments-services" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Услуги в записях
        </NavLink>
        <NavLink to="/payments" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Платежи
        </NavLink>
        {isMainAdmin && (
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Пользователи и персонал
          </NavLink>
        )}
      </div>

      <div className="admin-panel__section">
        <span className="admin-section-title">Каталог и номенклатура</span>
        <NavLink to="/services" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Услуги и цены
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Категории
        </NavLink>
        <NavLink to="/services-categories" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Связи категорий
        </NavLink>
        <NavLink to="/discounts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Скидки и акции
        </NavLink>

        {isMainAdmin && (
          <NavLink to="/roles" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Роли пользователей
          </NavLink>
        )}
      </div>

      <div className="admin-panel__user">
        <div className="admin-user-box">
          <span className="user-email-text">{user?.email}</span>
          <span className="user-name-sub">
            {user?.first_name ? `${user.first_name} ${user.second_name || ''}` : ''}
          </span>
        </div>
        <button onClick={logout} className="btn-minimal-logout">
          Выйти
        </button>
      </div>
    </nav>
  );
}

export default AdminPanel;