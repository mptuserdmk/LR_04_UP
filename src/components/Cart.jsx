import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getUsers } from '../api/users';
import { Link } from 'react-router-dom';

export default function Cart() {
  const { user } = useAuth();
  const { cart, loading, error, isOfflineCart, updateQuantity, removeFromCart, clearCart, reloadCart } = useCart();
  const [masters, setMasters] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState('11:30');
  const [address, setAddress] = useState(user?.address || '');
  const [note, setNote] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const timeSlots = ['09:00', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:30'];

  useEffect(() => {
    if (user?.address) {
      setAddress(user.address);
    }
  }, [user]);

  useEffect(() => {
    async function loadMasters() {
      try {
        const users = await getUsers();
        const staff = users.filter((u) => u.role_id === 3 || u.role_title === 'Мастер');
        setMasters(staff);
        if (staff.length > 0) {
          setSelectedMasterId(String(staff[0].id_user));
        }
      } catch (err) {
        console.error('Error loading masters:', err);
      }
    }
    loadMasters();
  }, []);

  const userDiscountPercentage = user?.discount_percentage || 0;

  const summary = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const qty = parseInt(item.quantity, 10) || 1;
        const basePrice = parseFloat(item.price) || 0;
        const duration = parseInt(item.duration, 10) || 30;
        const servPct = item.discount_percentage ? Number(item.discount_percentage) : 0;
        const userPct = Number(userDiscountPercentage);
        const effectivePct = Math.min(75, servPct + userPct);

        const discountedUnitPrice = effectivePct > 0
          ? Math.round(basePrice * (1 - effectivePct / 100))
          : basePrice;

        acc.totalQuantity += qty;
        acc.rawTotal += basePrice * qty;
        acc.finalTotal += discountedUnitPrice * qty;
        acc.totalDuration += duration * qty;
        return acc;
      },
      { totalQuantity: 0, rawTotal: 0, finalTotal: 0, totalDuration: 0 }
    );
  }, [cart, userDiscountPercentage]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) {
      setCheckoutError('Для оформления заказа необходимо авторизоваться');
      return;
    }
    if (cart.length === 0) {
      setCheckoutError('Корзина пуста');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);

    try {
      const appointmentDateTime = `${selectedDate}T${selectedSlot}:00`;
      
      const appRes = await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id_user,
          master_id: selectedMasterId ? Number(selectedMasterId) : null,
          appointment_date: appointmentDateTime,
          note: `${note ? note + ' | ' : ''}Адрес: ${address}`,
          is_completed: false,
        }),
      });

      if (!appRes.ok) {
        const errData = await appRes.json();
        throw new Error(errData.error || 'Ошибка при создании записи');
      }

      const newAppointment = await appRes.json();
      const appointmentId = newAppointment.id_appointment;

      for (const item of cart) {
        await fetch('http://localhost:3001/api/appointments-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appointmentId,
            service_id: item.service_id,
            quantity: item.quantity,
          }),
        });
      }

      try {
        await fetch('http://localhost:3001/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appointmentId,
            amount: summary.finalTotal,
            payment_date: new Date().toISOString(),
          }),
        });
      } catch (payErr) {
        console.warn('Payment record notice:', payErr);
      }

      const chosenMaster = masters.find((m) => String(m.id_user) === String(selectedMasterId));
      const masterName = chosenMaster
        ? `${chosenMaster.first_name} ${chosenMaster.second_name || ''}`
        : 'Любой свободный специалист';

      setCheckoutSuccess({
        appointmentId,
        date: selectedDate,
        time: selectedSlot,
        masterName,
        address: address || 'Салон (по умолчанию)',
        total: summary.finalTotal,
        totalDuration: summary.totalDuration,
      });

      await clearCart();
    } catch (err) {
      setCheckoutError(err.message || 'Ошибка при оформлении записи');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Загрузка корзины...</p>
      </div>
    );
  }

  if (checkoutSuccess) {
    return (
      <div className="page-container">
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', textAlign: 'center' }}>
          <div className="badge badge-success" style={{ marginBottom: '12px', display: 'inline-block' }}>Заказ успешно оформлен</div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-h)' }}>Вы записаны на визит</h2>
          <div style={{ textAlign: 'left', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '14px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
            <p style={{ marginBottom: '6px' }}>Дата и время: <strong>{checkoutSuccess.date}, {checkoutSuccess.time}</strong></p>
            <p style={{ marginBottom: '6px' }}>Мастер: <strong>{checkoutSuccess.masterName}</strong></p>
            <p style={{ marginBottom: '6px' }}>Адрес: <strong>{checkoutSuccess.address}</strong></p>
            <p style={{ marginBottom: '6px' }}>Общая длительность: <strong>{checkoutSuccess.totalDuration} мин.</strong></p>
            <p style={{ marginBottom: '0' }}>Итоговая сумма: <strong>{checkoutSuccess.total.toLocaleString()} ₽</strong></p>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Link to="/profile" className="btn btn-primary">
              История заказов в кабинете
            </Link>
            <Link to="/available-services" className="btn btn-secondary">
              В каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор');

  if (isMainAdmin) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Корзина недоступна</h1>
            <p className="page-subtitle">Администраторам недоступна функция корзины и клиентской записи на услуги</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            Для управления записями, услугами и другими данными перейдите в панель управления.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Link to="/appointments" className="btn btn-primary">
              Панель управления
            </Link>
            <Link to="/available-services" className="btn btn-secondary">
              В каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Корзина и запись</h1>
          <p className="page-subtitle">Выбранные услуги и выбор времени визита</p>
        </div>
        {cart.length > 0 && (
          <button type="button" onClick={clearCart} className="btn btn-danger btn-sm">
            Очистить корзину
          </button>
        )}
      </div>

      {isOfflineCart && (
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            color: 'var(--warning)',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <span>⚠️</span>
          <span>
            Бэкенд временно недоступен. Ваши позиции сохранены локально на устройстве и не будут утеряны.
          </span>
        </div>
      )}

      {checkoutError && (
        <div className="badge badge-danger" style={{ display: 'block', marginBottom: '12px', padding: '8px' }}>
          {checkoutError}
        </div>
      )}

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Ваша корзина пуста</p>
          <Link to="/available-services" className="btn btn-primary">
            Выбрать услуги в каталоге
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
          {/* Items List */}
          <div className="table-wrapper">
            <table className="minimal-table">
              <thead>
                <tr>
                  <th>Услуга</th>
                  <th>Время</th>
                  <th>Цена</th>
                  <th>Кол-во</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => {
                  const basePrice = parseFloat(item.price) || 0;
                  const servPct = item.discount_percentage ? Number(item.discount_percentage) : 0;
                  const effectivePct = Math.min(75, servPct + Number(userDiscountPercentage));
                  const finalUnitPrice = effectivePct > 0 ? Math.round(basePrice * (1 - effectivePct / 100)) : basePrice;
                  const itemTotal = finalUnitPrice * item.quantity;
                  const serviceId = item.service_id;

                  return (
                    <tr key={serviceId}>
                      <td>
                        <strong>{item.title || item.service_title}</strong>
                        {effectivePct > 0 && <span className="badge badge-warning" style={{ marginLeft: '8px' }}>-{effectivePct}%</span>}
                      </td>
                      <td>{item.duration || 30} мин.</td>
                      <td>{finalUnitPrice} ₽</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', minWidth: '24px' }}
                            onClick={() => updateQuantity(serviceId, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', minWidth: '24px' }}
                            onClick={() => updateQuantity(serviceId, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td><strong>{itemTotal.toLocaleString()} ₽</strong></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 6px' }}
                          onClick={() => removeFromCart(serviceId)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Booking Side Form */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              Параметры визита
            </h3>

            <form onSubmit={handleCheckout}>
              <div className="form-group">
                <label className="form-label">Специалист</label>
                <select
                  value={selectedMasterId}
                  onChange={(e) => setSelectedMasterId(e.target.value)}
                  required
                >
                  {masters.map((m) => (
                    <option key={m.id_user} value={m.id_user}>
                      {m.first_name} {m.second_name || ''} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Дата</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Время</label>
                <div className="slots-grid">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={`slot-pill ${selectedSlot === slot ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Адрес</label>
                <input
                  type="text"
                  placeholder="г. Москва, ул. Ленина, д. 10 или 'Салон'"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Пожелания к визиту</label>
                <input
                  type="text"
                  placeholder="Дополнительные пожелания..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: '4px', margin: '14px 0', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Услуг в заказе:</span>
                  <span>{summary.totalQuantity} шт.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Длительность:</span>
                  <span>{summary.totalDuration} мин.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', color: 'var(--text-h)', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
                  <span>К оплате:</span>
                  <span>{summary.finalTotal.toLocaleString()} ₽</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={submitting}
              >
                {submitting ? 'Оформление...' : 'Записаться'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}