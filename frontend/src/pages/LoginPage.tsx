import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const redirectTo = (location.state as { from?: string })?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Username atau password salah");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0e13] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#11161d] border border-gray-800 rounded-xl p-8 shadow-xl"
      >
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">📹</div>
          <h1 className="text-xl font-bold text-white">LiveView CCTV Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk untuk memantau kamera</p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <label className="block text-sm text-gray-400 mb-1">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 rounded-md bg-[#0b0e13] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          autoFocus
          required
        />

        <label className="block text-sm text-gray-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 rounded-md bg-[#0b0e13] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 transition"
        >
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
