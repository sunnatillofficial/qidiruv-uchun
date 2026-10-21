// /.netlify/functions/auth            -> Telegram Login Widget callback (data-auth-url)
// /.netlify/functions/auth?me=1       -> joriy foydalanuvchi va sozlamalar
// /.netlify/functions/auth?logout=1   -> chiqish
const { verifyTelegram, sign, getSession, cookie } = require("../lib/session");

const json = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(data),
});
const redirect = (setCookie) => ({
  statusCode: 302,
  headers: { Location: "/", "Cache-Control": "no-store", "Set-Cookie": setCookie },
  body: "",
});

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (q.me !== undefined) {
    const s = getSession(event);
    return json(200, {
      user: s ? { name: s.name, username: s.username } : null,
      bot: process.env.TELEGRAM_BOT_USERNAME || null,
      required: process.env.REQUIRE_LOGIN === "true",
    });
  }

  if (q.logout !== undefined) return redirect(cookie("", 0));

  if (!token) return json(500, { error: "TELEGRAM_BOT_TOKEN sozlanmagan" });
  if (!verifyTelegram(q, token)) return json(401, { error: "Telegram imzosi noto'g'ri yoki eskirgan. Qayta urinib ko'ring." });

  const name = [q.first_name, q.last_name].filter(Boolean).join(" ") || q.username || "Foydalanuvchi";
  const session = sign(
    { id: q.id, name, username: q.username || null, exp: Math.floor(Date.now() / 1000) + 7 * 86400 },
    token
  );
  return redirect(cookie(session, 7 * 86400));
};
