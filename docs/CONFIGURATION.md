# Konfigurasi Kamera, FFmpeg, dan Penambahan Device

## 1. Konsep Device vs Kamera

Aplikasi ini membedakan dua entitas di database:

- **Device** — unit fisik dengan satu IP & satu kredensial RTSP. Bisa berupa:
  - `IP_CAMERA`: kamera IP Hikvision berdiri sendiri (1 device = 1 kamera).
  - `NVR`: NVR/DVR Hikvision yang menerima banyak kamera analog/IP sekaligus
    (1 device = banyak kamera, satu per channel).
- **Camera** — satu channel/lensa yang tampil di dashboard. Menyimpan
  `channelNo`, `mainStreamSuffix` (fullscreen), dan `subStreamSuffix` (grid).

Kredensial RTSP (`rtspUsername` + `rtspPassword`) disimpan di level **Device**
karena pada Hikvision NVR semua channel memakai login yang sama. Password
dienkripsi (AES-256-GCM) di kolom `rtspPasswordEnc` dan tidak pernah
dikembalikan oleh API maupun ditampilkan di frontend.

> **Jebakan umum #1 — Port Device bukan port RTSP.** Field `port` pada Device
> harus diisi port **RTSP** (default `554`), **bukan** port web/ISAPI Hikvision
> (umumnya `8000` atau `80`). Mengisi `8000` akan membuat semua percobaan
> streaming/test-connection gagal connect meski device terlihat "ada" di
> database.
>
> **Jebakan umum #2 — Menambah Device saja tidak otomatis memunculkan kamera.**
> Aplikasi ini **tidak melakukan auto-discovery** channel dari NVR/DVR (tidak
> ada integrasi ISAPI/SDK Hikvision untuk scan channel). Setelah Device
> dibuat, Anda **wajib** menambahkan setiap channel secara manual lewat menu
> **Kamera → Tambah Kamera** (lihat bagian 4). Device dengan 0 Camera akan
> membuat dashboard tetap kosong walau Device-nya valid.

## 2. Format RTSP Hikvision

```
rtsp://<username>:<password>@<ip>:554/Streaming/Channels/<suffix>
```

`<suffix>` = `channel * 100 + stream`, dengan `stream` 1 = main (HD, dipakai
saat fullscreen), `stream` 2 = sub (resolusi rendah, dipakai di grid agar
hemat bandwidth):

| Channel | Main stream (fullscreen) | Sub stream (grid) |
|---|---|---|
| 1 | 101 | 102 |
| 2 | 201 | 202 |
| 3 | 301 | 302 |
| 4 | 401 | 402 |

Form **Tambah Kamera** di menu admin otomatis mengisi `mainStreamSuffix`
dan `subStreamSuffix` berdasarkan `channelNo` yang diinput (bisa diubah manual
jika konfigurasi kamera Anda berbeda).

## 3. Menambahkan IP Camera (berdiri sendiri)

1. Buka menu **Device** → **Tambah Device**.
2. Isi:
   - Tipe: `IP Camera`
   - IP Address: IP kamera, contoh `192.168.1.51`
   - Port RTSP: `554`
   - Username/Password: kredensial login kamera (default Hikvision: `admin`)
3. Buka menu **Kamera** → **Tambah Kamera**:
   - Device: pilih device yang baru dibuat
   - Channel No.: `1`
   - Main/Sub suffix otomatis terisi `101` / `102`
4. Klik **Test** pada baris kamera untuk memverifikasi koneksi sebelum
   ditampilkan di dashboard.

## 4. Menambahkan Kamera Analog via DVR/NVR Hikvision

Satu NVR/DVR didaftarkan sebagai **satu Device**, lalu setiap kamera analog
yang terhubung ke channel NVR didaftarkan sebagai **Camera** terpisah.

1. Menu **Device** → **Tambah Device**:
   - Tipe: `NVR / DVR`
   - IP Address: IP NVR (bukan IP kamera analognya — kamera analog tidak
     punya alamat sendiri, semua lewat IP NVR)
   - Username/Password: kredensial login NVR
2. Menu **Kamera** → **Tambah Kamera**, ulangi untuk setiap channel:
   - Channel 1 (kamera analog di port BNC 1) → suffix `101`/`102`
   - Channel 2 (kamera analog di port BNC 2) → suffix `201`/`202`
   - Channel 3 → `301`/`302`, dst.
