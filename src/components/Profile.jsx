import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserAppointments } from '../api/appointments';
import { updateProfile, changePassword } from '../api/users';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'info', 'security'

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  // Profile info state
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    second_name: user?.second_name || '',
    middle_name: user?.middle_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Security state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        second_name: user.second_name || '',
        middle_name: user.middle_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const loadUserOrders = async () => {
    if (!user || !user.id_user) return;
    try {
      setLoadingOrders(true);
      setOrdersError(null);
      const data = await getUserAppointments(user.id_user);
      setOrders(data);
    } catch (err) {
      setOrdersError(err.message || 'Ошибка загрузки истории заказов');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadUserOrders();
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setSavingProfile(true);

    try {
      const updated = await updateProfile(user.id_user, formData);
      login(updated);
      setProfileMsg('Личные данные успешно обновлены');
      setTimeout(() => setProfileMsg(null), 3500);
    } catch (err) {
      setProfileError(err.message || 'Ошибка обновления профиля');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают');
      return;
    }

    if (passwordData.newPassword.length < 4) {
      setPasswordError('Пароль должен быть от 4 символов');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(user.id_user, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordMsg('Пароль успешно изменен');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordMsg(null), 3500);
    } catch (err) {
      setPasswordError(err.message || 'Ошибка при изменении пароля');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Необходима авторизация для доступа к личному кабинету</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '16px' }}>
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Личный кабинет</h1>
          <p className="page-subtitle">
            {user.first_name ? `${user.first_name} ${user.second_name || ''}` : user.email} • {user.role_title || 'Клиент'}
          </p>
        </div>
        {user.discount_percentage > 0 && (
          <div className="badge badge-success">
            {user.discount_title || 'Скидка'}: {user.discount_percentage}%
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="admin-nav-bar" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          История заказов ({orders.length})
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Личные данные
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Безопасность
        </button>
      </div>

      {/* TAB 1: ORDERS HISTORY */}
      {activeTab === 'orders' && (
        <div>
          {loadingOrders ? (
            <p style={{ color: 'var(--text-muted)' }}>Загрузка истории заказов...</p>
          ) : ordersError ? (
            <div className="badge badge-danger" style={{ display: 'block', padding: '8px' }}>{ordersError}</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>У вас пока нет оформленных заказов или записей</p>
              <Link to="/available-services" className="btn btn-primary btn-sm">
                Выбрать услуги в каталоге
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order, idx) => {
                const dateFormatted = order.appointment_date
                  ? new Date(order.appointment_date).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <div
                    key={order.id_appointment}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: 'var(--text-h)' }}>
                          Заказ #{idx + 1}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '12px' }}>
                          {dateFormatted}
                        </span>
                      </div>
                      <span className={order.is_completed ? 'badge badge-success' : 'badge badge-warning'}>
                        {order.is_completed ? 'Завершен' : 'В обработке'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px', marginBottom: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Мастер: </span>
                        <strong>{order.master_first_name ? `${order.master_first_name} ${order.master_second_name || ''}` : 'Мастер салона'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Адрес: </span>
                        <strong>{order.address || 'Салон (по умолчанию)'}</strong>
                      </div>
                      {order.note && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Примечание: </span>
                          <span>{order.note}</span>
                        </div>
                      )}
                    </div>

                    {/* Ordered Services List */}
                    {order.services && order.services.length > 0 && (
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: '4px', padding: '12px', marginTop: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                          Состав заказа:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {order.services.map((s, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span>{s.title} {s.quantity > 1 && `(x${s.quantity})`}</span>
                              <strong>{(parseFloat(s.price) * (s.quantity || 1)).toLocaleString()} ₽</strong>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px', fontWeight: '700', fontSize: '14px', color: 'var(--text-h)' }}>
                          <span>Итого к оплате:</span>
                          <span>{(order.totalPrice || 0).toLocaleString()} ₽</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERSONAL INFO */}
      {activeTab === 'info' && (
        <div style={{ maxWidth: '600px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Редактирование профиля
          </h3>

          {profileError && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '12px', padding: '8px' }}>{profileError}</div>}
          {profileMsg && <div className="badge badge-success" style={{ display: 'block', marginBottom: '12px', padding: '8px' }}>{profileMsg}</div>}

          <form onSubmit={handleProfileSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Фамилия *</label>
                <input
                  type="text"
                  value={formData.second_name}
                  onChange={(e) => setFormData({ ...formData, second_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Отчество</label>
              <input
                type="text"
                value={formData.middle_name}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Номер телефона</label>
              <input
                type="tel"
                placeholder="+7 (999) 000-00-00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Адрес по умолчанию</label>
              <input
                type="text"
                placeholder="г. Москва, ул. Ленина, д. 1"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              disabled={savingProfile}
            >
              {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: SECURITY */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '500px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Изменение пароля
          </h3>

          {passwordError && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '12px', padding: '8px' }}>{passwordError}</div>}
          {passwordMsg && <div className="badge badge-success" style={{ display: 'block', marginBottom: '12px', padding: '8px' }}>{passwordMsg}</div>}

          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label">Текущий пароль *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Новый пароль *</label>
              <input
                type="password"
                placeholder="Минимум 4 символа"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Подтверждение нового пароля *</label>
              <input
                type="password"
                placeholder="Повторите новый пароль"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              disabled={savingPassword}
            >
              {savingPassword ? 'Сохранение...' : 'Обновить пароль'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
