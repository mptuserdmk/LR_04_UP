import { useServerStatus } from '../context/ServerStatusContext';
import { useCart } from '../context/CartContext';
import './MaintenancePage.css';

export default function MaintenancePage() {
  const { isChecking, checkConnection } = useServerStatus();
  const { cart } = useCart();
  const totalCartItems = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);

  return (
    <div className="simple-maintenance-container">
      <div className="simple-maintenance-card">
        <div className="simple-maintenance-icon">🔧</div>
        <h1 className="simple-maintenance-title">Технические работы</h1>
        <p className="simple-maintenance-text">
          Сервер временно недоступен. Ведутся технические работы.
          Пожалуйста, попробуйте позже или нажмите кнопку ниже.
        </p>

        {totalCartItems > 0 && (
          <p className="simple-maintenance-cart-hint">
            🛒 Корзина ({totalCartItems} шт.) сохранена локально
          </p>
        )}

        <button
          className="simple-maintenance-btn"
          onClick={() => checkConnection()}
          disabled={isChecking}
          type="button"
        >
          {isChecking ? 'Проверка...' : 'Повторить попытку'}
        </button>
      </div>
    </div>
  );
}
