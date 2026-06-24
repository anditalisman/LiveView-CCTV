# Panduan Instalasi & Deployment — Ubuntu Server

Dokumen ini menjelaskan langkah deployment LiveView CCTV Dashboard pada
**Ubuntu Server 22.04 LTS** di jaringan lokal/intranet.

## 1. Prasyarat Sistem

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# FFmpeg (media gateway RTSP -> HLS)
sudo apt install -y ffmpeg

# Nginx
sudo apt install -y nginx

# Process manager untuk Node.js
sudo npm install -g pm2
```

Verifikasi versi:

```bash
node -v        # >= 20
ffmpeg -version
nginx -v
```

## 2. Siapkan Database

```bash
sudo -u postgres psql <<'EOF'
CREATE USER liveview WITH PASSWORD 'changeme';
CREATE DATABASE liveview_cctv OWNER liveview;
EOF
```

## 3. Ambil Source Code

```bash
sudo mkdir -p /opt/liveview
sudo chown $USER:$USER /opt/liveview
# salin folder project (backend/, frontend/, nginx/, docs/) ke /opt/liveview
cd /opt/liveview
```

## 4. Setup Backend

```bash
cd /opt/liveview/backend
cp .env.example .env
nano .env
```

Isi minimal yang **wajib** diubah di `.env`:

- `DATABASE_URL` → sesuaikan user/password/db PostgreSQL di atas
- `JWT_SECRET` → string acak panjang, contoh: `openssl rand -hex 32`
- `ENCRYPTION_KEY` → **wajib** 64 karakter hex: `openssl rand -hex 32`
- `HLS_OUTPUT_DIR` → contoh `/var/www/liveview/streams`
- `CORS_ORIGIN` → domain/IP frontend, contoh `http://cctv.lan`

Install dependency, migrasi database, dan seed admin:

```bash
npm install
npx prisma migrate deploy
npm run seed       # membuat user admin default (admin / Admin123!)
npm run build
```

Siapkan direktori HLS output dan beri izin ke user yang menjalankan Node:

```bash
sudo mkdir -p /var/www/liveview/streams
sudo chown -R $USER:$USER /var/www/liveview
```

Jalankan backend dengan PM2 (auto-restart jika crash/reboot server):

```bash
pm2 start dist/server.js --name liveview-backend
pm2 save
pm2 startup   # ikuti instruksi yang muncul agar PM2 start otomatis saat boot
```

## 5. Build Frontend

```bash
cd /opt/liveview/frontend
npm install
npm run build
sudo mkdir -p /var/www/liveview/frontend
sudo cp -r dist/* /var/www/liveview/frontend/
```

> Jika backend tidak diakses lewat path `/api` pada domain yang sama,
> set `VITE_API_BASE_URL` saat build atau sesuaikan `nginx/liveview.conf`.

## 6. Konfigurasi Nginx

```bash
sudo cp /opt/liveview/nginx/liveview.conf /etc/nginx/sites-available/liveview.conf
sudo ln -s /etc/nginx/sites-available/liveview.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Edit `server_name` di file tersebut sesuai hostname/IP server intranet Anda.

## 7. Firewall (jika `ufw` aktif)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

Catatan: port RTSP kamera (554) dan port backend (4000) **tidak perlu**
dibuka ke luar — backend mengakses kamera secara internal di jaringan
intranet, dan Nginx menjadi satu-satunya pintu masuk (port 80).

## 8. Login Pertama Kali

1. Buka `http://<ip-server>/` dari browser di jaringan yang sama.
2. Login dengan `admin` / `Admin123!` (sesuai `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` di `.env` jika diubah).
3. **Segera ganti password admin** lewat menu profil/change-password.
4. Tambahkan Device (IP Camera/NVR) dan Kamera lewat menu **Device** & **Kamera**.

## 9. Update Aplikasi (deployment berikutnya)

```bash
cd /opt/liveview/backend && git pull && npm install && npx prisma migrate deploy && npm run build && pm2 restart liveview-backend
cd /opt/liveview/frontend && git pull && npm install && npm run build && sudo cp -r dist/* /var/www/liveview/frontend/
```

## 10. Troubleshooting Cepat

| Gejala | Kemungkinan Sebab | Solusi |
|---|---|---|
| Tile kamera terus "Menyambungkan ulang..." | Kredensial RTSP salah / kamera unreachable | Cek dari server: `ffprobe rtsp://user:pass@ip:554/Streaming/Channels/102` |
| Video hitam tapi status Online | Kamera H.265, FFmpeg `-c:v copy` tidak didukung browser | Ubah ke transcode `-c:v libx264` (lihat `docs/CONFIGURATION.md`) |
| 502/504 di `/streams/...` | `HLS_OUTPUT_DIR` backend ≠ `alias` di Nginx | Samakan path di `.env` dan `nginx/liveview.conf` |
| Status semua kamera Offline | Backend tidak bisa reach jaringan kamera, atau `ffprobe` tidak terinstal | `which ffprobe`, cek `FFPROBE_PATH` di `.env` |
