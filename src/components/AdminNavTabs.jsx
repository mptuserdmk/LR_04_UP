import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminNavTabs() {
  const { user } = useAuth();
  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор');

  return (
    <div className="admin-nav-bar">
      <NavLink to="/appointments" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Записи
      </NavLink>
      <NavLink to="/services" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Услуги
      </NavLink>
      <NavLink to="/categories" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Категории
      </NavLink>
      {isMainAdmin && (
        <NavLink to="/users" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
          Пользователи
        </NavLink>
      )}
      <NavLink to="/discounts" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Скидки
      </NavLink>
      <NavLink to="/payments" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Платежи
      </NavLink>
      <NavLink to="/appointments-services" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Услуги в записях
      </NavLink>
      <NavLink to="/services-categories" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
        Связи категорий
      </NavLink>
      {isMainAdmin && (
        <NavLink to="/roles" className={({ isActive }) => (isActive ? 'admin-nav-tab active' : 'admin-nav-tab')}>
          Роли
        </NavLink>
      )}
    </div>
  );
}
