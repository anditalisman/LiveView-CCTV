import { FormEvent, ReactNode, useEffect, useState } from "react";
import { userApi } from "../api/client";
import type { User } from "../api/types";
import { useAuth } from "../context/AuthContext";

interface FormState {
  username: string;
  password: string;
  fullName: string;
  role: "ADMIN" | "OPERATOR";
}

const emptyForm: FormState = { username: "", password: "", fullName: "", role: "OPERATOR" };

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await userApi.list();
    setUsers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMsg(null);
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditingId(u.id);
    setForm({ username: u.username, password: "", fullName: u.fullName, role: u.role });
    setErrorMsg(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        const payload: Record<string, unknown> = { fullName: form.fullName, role: form.role };
        if (form.password) payload.password = form.password;
        await userApi.update(editingId, payload);
      } else {
        await userApi.create(form);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan pengguna");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u: User) {
    await userApi.update(u.id, { isActive: !u.isActive });
    await load();
  }

  async function handleDelete(u: User) {
    if (!confirm(`Hapus pengguna "${u.username}"?`)) return;
    await userApi.remove(u.id);
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Manajemen Pengguna</h1>
          <p className="text-sm text-gray-500">Admin mengelola kamera & pengguna, Operator hanya melihat live view.</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Tambah Pengguna
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-800 bg-[#11161d] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">{editingId ? "Edit Pengguna" : "Tambah Pengguna"}</h2>
          {errorMsg && <div className="mb-3 text-sm text-red-400">{errorMsg}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Username">
              <input required disabled={!!editingId} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Nama Lengkap">
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "OPERATOR" })} className={inputClass}>
                <option value="OPERATOR">Operator (lihat live view)</option>
                <option value="ADMIN">Admin (kelola kamera & user)</option>
              </select>
            </Field>
            <Field label={editingId ? "Password baru (kosongkan jika tidak diubah)" : "Password"}>
              <input type="password" required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-[#161c25] text-left text-gray-400">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Memuat...</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="bg-[#11161d]">
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleToggleActive(u)} className={`rounded-full px-2 py-0.5 text-xs ${u.isActive ? "bg-green-500/15 text-green-400" : "bg-gray-600/20 text-gray-400"}`}>
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(u)} className="mr-2 text-blue-400 hover:underline">Edit</button>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={u.id === currentUser?.id}
                    className="text-red-400 hover:underline disabled:opacity-30"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-700 bg-[#0b0e13] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      {children}
    </div>
  );
}
