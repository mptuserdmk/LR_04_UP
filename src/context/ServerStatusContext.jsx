import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ServerStatusContext = createContext(null);

export const BACKEND_URL = 'http://localhost:3001';

export function ServerStatusProvider({ children }) {
  const [isServerDown, setIsServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const originalFetchRef = useRef(window.fetch.bind(window));
  const isServerDownRef = useRef(isServerDown);
  isServerDownRef.current = isServerDown;

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await originalFetchRef.current(`${BACKEND_URL}/api/categories`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res && res.status < 500) {
        setIsServerDown(false);
        setLastCheckTime(new Date());
        setIsChecking(false);
        return true;
      } else {
        setIsServerDown(true);
        setLastCheckTime(new Date());
        setIsChecking(false);
        return false;
      }
    } catch {
      setIsServerDown(true);
      setLastCheckTime(new Date());
      setIsChecking(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const rawFetch = originalFetchRef.current;

    const interceptedFetch = async (...args) => {
      let url = args[0];
      if (typeof url === 'object' && url && url.url) {
        url = url.url;
      }
      const isBackendReq = typeof url === 'string' && (url.includes(':3001') || url.includes('/api/'));

      try {
        const response = await rawFetch(...args);
        if (isBackendReq) {
          if (response.status >= 500 && response.status <= 599) {
            setIsServerDown(true);
          } else if (response.status < 500) {
            if (isServerDownRef.current) {
              setIsServerDown(false);
            }
          }
        }
        return response;
      } catch (err) {
        if (isBackendReq) {
          setIsServerDown(true);
        }
        throw err;
      }
    };

    window.fetch = interceptedFetch;

    return () => {
      window.fetch = rawFetch;
    };
  }, []);

  // Initial connection check
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Periodic health check when server is down
  useEffect(() => {
    if (!isServerDown) return;
    const interval = setInterval(() => {
      checkConnection();
    }, 4000);
    return () => clearInterval(interval);
  }, [isServerDown, checkConnection]);

  return (
    <ServerStatusContext.Provider
      value={{
        isServerDown,
        setServerDown: setIsServerDown,
        isChecking,
        checkConnection,
        lastCheckTime,
      }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
}

export function useServerStatus() {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error('useServerStatus must be used within a ServerStatusProvider');
  }
  return context;
}
