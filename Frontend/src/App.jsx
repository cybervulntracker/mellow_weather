import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MaintenanceGate from "./components/MaintenanceGate.jsx";
import ContactUs from "./components/ContactUs.jsx";
import Testing from "./components/Testing.jsx";
import TaskForm from "./components/TaskForm.jsx";
import TaskList from "./components/TaskList.jsx";

import { AuthProvider } from "./context/AuthContext.jsx";
import { PrefsProvider } from "./context/PrefsContext.jsx";
import { FeedbackProvider } from "./components/ui/Feedback.jsx";
import { GuestOnly, HomeRedirect, RequireAdmin, RequireAuth } from "./components/RouteGuards.jsx";

import Login from "./pages/auth/Login.jsx";
import Signup from "./pages/auth/Signup.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail.jsx";

import WeatherLayout from "./pages/weather/WeatherLayout.jsx";
import WeatherHome from "./pages/weather/Home.jsx";
import Forecast from "./pages/weather/Forecast.jsx";
import Compare from "./pages/weather/Compare.jsx";
import Trip from "./pages/weather/Trip.jsx";
import Favorites from "./pages/weather/Favorites.jsx";
import History from "./pages/weather/History.jsx";
import WeatherSettings from "./pages/weather/Settings.jsx";
import WeatherProfile from "./pages/weather/Profile.jsx";

import AdminLayout from "./pages/admin/AdminLayout.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import Users from "./pages/admin/Users.jsx";
import Sessions from "./pages/admin/Sessions.jsx";
import Searches from "./pages/admin/Searches.jsx";
import AdminFavorites from "./pages/admin/Favorites.jsx";
import ActivityLog from "./pages/admin/ActivityLog.jsx";
import Security from "./pages/admin/Security.jsx";
import Settings from "./pages/admin/Settings.jsx";
import AdminProfile from "./pages/admin/Profile.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import Support from "./pages/admin/Support.jsx";
import System from "./pages/admin/System.jsx";
import Audit from "./pages/admin/Audit.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <MaintenanceGate />
        <AuthProvider>
          <PrefsProvider>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />

              <Route element={<GuestOnly />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* links from emails work whether or not you're signed in */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              <Route element={<RequireAuth />}>
                <Route path="/weather" element={<WeatherLayout />}>
                  <Route index element={<WeatherHome />} />
                  <Route path="forecast" element={<Forecast />} />
                  <Route path="compare" element={<Compare />} />
                  <Route path="trip" element={<Trip />} />
                  <Route path="favorites" element={<Favorites />} />
                  <Route path="history" element={<History />} />
                  <Route path="settings" element={<WeatherSettings />} />
                  <Route path="profile" element={<WeatherProfile />} />
                  <Route path="*" element={<Navigate to="/weather" replace />} />
                </Route>

                <Route element={<RequireAdmin />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="users" element={<Users />} />
                    <Route path="support" element={<Support />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="system" element={<System />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="searches" element={<Searches />} />
                    <Route path="favorites" element={<AdminFavorites />} />
                    <Route path="activity" element={<ActivityLog />} />
                    <Route path="security" element={<Security />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<AdminProfile />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Route>
                </Route>

                {/* Your original practice page, kept as-is */}
                <Route path="/tasks" element={<><h1>My Website</h1><TaskForm /><TaskList /><ContactUs /><Testing /></>} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PrefsProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
