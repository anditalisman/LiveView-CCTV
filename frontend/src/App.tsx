import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Layout/Navbar";
import { ProtectedRoute } from "./components/Layout/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CameraManagementPage from "./pages/CameraManagementPage";
import DeviceManagementPage from "./pages/DeviceManagementPage";
import UserManagementPage from "./pages/UserManagementPage";

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#0b0e13]">
      <Navbar />
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/cameras" element={<CameraManagementPage />} />
            <Route path="/devices" element={<DeviceManagementPage />} />
            <Route path="/users" element={<UserManagementPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
