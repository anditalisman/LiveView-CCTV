import { FormEvent, ReactNode, useEffect, useState } from "react";
import { cameraApi, CameraPayload, deviceApi } from "../api/client";
import type { Camera, Device, TestConnectionResult } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";

const emptyForm: CameraPayload = {
  deviceId: "",
  name: "",
  location: "",
  channelNo: 1,
  mainStreamSuffix: 101,
  subStreamSuffix: 102,
  isActive: true,
  sortOrder: 0,
};

export default function CameraManagementPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CameraPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [camRes, devRes] = await Promise.all([cameraApi.list(), deviceApi.list()]);
    setCameras(camRes.data);
    setDevices(devRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, deviceId: devices[0]?.id || "" });
    setErrorMsg(null);
    setShowForm(true);
  }

  function openEdit(camera: Camera) {
    setEditingId(camera.id);
    setForm({
      deviceId: camera.deviceId,
      name: camera.name,
      location: camera.location,
      channelNo: camera.channelNo,
      mainStreamSuffix: camera.mainStreamSuffix,
      subStreamSuffix: camera.subStreamSuffix,
      isActive: camera.isActive,
      sortOrder: camera.sortOrder,
    });
    setErrorMsg(null);
    setShowForm(true);
  }

  function applyChannelDefaults(channelNo: number) {
    setForm((f) => ({
      ...f,
      channelNo,
      mainStreamSuffix: channelNo * 100 + 1,
      subStreamSuffix: channelNo * 100 + 2,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        await cameraApi.update(editingId, form);
      } else {
        await cameraApi.create(form);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan kamera");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(camera: Camera) {
    if (!confirm(`Hapus kamera "${camera.name}"?`)) return;
    await cameraApi.remove(camera.id);
    await load();
  }

  async function handleToggleActive(camera: Camera) {
    await cameraApi.toggleActive(camera.id);
    await load();
  }

  async function handleTest(camera: Camera) {
    setTestingId(camera.id);
    try {
      const res = await cameraApi.testConnection(camera.id);
      setTestResults((prev) => ({ ...prev, [camera.id]: res.data }));
    } finally {
      setTestingId(null);
      await load();
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Manajemen Kamera</h1>
          <p className="text-sm text-gray-500">
            Setiap kamera = satu channel pada device (IP Camera atau channel NVR/DVR).
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={devices.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          + Tambah Kamera
        </button>
      </div>

      {devices.length === 0 && (
        <div className="mb-4 rounded-md border border-yellow-800 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-300">
          Belum ada device. Tambahkan device (IP Camera/NVR) terlebih dahulu di menu Device.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-800 bg-[#11161d] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">{editingId ? "Edit Kamera" : "Tambah Kamera"}</h2>
          {errorMsg && <div className="mb-3 text-sm text-red-400">{errorMsg}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Device">
              <select required value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} className={inputClass}>
                <option value="" disabled>Pilih device...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</option>
                ))}
              </select>
            </Field>
            <Field label="Nama Kamera">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Kamera Pintu Depan" />
            </Field>
            <Field label="Lokasi">
              <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="Lobby Lantai 1" />
            </Field>
            <Field label="Channel No. (1 untuk IP Camera, 1..N untuk NVR)">
              <input
                required
                type="number"
                min={1}
                value={form.channelNo}
                onChange={(e) => applyChannelDefaults(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Main Stream Suffix (fullscreen)">
              <input required type="number" value={form.mainStreamSuffix} onChange={(e) => setForm({ ...form, mainStreamSuffix: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Sub Stream Suffix (grid, hemat bandwidth)">
              <input required type="number" value={form.subStreamSuffix} onChange={(e) => setForm({ ...form, subStreamSuffix: Number(e.target.value) })} className={inputClass} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Contoh Hikvision: channel 1 → main 101, sub 102. Channel 2 → main 201, sub 202. Diisi otomatis saat channel diubah, bisa disesuaikan manual.
          </p>

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
              <th className="px-3 py-2">Lokasi</th>
              <th className="px-3 py-2">Device</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aktif</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200">
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Memuat...</td></tr>
            )}
            {!loading && cameras.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Belum ada kamera</td></tr>
            )}
            {cameras.map((cam) => (
              <tr key={cam.id} className="bg-[#11161d] align-top">
                <td className="px-3 py-2 font-medium">{cam.name}</td>
                <td className="px-3 py-2">{cam.location}</td>
                <td className="px-3 py-2">{cam.device.name}</td>
                <td className="px-3 py-2">
                  ch.{cam.channelNo} ({cam.mainStreamSuffix}/{cam.subStreamSuffix})
                </td>
                <td className="px-3 py-2"><StatusBadge status={cam.status} /></td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleToggleActive(cam)}
                    className={`rounded-full px-2 py-0.5 text-xs ${cam.isActive ? "bg-blue-500/15 text-blue-400" : "bg-gray-600/20 text-gray-400"}`}
                  >
                    {cam.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => handleTest(cam)} disabled={testingId === cam.id} className="mr-2 text-emerald-400 hover:underline disabled:opacity-50">
                    {testingId === cam.id ? "Menguji..." : "Test"}
                  </button>
                  <button onClick={() => openEdit(cam)} className="mr-2 text-blue-400 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(cam)} className="text-red-400 hover:underline">Hapus</button>
                  {testResults[cam.id] && (
                    <div className={`mt-1 text-xs ${testResults[cam.id].success ? "text-green-400" : "text-red-400"}`}>
                      {testResults[cam.id].message} ({testResults[cam.id].latencyMs}ms)
                      {!testResults[cam.id].success && testResults[cam.id].reason && (
                        <div className="text-gray-400">{testResults[cam.id].reason}</div>
                      )}
                      {testResults[cam.id].streamInfo?.codec_name && (
                        <span
                          className={
                            /265|hevc/i.test(testResults[cam.id].streamInfo!.codec_name!)
                              ? "ml-1 text-yellow-400"
                              : "ml-1 text-gray-400"
                          }
                        >
                          · codec: {testResults[cam.id].streamInfo!.codec_name}
                          {/265|hevc/i.test(testResults[cam.id].streamInfo!.codec_name!) &&
                            " (browser tidak mendukung, ubah ke H.264 di NVR)"}
                        </span>
                      )}
                    </div>
                  )}
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
