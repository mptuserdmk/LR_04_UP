import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getReviews, createReview, updateReview, deleteReview } from '../api/reviews';
import { getServices } from '../api/services';
import { useAuth } from '../context/AuthContext';
import Pagination from './Pagination';

export default function Reviews() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviews, setReviews] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  // Form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [filterRating, setFilterRating] = useState('all');
  const [filterServiceId, setFilterServiceId] = useState('all');

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [revs, servs] = await Promise.all([getReviews(), getServices()]);
      setReviews(revs);
      setServices(servs);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки отзывов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Handle URL query param for service preselection
  useEffect(() => {
    const sId = searchParams.get('serviceId');
    if (sId) {
      setSelectedServiceId(sId);
      setFilterServiceId(sId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const userExistingReview = useMemo(() => {
    if (!user) return null;
    return reviews.find((r) => String(r.user_id) === String(user.id_user));
  }, [user, reviews]);

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id_review);
    setRating(rev.rating);
    setComment(rev.comment);
    setSelectedServiceId(rev.service_id ? String(rev.service_id) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setRating(5);
    setComment('');
    setSelectedServiceId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Для отправки отзыва необходимо войти в аккаунт');
      return;
    }

    if (!comment.trim()) {
      setError('Напишите текст отзыва');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (editingReviewId) {
        const updated = await updateReview(editingReviewId, {
          rating,
          comment: comment.trim(),
          service_id: selectedServiceId ? Number(selectedServiceId) : null,
        });
        setReviews((prev) => prev.map((r) => (r.id_review === updated.id_review ? { ...r, ...updated } : r)));
        setMessage('Отзыв успешно обновлен!');
        handleCancelEdit();
      } else {
        const created = await createReview({
          user_id: user.id_user,
          author_name: `${user.first_name || ''} ${user.second_name || ''}`.trim() || user.email,
          service_id: selectedServiceId ? Number(selectedServiceId) : null,
          rating,
          comment: comment.trim(),
        });
        setReviews((prev) => [created, ...prev]);
        setMessage('Спасибо! Ваш отзыв успешно опубликован.');
        setComment('');
        setRating(5);
        setSelectedServiceId('');
        setCooldownRemaining(30);
      }
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setError(err.message || 'Ошибка при сохранении отзыва');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы действительно хотите удалить этот отзыв?')) return;
    try {
      setError(null);
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id_review !== id));
      setMessage('Отзыв удален');
      if (editingReviewId === id) handleCancelEdit();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Ошибка при удалении отзыва');
    }
  };

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchRating = filterRating === 'all' || String(r.rating) === String(filterRating);
      const matchService =
        filterServiceId === 'all'
          ? true
          : filterServiceId === 'general'
          ? !r.service_id
          : String(r.service_id) === String(filterServiceId);
      return matchRating && matchService;
    });
  }, [reviews, filterRating, filterServiceId]);

  const avgRating = useMemo(() => {
    if (filteredReviews.length === 0) return reviews.length === 0 ? '5.0' : '-';
    const sum = filteredReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / filteredReviews.length).toFixed(1);
  }, [reviews, filteredReviews]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '40px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Загрузка отзывов...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Отзывы клиентов</h1>
          <p className="page-subtitle">Мнения гостей о визитах и качестве обслуживания</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>★ {avgRating}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>({filteredReviews.length} из {reviews.length})</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Reviews List */}
        <div>
          {/* Filters Bar: Rating & Service */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="admin-nav-bar" style={{ margin: 0, flexWrap: 'wrap' }}>
              {['all', '5', '4', '3', '2', '1'].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`admin-nav-tab ${filterRating === val ? 'active' : ''}`}
                  onClick={() => setFilterRating(val)}
                >
                  {val === 'all' ? `Все оценки` : `★ ${val}`}
                </button>
              ))}
            </div>

            <div style={{ minWidth: '200px' }}>
              <select
                value={filterServiceId}
                onChange={(e) => setFilterServiceId(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <option value="all">Все услуги и салон ({reviews.length})</option>
                <option value="general">Общие отзывы о салоне</option>
                {services.map((s) => {
                  const count = reviews.filter((r) => String(r.service_id) === String(s.id_service)).length;
                  return (
                    <option key={s.id_service} value={s.id_service}>
                      {s.title} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <p style={{ color: 'var(--text-muted)' }}>В этой категории отзывов пока нет</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredReviews
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map((rev) => {
                const isAuthor = user && String(user.id_user) === String(rev.user_id);
                const isAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор');

                return (
                  <div
                    key={rev.id_review}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>
                          {rev.first_name ? `${rev.first_name} ${rev.second_name || ''}` : rev.author_name || 'Гость'}
                        </strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          {rev.created_at ? new Date(rev.created_at).toLocaleDateString('ru-RU') : 'Недавно'}
                          {rev.service_title && ` • ${rev.service_title}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '14px' }}>
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                        {(isAuthor || isAdmin) && (
                          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                            {isAuthor && (
                              <button
                                type="button"
                                className="btn-action-edit"
                                onClick={() => handleStartEdit(rev)}
                              >
                                Изменить
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-action-delete"
                              onClick={() => handleDelete(rev.id_review)}
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: '1.4' }}>
                      {rev.comment}
                    </p>
                  </div>
                );
              })}

              <Pagination
                currentPage={currentPage}
                totalItems={filteredReviews.length}
                pageSize={PAGE_SIZE}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </div>

        {/* Form Container */}
        <div>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              {editingReviewId ? 'Редактирование отзыва' : 'Оставить отзыв'}
            </h3>

            {error && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '10px', padding: '6px' }}>{error}</div>}
            {message && <div className="badge badge-success" style={{ display: 'block', marginBottom: '10px', padding: '6px' }}>{message}</div>}

            {userExistingReview && !editingReviewId && (
              <div style={{ background: '#f9fafb', border: '1px solid var(--border)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>Вы уже оставили отзыв к услугам салона.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleStartEdit(userExistingReview)}
                >
                  Редактировать мой отзыв
                </button>
              </div>
            )}

            {cooldownRemaining > 0 && !editingReviewId && (
              <div style={{ background: 'var(--warning-bg)', border: '1px solid #fde68a', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: 'var(--warning)' }}>
                Повторная публикация доступна через: <strong>{cooldownRemaining} сек.</strong>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Оценка</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      style={{
                        background: rating >= star ? 'var(--accent)' : '#fff',
                        color: rating >= star ? '#fff' : 'var(--text-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                      }}
                      onClick={() => setRating(star)}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Услуга (необязательно)</label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                >
                  <option value="">Общий отзыв о салоне</option>
                  {services.map((s) => (
                    <option key={s.id_service} value={s.id_service}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Текст отзыва</label>
                <textarea
                  rows={4}
                  placeholder="Опишите ваши впечатления от визита..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submitting || (cooldownRemaining > 0 && !editingReviewId)}
                >
                  {submitting ? 'Сохранение...' : editingReviewId ? 'Обновить' : 'Опубликовать'}
                </button>
                {editingReviewId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    Отмена
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
