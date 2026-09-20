import AppointmentsList from './components/AppointmentsList';
import AppointmentsServicesList from './components/AppointmentsServicesList';
import CategoriesList from './components/CategoriesList';
import DiscountsList from './components/DiscountsList';
import PaymentsList from './components/PaymentsList';
import RolesList from './components/RolesList';
import ServicesList from './components/ServicesList';
import ServicesCategoriesList from './components/ServicesCategoriesList';
import UsersList from './components/UsersList';
import Services from './components/Services';
import Cart from './components/Cart';
import Reviews from './components/Reviews';
import Profile from './components/Profile';

import Menu from './Menu';
import Login from './login';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useServerStatus } from './context/ServerStatusContext';
import MaintenancePage from './components/MaintenancePage';
import './App.css';

function ProtectedStaffRoute({ children, isAllowed }) {
  if (!isAllowed) {
    return <Navigate to="/available-services" replace />;
  }
  return children;
}

function App() {
  const { user } = useAuth();
  const { isServerDown } = useServerStatus();
  const isMainAdmin = user && (user.role_id === 1 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор');
  const isStaffOrAdmin = user && (user.role_id === 1 || user.role_id === 2 || user.role_title === 'Главный администратор' || user.role_title === 'Администратор' || user.role_title?.includes('Сотрудник'));

  if (isServerDown) {
    return <MaintenancePage />;
  }

  return (
    <BrowserRouter>
      {!user ? (
        <Login />
      ) : (
        <div className="app-container">
          <Menu />
          <main className="app-main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/available-services" replace />} />
              <Route path="/available-services" element={<Services />} />
              <Route
                path="/cart"
                element={isMainAdmin ? <Navigate to="/available-services" replace /> : <Cart />}
              />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/profile" element={<Profile />} />

              {/* Protected Staff & Admin Routes */}
              <Route
                path="/appointments"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <AppointmentsList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/appointments-services"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <AppointmentsServicesList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/services"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <ServicesList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <CategoriesList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/services-categories"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <ServicesCategoriesList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/service-categories"
                element={<Navigate to="/services-categories" replace />}
              />
              <Route
                path="/discounts"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <DiscountsList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <ProtectedStaffRoute isAllowed={isStaffOrAdmin}>
                    <PaymentsList />
                  </ProtectedStaffRoute>
                }
              />

              {/* Main Admin Only Routes */}
              <Route
                path="/users"
                element={
                  <ProtectedStaffRoute isAllowed={isMainAdmin}>
                    <UsersList />
                  </ProtectedStaffRoute>
                }
              />
              <Route
                path="/roles"
                element={
                  <ProtectedStaffRoute isAllowed={isMainAdmin}>
                    <RolesList />
                  </ProtectedStaffRoute>
                }
              />

              <Route path="*" element={<Navigate to="/available-services" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
