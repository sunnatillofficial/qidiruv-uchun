// Har bir so'rov bitta platformani tekshiradi: /.netlify/functions/check?u=NAME&s=INDEX
// s berilmasa, platformalar ro'yxati qaytadi.
// mode: status = 200 bo'lsa topildi | miss = sahifada belgi bo'lmasa topildi | has = sahifada belgi bo'lsa topildi

const SITES = [
  { name: "GitHub", url: "https://github.com/{u}", mode: "status" },
  { name: "GitLab", url: "https://gitlab.com/api/v4/users?username={u}", mode: "miss", mark: "[]", profile: "https://gitlab.com/{u}" },
  { name: "npm", url: "https://registry.npmjs.org/-/v1/search?text=maintainer:{u}", mode: "miss", mark: '"total":0', profile: "https://www.npmjs.com/~{u}" },
  { name: "PyPI", url: "https://pypi.org/user/{u}/", mode: "status" },
  { name: "Docker Hub", url: "https://hub.docker.com/v2/users/{u}/", mode: "status", profile: "https://hub.docker.com/u/{u}" },
  { name: "Hugging Face", url: "https://huggingface.co/{u}", mode: "status" },
  { name: "Dev.to", url: "https://dev.to/{u}", mode: "status" },
  { name: "Hacker News", url: "https://hacker-news.firebaseio.com/v0/user/{u}.json", mode: "miss", mark: "null", profile: "https://news.ycombinator.com/user?id={u}" },
  { name: "Keybase", url: "https://keybase.io/_/api/1.0/user/lookup.json?usernames={u}", mode: "miss", mark: '"them":[null]', profile: "https://keybase.io/{u}" },
  { name: "Replit", url: "https://replit.com/@{u}", mode: "status" },
  { name: "CodePen", url: "https://codepen.io/{u}", mode: "status" },
  { name: "Chess.com", url: "https://api.chess.com/pub/player/{u}", mode: "status", profile: "https://www.chess.com/member/{u}" },
  { name: "Lichess", url: "https://lichess.org/api/user/{u}", mode: "status", profile: "https://lichess.org/@/{u}" },
  { name: "Steam", url: "https://steamcommunity.com/id/{u}", mode: "miss", mark: "The specified profile could not be found" },
  { name: "Telegram", url: "https://t.me/{u}", mode: "miss", mark: "Telegram: Contact @" },
  { name: "Reddit", url: "https://www.reddit.com/user/{u}/about.json", mode: "status", profile: "https://www.reddit.com/user/{u}" },
  { name: "Mastodon", url: "https://mastodon.social/@{u}", mode: "status" },
  { name: "Bluesky", url: "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={u}.bsky.social", mode: "status", profile: "https://bsky.app/profile/{u}.bsky.social" },
  { name: "Medium", url: "https://medium.com/@{u}", mode: "status" },
  { name: "Dribbble", url: "https://dribbble.com/{u}", mode: "status" },
  { name: "Behance", url: "https://www.behance.net/{u}", mode: "status" },
  { name: "SoundCloud", url: "https://soundcloud.com/{u}", mode: "status" },
  { name: "Pinterest", url: "https://www.pinterest.com/{u}/", mode: "status" },
  { name: "Patreon", url: "https://www.patreon.com/{u}", mode: "status" },
  { name: "Linktree", url: "https://linktr.ee/{u}", mode: "status" },
  { name: "Last.fm", url: "https://www.last.fm/user/{u}", mode: "status" },
  { name: "Letterboxd", url: "https://letterboxd.com/{u}/", mode: "status" },
  { name: "Vimeo", url: "https://vimeo.com/{u}", mode: "status" },
  { name: "Gravatar", url: "https://en.gravatar.com/{u}.json", mode: "status", profile: "https://gravatar.com/{u}" },
];

const { getSession } = require("../lib/session");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const NOT_FOUND = [400, 404, 410];

const reply = (code, data, cache = "private, max-age=300") => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Cache-Control": cache },
  body: JSON.stringify(data),
});

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};

  if (q.s === undefined) return reply(200, SITES.map((s) => s.name));

  // REQUIRE_LOGIN=true bo'lsa, tekshiruv faqat Telegram orqali kirganlarga ishlaydi
  if (process.env.REQUIRE_LOGIN === "true" && !getSession(event))
    return reply(401, { error: "Kirish kerak" }, "no-store");

  const site = SITES[Number(q.s)];
  const user = q.u || "";
  if (!site) return reply(400, { error: "Noto'g'ri platforma" }, "no-store");
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(user))
    return reply(400, { error: "Username noto'g'ri" }, "no-store");

  const u = encodeURIComponent(user);
  const profile = (site.profile || site.url).replace("{u}", u);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(site.url.replace("{u}", u), {
      headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*" },
      signal: ctrl.signal,
    });

    let state = "error";
    if (NOT_FOUND.includes(res.status)) {
      state = "notfound";
    } else if (res.status === 200) {
      if (site.mode === "status") {
        state = "found";
      } else {
        const body = (await res.text()).slice(0, 300000);
        const hit = body.includes(site.mark);
        state = (site.mode === "has" ? hit : !hit) ? "found" : "notfound";
      }
    }
    return reply(200, { name: site.name, state, url: profile });
  } catch (e) {
    return reply(200, { name: site.name, state: "error", url: profile }, "no-store");
  } finally {
    clearTimeout(timer);
  }
};
