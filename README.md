# LiveView CCTV Dashboard

Aplikasi web untuk menampilkan seluruh kamera CCTV Hikvision (IP Camera
maupun kamera analog via DVR/NVR) dalam satu dashboard grid, dioptimalkan
untuk jaringan lokal/intranet dengan banyak kamera sekaligus.

## Arsitektur

```
┌──────────────┐      RTSP (intranet)      ┌────────────────────┐
│ Hikvision IP │ ────────────────────────▶ │                    │
│   Camera     │                            │   Backend (Node)   │
└──────────────┘                            │  - REST API        │
                                             │  - Auth (JWT)      │
┌──────────────┐      RTSP per channel      │  - Stream Manager  │
│ Hikvision    │ ────────────────────────▶  │    (spawn FFmpeg)  │
│  NVR / DVR   │   ch.101/102, 201/202...   │  - Status poller   │
└──────────────┘                            └─────────┬──────────┘
                                                       │ tulis file
                                                       ▼ HLS (.m3u8/.ts)
┌──────────────┐   HTTP (HLS.js)            ┌────────────────────┐
│   Browser    │ ◀────────────────────────  │   Nginx            │
│  (Operator/  │   REST API, Socket.IO      │  - serve frontend  │
│   Admin)     │ ◀────────────────────────  │  - proxy /api      │
└──────────────┘                            │  - serve /streams  │
                                             └────────────────────┘
                                                       │
                                             ┌────────────────────┐
                                             │   PostgreSQL       │
                                             │  users/devices/    │
                                             │  cameras           │
                                             └────────────────────┘
```

RTSP **tidak pernah** dibuka langsung dari browser. Backend bertindak
sebagai *media gateway*: menjalankan FFmpeg per kamera untuk meng-convert
RTSP → HLS, file HLS-nya disajikan oleh Nginx ke browser.

## Struktur Folder

```
LiveView/
├── backend/                     # Node.js + TypeScript + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma        # skema database (User, Device, Camera)
│   │   └── seed.ts              # buat user admin default
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── lib/prisma.ts
│   │   ├── utils/
│   │   │   ├── crypto.ts        # enkripsi/dekripsi password RTSP (AES-256-GCM)
│   │   │   ├── rtsp.ts          # builder URL RTSP Hikvision
│   │   │   └── asyncHandler.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts          # verifikasi JWT + role guard
│   │   │   └── errorHandler.ts
│   │   ├── controllers/         # auth, user, device, camera, stream
│   │   ├── routes/              # auth, user, device, camera, stream
│   │   ├── services/
│   │   │   ├── streamManager.ts       # spawn/kill FFmpeg, auto-reconnect, idle timeout
│   │   │   ├── cameraStatus.service.ts # polling online/offline
│   │   │   └── socket.ts              # Socket.IO realtime status
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   └── package.json
├── frontend/                    # React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── api/                 # axios client, types
│       ├── context/AuthContext.tsx
│       ├── hooks/                # useCameras, useCameraStatusSocket, useDarkMode
│       ├── components/
│       │   ├── CameraTile.tsx
│       │   ├── HlsPlayer.tsx     # player HLS.js dengan auto-reconnect
│       │   ├── StatusBadge.tsx
│       │   ├── SearchFilterBar.tsx
│       │   ├── Pagination.tsx
│       │   └── Layout/ (Navbar, ProtectedRoute)
│       └── pages/
│           ├── LoginPage.tsx
│           ├── DashboardPage.tsx         # grid utama live view
│           ├── CameraManagementPage.tsx  # CRUD + test connection + aktif/nonaktif
│           ├── DeviceManagementPage.tsx  # CRUD device (IP Camera/NVR)
│           └── UserManagementPage.tsx    # kelola Admin/Operator
├── nginx/liveview.conf           # reverse proxy + serve HLS
└── docs/
    ├── INSTALLATION.md           # deployment Ubuntu Server step-by-step
    └── CONFIGURATION.md          # contoh konfigurasi kamera & FFmpeg
```

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS (dark mode), HLS.js, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Prisma ORM, JWT, Socket.IO |
| Database | PostgreSQL |
| Media gateway | FFmpeg (RTSP → HLS), `ffprobe` untuk cek status & test koneksi |
| Web server | Nginx (serve frontend build + proxy API + serve HLS) |
| OS | Ubuntu Server 22.04 LTS |

