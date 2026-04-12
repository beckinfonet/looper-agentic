import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OverviewPage from "./pages/OverviewPage";
import ServicesPage from "./pages/ServicesPage";
import SpecialistsPage from "./pages/SpecialistsPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import BookingsPage from "./pages/BookingsPage";

function Private({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="layout">
      <nav>
        <strong>Looper Business</strong>
        {getToken() && (
          <>
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Profile
            </NavLink>
            <NavLink to="/services" className={({ isActive }) => (isActive ? "active" : "")}>
              Services
            </NavLink>
            <NavLink to="/specialists" className={({ isActive }) => (isActive ? "active" : "")}>
              Specialists
            </NavLink>
            <NavLink to="/availability" className={({ isActive }) => (isActive ? "active" : "")}>
              Availability
            </NavLink>
            <NavLink to="/bookings" className={({ isActive }) => (isActive ? "active" : "")}>
              Bookings
            </NavLink>
          </>
        )}
      </nav>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <Private>
              <OverviewPage />
            </Private>
          }
        />
        <Route
          path="/services"
          element={
            <Private>
              <ServicesPage />
            </Private>
          }
        />
        <Route
          path="/specialists"
          element={
            <Private>
              <SpecialistsPage />
            </Private>
          }
        />
        <Route
          path="/availability"
          element={
            <Private>
              <AvailabilityPage />
            </Private>
          }
        />
        <Route
          path="/bookings"
          element={
            <Private>
              <BookingsPage />
            </Private>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
