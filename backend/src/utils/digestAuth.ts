import crypto from "crypto";

/**
 * GET request dengan HTTP Digest Authentication (RFC 2617), seperti yang
 * dipakai web/ISAPI Hikvision. Tidak ada library digest-auth bawaan Node,
 * jadi diimplementasikan manual: request pertama untuk mendapatkan
 * WWW-Authenticate (realm/nonce/qop), lalu request kedua dengan header
 * Authorization yang dihitung.
 */
export async function digestAuthGet(
  url: string,
  username: string,
  password: string,
  timeoutMs = 8000
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const first = await fetch(url, { method: "GET", signal: controller.signal });
    if (first.status !== 401) {
      return { status: first.status, body: await first.text() };
    }

    const authHeader = first.headers.get("www-authenticate");
    if (!authHeader) {
      return { status: first.status, body: await first.text() };
    }

    // Sebagian device Hikvision (mode keamanan tertentu) memakai Basic, bukan Digest.
    if (/^basic/i.test(authHeader)) {
      const basic = Buffer.from(`${username}:${password}`).toString("base64");
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Authorization: `Basic ${basic}` },
      });
      return { status: res.status, body: await res.text() };
    }

    if (!/digest/i.test(authHeader)) {
      return { status: first.status, body: await first.text() };
    }

    const params = parseDigestHeader(authHeader);
    const { realm, nonce, qop, opaque } = params;
    const path = new URL(url).pathname + (new URL(url).search || "");
    const method = "GET";
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");

    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${path}`);
    const response = qop
      ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : md5(`${ha1}:${nonce}:${ha2}`);

    const authParts = [
      `username="${username}"`,
      `realm="${realm}"`,
      `nonce="${nonce}"`,
      `uri="${path}"`,
      `response="${response}"`,
      `algorithm=MD5`,
    ];
    if (qop) authParts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
    if (opaque) authParts.push(`opaque="${opaque}"`);

    const second = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Authorization: `Digest ${authParts.join(", ")}` },
    });
    return { status: second.status, body: await second.text() };
  } finally {
    clearTimeout(timer);
  }
}

function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

function parseDigestHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /(\w+)=("([^"]*)"|[^,]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(header.replace(/^Digest\s+/i, "")))) {
    result[match[1]] = match[3] !== undefined ? match[3] : match[2];
  }
  return result;
}
