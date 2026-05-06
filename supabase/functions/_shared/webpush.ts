// Minimal Web Push helper using Deno crypto (VAPID + AES128GCM).
// Inspired by https://github.com/web-push-libs/web-push spec.

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importVapidKey(privateKeyB64: string, publicKeyB64: string) {
  const d = b64urlDecode(privateKeyB64);
  const pub = b64urlDecode(publicKeyB64); // 65 bytes uncompressed (0x04 || X || Y)
  const x = b64urlEncode(pub.slice(1, 33));
  const y = b64urlEncode(pub.slice(33, 65));
  const jwk = {
    kty: "EC", crv: "P-256", d: b64urlEncode(d), x, y, ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signJwt(privateKeyB64: string, publicKeyB64: string, audience: string, subject: string) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject.startsWith("mailto:") ? subject : `mailto:${subject}`,
  };
  const enc = new TextEncoder();
  const head = b64urlEncode(enc.encode(JSON.stringify(header)));
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${head}.${body}`);
  const key = await importVapidKey(privateKeyB64, publicKeyB64);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = new Uint8Array(info.length + 1);
  t.set(info, 0); t[info.length] = 1;
  const out = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, t));
  return out.slice(0, length);
}

function concat(...arrs: Uint8Array[]) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

async function generateEcdhKey() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)); // uncompressed 65 bytes
  return { kp, raw };
}

async function importClientPublicKey(p256dhB64: string) {
  const raw = b64urlDecode(p256dhB64);
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** Encrypt body using aes128gcm content encoding (RFC 8188) */
async function encryptPayload(payload: string, p256dhB64: string, authB64: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { kp: localKp, raw: localPubRaw } = await generateEcdhKey();
  const clientPub = await importClientPublicKey(p256dhB64);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPub }, localKp.privateKey, 256)
  );
  const authSecret = b64urlDecode(authB64);
  const clientPubRaw = b64urlDecode(p256dhB64);

  // PRK_key
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPubRaw,
    localPubRaw
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // Content Encryption Key
  const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = new TextEncoder().encode(payload);
  const padded = concat(plain, new Uint8Array([0x02])); // last record delimiter
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, padded));

  // aes128gcm header: salt(16) || rs(4)=4096 || idlen(1)=65 || keyid(localPubRaw 65)
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  const header = concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);
  return concat(header, ct);
}

export interface PushSubscriptionInfo {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPush(
  sub: PushSubscriptionInfo,
  payload: string,
  vapid: { publicKey: string; privateKey: string; subject: string }
): Promise<{ ok: boolean; status: number; body?: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signJwt(vapid.privateKey, vapid.publicKey, audience, vapid.subject);
  const body = await encryptPayload(payload, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "60",
      "Authorization": `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body,
  });
  const text = res.ok ? "" : await res.text();
  return { ok: res.ok, status: res.status, body: text };
}