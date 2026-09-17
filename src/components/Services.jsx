import { useEffect, useState, useMemo } from 'react';
import { getServices } from '../api/services';
import { getServicesCategories } from '../api/services_categories';
import { getСategories } from '../api/categories';
import { getDiscounts } from '../api/discounts';
import { getUsers } from '../api/users';
import { getReviews, createReview } from '../api/reviews';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { NavLink, useSearchParams } from 'react-router-dom';

export default function Services() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [masters, setMasters] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sortBy, setSortBy] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMessage, setAddMessage] = useState(null);

  // Reviews expansion state per service ID
  const [expandedReviews, setExpandedReviews] = useState({});

  // Quick Review Modal State
  const [reviewService, setReviewService] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(null);
  const [reviewCooldown, setReviewCooldown] = useState(0);

  // Quick Time-Slot Booking Modal
  const [quickBookService, setQuickBookService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState('11:30');
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [quickBookSuccess, setQuickBookSuccess] = useState(null);
  const [quickBookSubmitting, setQuickBookSubmitting] = useState(false);

  const timeSlots = ['09:00', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:30'];

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [servicesData, categoriesData, linksData, discountsData, usersData, reviewsData] = await Promise.all([
        getServices(),
        getСategories(),
        getServicesCategories(),
        getDiscounts(),
        getUsers(),
        getReviews(),
      ]);

      setServices(servicesData);
      setCategories(categoriesData);
      setServiceCategories(linksData);
      setDiscounts(discountsData);
      setReviews(reviewsData);

      const staffMasters = usersData.filter((u) => u.role_id === 3 || u.role_title === 'Мастер');
      setMasters(staffMasters);
      if (staffMasters.length > 0) {
        setSelectedMasterId(String(staffMasters[0].id_user));
      }
    } catch (err) {
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle URL category query param
  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam) {
      setSelectedCategoryIds([Number(catParam)]);
    }
  }, [searchParams]);

  // Cooldown countdown timer
  useEffect(() => {
    if (reviewCooldown <= 0) return;
    const timer = setInterval(() => {
      setReviewCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [reviewCooldown]);

  const userDiscount = useMemo(() => {
    if (!user || !user.discount_id) return null;
    const found = discounts.find((d) => String(d.id_discount) === String(user.discount_id));
    return found && found.percentage > 0 ? found : null;
  }, [user, discounts]);

  const getServiceDiscount = (service) => {
    if (!service.discount_id) return null;
    const found = discounts.find((d) => String(d.id_discount) === String(service.discount_id));
    return found && found.percentage > 0 ? found : null;
  };

  const getServiceCategories = (service) => {
    return serviceCategories
      .filter((link) => String(link.service_id) === String(service.id_service))
      .map((link) => categories.find((c) => String(c.id_category) === String(link.category_id)))
      .filter(Boolean);
  };

  const calculateFinalPrice = (basePrice, serviceDisc, userDisc) => {
    const original = parseFloat(basePrice) || 0;
    const servPct = serviceDisc ? Number(serviceDisc.percentage) : 0;
    const userPct = userDisc ? Number(userDisc.percentage) : 0;
    const effectivePct = Math.min(75, servPct + userPct);

    if (effectivePct === 0) {
      return { finalPrice: original, effectivePct: 0, hasDiscount: false };
    }
    const finalPrice = Math.round(original * (1 - effectivePct / 100));
    return { finalPrice, effectivePct, hasDiscount: true };
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  // Map reviews by service_id
  const reviewsByService = useMemo(() => {
    const map = {};
    for (const r of reviews) {
      if (r.service_id) {
        if (!map[r.service_id]) map[r.service_id] = [];
        map[r.service_id].push(r);
      }
    }
    return map;
  }, [reviews]);

  const getServiceStats = (serviceId) => {
    const servReviews = reviewsByService[serviceId] || [];
    if (servReviews.length === 0) {
      return { count: 0, avg: null };
    }
    const sum = servReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return { count: servReviews.length, avg: (sum / servReviews.length).toFixed(1) };
  };

  const toggleReviewsExpand = (serviceId) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const openReviewModal = (service) => {
    setReviewService(service);
    setReviewRating(5);
    setReviewComment('');
    setReviewError(null);
    setReviewSuccess(null);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setReviewError('Для публикации отзыва необходимо авторизоваться');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError('Пожалуйста, напишите текст отзыва');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      await createReview({
        user_id: user.id_user,
        service_id: reviewService.id_service,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewSuccess('Спасибо! Ваш отзыв опубликован.');
      setReviewComment('');
      setReviewCooldown(180);

      // Auto expand reviews for this service so user immediately sees their review
      setExpandedReviews((prev) => ({
        ...prev,
        [reviewService.id_service]: true,
      }));

      // Reload reviews
      const updatedReviews = await getReviews();
      setReviews(updatedReviews);

      setTimeout(() => {
        setReviewService(null);
        setReviewSuccess(null);
      }, 1500);
    } catch (err) {
      if (err.message && err.message.includes('Подождите')) {
        const match = err.message.match(/(\d+)\s*сек/);
        const secs = match ? parseInt(match[1], 10) : 180;
        setReviewCooldown(secs);
        setReviewError(`Антиспам-защита: повторный отзыв возможен через ${secs} сек.`);
      } else {
        setReviewError(err.message || 'Ошибка сохранения отзыва');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const filteredServices = useMemo(() => {
    let result = services;

    if (selectedCategoryIds.length > 0) {
      result = result.filter((service) => {
        const serviceCats = serviceCategories
          .filter((link) => String(link.service_id) === String(service.id_service))
          .map((link) => link.category_id);
        return selectedCategoryIds.some((selectedId) => serviceCats.includes(selectedId));
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);

      result = result.filter((service) => {
        const serviceCats = getServiceCategories(service).map((c) => c.title.toLowerCase()).join(' ');
        const servicePriceStr = String(service.price);
        const serviceDurationStr = `${service.duration} мин минут`;
        const searchableText = `${service.title} ${service.description || ''} ${serviceCats} ${servicePriceStr} ${serviceDurationStr}`.toLowerCase();

        return tokens.every((token) => {
          if (searchableText.includes(token)) return true;
          if (token.length >= 4) {
            const stem = token.substring(0, token.length - 1);
            if (searchableText.includes(stem)) return true;
          }
          return false;
        });
      });
    }

    result = result.filter((service) => {
      const servDisc = getServiceDiscount(service);
      const { finalPrice } = calculateFinalPrice(service.price, servDisc, userDiscount);
      return finalPrice <= maxPrice;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'price-asc') {
        return parseFloat(a.price) - parseFloat(b.price);
      }
      if (sortBy === 'price-desc') {
        return parseFloat(b.price) - parseFloat(a.price);
      }
      if (sortBy === 'duration') {
        return (a.duration || 30) - (b.duration || 30);
      }
      if (sortBy === 'rating') {
        const ratingA = parseFloat(getServiceStats(a.id_service).avg) || 0;
        const ratingB = parseFloat(getServiceStats(b.id_service).avg) || 0;
        return ratingB - ratingA;
      }
      return 0;
    });
  }, [services, selectedCategoryIds, searchQuery, maxPrice, sortBy, serviceCategories, categories, discounts, userDiscount, reviewsByService]);

  const handleAddToCart = async (service) => {
    try {
      await addToCart(service);
      setAddMessage(`«${service.title}» добавлена в корзину`);
      setTimeout(() => setAddMessage(null), 3000);
    } catch {
      setAddMessage('Ошибка при добавлении в корзину');
    }
  };

  const handleQuickBookSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Для онлайн-записи необходимо войти в систему.');
      return;
    }
    setQuickBookSubmitting(true);
    try {
      const appointmentDateTime = `${selectedDate}T${selectedSlot}:00`;
      const servDisc = getServiceDiscount(quickBookService);
      const { finalPrice } = calculateFinalPrice(quickBookService.price, servDisc, userDiscount);

      const appRes = await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id_user,
          master_id: selectedMasterId ? Number(selectedMasterId) : null,
          appointment_date: appointmentDateTime,
          note: `Экспресс-запись на услугу «${quickBookService.title}»`,
          is_completed: false,
        }),
      });
      const newApp = await appRes.json();

      await fetch('http://localhost:3001/api/appointments-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: newApp.id_appointment,
          service_id: quickBookService.id_service,
          quantity: 1,
        }),
      });

      const chosenMaster = masters.find((m) => String(m.id_user) === String(selectedMasterId));
      setQuickBookSuccess({
        date: selectedDate,
        time: selectedSlot,
        masterName: chosenMaster ? `${chosenMaster.first_name} ${chosenMaster.second_name || ''}` : 'Любой свободный мастер',
        serviceTitle: quickBookService.title,
        finalPrice,
      });
    } catch (err) {
      alert('Ошибка при оформлении записи: ' + err.message);
    } finally {
      setQuickBookSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Загрузка каталога услуг...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--accent-danger)' }}>{error}</p>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Каталог услуг</h1>
          <p className="page-subtitle">
            Профессиональные услуги салона с прозрачными ценами, отзывами гостей и онлайн-записью
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <NavLink to="/reviews" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>★ Все отзывы салона</span>
            <span className="badge badge-primary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{reviews.length}</span>
          </NavLink>
          {userDiscount && (
            <div className="badge badge-success" style={{ padding: '0.4rem 0.8rem' }}>
              Персональная скидка: {userDiscount.percentage}%
            </div>
          )}
        </div>
      </div>

      {addMessage && (
        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-strong)', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{addMessage}</span>
          <NavLink to="/cart" className="btn btn-primary btn-sm">Перейти в корзину</NavLink>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="services-filter-bar">
        <div>
          <input
            type="text"
            placeholder="Поиск по названию, описанию или категории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="popular">По умолчанию</option>
            <option value="rating">По рейтингу (высокий)</option>
            <option value="price-asc">Сначала недорогие</option>
            <option value="price-desc">Сначала премиум</option>
            <option value="duration">По времени (быстрые)</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>До: {maxPrice} ₽</span>
          <input
            type="range"
            min="500"
            max="10000"
            step="100"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="admin-nav-bar" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`admin-nav-tab ${selectedCategoryIds.length === 0 ? 'active' : ''}`}
          onClick={() => setSelectedCategoryIds([])}
        >
          Все ({services.length})
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategoryIds.includes(cat.id_category);
          return (
            <button
              key={cat.id_category}
              type="button"
              className={`admin-nav-tab ${isSelected ? 'active' : ''}`}
              onClick={() => handleCategoryToggle(cat.id_category)}
            >
              {cat.title}
            </button>
          );
        })}
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>По вашему запросу услуг не найдено</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategoryIds([]);
              setMaxPrice(10000);
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="services-grid">
          {filteredServices.map((service) => {
            const servDisc = getServiceDiscount(service);
            const { finalPrice, effectivePct, hasDiscount } = calculateFinalPrice(
              service.price,
              servDisc,
              userDiscount
            );
            const serviceCats = getServiceCategories(service);
            const stats = getServiceStats(service.id_service);
            const servReviewsList = reviewsByService[service.id_service] || [];
            const isExpanded = !!expandedReviews[service.id_service];

            return (
              <div key={service.id_service} className="service-card">
                <div className="service-card-media">
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.title}
                      className="service-card-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="service-card-placeholder"
                    style={{ display: service.image_url ? 'none' : 'flex' }}
                  >
                    <span>{serviceCats[0]?.title || 'УСЛУГА САЛОНА'}</span>
                  </div>
                </div>

                <div className="service-card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h3 className="service-card-title">{service.title}</h3>
                    {hasDiscount && (
                      <span className="badge badge-warning">-{effectivePct}%</span>
                    )}
                  </div>

                  {/* Service Rating Summary */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.35rem 0 0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--accent-silver)', fontWeight: '700' }}>
                        {stats.avg ? `★ ${stats.avg}` : '★ 5.0'}
                      </span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {stats.count > 0 ? `(${stats.count} ${stats.count === 1 ? 'отзыв' : stats.count < 5 ? 'отзыва' : 'отзывов'})` : '(нет отзывов)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleReviewsExpand(service.id_service)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isExpanded ? 'var(--text-main)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        textDecoration: 'underline',
                        padding: '0.1rem 0.3rem',
                      }}
                    >
                      {isExpanded ? 'Скрыть отзывы ▲' : `Отзывы (${stats.count}) ▼`}
                    </button>
                  </div>

                  <p className="service-card-desc">{service.description || 'Профессиональная услуга мастеров салона.'}</p>

                  <div className="service-card-meta">
                    <div>
                      <span className="service-price">{finalPrice.toLocaleString()} ₽</span>
                      {hasDiscount && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textDecoration: 'line-through', marginLeft: '0.4rem' }}>
                          {parseFloat(service.price).toLocaleString()} ₽
                        </span>
                      )}
                    </div>
                    <span className="service-duration">{service.duration || 30} мин.</span>
                  </div>

                  {/* Primary Card Actions */}
                  <div className="service-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddToCart(service)}
                    >
                      В корзину
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setQuickBookService(service);
                        setQuickBookSuccess(null);
                      }}
                    >
                      Записаться
                    </button>
                  </div>

                  {/* Secondary Reviews Quick Action */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      onClick={() => openReviewModal(service)}
                    >
                      ✍ Оставить отзыв
                    </button>
                    <NavLink
                      to={`/reviews?serviceId=${service.id_service}`}
                      className="btn btn-sm"
                      style={{
                        background: 'var(--bg-input)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.5rem',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Все отзывы
                    </NavLink>
                  </div>

                  {/* Expandable Service Reviews Section */}
                  {isExpanded && (
                    <div className="service-card-reviews-panel" style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-strong)', background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>
                          Отзывы к услуге ({servReviewsList.length})
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => openReviewModal(service)}
                        >
                          + Написать
                        </button>
                      </div>

                      {servReviewsList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '0.75rem 0.25rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Пока нет отзывов к этой услуге.
                          <div style={{ marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => openReviewModal(service)}
                            >
                              Будьте первым!
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {servReviewsList.map((rev) => (
                            <div
                              key={rev.id_review}
                              style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                padding: '0.5rem 0.6rem',
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <strong style={{ color: 'var(--text-main)' }}>
                                  {rev.first_name ? `${rev.first_name} ${rev.second_name || ''}` : rev.author_name || 'Клиент'}
                                </strong>
                                <span style={{ color: 'var(--accent-silver)', fontWeight: '700' }}>
                                  {'★'.repeat(rev.rating)}
                                </span>
                              </div>
                              <p style={{ color: 'var(--text-muted)', margin: '0 0 0.2rem', lineHeight: '1.3' }}>
                                {rev.comment}
                              </p>
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                                {rev.created_at ? new Date(rev.created_at).toLocaleDateString('ru-RU') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leave Review Modal */}
      {reviewService && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title">Отзыв об услуге</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setReviewService(null)}
              >
                ✕
              </button>
            </div>

            {reviewSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div className="badge badge-success" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Успешно</div>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>{reviewService.title}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{reviewSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Выбранная услуга
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1rem', marginTop: '0.2rem' }}>
                    {reviewService.title}
                  </div>
                </div>

                {reviewError && (
                  <div className="badge badge-danger" style={{ display: 'block', marginBottom: '0.75rem', padding: '0.4rem' }}>
                    {reviewError}
                  </div>
                )}

                {reviewCooldown > 0 && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--accent-warning)' }}>
                    Повторный отзыв возможен через: <strong>{reviewCooldown} сек.</strong>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ваша оценка</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        style={{
                          flex: 1,
                          background: reviewRating >= star ? 'var(--accent-silver)' : 'var(--bg-input)',
                          color: reviewRating >= star ? '#0c0e12' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '0.4rem 0.2rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                        onClick={() => setReviewRating(star)}
                      >
                        ★ {star}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Текст отзыва</label>
                  <textarea
                    rows={4}
                    placeholder={`Поделитесь впечатлением от услуги «${reviewService.title}»...`}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={reviewSubmitting || reviewCooldown > 0}
                  >
                    {reviewSubmitting ? 'Отправка...' : 'Опубликовать отзыв'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReviewService(null)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick Booking Modal */}
      {quickBookService && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title">Онлайн-запись</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setQuickBookService(null)}
              >
                ✕
              </button>
            </div>

            {quickBookSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div className="badge badge-success" style={{ marginBottom: '1rem', display: 'inline-block' }}>Запись подтверждена</div>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>{quickBookSuccess.serviceTitle}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Дата и время: <strong>{quickBookSuccess.date}, {quickBookSuccess.time}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Мастер: <strong>{quickBookSuccess.masterName}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Сумма к оплате: <strong>{quickBookSuccess.finalPrice} ₽</strong>
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setQuickBookService(null)}
                >
                  Готово
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuickBookSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{quickBookService.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Длительность: {quickBookService.duration} мин. | Стоимость: {quickBookService.price} ₽
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Мастер</label>
                  <select
                    value={selectedMasterId}
                    onChange={(e) => setSelectedMasterId(e.target.value)}
                  >
                    {masters.map((m) => (
                      <option key={m.id_user} value={m.id_user}>
                        {m.first_name} {m.second_name || ''} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Дата визита</label>
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

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  disabled={quickBookSubmitting}
                >
                  {quickBookSubmitting ? 'Оформление...' : 'Подтвердить запись'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}