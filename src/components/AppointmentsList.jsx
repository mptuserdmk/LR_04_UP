import { useState, useEffect } from 'react';
import { getAppointments, createAppointment, updateAppointment, deleteAppointment } from '../api/appointments';
import { getUsers } from '../api/users';
import AdminNavTabs from './AdminNavTabs';
import Pagination from './Pagination';

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formData, setFormData] = useState({
    id_appointment: '',
    user_id: '',
    master_id: '',
    appointment_date: '',
    note: '',
    is_completed: false,
  });

  const [formError, setFormError] = useState(null);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);
      const [appData, usersData] = await Promise.all([
        getAppointments(),
        getUsers(),
      ]);
      setAppointments(appData);
      setUsers(usersData);
      if (usersData.length > 0 && !formData.user_id) {
        setFormData((prev) => ({
          ...prev,
          user_id: String(usersData[0].id_user),
          master_id: String(usersData[0].id_user),
        }));
      }
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
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    try {
      if (formData.id_appointment) {
        await updateAppointment(formData.id_appointment, formData);
      } else {
        await createAppointment(formData);
      }
      setFormData({
        id_appointment: '',
        user_id: users[0] ? String(users[0].id_user) : '',
        master_id: users[0] ? String(users[0].id_user) : '',
        appointment_date: '',
        note: '',
        is_completed: false,
      });
      loadAllData();
    } catch (err) {
      setFormError(err.message);
    }
  }

  function handleEdit(item) {
    let formattedDate = '';
    if (item.appointment_date) {
      const d = new Date(item.appointment_date);
      formattedDate = d.toISOString().slice(0, 16);
    }

    setFormData({
      id_appointment: item.id_appointment,
      user_id: String(item.user_id),
      master_id: String(item.master_id),
      appointment_date: formattedDate,
      note: item.note || '',
      is_completed: Boolean(item.is_completed),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Вы уверены, что хотите удалить эту запись?')) return;
    try {
      await deleteAppointment(id);
      loadAllData();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCancel() {
    setFormData({
      id_appointment: '',
      user_id: users[0] ? String(users[0].id_user) : '',
      master_id: users[0] ? String(users[0].id_user) : '',
      appointment_date: '',
      note: '',
      is_completed: false,
    });
    setFormError(null);
  }

  const clients = users.filter((u) => u.role_id === 4 || u.role_title === 'Клиент' || !u.role_id);
  const masters = users.filter((u) => u.role_id === 3 || u.role_title === 'Мастер' || u.role_id === 1);

  return (
    <div className="admin-content-card">
      <AdminNavTabs activeSection="appointments" />

      <div className="admin-header-row">
        <h2>Журнал записей клиентов</h2>
        <span className="count-tag">Всего записей: {appointments.length}</span>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {formError && <div className="alert-error">{formError}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <h3>{formData.id_appointment ? 'Редактировать запись' : 'Создать новую запись'}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Клиент *</label>
            <select
              name="user_id"
              value={formData.user_id}
              onChange={handleChange}
              required
            >
              {users.map((u) => (
                <option key={u.id_user} value={u.id_user}>
                  {u.second_name} {u.first_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Мастер (Специалист) *</label>
            <select
              name="master_id"
              value={formData.master_id}
              onChange={handleChange}
              required
            >
              {(masters.length > 0 ? masters : users).map((m) => (
                <option key={m.id_user} value={m.id_user}>
                  {m.second_name} {m.first_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Дата и время записи *</label>
            <input
              type="datetime-local"
              name="appointment_date"
              value={formData.appointment_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Пожелания / Примечание</label>
            <input
              type="text"
              name="note"
              placeholder="Комментарий к визиту"
              value={formData.note}
              onChange={handleChange}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '28px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                name="is_completed"
                checked={formData.is_completed}
                onChange={handleChange}
              />
              <strong>Визит завершен</strong>
            </label>
          </div>
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="btn-primary">
            {formData.id_appointment ? 'Сохранить запись' : 'Создать запись'}
          </button>
          {formData.id_appointment && (
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Отмена
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="loading-state">
          <p>Загрузка записей...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Клиент</th>
                <th>Мастер</th>
                <th>Дата и время</th>
                <th>Примечание</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {appointments
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((a, index) => {
                const clientObj = users.find((u) => String(u.id_user) === String(a.user_id));
                const masterObj = users.find((u) => String(u.id_user) === String(a.master_id));

                const dateStr = a.appointment_date
                  ? new Date(a.appointment_date).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <tr key={a.id_appointment}>
                    <td className="row-number-cell">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      <strong>
                        {a.client_first_name
                          ? `${a.client_second_name || ''} ${a.client_first_name}`
                          : clientObj
                          ? `${clientObj.second_name} ${clientObj.first_name}`
                          : a.client_email || 'Клиент'}
                      </strong>
                      <small style={{ display: 'block', color: '#9ca3af' }}>{a.client_email || clientObj?.email}</small>
                    </td>
                    <td>
                      {a.master_first_name
                        ? `${a.master_second_name || ''} ${a.master_first_name}`
                        : masterObj
                        ? `${masterObj.second_name} ${masterObj.first_name}`
                        : 'Мастер салона'}
                    </td>
                    <td><strong>{dateStr}</strong></td>
                    <td>{a.note || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {a.is_paid && (
                          <span className="badge-status badge-status--completed" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                            Оплачена
                          </span>
                        )}
                        {a.is_completed ? (
                          <span className="badge-status badge-status--completed">Завершена</span>
                        ) : (
                          <span className="badge-status badge-status--pending">Ожидает</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-edit"
                        onClick={() => handleEdit(a)}
                      >
                        Редактировать
                      </button>
                      {!a.is_paid && (
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => handleDelete(a.id_appointment)}
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
            totalItems={appointments.length}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );
}