3. Beri `name` dan `location` yang jelas per channel, contoh:
   - "Kamera Gudang A" — Channel 1
   - "Kamera Parkiran Belakang" — Channel 2

## 5. Contoh Perintah FFmpeg (RTSP → HLS)

Ini adalah perintah yang dijalankan otomatis oleh backend
(`backend/src/services/streamManager.ts`) saat sebuah tile kamera dibuka:

```bash
ffmpeg \
  -rtsp_transport tcp \
  -i "rtsp://admin:password@192.168.1.10:554/Streaming/Channels/102" \
  -an \
  -c:v copy \
  -f hls \
  -hls_time 2 \
  -hls_list_size 6 \
  -hls_flags delete_segments+independent_segments \
  -hls_segment_filename "/var/www/liveview/streams/<cameraId>/sub/seg_%05d.ts" \
  /var/www/liveview/streams/<cameraId>/sub/index.m3u8
```

Penjelasan flag penting:

- `-rtsp_transport tcp` — lebih stabil di intranet dibanding UDP (default
  Hikvision sering UDP, tapi TCP menghindari packet loss/gambar pecah).
- `-c:v copy` — **tidak transcode**, hanya re-mux H.264 ke HLS. Ringan untuk
  CPU server, mampu menangani banyak kamera sekaligus.
- `-an` — tanpa audio, cukup untuk kebutuhan monitoring & hemat bandwidth.
- `-hls_time 2` + `-hls_list_size 6` — buffer kecil (≈12 detik) agar latency
  rendah, sesuai untuk live monitoring.
- `-hls_flags delete_segments` — segmen lama otomatis dihapus, disk tidak
  penuh untuk stream yang berjalan terus-menerus.

### Jika kamera menggunakan codec H.265/HEVC

Sebagian kamera/NVR Hikvision default ke H.265 pada main maupun sub stream.
Browser pada umumnya **tidak** bisa decode H.265 di tag `<video>` melalui
HLS.js — RTSP-nya tetap bisa konek normal (test connection sukses), tapi
videonya tidak akan tampil.

Tombol **Test** di menu Kamera menampilkan `codec:` hasil probe (lewat
`ffprobe`); jika tertulis `hevc` atau mengandung `265`, tile kamera tersebut
akan tampil hitam meski status terbaca Online. Cara mengatasi, ubah codec
video kamera ke H.264 di web config Hikvision (`Configuration > Video/Audio
> Video`, ubah tab Sub Stream **dan** Main Stream per channel), atau ubah
`-c:v copy` menjadi transcode di `streamManager.ts`:

```bash
-c:v libx264 -preset veryfast -tune zerolatency -profile:v baseline
```

Transcode menggunakan CPU jauh lebih besar — pertimbangkan menyalakan
hanya untuk kamera yang memang H.265, atau gunakan GPU encoding
(`-c:v h264_nvenc` jika server punya GPU NVIDIA).

## 6. Pengujian Manual RTSP dari Server

Sebelum menambahkan kamera lewat UI, disarankan tes manual dari server:

```bash
ffprobe -rtsp_transport tcp "rtsp://admin:password@192.168.1.10:554/Streaming/Channels/102"
```

Jika berhasil, akan tampil info stream (codec, resolusi, fps). Jika gagal,
periksa: IP/port kamera, kredensial, dan apakah server satu jaringan
(intranet) dengan kamera/NVR.

## 7. Hemat Bandwidth & CPU

- Dashboard grid selalu memakai **sub stream** (resolusi rendah).
- Fullscreen otomatis berpindah ke **main stream** (resolusi penuh) dan
  kembali ke sub stream saat keluar fullscreen.
- Stream FFmpeg **dihentikan otomatis** jika tidak ada viewer selama
  `STREAM_IDLE_TIMEOUT_SEC` (default 60 detik) — diatur di
  `backend/src/services/streamManager.ts`, sehingga kamera yang tidak
  sedang dilihat tidak membebani CPU/bandwidth server.
- Status online/offline dicek berkala (`STATUS_CHECK_INTERVAL_SEC`) memakai
  `ffprobe` ringan, bukan dengan membuka stream penuh.
