import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getReviews, createReview, updateReview, deleteReview } from '../api/reviews';
import { getServices } from '../api/services';
import { useAuth } from '../context/AuthContext';

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
    if (!user || !user.id_user) return null;
    return reviews.find((r) => String(r.user_id) === String(user.id_user));
  }, [user, reviews]);

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id_review);
    setRating(rev.rating);
    setComment(rev.comment);
    setSelectedServiceId(rev.service_id ? String(rev.service_id) : '');
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
      setError('Для публикации необходимо авторизоваться');
      return;
    }
    if (!comment.trim()) {
      setError('Пожалуйста, напишите текст отзыва');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (editingReviewId) {
        await updateReview(editingReviewId, {
          rating,
          comment: comment.trim(),
          service_id: selectedServiceId ? parseInt(selectedServiceId, 10) : null,
        });
        setMessage('Отзыв успешно обновлен');
        handleCancelEdit();
      } else {
        await createReview({
          user_id: user.id_user,
          service_id: selectedServiceId ? parseInt(selectedServiceId, 10) : null,
          rating,
          comment: comment.trim(),
        });
        setMessage('Спасибо за ваш отзыв!');
        setComment('');
        setSelectedServiceId('');
        setCooldownRemaining(180);
      }
      await loadAll();
    } catch (err) {
      if (err.message && err.message.includes('Подождите')) {
        const match = err.message.match(/(\d+)\s*сек/);
        const secs = match ? parseInt(match[1], 10) : 180;
        setCooldownRemaining(secs);
        setError(`Антиспам-защита: повторный отзыв возможен через ${secs} сек.`);
      } else {
        setError(err.message || 'Ошибка сохранения отзыва');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить данный отзыв?')) return;
    try {
      await deleteReview(id);
      await loadAll();
      if (editingReviewId === id) handleCancelEdit();
    } catch (err) {
      alert('Ошибка при удалении: ' + err.message);
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
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>★ {avgRating}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({filteredReviews.length} из {reviews.length})</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Reviews List */}
        <div>
          {/* Filters Bar: Rating & Service */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
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
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
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
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <p style={{ color: 'var(--text-muted)' }}>В этой категории отзывов пока нет</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredReviews.map((rev) => {
                const isAuthor = user && String(user.id_user) === String(rev.user_id);
                const isAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор');

                return (
                  <div
                    key={rev.id_review}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1.25rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {rev.first_name ? `${rev.first_name} ${rev.second_name || ''}` : rev.author_name || 'Гость'}
                        </strong>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                          {rev.created_at ? new Date(rev.created_at).toLocaleDateString('ru-RU') : 'Недавно'}
                          {rev.service_title && ` • ${rev.service_title}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--accent-silver)', fontWeight: '700', fontSize: '0.85rem' }}>
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                        {(isAuthor || isAdmin) && (
                          <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.5rem' }}>
                            {isAuthor && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                                onClick={() => handleStartEdit(rev)}
                              >
                                Изменить
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                              onClick={() => handleDelete(rev.id_review)}
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                      {rev.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Container */}
        <div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              {editingReviewId ? 'Редактирование отзыва' : 'Оставить отзыв'}
            </h3>

            {error && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '0.75rem', padding: '0.4rem' }}>{error}</div>}
            {message && <div className="badge badge-success" style={{ display: 'block', marginBottom: '0.75rem', padding: '0.4rem' }}>{message}</div>}

            {userExistingReview && !editingReviewId && (
              <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Вы уже оставили отзыв к услугам салона.</p>
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
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>
                Повторная публикация доступна через: <strong>{cooldownRemaining} сек.</strong>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Оценка</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      style={{
                        background: rating >= star ? 'var(--accent-silver)' : 'var(--bg-input)',
                        color: rating >= star ? '#0c0e12' : 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.6rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
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

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
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
