import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const getCartKey = (userId) => `pr4_cart_items_${userId || 'guest'}`;
const getCartInfoKey = (userId) => `pr4_cart_info_${userId || 'guest'}`;

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id_user;
  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор');

  const [cartInfo, setCartInfo] = useState(() => {
    try {
      const saved = localStorage.getItem(getCartInfoKey(userId));
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(getCartKey(userId));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOfflineCart, setIsOfflineCart] = useState(false);

  // Sync state to localStorage
  const saveToLocal = (newItems, newCartInfo) => {
    try {
      if (newItems !== undefined) {
        localStorage.setItem(getCartKey(userId), JSON.stringify(newItems));
      }
      if (newCartInfo !== undefined) {
        if (newCartInfo) {
          localStorage.setItem(getCartInfoKey(userId), JSON.stringify(newCartInfo));
        } else {
          localStorage.removeItem(getCartInfoKey(userId));
        }
      }
    } catch (e) {
      console.warn('Could not save cart to localStorage', e);
    }
  };

  // When user changes, reload from user-specific localStorage
  useEffect(() => {
    if (!userId || isMainAdmin) {
      if (isMainAdmin) {
        setCartInfo(null);
        setItems([]);
      }
      return;
    }
    try {
      const savedItems = localStorage.getItem(getCartKey(userId));
      const savedInfo = localStorage.getItem(getCartInfoKey(userId));
      if (savedItems) setItems(JSON.parse(savedItems));
      if (savedInfo) setCartInfo(JSON.parse(savedInfo));
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
  }, [userId, isMainAdmin]);

  const loadCart = useCallback(async () => {
    if (!user || !user.id_user || isMainAdmin) {
      if (isMainAdmin) {
        setCartInfo(null);
        setItems([]);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [res, servicesRes] = await Promise.all([
        fetch(`http://localhost:3001/api/carts/user/${user.id_user}`),
        fetch('http://localhost:3001/api/services')
      ]);

      if (!res.ok) throw new Error('Ошибка загрузки корзины с сервера');
      const data = await res.json();
      const activeServices = servicesRes.ok ? await servicesRes.json() : [];
      const activeServiceIds = new Set(activeServices.map((s) => Number(s.id_service)));

      let serverItems = data.items || [];
      if (activeServices.length > 0) {
        serverItems = serverItems.filter((item) => activeServiceIds.has(Number(item.service_id || item.id_service)));
      }
      const serverCart = data.cart;
      
      setCartInfo(serverCart);
      setItems(serverItems);
      setIsOfflineCart(false);
      saveToLocal(serverItems, serverCart);
    } catch (err) {
      // Backend is down or network error: DO NOT CLEAR ITEMS!
      // Keep items from state / localStorage
      console.warn('Backend unavailable for cart, preserving local cart state:', err);
      setIsOfflineCart(true);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, isMainAdmin, userId]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = async (service, qty = 1) => {
    if (!user) return { success: false, error: 'Необходима авторизация' };
    if (isMainAdmin) return { success: false, error: 'Администраторам недоступно добавление в корзину' };

    const serviceId = Number(service.id_service || service.service_id);
    const existingIndex = items.findIndex((i) => Number(i.service_id || i.id_service) === serviceId);

    let updatedItems;
    if (existingIndex >= 0) {
      updatedItems = items.map((item, idx) =>
        idx === existingIndex
          ? { ...item, quantity: (parseInt(item.quantity, 10) || 0) + qty }
          : item
      );
    } else {
      const newItem = {
        service_id: serviceId,
        id_service: serviceId,
        title: service.title || service.service_title || 'Услуга',
        price: service.price || 0,
        duration: service.duration || 30,
        discount_percentage: service.discount_percentage || 0,
        quantity: qty,
      };
      updatedItems = [...items, newItem];
    }

    setItems(updatedItems);
    saveToLocal(updatedItems, cartInfo);

    try {
      setError(null);
      let activeCartId = cartInfo?.id_cart;

      if (!activeCartId) {
        const cartRes = await fetch(`http://localhost:3001/api/carts/user/${user.id_user}`);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCartInfo(cartData.cart);
          activeCartId = cartData.cart?.id_cart;
          saveToLocal(updatedItems, cartData.cart);
        }
      }

      if (activeCartId) {
        const res = await fetch('http://localhost:3001/api/carts_items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart_id: activeCartId,
            service_id: serviceId,
            quantity: qty,
          }),
        });
        if (res.ok) {
          await loadCart();
        }
      }
      return { success: true };
    } catch (err) {
      console.warn('Added to local cart only (backend offline):', err);
      setIsOfflineCart(true);
      return { success: true, offline: true };
    }
  };

  const updateQuantity = async (serviceId, quantity) => {
    if (!user || isMainAdmin) return;
    const sId = Number(serviceId);

    if (quantity <= 0) {
      return await removeFromCart(sId);
    }

    const updatedItems = items.map((item) =>
      Number(item.service_id || item.id_service) === sId
        ? { ...item, quantity }
        : item
    );
    setItems(updatedItems);
    saveToLocal(updatedItems, cartInfo);

    try {
      setError(null);
      let activeCartId = cartInfo?.id_cart;
      if (!activeCartId) {
        const cartRes = await fetch(`http://localhost:3001/api/carts/user/${user.id_user}`);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCartInfo(cartData.cart);
          activeCartId = cartData.cart?.id_cart;
        }
      }

      if (activeCartId) {
        const res = await fetch(`http://localhost:3001/api/carts_items/${activeCartId}/${sId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
        });
        if (res.ok) {
          await loadCart();
        }
      }
    } catch (err) {
      console.warn('Updated local cart only (backend offline):', err);
      setIsOfflineCart(true);
    }
  };

  const removeFromCart = async (serviceId) => {
    if (!user || isMainAdmin) return;
    const sId = Number(serviceId);

    const updatedItems = items.filter(
      (item) => Number(item.service_id || item.id_service) !== sId
    );
    setItems(updatedItems);
    saveToLocal(updatedItems, cartInfo);

    try {
      setError(null);
      let activeCartId = cartInfo?.id_cart;
      if (!activeCartId) {
        const cartRes = await fetch(`http://localhost:3001/api/carts/user/${user.id_user}`);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCartInfo(cartData.cart);
          activeCartId = cartData.cart?.id_cart;
        }
      }

      if (activeCartId) {
        const res = await fetch(`http://localhost:3001/api/carts_items/${activeCartId}/${sId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          await loadCart();
        }
      }
    } catch (err) {
      console.warn('Removed from local cart only (backend offline):', err);
      setIsOfflineCart(true);
    }
  };

  const clearCart = async () => {
    if (!user || isMainAdmin) return;
    setItems([]);
    saveToLocal([], cartInfo);

    try {
      setError(null);
      let activeCartId = cartInfo?.id_cart;
      if (!activeCartId) {
        const cartRes = await fetch(`http://localhost:3001/api/carts/user/${user.id_user}`);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCartInfo(cartData.cart);
          activeCartId = cartData.cart?.id_cart;
        }
      }

      if (activeCartId) {
        await fetch(`http://localhost:3001/api/carts/${activeCartId}/items`, {
          method: 'DELETE',
        });
      }
    } catch (err) {
      console.warn('Cleared local cart only (backend offline):', err);
      setIsOfflineCart(true);
    }
  };

  const totalCount = items.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 0), 0);

  return (
    <CartContext.Provider
      value={{
        cart: items,
        cartInfo,
        loading,
        error,
        isOfflineCart,
        totalCount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        reloadCart: loadCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}