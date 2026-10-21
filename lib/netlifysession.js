const crypto = require("crypto");

const sessionKey = (token) => crypto.createHmac("sha256", token).update("session-v1").digest();
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Telegram Login Widget imzosini tekshiradi (https://core.telegram.org/widgets/login)
function verifyTelegram(query, token) {
  const { hash, ...data } = query;
  if (!hash || !data.id || !data.auth_date) return false;
  const str = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(str).digest("hex");
  const fresh = Date.now() / 1000 - Number(data.auth_date) < 86400;
  return fresh && safeEqual(expected, hash);
}

function sign(payload, token) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionKey(token)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readSession(value, token) {
  if (!value || !token) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", sessionKey(token)).update(body).digest("base64url");
  if (!safeEqual(expected, sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch (e) {
    return null;
  }
}

function getSession(event) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
  const m = raw.match(/(?:^|;\s*)sid=([^;]+)/);
  return readSession(m && m[1], process.env.TELEGRAM_BOT_TOKEN);
}

const cookie = (value, maxAge) =>
  `sid=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

module.exports = { verifyTelegram, sign, getSession, cookie };
