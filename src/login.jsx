import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { loginUser, registerUser, forgotPassword, resetPassword } from './api/users';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form state
  const [registerData, setRegisterData] = useState({
    first_name: '',
    second_name: '',
    middle_name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [receivedCode, setReceivedCode] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const validateLoginForm = () => {
    const errors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Поле Email обязательно для заполнения';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Введите корректный адрес электронной почты';
    }

    if (!password) {
      errors.password = 'Поле Пароль обязательно для заполнения';
    } else if (password.length < 4) {
      errors.password = 'Пароль должен содержать не менее 4 символов';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegisterForm = () => {
    const errors = {};
    if (!registerData.first_name.trim()) errors.first_name = 'Укажите имя';
    if (!registerData.second_name.trim()) errors.second_name = 'Укажите фамилию';
    
    if (!registerData.email.trim()) {
      errors.email = 'Укажите email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email.trim())) {
      errors.email = 'Некорректный формат email';
    }

    if (!registerData.phone.trim()) {
      errors.phone = 'Укажите номер телефона';
    }

    if (!registerData.password) {
      errors.password = 'Укажите пароль';
    } else if (registerData.password.length < 4) {
      errors.password = 'Пароль должен быть от 4 символов';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateLoginForm()) return;

    setLoading(true);
    try {
      const userData = await loginUser(email.trim(), password);
      login(userData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateRegisterForm()) return;

    setLoading(true);
    try {
      const newUser = await registerUser(registerData);
      setSuccessMsg('Регистрация успешно завершена! Выполняется вход...');
      login(newUser);
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const fillTestAccount = (testEmail, testPass) => {
    setAuthMode('login');
    setEmail(testEmail);
    setPassword(testPass);
    setFieldErrors({});
    setError('');
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');
    if (!forgotEmail.trim()) {
      setForgotError('Введите email');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotMsg('Код подтверждения успешно отправлен на вашу почту');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || 'Ошибка запроса кода');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');

    if (!resetCode.trim() || !newPassword.trim()) {
      setForgotError('Заполните код и новый пароль');
      return;
    }

    if (newPassword.length < 4) {
      setForgotError('Пароль должен быть от 4 символов');
      return;
    }

    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim(), resetCode.trim(), newPassword);
      setForgotMsg('Пароль успешно изменен. Теперь вы можете войти.');
      setEmail(forgotEmail.trim());
      setPassword(newPassword);
      setAuthMode('login');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotMsg('');
      }, 1500);
    } catch (err) {
      setForgotError(err.message || 'Неверный проверочный код');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-theme-toggle-container">
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={toggleTheme}
          title="Сменить цветовую тему"
        >
          {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
        </button>
      </div>

      <div className="auth-card" style={{ maxWidth: authMode === 'register' ? '500px' : '420px' }}>
        <div className="auth-header">
          <h2 className="auth-title">
            {authMode === 'login' ? 'Авторизация' : 'Регистрация'}
          </h2>
          <p className="auth-subtitle">
            {authMode === 'login'
              ? 'Вход в персональный кабинет и систему записи'
              : 'Создание нового аккаунта клиента'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => {
              setAuthMode('login');
              setError('');
              setFieldErrors({});
            }}
          >
            Вход в систему
          </button>
          <button
            type="button"
            className={`btn ${authMode === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => {
              setAuthMode('register');
              setError('');
              setFieldErrors({});
            }}
          >
            Регистрация
          </button>
        </div>

        {error && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '1rem', textAlign: 'center', padding: '0.5rem' }}>{error}</div>}
        {successMsg && <div className="badge badge-success" style={{ display: 'block', marginBottom: '1rem', textAlign: 'center', padding: '0.5rem' }}>{successMsg}</div>}

        {authMode === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
                }}
              />
              {fieldErrors.email && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="password">Пароль</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotEmail(email);
                    setForgotStep(1);
                    setForgotError('');
                    setForgotMsg('');
                  }}
                >
                  Забыли пароль?
                </button>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                }}
              />
              {fieldErrors.password && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.password}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Проверка...' : 'Войти в систему'}
            </button>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Фамилия *</label>
                <input
                  type="text"
                  placeholder="Иванов"
                  value={registerData.second_name}
                  onChange={(e) => setRegisterData({ ...registerData, second_name: e.target.value })}
                />
                {fieldErrors.second_name && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.second_name}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  placeholder="Иван"
                  value={registerData.first_name}
                  onChange={(e) => setRegisterData({ ...registerData, first_name: e.target.value })}
                />
                {fieldErrors.first_name && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.first_name}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email (для входа) *</label>
              <input
                type="email"
                placeholder="ivan@mail.ru"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              />
              {fieldErrors.email && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Номер телефона *</label>
              <input
                type="tel"
                placeholder="+7 (999) 000-00-00"
                value={registerData.phone}
                onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
              />
              {fieldErrors.phone && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Адрес доставки / выезда</label>
              <input
                type="text"
                placeholder="г. Москва, ул. Ленина, д. 10"
                value={registerData.address}
                onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Пароль *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              />
              {fieldErrors.password && <span style={{ color: 'var(--accent-danger)', fontSize: '0.75rem' }}>{fieldErrors.password}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
            </button>
          </form>
        )}

        {/* Quick Test Accounts Grid */}
        <div className="quick-accounts-grid">
          <button
            type="button"
            className="account-preset-btn"
            onClick={() => fillTestAccount('isip_m.k.devlet@gmail.com', 'admin123')}
          >
            <div className="account-preset-name">Максим</div>
            <div className="account-preset-role">Главный администратор</div>
          </button>

          <button
            type="button"
            className="account-preset-btn"
            onClick={() => fillTestAccount('elena.staff@salon.ru', 'staff123')}
          >
            <div className="account-preset-name">Елена</div>
            <div className="account-preset-role">Менеджер салона</div>
          </button>

          <button
            type="button"
            className="account-preset-btn"
            onClick={() => fillTestAccount('anna.master@salon.ru', '123456')}
          >
            <div className="account-preset-name">Анна</div>
            <div className="account-preset-role">Мастер-стилист</div>
          </button>

          <button
            type="button"
            className="account-preset-btn"
            onClick={() => fillTestAccount('ivan.petrov@mail.ru', '123456')}
          >
            <div className="account-preset-name">Иван</div>
            <div className="account-preset-role">Клиент</div>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title">Восстановление пароля</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowForgotModal(false)}
              >
                ✕
              </button>
            </div>

            {forgotError && <div className="badge badge-danger" style={{ display: 'block', marginBottom: '0.75rem', padding: '0.4rem', textAlign: 'center' }}>{forgotError}</div>}
            {forgotMsg && <div className="badge badge-success" style={{ display: 'block', marginBottom: '0.75rem', padding: '0.4rem', textAlign: 'center' }}>{forgotMsg}</div>}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestCode}>
                <div className="form-group">
                  <label className="form-label">Укажите email аккаунта</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Отправка...' : 'Получить код'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '1rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Проверочный код отправлен на почту <strong>{forgotEmail}</strong>. Пожалуйста, проверьте входящие сообщения (и папку «Спам») и укажите код ниже:
                </div>

                <div className="form-group">
                  <label className="form-label">6-значный проверочный код</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Новый пароль</label>
                  <input
                    type="password"
                    placeholder="Минимум 4 символа"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Сохранение...' : 'Установить новый пароль'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
