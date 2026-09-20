import { useState, useEffect } from 'react';
import { getServices, createService, updateService, deleteService } from '../api/services';
import { getDiscounts } from '../api/discounts';
import AdminNavTabs from './AdminNavTabs';
import Pagination from './Pagination';

export default function ServicesList() {
  const [services, setServices] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formData, setFormData] = useState({
    id_service: '',
    title: '',
    description: '',
    duration: '45',
    price: '',
    discount_id: '1',
    image_url: '',
  });

  const [formError, setFormError] = useState(null);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);
      const [servicesData, discountsData] = await Promise.all([
        getServices(),
        getDiscounts(),
      ]);
      setServices(servicesData);
      setDiscounts(discountsData);
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
      if (formData.id_service) {
        await updateService(formData.id_service, formData);
      } else {
        await createService(formData);
      }
      setFormData({
        id_service: '',
        title: '',
        description: '',
        duration: '45',
        price: '',
        discount_id: '1',
        image_url: '',
      });
      loadAllData();
    } catch (err) {
      setFormError(err.message);
    }
  }

  function handleEdit(service) {
    setFormData({
      id_service: service.id_service,
      title: service.title || '',
      description: service.description || '',
      duration: String(service.duration || '45'),
      price: String(service.price || ''),
      discount_id: String(service.discount_id || '1'),
      image_url: service.image_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Вы уверены, что хотите удалить эту услугу?')) return;
    try {
      await deleteService(id);
      loadAllData();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCancel() {
    setFormData({
      id_service: '',
      title: '',
      description: '',
      duration: '45',
      price: '',
      discount_id: '1',
      image_url: '',
    });
    setFormError(null);
  }

  return (
    <div className="admin-content-card">
      <AdminNavTabs activeSection="services" />

      <div className="admin-header-row">
        <h2>Каталог и номенклатура услуг</h2>
        <span className="count-tag">Всего услуг: {services.length}</span>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {formError && <div className="alert-error">{formError}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <h3>{formData.id_service ? 'Редактировать услугу' : 'Добавить новую услугу'}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Название услуги *</label>
            <input
              type="text"
              name="title"
              placeholder="Например: Стрижка Fade"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Длительность (минут) *</label>
            <input
              type="number"
              name="duration"
              min="5"
              step="5"
              placeholder="45"
              value={formData.duration}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Стоимость (₽) *</label>
            <input
              type="number"
              name="price"
              min="0"
              step="50"
              placeholder="1500"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Промо-скидка</label>
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

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>URL изображения (ссылка на фото)</label>
            <input
              type="url"
              name="image_url"
              placeholder="https://images.unsplash.com/photo-..."
              value={formData.image_url}
              onChange={handleChange}
            />
            <small style={{ color: '#9ca3af', marginTop: '4px', display: 'block' }}>
              Если ссылка не указана, будет использована стильная шаблонная заглушка салона.
            </small>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Описание процедуры</label>
            <textarea
              name="description"
              rows="2"
              placeholder="Подробное описание этапов услуги и используемых средств..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="btn-primary">
            {formData.id_service ? 'Сохранить услугу' : 'Добавить услугу'}
          </button>
          {formData.id_service && (
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Отмена
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="loading-state">
          <p>Загрузка услуг...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '70px' }}>Фото</th>
                <th>Услуга</th>
                <th>Длительность</th>
                <th>Стоимость</th>
                <th>Промо-скидка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {services
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((s, index) => {
                const discountObj = discounts.find((d) => String(d.id_discount) === String(s.discount_id));

                return (
                  <tr key={s.id_service}>
                    <td className="row-number-cell">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.title}
                          className="table-thumbnail-img"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="table-thumbnail-placeholder">ФОТО</div>
                      )}
                    </td>
                    <td>
                      <strong>{s.title}</strong>
                      <p className="table-desc-snippet">{s.description || '—'}</p>
                    </td>
                    <td>
                      <span className="badge-duration">{s.duration || 30} мин.</span>
                    </td>
                    <td>
                      <strong>{parseFloat(s.price).toLocaleString()} ₽</strong>
                    </td>
                    <td>
                      {discountObj && discountObj.percentage > 0 ? (
                        <span className="badge-discount-tag">
                          {discountObj.title} (-{discountObj.percentage}%)
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Базовая цена</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-edit"
                        onClick={() => handleEdit(s)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="btn-action-delete"
                        onClick={() => handleDelete(s.id_service)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalItems={services.length}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );
}