## Skema Database (ringkas)

Detail lengkap: `backend/prisma/schema.prisma`.

- **users**: `username`, `passwordHash` (bcrypt), `role` (`ADMIN`/`OPERATOR`), `isActive`
- **devices**: `type` (`IP_CAMERA`/`NVR`), `ipAddress`, `port`, `rtspUsername`,
  `rtspPasswordEnc` (AES-256-GCM, **tidak pernah** dikirim ke frontend), `transport`
- **cameras**: `deviceId` (FK), `name`, `location`, `channelNo`,
  `mainStreamSuffix`, `subStreamSuffix`, `isActive`, `status` (`ONLINE`/`OFFLINE`/`UNKNOWN`)

## Fitur Utama

- Dashboard grid otomatis: 1→1×1, 4→2×2, 9→3×3, 16→4×4, >16 kamera → pagination.
- Tiap tile: nama, lokasi, badge status online/offline (realtime via Socket.IO), live stream, tombol fullscreen (otomatis pindah ke main stream beresolusi penuh).
- Pencarian (nama/lokasi) + filter lokasi & status.
- Dark mode (default aktif, bisa di-toggle).
- Role Admin (kelola device/kamera/user) vs Operator (live view saja) — ditegakkan di backend (middleware `requireRole`) dan frontend (`ProtectedRoute`).
- Manajemen kamera: tambah, edit, hapus, test koneksi (ffprobe), aktifkan/nonaktifkan.
- Deteksi channel otomatis dari NVR/DVR lewat Hikvision ISAPI (tombol "Deteksi Channel" di menu Device) — tidak perlu input channel satu per satu.
- Password RTSP terenkripsi di database, tidak pernah dikirim ke frontend dalam bentuk apapun.
- Auto-reconnect: FFmpeg di-restart otomatis dengan backoff jika RTSP putus; player frontend retry otomatis jika HLS gagal load.
- Hemat resource: stream FFmpeg hanya berjalan saat ada viewer (idle timeout), grid memakai sub-stream beresolusi rendah.

## Quick Start (development lokal)

```bash
# Backend
cd backend
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY (openssl rand -hex 32)
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev             # http://localhost:4000

# Frontend (terminal baru)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Login dengan `admin` / `Admin123!` (ubah lewat `.env` sebelum seed, atau ganti password setelah login pertama).

Untuk deployment produksi di Ubuntu Server, lihat **[docs/INSTALLATION.md](docs/INSTALLATION.md)**.
Untuk contoh konfigurasi kamera, format RTSP, dan perintah FFmpeg, lihat **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)**.

## Contoh Tampilan Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📹 LiveView   CCTV Dashboard      Dashboard  Kamera  Device  Pengguna   │
│                                                  🌙   Budi (ADMIN)  ⎋   │
├─────────────────────────────────────────────────────────────────────────┤
│ [ Cari nama/lokasi...      ] [Lokasi ▾] [Status ▾] [Grid: Otomatis ▾]   │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐       │
│ │ Lobby Depan  ●ON  │ │ Gudang A     ●ON  │ │ Parkiran     ●OFF │       │
│ │                   │ │                   │ │  (kamera offline) │       │
│ │   [ live video ]  │ │   [ live video ]  │ │                   │       │
│ │                   │ │                   │ │                   │       │
│ │             [⛶]  │ │             [⛶]  │ │             [⛶]  │       │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘       │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐       │
│ │ Lt.2 Koridor ●ON  │ │ Ruang Server ●ON  │ │ Pintu Belakang●ON │       │
│ │   [ live video ]  │ │   [ live video ]  │ │   [ live video ]  │       │
│ │             [⛶]  │ │             [⛶]  │ │             [⛶]  │       │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘       │
├─────────────────────────────────────────────────────────────────────────┤
│              ◀ Sebelumnya   Halaman 1 dari 3   Selanjutnya ▶            │
│                  Menampilkan 9 dari 21 kamera                           │
└─────────────────────────────────────────────────────────────────────────┘
```

Tema gelap dengan aksen biru, badge hijau (●ON) untuk online dan merah
(●OFF) untuk offline, tombol fullscreen (⛶) muncul saat tile di-hover —
dirancang agar mudah dipantau operator dalam waktu lama tanpa melelahkan mata.
