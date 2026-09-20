import { useEffect, useState, useMemo } from 'react';
import { getServices } from '../api/services';
import { getServicesCategories } from '../api/services_categories';
import { getСategories, createCategory } from '../api/categories';
import { getDiscounts } from '../api/discounts';
import { getUsers } from '../api/users';
import { getReviews, createReview } from '../api/reviews';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { NavLink, useSearchParams } from 'react-router-dom';
import Pagination from './Pagination';

export default function Services() {
  const { user } = useAuth();
  const { addToCart, cart } = useCart();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [masters, setMasters] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sortBy, setSortBy] = useState('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  // New Category inline form for Admin (from PR3)
  const [newCatTitle, setNewCatTitle] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [catError, setCatError] = useState('');

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

  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор');
  const isStaffOrAdmin = user && (user.role_id === 1 || user.role_id === 2 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор' || user.role_title?.includes('Сотрудник'));
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
      setError(err.message || 'Ошибка загрузки данных каталога с сервера');
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
    if (service.discount_percentage && service.discount_percentage > 0) {
      return { percentage: service.discount_percentage, title: service.discount_title };
    }
    if (!service.discount_id) return null;
    const found = discounts.find((d) => String(d.id_discount) === String(service.discount_id));
    return found && found.percentage > 0 ? found : null;
  };

  const getServiceCategories = (service) => {
    if (service.category_ids && Array.isArray(service.category_ids)) {
      return categories.filter((c) => service.category_ids.includes(c.id_category));
    }
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

  const getItemCartQty = (serviceId) => {
    const found = cart.find((item) => String(item.service_id) === String(serviceId));
    return found ? found.quantity : 0;
  };

  const handleCategoryCheckboxChange = (categoryId) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatTitle.trim()) return;
    try {
      setAddingCategory(true);
      setCatError('');
      const created = await createCategory({ title: newCatTitle.trim() });
      setCategories((prev) => [...prev, created]);
      setNewCatTitle('');
      setToastMessage(`Категория «${created.title}» успешно создана`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      setCatError(err.message || 'Ошибка создания категории');
    } finally {
      setAddingCategory(false);
    }
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
    const servRevs = reviewsByService[serviceId] || [];
    if (servRevs.length === 0) return { avg: null, count: 0 };
    const sum = servRevs.reduce((acc, r) => acc + (r.rating || 5), 0);
    return {
      avg: (sum / servRevs.length).toFixed(1),
      count: servRevs.length,
    };
  };

  const toggleReviewsExpand = (serviceId) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const openReviewModal = (service) => {
    if (!user) {
      alert('Для написания отзыва необходимо войти в систему.');
      return;
    }
    setReviewService(service);
    setReviewRating(5);
    setReviewComment('');
    setReviewError(null);
    setReviewSuccess(null);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      setReviewError('Введите текст отзыва');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const newRev = await createReview({
        user_id: user.id_user,
        author_name: `${user.first_name || ''} ${user.second_name || ''}`.trim() || user.email,
        service_id: reviewService.id_service,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviews((prev) => [newRev, ...prev]);
      setReviewSuccess('Спасибо! Ваш отзыв успешно опубликован.');
      setReviewCooldown(30);
      setTimeout(() => {
        setReviewService(null);
      }, 2000);
    } catch (err) {
      setReviewError(err.message || 'Ошибка отправки отзыва');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAddToCart = (service) => {
    if (isMainAdmin) return;
    try {
      addToCart({
        id_service: service.id_service,
        title: service.title,
        price: service.price,
        duration: service.duration,
        discount_percentage: getServiceDiscount(service)?.percentage || 0,
      });
      setToastMessage(`«${service.title}» добавлена в корзину!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch {
      setToastMessage('Ошибка при добавлении в корзину');
    }
  };

  const handleQuickBookSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Для онлайн-записи необходимо войти в систему.');
      return;
    }
    if (isMainAdmin) {
      alert('Администраторам недоступна клиентская запись на услуги.');
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

  const filteredServices = useMemo(() => {
    let result = [...services];

    // Filter by Categories
    if (selectedCategoryIds.length > 0) {
      result = result.filter((service) => {
        const serviceCatIds = service.category_ids && Array.isArray(service.category_ids)
          ? service.category_ids
          : serviceCategories
              .filter((link) => String(link.service_id) === String(service.id_service))
              .map((link) => link.category_id);

        return selectedCategoryIds.some((selectedId) => serviceCatIds.includes(selectedId));
      });
    }

    // Filter by Discount Only
    if (onlyDiscounted) {
      result = result.filter((service) => {
        const servDisc = getServiceDiscount(service);
        return servDisc && servDisc.percentage > 0;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);

      result = result.filter((service) => {
        const serviceCats = getServiceCategories(service).map((c) => c.title.toLowerCase()).join(' ');
        const servicePriceStr = String(service.price);
        const serviceDurationStr = `${service.duration} мин`;
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

    // Max price filter
    result = result.filter((service) => {
      const servDisc = getServiceDiscount(service);
      const { finalPrice } = calculateFinalPrice(service.price, servDisc, userDiscount);
      return finalPrice <= maxPrice;
    });

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'price-asc') return parseFloat(a.price) - parseFloat(b.price);
      if (sortBy === 'price-desc') return parseFloat(b.price) - parseFloat(a.price);
      if (sortBy === 'duration') return (a.duration || 30) - (b.duration || 30);
      if (sortBy === 'discount') {
        const discA = getServiceDiscount(a)?.percentage || 0;
        const discB = getServiceDiscount(b)?.percentage || 0;
        return discB - discA;
      }
      if (sortBy === 'rating') {
        const rA = parseFloat(getServiceStats(a.id_service).avg || 0);
        const rB = parseFloat(getServiceStats(b.id_service).avg || 0);
        return rB - rA;
      }
      return 0;
    });
  }, [services, selectedCategoryIds, onlyDiscounted, searchQuery, maxPrice, sortBy, serviceCategories, categories, discounts, userDiscount, reviews]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryIds, onlyDiscounted, searchQuery, maxPrice, sortBy]);

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredServices.slice(start, start + PAGE_SIZE);
  }, [filteredServices, currentPage, PAGE_SIZE]);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Каталог услуг</h1>
          <p className="page-subtitle">
            Профессиональные услуги салона, прозрачные цены и гарантированные скидки
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NavLink to="/reviews" className="btn btn-secondary btn-sm">
            ★ Все отзывы ({reviews.length})
          </NavLink>
          {userDiscount && (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Персональный купон: <strong>{userDiscount.title} ({userDiscount.percentage}%)</strong>
            </div>
          )}
        </div>
      </div>

      {/* Toast Message Banner */}
      {toastMessage && (
        <div className="success-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{toastMessage}</span>
          <NavLink to="/cart" className="btn btn-primary btn-sm">Перейти в корзину</NavLink>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div className="loading-state">
          <p>Загрузка каталога услуг с сервера API...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-banner">
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>Ошибка при запросе к серверу</p>
          <p>{error}</p>
          <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
            Повторить попытку
          </button>
        </div>
      )}

      {/* Main Two-Column Layout with ASIDE on the left */}
      {!loading && !error && (
        <div className="catalog-layout">
          {/* ASIDE: Categories with Checkboxes & Filters */}
          <aside className="catalog-aside">
            <div className="aside-section">
              <div className="aside-header">
                <h3 className="aside-title">Категории</h3>
                {selectedCategoryIds.length > 0 && (
                  <button
                    type="button"
                    className="aside-reset-btn"
                    onClick={() => setSelectedCategoryIds([])}
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* Checkbox: All categories */}
              <label className="category-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.length === 0}
                  onChange={() => setSelectedCategoryIds([])}
                />
                <span className="category-label-text">Все категории</span>
                <span className="category-count">{services.length}</span>
              </label>

              {/* Dynamic Categories list with Checkboxes */}
              <div className="categories-checkbox-list">
                {categories.map((cat) => {
                  const isChecked = selectedCategoryIds.includes(cat.id_category);
                  const count = services.filter((s) => {
                    const catIds = s.category_ids || serviceCategories.filter((sc) => sc.service_id === s.id_service).map((sc) => sc.category_id);
                    return catIds.includes(cat.id_category);
                  }).length;

                  return (
                    <label key={cat.id_category} className={`category-checkbox-label ${isChecked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCategoryCheckboxChange(cat.id_category)}
                      />
                      <span className="category-label-text">{cat.title}</span>
                      <span className="category-count">{count}</span>
                    </label>
                  );
                })}
              </div>

              {/* Admin direct category creation inside aside */}
              {isStaffOrAdmin && (
                <div className="aside-admin-box">
                  <div className="aside-admin-title">+ Добавить категорию</div>
                  <form onSubmit={handleAddCategory} className="aside-admin-form">
                    <input
                      type="text"
                      placeholder="Название категории..."
                      value={newCatTitle}
                      onChange={(e) => setNewCatTitle(e.target.value)}
                      disabled={addingCategory}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={addingCategory || !newCatTitle.trim()}>
                      {addingCategory ? '...' : 'Добавить'}
                    </button>
                  </form>
                  {catError && <div className="aside-admin-error">{catError}</div>}
                </div>
              )}
            </div>

            {/* Aside Special Filters */}
            <div className="aside-section">
              <h3 className="aside-title">Фильтр скидок</h3>
              <label className="category-checkbox-label">
                <input
                  type="checkbox"
                  checked={onlyDiscounted}
                  onChange={(e) => setOnlyDiscounted(e.target.checked)}
                />
                <span className="category-label-text">Товары со скидкой</span>
                <span className="category-count">
                  {services.filter((s) => (getServiceDiscount(s)?.percentage || 0) > 0).length}
                </span>
              </label>
            </div>

            {/* Aside Price Slider */}
            <div className="aside-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h3 className="aside-title">Макс. стоимость</h3>
                <span style={{ fontSize: '13px', color: 'var(--text-h)', fontWeight: '600' }}>{maxPrice.toLocaleString()} ₽</span>
              </div>
              <input
                type="range"
                min="500"
                max="10000"
                step="250"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </aside>

          {/* MAIN CONTENT: Top Toolbar & Services Grid */}
          <main className="catalog-main">
            <div className="catalog-toolbar">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Поиск по названию или описанию услуги..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="sort-box">
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Сортировка:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="popular">По умолчанию</option>
                  <option value="price-asc">По возрастанию цены</option>
                  <option value="price-desc">По убыванию цены</option>
                  <option value="discount">По размеру скидки</option>
                  <option value="rating">По рейтингу</option>
                  <option value="duration">По длительности (быстрые)</option>
                </select>
              </div>
            </div>

            {/* Results Count & Active Filters Bar */}
            <div className="catalog-results-bar">
              <span className="results-count">Найдено услуг: <strong>{filteredServices.length}</strong></span>
              {(selectedCategoryIds.length > 0 || onlyDiscounted || searchQuery) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    setOnlyDiscounted(false);
                    setSearchQuery('');
                    setMaxPrice(10000);
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>

            {/* Services Grid */}
            {filteredServices.length === 0 ? (
              <div className="catalog-empty-state">
                <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '14px' }}>
                  По заданным параметрам ничего не найдено.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    setOnlyDiscounted(false);
                    setSearchQuery('');
                    setMaxPrice(10000);
                  }}
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <div className="services-grid">
                {paginatedServices.map((service) => {
                  const servDisc = getServiceDiscount(service);
                  const { finalPrice, effectivePct, hasDiscount } = calculateFinalPrice(
                    service.price,
                    servDisc,
                    userDiscount
                  );
                  const serviceCats = getServiceCategories(service);
                  const inCartQty = getItemCartQty(service.id_service);
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
                          <span>{serviceCats[0]?.title || 'УСЛУГА'}</span>
                        </div>

                        {hasDiscount && (
                          <div className="service-card-discount-badge">
                            -{effectivePct}%
                          </div>
                        )}
                      </div>

                      <div className="service-card-body">
                        <div className="service-card-categories">
                          {serviceCats.map((c) => (
                            <span key={c.id_category} className="category-pill">{c.title}</span>
                          ))}
                        </div>

                        <h3 className="service-card-title">{service.title}</h3>

                        {/* Rating summary */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                              {stats.avg ? `★ ${stats.avg}` : '★ 5.0'}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              ({stats.count})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleReviewsExpand(service.id_service)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textDecoration: 'underline',
                              padding: '2px 0',
                            }}
                          >
                            {isExpanded ? 'Скрыть отзывы ▲' : 'Отзывы ▼'}
                          </button>
                        </div>

                        <p className="service-card-desc">{service.description || 'Профессиональная услуга в салоне.'}</p>

                        <div className="service-card-meta">
                          <div>
                            <span className="service-price">{finalPrice.toLocaleString()} ₽</span>
                            {hasDiscount && (
                              <span className="service-old-price">
                                {parseFloat(service.price).toLocaleString()} ₽
                              </span>
                            )}
                          </div>
                          <span className="service-duration">{service.duration || 30} мин.</span>
                        </div>

                        {!isMainAdmin && (
                          <div className="service-card-actions">
                            <button
                              type="button"
                              className={`btn ${inCartQty > 0 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                              style={{ width: '100%' }}
                              onClick={() => handleAddToCart(service)}
                            >
                              {inCartQty > 0 ? `В корзине (${inCartQty}) +` : 'Добавить в корзину'}
                            </button>
                          </div>
                        )}

                        {/* Additional Quick Actions */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {!isMainAdmin && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ flex: 1, fontSize: '11px', padding: '3px 4px' }}
                              onClick={() => {
                                setQuickBookService(service);
                                setQuickBookSuccess(null);
                              }}
                            >
                              Записаться
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ flex: isMainAdmin ? 1 : undefined, fontSize: '11px', padding: '3px 6px' }}
                            onClick={() => openReviewModal(service)}
                          >
                            ✍ Отзыв
                          </button>
                        </div>

                        {/* Expandable Reviews Section */}
                        {isExpanded && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-h)' }}>
                                Отзывы ({servReviewsList.length})
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '1px 5px', fontSize: '10px' }}
                                onClick={() => openReviewModal(service)}
                              >
                                + Написать
                              </button>
                            </div>

                            {servReviewsList.length === 0 ? (
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' }}>
                                Нет отзывов
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                                {servReviewsList.map((rev) => (
                                  <div
                                    key={rev.id_review}
                                    style={{
                                      background: '#fff',
                                      border: '1px solid var(--border)',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                      fontSize: '11px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                      <strong style={{ color: 'var(--text-h)' }}>
                                        {rev.first_name ? `${rev.first_name} ${rev.second_name || ''}` : rev.author_name || 'Клиент'}
                                      </strong>
                                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                                        {'★'.repeat(rev.rating)}
                                      </span>
                                    </div>
                                    <p style={{ color: 'var(--text)', margin: '0 0 2px', lineHeight: '1.3' }}>
                                      {rev.comment}
                                    </p>
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

            {filteredServices.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredServices.length}
                pageSize={PAGE_SIZE}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Leave Review Modal */}
      {reviewService && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-h)' }}>Отзыв об услуге</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setReviewService(null)}
              >
                ✕
              </button>
            </div>

            {reviewSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="badge badge-success" style={{ marginBottom: '10px', display: 'inline-block' }}>Успешно</div>
                <h4 style={{ color: 'var(--text-h)', marginBottom: '6px' }}>{reviewService.title}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{reviewSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                <div style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Выбранная услуга
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-h)', fontSize: '15px', marginTop: '4px' }}>
                    {reviewService.title}
                  </div>
                </div>

                {reviewError && (
                  <div className="badge badge-danger" style={{ display: 'block', marginBottom: '10px', padding: '6px' }}>
                    {reviewError}
                  </div>
                )}

                {reviewCooldown > 0 && (
                  <div style={{ background: 'var(--warning-bg)', border: '1px solid #fde68a', padding: '8px', borderRadius: '4px', marginBottom: '10px', fontSize: '12px', color: 'var(--warning)' }}>
                    Повторный отзыв возможен через: <strong>{reviewCooldown} сек.</strong>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Ваша оценка</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        style={{
                          flex: 1,
                          background: reviewRating >= star ? 'var(--accent)' : '#fff',
                          color: reviewRating >= star ? '#fff' : 'var(--text-muted)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: '4px',
                          padding: '6px 4px',
                          cursor: 'pointer',
                          fontSize: '14px',
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

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
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
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-h)' }}>Онлайн-запись</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setQuickBookService(null)}
              >
                ✕
              </button>
            </div>

            {quickBookSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div className="badge badge-success" style={{ marginBottom: '12px', display: 'inline-block' }}>Запись подтверждена</div>
                <h4 style={{ color: 'var(--text-h)', marginBottom: '8px' }}>{quickBookSuccess.serviceTitle}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>
                  Дата и время: <strong>{quickBookSuccess.date}, {quickBookSuccess.time}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>
                  Мастер: <strong>{quickBookSuccess.masterName}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
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
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-h)', fontSize: '15px' }}>{quickBookService.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
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
                  style={{ width: '100%', marginTop: '14px' }}
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