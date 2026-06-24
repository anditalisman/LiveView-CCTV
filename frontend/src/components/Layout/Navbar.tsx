import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../hooks/useDarkMode";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-gray-300 hover:bg-gray-800 hover:text-white"
  }`;

export function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();

  return (
    <header className="flex items-center justify-between bg-[#11161d] border-b border-gray-800 px-4 py-2.5 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white tracking-tight">📹 LiveView</span>
        <span className="text-xs text-gray-500 hidden sm:inline">CCTV Dashboard</span>
      </div>

      <nav className="flex items-center gap-1">
        <NavLink to="/" className={linkClass} end>
          Dashboard
        </NavLink>
        {user?.role === "ADMIN" && (
          <>
            <NavLink to="/cameras" className={linkClass}>
              Kamera
            </NavLink>
            <NavLink to="/devices" className={linkClass}>
              Device
            </NavLink>
            <NavLink to="/users" className={linkClass}>
              Pengguna
            </NavLink>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          title="Toggle dark mode"
          className="text-gray-300 hover:text-white px-2 py-1 rounded-md hover:bg-gray-800"
        >
          {dark ? "🌙" : "☀️"}
        </button>
        <div className="text-right hidden sm:block">
          <div className="text-sm text-white">{user?.fullName}</div>
          <div className="text-xs text-gray-500">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="text-sm px-3 py-1.5 rounded-md bg-gray-800 text-gray-200 hover:bg-red-600 hover:text-white transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
