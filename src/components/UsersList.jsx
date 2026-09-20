import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import { getDiscounts } from '../api/discounts';
import { getRoles } from '../api/roles';
import { useAuth } from '../context/AuthContext';
import AdminNavTabs from './AdminNavTabs';
import Pagination from './Pagination';

export default function UsersList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formData, setFormData] = useState({
    id_user: '',
    second_name: '',
    first_name: '',
    middle_name: '',
    role_id: '4',
    email: '',
    password: '',
    discount_id: '1',
  });

  const [formError, setFormError] = useState(null);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);
      const [usersData, discountsData, rolesData] = await Promise.all([
        getUsers(),
        getDiscounts(),
        getRoles(),
      ]);
      setUsers(usersData);
      setDiscounts(discountsData);
      setRoles(rolesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    try {
      if (formData.id_user) {
        await updateUser(formData.id_user, formData);
      } else {
        await createUser(formData);
      }
      setFormData({
        id_user: '',
        second_name: '',
        first_name: '',
        middle_name: '',
        role_id: '4',
        email: '',
        password: '',
        discount_id: '1',
      });
      loadAllData();
    } catch (err) {
      setFormError(err.message);
    }
  }

  function handleEdit(user) {
    setFormData({
      id_user: user.id_user,
      second_name: user.second_name || '',
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      role_id: String(user.role_id || '4'),
      email: user.email || '',
      password: user.password || '',
      discount_id: String(user.discount_id || '1'),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id, userRole) {
    if (userRole === 1) {
      alert('Запрещено удалять учетную запись Главного администратора');
      return;
    }
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await deleteUser(id);
      loadAllData();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCancel() {
    setFormData({
      id_user: '',
      second_name: '',
      first_name: '',
      middle_name: '',
      role_id: '4',
      email: '',
      password: '',
      discount_id: '1',
    });
    setFormError(null);
  }

  const isEditingOwnAccount = formData.id_user && currentUser && String(formData.id_user) === String(currentUser.id_user);

  return (
    <div className="admin-content-card">
      <AdminNavTabs activeSection="users" />

      <div className="admin-header-row">
        <h2>Пользователи и персонал</h2>
        <span className="count-tag">Всего: {users.length}</span>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {formError && <div className="alert-error">{formError}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <h3>{formData.id_user ? 'Редактировать пользователя' : 'Добавить нового пользователя'}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Фамилия *</label>
            <input
              type="text"
              name="second_name"
              placeholder="Иванов"
              value={formData.second_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Имя *</label>
            <input
              type="text"
              name="first_name"
              placeholder="Иван"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Отчество</label>
            <input
              type="text"
              name="middle_name"
              placeholder="Иванович"
              value={formData.middle_name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль *</label>
            <input
              type="text"
              name="password"
              placeholder="Пароль учетной записи"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Роль в системе *
              {isEditingOwnAccount && currentUser?.role_id === 1 && (
                <span style={{ color: '#eab308', fontSize: '0.8rem', display: 'block' }}>
                  (Нельзя снять роль Главного админа со своего аккаунта)
                </span>
              )}
            </label>
            <select
              name="role_id"
              value={formData.role_id}
              onChange={handleChange}
              disabled={isEditingOwnAccount && currentUser?.role_id === 1}
              required
            >
              {roles.map((r) => (
                <option key={r.id_role} value={r.id_role}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Персональная скидка</label>
            <select
              name="discount_id"
              value={formData.discount_id}
              onChange={handleChange}
            >
              {discounts.map((d) => (
                <option key={d.id_discount} value={d.id_discount}>
                  {d.title} ({d.percentage}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="btn-primary">
            {formData.id_user ? 'Сохранить изменения' : 'Добавить пользователя'}
          </button>
          {formData.id_user && (
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Отмена
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="loading-state">
          <p>Загрузка данных...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>ФИО</th>
                <th>Email</th>
                <th>Пароль</th>
                <th>Роль</th>
                <th>Персональная скидка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((u, index) => {
                const roleObj = roles.find((r) => String(r.id_role) === String(u.role_id));
                const discountObj = discounts.find((d) => String(d.id_discount) === String(u.discount_id));
                const isMainAdmin = u.role_id === 1;

                return (
                  <tr key={u.id_user}>
                    <td className="row-number-cell">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      <strong>{u.second_name} {u.first_name}</strong> {u.middle_name || ''}
                    </td>
                    <td>{u.email}</td>
                    <td><code>{u.password}</code></td>
                    <td>
                      <span className={`role-badge role-badge--${u.role_id}`}>
                        {roleObj ? roleObj.title : u.role_title || 'Клиент'}
                      </span>
                    </td>
                    <td>
                      {discountObj && discountObj.percentage > 0 ? (
                        <span className="badge-discount-tag">
                          {discountObj.title} ({discountObj.percentage}%)
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Без скидки</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-edit"
                        onClick={() => handleEdit(u)}
                      >
                        Редактировать
                      </button>
                      {!isMainAdmin && (
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => handleDelete(u.id_user, u.role_id)}
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={users.length}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );
}
