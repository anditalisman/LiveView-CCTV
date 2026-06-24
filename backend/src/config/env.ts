import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Environment variable ${name} wajib diisi (lihat .env.example)`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  encryptionKey: required("ENCRYPTION_KEY"),

  hlsOutputDir: process.env.HLS_OUTPUT_DIR || "/var/www/liveview/streams",
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",

  streamIdleTimeoutSec: parseInt(process.env.STREAM_IDLE_TIMEOUT_SEC || "60", 10),
  statusCheckIntervalSec: parseInt(process.env.STATUS_CHECK_INTERVAL_SEC || "30", 10),
};
