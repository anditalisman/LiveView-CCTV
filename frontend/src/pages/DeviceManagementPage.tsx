import { FormEvent, ReactNode, useEffect, useState } from "react";
import { deviceApi, DevicePayload } from "../api/client";
import type { Device } from "../api/types";

const emptyForm: DevicePayload = {
  name: "",
  type: "IP_CAMERA",
  brand: "Hikvision",
  ipAddress: "",
  port: 554,
  rtspUsername: "admin",
  rtspPassword: "",
  transport: "tcp",
  notes: "",
};

export default function DeviceManagementPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DevicePayload>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await deviceApi.list();
    setDevices(res.data);
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

  function openEdit(device: Device) {
    setEditingId(device.id);
    setForm({
      name: device.name,
      type: device.type,
      brand: device.brand,
      ipAddress: device.ipAddress,
      port: device.port,
      rtspUsername: device.rtspUsername,
      rtspPassword: "", // password tidak pernah ditampilkan; isi hanya jika ingin mengganti
      transport: device.transport,
      notes: device.notes || "",
    });
    setErrorMsg(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.rtspPassword) delete payload.rtspPassword;
        await deviceApi.update(editingId, payload);
      } else {
        await deviceApi.create(form);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan device");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(device: Device) {
    if (!confirm(`Hapus device "${device.name}"? Semua kamera di device ini juga akan terhapus.`)) return;
    await deviceApi.remove(device.id);
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Manajemen Device</h1>
          <p className="text-sm text-gray-500">
            Device = IP Camera tunggal, atau NVR/DVR Hikvision dengan banyak channel.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Tambah Device
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-gray-800 bg-[#11161d] p-4"
        >
          <h2 className="mb-3 text-sm font-semibold text-white">
            {editingId ? "Edit Device" : "Tambah Device"}
          </h2>
          {errorMsg && <div className="mb-3 text-sm text-red-400">{errorMsg}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nama Device">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="NVR Lantai 1" />
            </Field>
            <Field label="Tipe">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DevicePayload["type"] })} className={inputClass}>
                <option value="IP_CAMERA">IP Camera</option>
                <option value="NVR">NVR / DVR</option>
              </select>
            </Field>
            <Field label="IP Address">
              <input required value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} className={inputClass} placeholder="192.168.1.10" />
            </Field>
            <Field label="Port RTSP">
              <input required type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Username RTSP">
              <input required value={form.rtspUsername} onChange={(e) => setForm({ ...form, rtspUsername: e.target.value })} className={inputClass} />
            </Field>
            <Field label={editingId ? "Password RTSP (kosongkan jika tidak diubah)" : "Password RTSP"}>
              <input
                type="password"
                required={!editingId}
                value={form.rtspPassword}
                onChange={(e) => setForm({ ...form, rtspPassword: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Transport">
              <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as "tcp" | "udp" })} className={inputClass}>
                <option value="tcp">TCP (disarankan)</option>
                <option value="udp">UDP</option>
              </select>
            </Field>
            <Field label="Catatan (opsional)">
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
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
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Tipe</th>
              <th className="px-3 py-2">IP : Port</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Memuat...</td>
              </tr>
            )}
            {!loading && devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Belum ada device</td>
              </tr>
            )}
            {devices.map((d) => (
              <tr key={d.id} className="bg-[#11161d]">
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2">{d.type === "IP_CAMERA" ? "IP Camera" : "NVR/DVR"}</td>
                <td className="px-3 py-2">{d.ipAddress}:{d.port}</td>
                <td className="px-3 py-2">{d.rtspUsername}</td>
                <td className="px-3 py-2">{d._count?.cameras ?? 0}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(d)} className="mr-2 text-blue-400 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(d)} className="text-red-400 hover:underline">Hapus</button>
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
