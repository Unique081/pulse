// ═══════════════════════════════════════════════════════════════════
// MODULE 5 — The Pulse: personalization, reliability & performance
// (builds on Modules 1–4: cards, chatbot, A/B test, dashboard, charts)
//
// New in this module — search for these section banners below:
//   • RATE LIMITER          — self-imposed call ceilings per API
//   • RESPONSE CACHE        — avoids redundant network calls
//   • RETRY / SKELETON      — graceful loading + failure states
//   • BOOKMARKS             — saved locations / articles / movies
//   • SESSION STATE         — sessionStorage vs localStorage split
//   • DEBOUNCE / THROTTLE   — efficient frontend event handling
//
// Every line below has a comment explaining what it does, per the
// module's request — not just the new Module 5 code.
// ═══════════════════════════════════════════════════════════════════

// ── API keys & endpoints ─────────────────────────────────────────
const WEATHER_KEY = "7fcddee98ce459f4009fd231ecdd1242";      // OpenWeatherMap key
const TMDB_KEY = "d8f35ac80d0708072b2c9889de5ece23";          // TMDb key
const NEWS_KEY = "d472a90b27b44b48a9da6f63c99a1d70";          // NewsAPI key

const WEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather";     // current weather by city or lat/lon
const WEATHER_FORECAST = "https://api.openweathermap.org/data/2.5/forecast"; // 5-day / 3-hour forecast
const TMDB_TRENDING = "https://api.themoviedb.org/3/trending/movie/day";     // today's trending movies
const TMDB_DISCOVER = "https://api.themoviedb.org/3/discover/movie";         // movies filtered by genre etc.
const TMDB_GENRES = "https://api.themoviedb.org/3/genre/movie/list";         // the list of genre id→name pairs
const TMDB_NOW_PLAYING = "https://api.themoviedb.org/3/movie/now_playing";   // movies currently in theaters
const TMDB_IMG = "https://image.tmdb.org/t/p/w780";                          // TMDb image CDN, 780px wide
const NEWS_EVERYTHING = "https://newsapi.org/v2/everything";                 // keyword-searchable news endpoint
const NEWS_TOP = "https://newsapi.org/v2/top-headlines";                     // top headlines endpoint

const WEATHER_CITIES = ["Lagos", "London", "New York", "Tokyo", "Paris", "Dubai"]; // the fixed "major cities" set

// Refinement options shown in the Fashion/Politics topic dropdown — each
// maps a friendly label to the actual NewsAPI `q=` search term used.
const TOPIC_OPTIONS = {
  fashion: [
    { label: "All Fashion", q: "fashion" },
    { label: "Runway & Shows", q: "fashion runway" },
    { label: "Streetwear", q: "streetwear" },
    { label: "Sustainable Fashion", q: "sustainable fashion" },
  ],
  politics: [
    { label: "All Politics", q: "politics" },
    { label: "Elections", q: "election" },
    { label: "Government Policy", q: "government policy" },
    { label: "Global Affairs", q: "international relations" },
  ],
};

// ── Mutable app state (drives the dynamic inputs) ──────────────────
let compareCities = [...WEATHER_CITIES];       // weather category + comparison chart — grows as you search cities
let currentEntertainmentGenre = "";             // "" = trending, else a TMDb genre id string
let newsQuery = { fashion: "fashion", politics: "politics" }; // active NewsAPI q= term per news category
let movieGenres = [];                           // cached list of {id, name} once loadGenres() resolves
let currentCategory = null;                     // which of the 4 category tabs is showing right now
let baseCategoryCards = [];                     // the active category's "regular" cards — a contextual
                                                 // search adds results on TOP of this, never replaces it
let cardIndex = {};                             // id → full card object, rebuilt on every renderCards() call,
                                                 // so a bookmark click can look up the card it needs to save

// ── DOM refs — one query per element we'll touch from JS ───────────
const cardsGrid = document.getElementById("cardsGrid");                 // the grid that holds article/city/movie cards
const categoryTitle = document.getElementById("categoryTitle");         // the "Fashion — All Fashion" heading
const categoryStatus = document.getElementById("categoryStatus");       // small status line under the heading
const categoryRefreshBtn = document.getElementById("categoryRefreshBtn"); // ↻ button that forces a fresh (uncached) fetch
const searchInput = document.getElementById("searchInput");             // the header search box (filter + API search)
const searchGoBtn = document.getElementById("searchGoBtn");             // ↵ button beside the search box
const categoryNav = document.getElementById("categoryNav");             // the Fashion/Weather/Entertainment/Politics nav
const navToggle = document.getElementById("navToggle");                 // "☰ Categories" button shown on mobile
const filterBar = document.getElementById("filterBar");                 // per-category filter row (dropdown / city box)
const categoryChartWrap = document.getElementById("categoryChartWrap"); // wrapper div around the category's chart
const viewToggle = document.getElementById("viewToggle");               // Both / Cards / Chart segmented control

const trendingStage = document.getElementById("trendingStage");         // the big rotating trending headline slide
const trendingDots = document.getElementById("trendingDots");           // the row of dots under the trending slide
const trendingUpdated = document.getElementById("trendingUpdated");     // "Updated Xm ago" label on the trending banner
const trendingRefreshBtn = document.getElementById("trendingRefresh");  // ↻ button on the trending banner

const dashWeatherHero = document.getElementById("dashWeatherHero");         // big temperature number in the dashboard
const dashWeatherUpdated = document.getElementById("dashWeatherUpdated");   // its "Updated Xm ago" label
const dashHeadlinesList = document.getElementById("dashHeadlinesList");     // the dashboard's top-5 headline list
const dashHeadlinesUpdated = document.getElementById("dashHeadlinesUpdated"); // its "Updated Xm ago" label
const dashMoviesUpdated = document.getElementById("dashMoviesUpdated");     // "Updated Xm ago" for the movies tile

const prefsToggle = document.getElementById("prefsToggle");         // ⚙️ button that opens the preferences modal
const prefsModal = document.getElementById("prefsModal");           // the preferences modal itself
const prefsClose = document.getElementById("prefsClose");           // ✕ button inside the preferences modal
const prefsForm = document.getElementById("prefsForm");             // the <form> holding the preference fields
const prefDefaultCategory = document.getElementById("prefDefaultCategory"); // <select> for default landing category
const prefHomeCity = document.getElementById("prefHomeCity");       // <input> for the visitor's home city
const prefGenre = document.getElementById("prefGenre");             // <select> for favorite movie genre

const bookmarksToggle = document.getElementById("bookmarksToggle"); // 🔖 button that opens the bookmarks modal
const bookmarksModal = document.getElementById("bookmarksModal");   // the bookmarks modal itself
const bookmarksClose = document.getElementById("bookmarksClose");   // ✕ button inside the bookmarks modal
const bookmarksList = document.getElementById("bookmarksList");     // container the saved items get rendered into

const offlineBanner = document.getElementById("offlineBanner");     // banner shown while the browser is offline

const chatToggle = document.getElementById("chatToggle");           // 💬 button that opens the chat widget
const chatPanel = document.getElementById("chatPanel");             // the chat panel itself
const chatClose = document.getElementById("chatClose");             // ✕ button inside the chat panel
const chatMessages = document.getElementById("chatMessages");       // scrollable list of chat bubbles
const chatForm = document.getElementById("chatForm");               // the <form> wrapping the chat text input
const chatInput = document.getElementById("chatInput");             // the chat's text <input>

const abPanel = document.getElementById("abPanel");                 // live A/B click-count readout in the docs footer

// ═══════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ═══════════════════════════════════════════════════════════════════

// Escapes HTML-special characters so text from an API can never be
// interpreted as markup (basic XSS protection for innerHTML use).
function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Shortens a string to `n` characters, adding an ellipsis if it was cut.
function truncate(str = "", n) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

// Turns a Date into a compact "just now / 5m ago / 2h ago" label.
function timeAgo(date) {
  const s = Math.round((Date.now() - date.getTime()) / 1000); // seconds elapsed
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

// Promise-based delay — used by the retry helpers below to wait a
// short moment before trying a failed request a second time.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wraps a function so rapid repeated calls collapse into one call,
// `delay` ms after the last one — used on the live search-filter so
// fast typing doesn't re-scan the whole card grid on every keystroke.
function debounce(fn, delay) {
  let timer; // holds the pending setTimeout id between calls
  return (...args) => {
    clearTimeout(timer);                      // cancel whatever was previously scheduled
    timer = setTimeout(() => fn(...args), delay); // schedule a fresh call after `delay` ms of silence
  };
}

// Friendlier error text for the status line — distinguishes "you're
// offline", "we rate-limited ourselves", and a generic fallback.
function friendlyErrorMessage(err) {
  if (!navigator.onLine) return "You're offline — reconnect and try again."; // browser-reported connectivity
  if (/rate limit/i.test(err.message)) return `⏳ ${err.message}`;           // our own guardedFetch() message
  return `Couldn't load this feed — ${err.message}`;                        // anything else (404, 500, parsing, …)
}

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER — self-imposed call ceilings per API
// Keeps a rolling list of call timestamps for each provider and
// refuses to place a new call once the ceiling is hit inside the
// time window, so a bug (or an eager visitor) can't actually trip a
// real 429 from OpenWeatherMap / TMDb / NewsAPI.
// ═══════════════════════════════════════════════════════════════════

const API_LABELS = { weather: "OpenWeatherMap", tmdb: "TMDb", news: "NewsAPI" }; // for error messages

const RATE_LIMITS = {
  // Deliberately conservative — well under each provider's real free-tier
  // ceiling — so we fail fast with a friendly message long before a real
  // 429 would ever happen.
  weather: { max: 20, windowMs: 60_000 }, // ≤20 OpenWeatherMap calls per rolling minute
  tmdb: { max: 30, windowMs: 60_000 },    // ≤30 TMDb calls per rolling minute
  news: { max: 15, windowMs: 60_000 },    // ≤15 NewsAPI calls per rolling minute
};

const callLog = { weather: [], tmdb: [], news: [] }; // timestamps of recent calls, one array per API

// Returns true if we're still under this API's ceiling right now.
function canCall(apiName) {
  const cfg = RATE_LIMITS[apiName];                       // this API's { max, windowMs }
  const now = Date.now();                                 // current time, once, for consistency below
  callLog[apiName] = callLog[apiName].filter((t) => now - t < cfg.windowMs); // drop timestamps outside the window
  return callLog[apiName].length < cfg.max;                // still room under the ceiling?
}

// Records that a call was just made, so it counts against future checks.
function recordCall(apiName) {
  callLog[apiName].push(Date.now()); // append "now" to this API's call log
}

// ═══════════════════════════════════════════════════════════════════
// RETRY WRAPPERS — one silent automatic retry before we ever bother
// the user with an error, then a rate-limit check gate in front of
// every real network call.
// ═══════════════════════════════════════════════════════════════════

// Bare fetch + JSON parse, no retry — the smallest building block.
async function fetchJson(url) {
  const res = await fetch(url);                                  // send the request
  if (!res.ok) throw new Error(`Request failed — status ${res.status}`); // non-2xx → treat as an error
  return res.json();                                              // parse and return the body
}

// fetchJson with one silent retry after a short delay, for
// transient hiccups (a dropped packet, a momentary DNS blip).
async function fetchJsonWithRetry(url, attempt = 0) {
  try {
    return await fetchJson(url); // try the request
  } catch (err) {
    if (attempt === 0) {         // only retry once — this is "graceful", not "infinite"
      await sleep(800);          // brief pause before trying again
      return fetchJsonWithRetry(url, attempt + 1); // second and final attempt
    }
    throw err; // out of retries — bubble up so the caller can show a Retry button
  }
}

// Gate used by Weather + TMDb calls: checks the rate limiter first,
// then performs the retried fetch if we're allowed to.
async function guardedFetch(apiName, url) {
  if (!canCall(apiName)) {
    // Refuse to even send the request — this IS "setting API call restrictions"
    throw new Error(`${API_LABELS[apiName]} rate limit reached for this session — try again in a few seconds.`);
  }
  recordCall(apiName);              // log this call before it happens, so concurrent calls are counted correctly
  return fetchJsonWithRetry(url);   // now actually make the (retried) request
}

// NewsAPI needs its own gated wrapper because of the extra 426→proxy
// fallback logic in newsApiFetch() (see the section below).
async function guardedNewsFetch(url) {
  if (!canCall("news")) {
    throw new Error(`${API_LABELS.news} rate limit reached for this session — try again in a few seconds.`);
  }
  recordCall("news");
  return newsApiFetchWithRetry(url);
}

async function newsApiFetchWithRetry(url, attempt = 0) {
  try {
    return await newsApiFetch(url); // handles the 426 (localhost-only) → CORS-proxy swap internally
  } catch (err) {
    if (attempt === 0) {
      await sleep(800);
      return newsApiFetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE CACHE — avoids redundant network calls
// Every successful category fetch is stashed in localStorage for a
// few minutes, keyed by category + whatever filters were active.
// Switching Fashion → Weather → Fashion inside that window re-renders
// instantly with zero network calls.
// ═══════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough to help, short enough to stay fresh

// Reads a cache entry if it exists and hasn't expired yet.
function getCached(key) {
  try {
    const raw = localStorage.getItem(`pulse_cache_${key}`); // stored as JSON string
    if (!raw) return null;                                  // never cached — miss
    const { data, ts } = JSON.parse(raw);                    // { data: [...cards], ts: <timestamp> }
    if (Date.now() - ts > CACHE_TTL_MS) return null;          // stale — treat as a miss so we refetch
    return data;                                              // fresh — reuse it
  } catch {
    return null; // corrupted entry or storage unavailable — fail safe as a cache miss
  }
}

// Writes a cache entry, tagged with "now" so we know when it expires.
function setCache(key, data) {
  try {
    localStorage.setItem(`pulse_cache_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage can throw if full or disabled in this browser — caching
    // is only an optimization, so we simply skip it rather than crash.
  }
}

// Builds a cache key that changes whenever the underlying request would
// change — so a genre switch or a topic switch correctly misses the
// cache and fetches fresh data, instead of showing stale results.
function categoryCacheKey(key) {
  if (key === "weather") return `weather:${compareCities.slice().sort().join(",")}`; // sorted so order doesn't matter
  if (key === "entertainment") return `entertainment:${currentEntertainmentGenre || "trending"}`;
  if (key === "fashion") return `fashion:${newsQuery.fashion}`;
  if (key === "politics") return `politics:${newsQuery.politics}`;
  return key;
}

// ═══════════════════════════════════════════════════════════════════
// THROTTLE — a short cooldown after any search / "add a city" action,
// so a double-click (or an impatient double-Enter) can't fire the
// same network request twice in a row.
// ═══════════════════════════════════════════════════════════════════

let searchCooldownUntil = 0; // timestamp (ms) before which new searches are blocked

function isOnCooldown() {
  return Date.now() < searchCooldownUntil; // true while we're still inside the cooldown window
}

function startCooldown(ms = 1000) {
  searchCooldownUntil = Date.now() + ms; // push the cooldown boundary 1s into the future
}

// ═══════════════════════════════════════════════════════════════════
// PERSONALIZATION HELPERS — last-search memory, used for auto-fill
// ═══════════════════════════════════════════════════════════════════

// Remembers the last thing searched in a given category, so the
// relevant input box can be pre-filled next time (without ever
// auto-submitting it — that would mean an API call the user never
// actually asked for on this visit).
function saveLastSearch(category, term) {
  localStorage.setItem(`pulse_last_search_${category}`, term); // one key per category
}
function getLastSearch(category) {
  return localStorage.getItem(`pulse_last_search_${category}`) || ""; // "" if never searched
}

// ═══════════════════════════════════════════════════════════════════
// REUSABLE CARD RENDERING
// Every category fetch returns an array of items already in this
// shape, so cardTemplate() and renderCards() never need to know
// which API a given item came from.
//   { id, type, image, tag, title, text, meta, url, accent, emoji, raw }
// `id` is a stable key used for bookmarking; `raw` carries the plain
// number each mapper read from the API (temp, rating, source name).
// ═══════════════════════════════════════════════════════════════════

function cardTemplate(card) {
  // The image block: a real photo/icon if we have one, else a big emoji on a plain background.
  const media = card.image
    ? `<div class="card__media" style="background-image:url('${card.image}')"><span class="card__tag">${escapeHTML(card.tag)}</span></div>`
    : `<div class="card__media"><span class="card__media-fallback">${card.emoji || "📰"}</span><span class="card__tag">${escapeHTML(card.tag)}</span></div>`;

  // The call-to-action: a real link for articles/movies, or a "LIVE" badge for weather (which has no article to open).
  const cta = card.url
    ? `<a href="${card.url}" target="_blank" rel="noopener" class="card__cta" data-ab-track>${abVariant === "A" ? "Read More →" : "See Full Story →"}</a>`
    : `<span class="card__live">● LIVE</span>`;

  const bookmarked = isBookmarked(card.id); // check localStorage — the list is tiny, so this is cheap even per-card
  const bookmarkBtn = `<button class="card__bookmark ${bookmarked ? "is-active" : ""}" data-bookmark data-id="${escapeHTML(card.id)}" type="button" title="${bookmarked ? "Remove bookmark" : "Save this"}">${bookmarked ? "★" : "☆"}</button>`;

  return `
    <article class="card" style="--card-accent:${card.accent}">
      ${media}
      <div class="card__body">
        <h3 class="card__title">${escapeHTML(card.title)}</h3>
        <p class="card__text">${escapeHTML(card.text)}</p>
        <div class="card__meta">
          <span>${escapeHTML(card.meta || "")}</span>
          <span class="card__actions">${bookmarkBtn}${cta}</span>
        </div>
      </div>
    </article>`;
}

// Renders the real card grid AND rebuilds cardIndex (id → card object)
// so a later bookmark click can retrieve the full card data by its id.
function renderCards(container, items) {
  cardIndex = {};                                  // start fresh — old ids from a previous category are gone
  items.forEach((c) => { cardIndex[c.id] = c; });  // index every card by its stable id
  if (!items.length) {
    container.innerHTML = `<p class="feed__status">No articles found for this view right now.</p>`;
    return;
  }
  container.innerHTML = items.map(cardTemplate).join(""); // build one HTML string, one DOM write
}

// Renders `count` pulsing placeholder cards immediately, so the grid
// is never blank while a request is in flight — an "intelligent
// loading indicator" rather than a spinner-only or blank-screen wait.
function renderSkeletonCards(container, count) {
  container.innerHTML = Array.from({ length: count }) // build an array just to map over `count` times
    .map(() => `
      <article class="card card--skeleton">
        <div class="card__media skeleton"></div>
        <div class="card__body">
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line short"></div>
        </div>
      </article>`)
    .join("");
}

// ═══════════════════════════════════════════════════════════════════
// PER-SOURCE MAPPERS — turn raw API JSON into the shared card shape
// ═══════════════════════════════════════════════════════════════════

function mapNewsItem(article, accent, type) {
  return {
    id: article.url,                                    // article URLs are unique — a good stable bookmark key
    type,                                                // "fashion" or "politics" — used when listing bookmarks
    image: article.urlToImage || null,                   // NewsAPI sometimes omits an image
    tag: article.source?.name || "News",                 // publication name, or a fallback
    title: article.title || "Untitled",
    text: article.description || "",
    meta: article.publishedAt ? timeAgo(new Date(article.publishedAt)) : "",
    url: article.url,
    accent,                                               // CSS color variable string, e.g. "var(--c-politics)"
    emoji: "📰",                                          // shown when there's no image
    raw: { source: article.source?.name || "Unknown" },   // plain value the doughnut chart reads directly
  };
}

function mapMovieItem(movie) {
  const img = movie.backdrop_path || movie.poster_path;   // prefer the wide backdrop image, fall back to the poster
  return {
    id: `movie-${movie.id}`,                               // prefixed so it can never collide with a city or URL id
    type: "entertainment",
    image: img ? `${TMDB_IMG}${img}` : null,
    tag: "TMDb",
    title: movie.title || movie.name || "Untitled",
    text: movie.overview || "No synopsis available.",
    meta: movie.release_date ? `★ ${movie.vote_average?.toFixed(1) ?? "–"} · ${movie.release_date}` : "",
    url: `https://www.themoviedb.org/movie/${movie.id}`,
    accent: "var(--c-entertainment)",
    emoji: "🎬",
    raw: { rating: movie.vote_average || 0 },              // plain number the bar chart reads directly
  };
}

function mapWeatherItem(data) {
  const icon = data.weather?.[0]?.icon;                    // OpenWeatherMap's icon code, e.g. "04d"
  return {
    id: data.name.toLowerCase(),                           // city name doubles as the comparison-chart & bookmark key
    type: "weather",
    image: icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : null,
    tag: "Live Weather",
    title: `${data.name}, ${data.sys?.country ?? ""}`,
    text: `${Math.round(data.main.temp)}°C · ${data.weather?.[0]?.description ?? ""} · feels like ${Math.round(data.main.feels_like)}°C`,
    meta: `Humidity ${data.main.humidity}% · Wind ${data.wind.speed} m/s`,
    url: null,                                              // no article to link to — the card shows a LIVE badge instead
    accent: "var(--c-weather)",
    emoji: "⛅",
    raw: { temp: Math.round(data.main.temp) },              // plain number the comparison bar chart reads directly
  };
}

// ═══════════════════════════════════════════════════════════════════
// NEWSAPI FETCH WRAPPER (Module 3's 426/localhost fix, unchanged)
// ═══════════════════════════════════════════════════════════════════

const CORS_PROXY = "https://api.allorigins.win/raw?url="; // fetches on our behalf, server-side, no browser Origin header

async function newsApiFetch(url) {
  let res;
  try {
    res = await fetch(url);                 // try the request directly first
  } catch {
    return newsApiFetchViaProxy(url);       // a network-level CORS block throws before we even see a status — proxy it
  }
  if (res.status === 426) return newsApiFetchViaProxy(url); // NewsAPI's "localhost only" rejection — proxy it
  if (!res.ok) throw new Error(`NewsAPI request failed — status ${res.status}`); // any other error — bubble up
  return res.json();
}

async function newsApiFetchViaProxy(url) {
  const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`); // proxy fetches server-side, no CORS issue
  if (!res.ok) throw new Error(`NewsAPI request failed even via proxy — status ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY FETCHERS — each returns an array of mapped cards.
// All network calls go through guardedFetch()/guardedNewsFetch(), so
// every one of them is rate-limited AND retried automatically.
// ═══════════════════════════════════════════════════════════════════

async function fetchFashion() {
  const url = `${NEWS_EVERYTHING}?q=${encodeURIComponent(newsQuery.fashion)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${NEWS_KEY}`;
  const data = await guardedNewsFetch(url);                     // rate-limited + retried + 426-proxy-aware
  return data.articles.map((a) => mapNewsItem(a, "var(--c-fashion)", "fashion"));
}

async function fetchPolitics() {
  const url = `${NEWS_EVERYTHING}?q=${encodeURIComponent(newsQuery.politics)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${NEWS_KEY}`;
  const data = await guardedNewsFetch(url);
  return data.articles.map((a) => mapNewsItem(a, "var(--c-politics)", "politics"));
}

async function fetchEntertainment(genreId) {
  const url = genreId
    ? `${TMDB_DISCOVER}?api_key=${TMDB_KEY}&with_genres=${genreId}&sort_by=popularity.desc` // a genre is selected
    : `${TMDB_TRENDING}?api_key=${TMDB_KEY}`;                                               // no genre — trending today
  const data = await guardedFetch("tmdb", url);
  return data.results.map(mapMovieItem);
}

async function fetchWeather() {
  // Fetch every city in parallel rather than one-by-one, so the wait
  // time is one round trip, not compareCities.length round trips.
  const results = await Promise.all(
    compareCities.map(async (city) => {
      try {
        const url = `${WEATHER_BASE}?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_KEY}`;
        const data = await guardedFetch("weather", url);
        return mapWeatherItem(data);
      } catch (err) {
        console.error(`Weather fetch failed for ${city}:`, err.message); // logged, not shown — see next line
        return null; // one bad/rate-limited city shouldn't blank out the whole comparison
      }
    })
  );
  return results.filter(Boolean); // drop the nulls from any city that failed
}

// Maps each category key to its label + fetch function. Weather reads
// `compareCities`, Entertainment reads `currentEntertainmentGenre`,
// Fashion/Politics read `newsQuery` — all mutable state set by the
// filter bar and the main search box.
const CATEGORIES = {
  fashion: { label: "Fashion — Fresh From the Runway", fetch: fetchFashion },
  weather: { label: "Weather — Live Around the World", fetch: fetchWeather },
  entertainment: { label: "Entertainment — Trending Today", fetch: () => fetchEntertainment(currentEntertainmentGenre) },
  politics: { label: "Politics — Latest Coverage", fetch: fetchPolitics },
};

// ═══════════════════════════════════════════════════════════════════
// CHART.JS — shared styling + one chart per category's chosen type
// ═══════════════════════════════════════════════════════════════════

Chart.defaults.color = "#8a97b5";           // default label/axis text color across every chart
Chart.defaults.font.family = "'Inter', sans-serif"; // match the site's body font

// Shared bar/line chart options — dark-theme axis colors, no legend
// (the axis labels already say what's being shown).
function baseChartOptions(yLabel) {
  return {
    responsive: true,           // resize with its container (needed for the mobile breakpoints)
    maintainAspectRatio: false, // let the CSS-set height win instead of a fixed ratio
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#8a97b5", font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { color: "#8a97b5", font: { size: 10 } },
        grid: { color: "#26314a" },
        title: { display: !!yLabel, text: yLabel, color: "#8a97b5", font: { size: 10 } },
      },
    },
  };
}

let categoryChartInstance = null; // handle to the currently-shown category chart, so we can destroy() it before redrawing

// Draws the chart for whichever category is active, choosing chart
// type by what best communicates that category's data (see the
// Module 4 docs panel on the page for the full reasoning).
function renderCategoryChart(key, cards) {
  if (categoryChartInstance) {
    categoryChartInstance.destroy(); // Chart.js reuses canvases badly if you don't destroy the old instance first
    categoryChartInstance = null;
  }

  if (key === "weather") {
    categoryChartWrap.hidden = false;
    categoryChartInstance = new Chart(document.getElementById("categoryChart"), {
      type: "bar", // comparing one number (temp) across several named cities → bar chart
      data: {
        labels: cards.map((c) => c.title.split(",")[0]),               // just the city name, not the country code
        datasets: [{ label: "Temp (°C)", data: cards.map((c) => c.raw?.temp ?? 0), backgroundColor: "#5ec8d8", borderRadius: 4 }],
      },
      options: baseChartOptions("°C"),
    });
  } else if (key === "entertainment") {
    categoryChartWrap.hidden = false;
    const top = cards.slice(0, 8); // cap at 8 bars so labels stay readable
    categoryChartInstance = new Chart(document.getElementById("categoryChart"), {
      type: "bar", // comparing ratings across named movies → bar chart
      data: {
        labels: top.map((c) => truncate(c.title, 14)),
        datasets: [{ label: "Rating", data: top.map((c) => c.raw?.rating ?? 0), backgroundColor: "#c792ea", borderRadius: 4 }],
      },
      options: baseChartOptions("Rating /10"),
    });
  } else if (key === "fashion" || key === "politics") {
    categoryChartWrap.hidden = false;
    const counts = {};                                    // source name → article count, built below
    cards.forEach((c) => {
      const s = c.raw?.source || "Unknown";
      counts[s] = (counts[s] || 0) + 1;                    // tally one more article for this source
    });
    categoryChartInstance = new Chart(document.getElementById("categoryChart"), {
      type: "doughnut", // share of a whole (which sources make up the current results) → doughnut chart
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ["#f2a65a", "#5ec8d8", "#c792ea", "#e2665a", "#8a97b5", "#4caf82", "#e0c341"],
          borderColor: "#161f33",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: "#eaf0fb", boxWidth: 10, font: { size: 10 } } } },
      },
    });
  } else {
    categoryChartWrap.hidden = true; // no chart type applies — keep the wrapper hidden
  }
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY MODE TOGGLE — Both / Cards / Chart (optional deliverable)
// ═══════════════════════════════════════════════════════════════════

let viewMode = "both"; // "both" | "cards" | "chart" — which parts of the feed are visible right now

// Applies the current viewMode to the DOM — toggling `hidden`, never
// re-fetching, so switching views is instant.
function applyViewMode() {
  const hasChart = !!categoryChartInstance; // some categories might not have drawn a chart yet
  if (viewMode === "cards") {
    cardsGrid.hidden = false;
    categoryChartWrap.hidden = true;
  } else if (viewMode === "chart") {
    cardsGrid.hidden = true;
    categoryChartWrap.hidden = !hasChart;
  } else {
    cardsGrid.hidden = false;
    categoryChartWrap.hidden = !hasChart;
  }
}

viewToggle.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");         // ignore clicks that miss the buttons
  if (!btn) return;
  viewMode = btn.dataset.view;                                // "both" | "cards" | "chart"
  viewToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn)); // highlight it
  applyViewMode();
  saveSession({ viewMode });                                  // remember for THIS TAB only (see SESSION STATE below)
});

// ═══════════════════════════════════════════════════════════════════
// FILTER BAR — per-category dynamic inputs (search box / dropdowns)
// ═══════════════════════════════════════════════════════════════════

function renderFilterBar(key) {
  if (key === "weather") {
    // Pre-fill with the last city you searched here — auto-fill, but
    // NOT auto-submitted, so opening this tab never fires a call on its own.
    filterBar.innerHTML = `
      <span class="filter-bar__label">Compare cities</span>
      <input id="citySearchInput" type="text" placeholder="Add a city…" value="${escapeHTML(getLastSearch("weather"))}" />
      <button id="citySearchBtn" type="button">Add to chart</button>`;
  } else if (key === "entertainment") {
    const options = movieGenres
      .map((g) => `<option value="${g.id}" ${String(g.id) === String(currentEntertainmentGenre) ? "selected" : ""}>${escapeHTML(g.name)}</option>`)
      .join("");
    filterBar.innerHTML = `
      <span class="filter-bar__label">Genre</span>
      <select id="genreSelect">
        <option value="" ${currentEntertainmentGenre ? "" : "selected"}>Trending Today</option>
        ${options}
      </select>`;
  } else if (key === "fashion" || key === "politics") {
    const opts = TOPIC_OPTIONS[key]
      .map((o) => `<option value="${escapeHTML(o.q)}" ${o.q === newsQuery[key] ? "selected" : ""}>${escapeHTML(o.label)}</option>`)
      .join("");
    filterBar.innerHTML = `<span class="filter-bar__label">Refine</span><select id="topicSelect">${opts}</select>`;
  } else {
    filterBar.innerHTML = ""; // no filter control for this key (shouldn't happen — 4 categories cover all cases)
  }
}

// Adds a city to the comparison list and reloads the weather category —
// shared by both the filter bar's "Add to chart" button and the main
// search box (when Weather is the active category).
function addCityAndReload(city) {
  city = city.trim();                       // ignore leading/trailing whitespace
  if (!city) return Promise.resolve(null);  // nothing typed — do nothing
  if (isOnCooldown()) {                     // throttle: block a rapid double-submit
    categoryStatus.textContent = "Please wait a moment before adding another city.";
    return Promise.resolve(null);
  }
  startCooldown();                          // start the 1-second cooldown window
  saveLastSearch("weather", city);          // remember it for next time's auto-fill

  if (!compareCities.some((c) => c.toLowerCase() === city.toLowerCase())) { // skip if already in the list
    if (compareCities.length >= 10) compareCities.shift();                  // cap the list so the chart stays readable
    compareCities.push(city);                                               // majors stay — we only ever push, never clear
  }
  return loadCategory("weather", { force: true }); // force=true: the cached weather list is now stale
}

filterBar.addEventListener("click", (e) => {
  if (e.target.id === "citySearchBtn") {
    const input = document.getElementById("citySearchInput"); // grab the live input (re-created on every render)
    addCityAndReload(input.value);
    input.value = ""; // clear so it's ready for the next city
  }
});

filterBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "citySearchInput") {
    e.preventDefault();                                  // stop the (nonexistent) form from doing anything odd
    document.getElementById("citySearchBtn").click();    // reuse the button's own click handler
  }
});

filterBar.addEventListener("change", (e) => {
  if (e.target.id === "genreSelect") {
    currentEntertainmentGenre = e.target.value;  // "" (trending) or a TMDb genre id
    loadCategory("entertainment");                // cache-aware — instant if this genre was already fetched recently
  }
  if (e.target.id === "topicSelect" && (currentCategory === "fashion" || currentCategory === "politics")) {
    newsQuery[currentCategory] = e.target.value; // swap the active NewsAPI q= term
    loadCategory(currentCategory);
  }
});

// ═══════════════════════════════════════════════════════════════════
// LOAD CATEGORY — fetch (or reuse cache), render cards, chart, filter
// bar; shows a skeleton while loading and a Retry button on failure.
// ═══════════════════════════════════════════════════════════════════

async function loadCategory(key, { force = false } = {}) {
  const cfg = CATEGORIES[key];
  if (!cfg) return null; // unknown key — nothing to do

  currentCategory = key; // used by the "stale response" guard below, and by several other functions that read it
  categoryNav.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.category === key); // highlight only the matching nav button
  });

  categoryTitle.textContent = dynamicLabel(key, cfg.label); // reflect the active genre/topic in the heading
  renderFilterBar(key);                                     // swap in this category's control(s)
  updateSearchPlaceholder(key);                              // hint at what pressing Enter will do here
  searchInput.value = getLastSearch(key);                    // auto-fill: your last search here, never auto-run

  if (categoryChartInstance) {          // clear any chart left over from the previous category
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }
  categoryChartWrap.hidden = true;

  const cacheKey = categoryCacheKey(key);              // e.g. "weather:Lagos,London,..."
  const cached = force ? null : getCached(cacheKey);   // force=true always skips the cache (manual refresh / new city)

  if (cached) {
    // Cache hit — render immediately with ZERO network calls. This is
    // the concrete "avoid redundant API calls" optimization in action.
    baseCategoryCards = cached;
    renderCards(cardsGrid, cached);
    renderCategoryChart(key, cached);
    applyViewMode();
    categoryStatus.textContent = `${cached.length} result${cached.length === 1 ? "" : "s"} · from cache · no API call made`;
    categoryStatus.classList.remove("is-error");
    saveSession({ category: key }); // remember for this tab (see SESSION STATE below)
    return cached;
  }

  renderSkeletonCards(cardsGrid, 6);              // instant visual feedback while the real request is in flight
  categoryStatus.textContent = "Loading live data…";
  categoryStatus.classList.remove("is-error");

  try {
    const cards = await cfg.fetch();              // the actual network call(s) — rate-limited + retried inside
    if (currentCategory !== key) return cards;    // the user already switched categories — discard this late response
    baseCategoryCards = cards;
    setCache(cacheKey, cards);                    // remember this result so the next visit (within TTL) is free
    renderCards(cardsGrid, cards);
    renderCategoryChart(key, cards);
    applyViewMode();
    categoryStatus.textContent = `${cards.length} live result${cards.length === 1 ? "" : "s"} · updated ${timeAgo(new Date())}`;
    saveSession({ category: key });
    return cards;
  } catch (err) {
    console.error(err);                           // full error stays in devtools for debugging
    baseCategoryCards = [];
    categoryChartWrap.hidden = true;
    const message = friendlyErrorMessage(err);
    categoryStatus.textContent = message;
    categoryStatus.classList.add("is-error");
    // A dead end with no way forward is bad UX — always offer a retry.
    cardsGrid.innerHTML = `
      <div class="feed__error">
        <p>${escapeHTML(message)}</p>
        <button type="button" data-retry-category="${key}">↻ Retry</button>
      </div>`;
    return [];
  }
}

// Lets the retry button (rendered above) re-run the failed load.
cardsGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-retry-category]");
  if (!btn) return;
  loadCategory(btn.dataset.retryCategory, { force: true }); // force: don't just re-show a (nonexistent) cache
});

// Lets the header ↻ button next to categoryStatus force a fresh fetch,
// bypassing the cache on purpose when the visitor actually wants that.
categoryRefreshBtn.addEventListener("click", () => {
  if (currentCategory) loadCategory(currentCategory, { force: true });
});

// Updates the category heading to reflect an active genre/topic filter,
// e.g. "Entertainment — Comedy" instead of the generic default label.
function dynamicLabel(key, fallback) {
  if (key === "entertainment" && currentEntertainmentGenre) {
    const g = movieGenres.find((x) => String(x.id) === String(currentEntertainmentGenre));
    return g ? `Entertainment — ${g.name}` : fallback;
  }
  if (key === "fashion" || key === "politics") {
    const opt = TOPIC_OPTIONS[key].find((o) => o.q === newsQuery[key]);
    return opt ? `${fallback.split(" — ")[0]} — ${opt.label}` : fallback;
  }
  return fallback;
}

categoryNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-btn");
  if (!btn) return;
  loadCategory(btn.dataset.category);
  if (window.matchMedia("(max-width: 640px)").matches) { // on mobile, collapse the nav back down after picking one
    categoryNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// ═══════════════════════════════════════════════════════════════════
// SEARCH / FILTER — debounced on-screen filter, PLUS a real API
// search (Enter / ↵) scoped to the active category. Results are added
// ALONGSIDE the regular cards, never in place of them.
// ═══════════════════════════════════════════════════════════════════

const SEARCH_PLACEHOLDERS = {
  weather: "Type a city or town, press Enter to add it…",
  entertainment: "Type a movie title, press Enter to search…",
  fashion: "Type a term, press Enter to search fashion news…",
  politics: "Type a place or topic, press Enter to search politics news…",
};

function updateSearchPlaceholder(key) {
  searchInput.placeholder = SEARCH_PLACEHOLDERS[key] || "Filter on screen, or press Enter to search…";
}

// The as-you-type filter — wrapped in debounce() so a fast typist
// doesn't trigger a DOM scan on every single keystroke.
const debouncedFilter = debounce(() => {
  const q = searchInput.value.trim().toLowerCase();
  cardsGrid.querySelectorAll(".card").forEach((card) => {
    const text = card.textContent.toLowerCase();      // includes title + body + meta text
    card.hidden = q.length > 0 && !text.includes(q);   // hide anything that doesn't match a non-empty query
  });
}, 150); // 150ms of typing silence before the filter actually runs

searchInput.addEventListener("input", debouncedFilter);

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();                     // stop any default form behavior
    performContextualSearch(searchInput.value);
  }
});

searchGoBtn.addEventListener("click", () => {
  performContextualSearch(searchInput.value);
});

async function performContextualSearch(rawTerm) {
  const term = rawTerm.trim();
  if (!term) return; // nothing typed — nothing to do

  if (isOnCooldown()) { // throttle: block rapid repeated searches
    categoryStatus.textContent = "Please wait a moment before searching again.";
    return;
  }

  // Weather: adding a city already keeps every previously-shown city
  // (majors included), since loadCategory("weather") re-fetches the
  // whole compareCities list, not just the new one.
  if (currentCategory === "weather") {
    await addCityAndReload(term); // handles its own cooldown + last-search save internally
    return;
  }

  if (currentCategory !== "entertainment" && currentCategory !== "politics" && currentCategory !== "fashion") {
    return; // no other categories support a contextual search
  }

  startCooldown();                          // begin the 1s cooldown for this search too
  saveLastSearch(currentCategory, term);    // remember for next time's auto-fill

  categoryStatus.textContent = `Searching "${term}"…`;
  categoryStatus.classList.remove("is-error");

  try {
    let searchCards = [];

    if (currentCategory === "entertainment") {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(term)}`;
      const data = await guardedFetch("tmdb", url);        // rate-limited + retried, same as every other TMDb call
      searchCards = data.results.map(mapMovieItem);
    } else {
      // politics or fashion — combine the current topic filter with the typed term
      const combinedQuery = `${newsQuery[currentCategory]} AND ${term}`;
      const url = `${NEWS_EVERYTHING}?q=${encodeURIComponent(combinedQuery)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_KEY}`;
      const data = await guardedNewsFetch(url);
      const accent = currentCategory === "politics" ? "var(--c-politics)" : "var(--c-fashion)";
      searchCards = data.articles.map((a) => mapNewsItem(a, accent, currentCategory));
    }

    // Search results render on top; the regular feed for this
    // category stays right where it was, underneath — nothing is lost.
    const combinedCards = [...searchCards, ...baseCategoryCards];
    renderCards(cardsGrid, combinedCards);
    renderCategoryChart(currentCategory, combinedCards);
    applyViewMode();
    categoryStatus.textContent = searchCards.length
      ? `${searchCards.length} result${searchCards.length === 1 ? "" : "s"} for "${term}" added above · ${baseCategoryCards.length} regular shown below`
      : `No results for "${term}" — showing the regular feed below.`;
  } catch (err) {
    console.error(err);
    categoryStatus.textContent = friendlyErrorMessage(err);
    categoryStatus.classList.add("is-error");
  }
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE NAV TOGGLE
// ═══════════════════════════════════════════════════════════════════

navToggle.addEventListener("click", () => {
  const isOpen = categoryNav.classList.toggle("is-open");        // flip the open/closed CSS class
  navToggle.setAttribute("aria-expanded", String(isOpen));        // keep the accessibility state in sync
});

// ═══════════════════════════════════════════════════════════════════
// TRENDING BANNER — rotating carousel + hourly refresh
// ═══════════════════════════════════════════════════════════════════

let trendingItems = [];   // the current top-5 headlines
let trendingIndex = 0;    // which one is currently shown in the carousel
let rotateTimer = null;   // handle to the setInterval that advances the carousel

async function fetchTrending() {
  trendingRefreshBtn.classList.add("is-spinning"); // spin animation while the refresh is in flight
  try {
    const url = `${NEWS_TOP}?country=us&pageSize=5&apiKey=${NEWS_KEY}`;
    const data = await guardedNewsFetch(url);      // rate-limited + retried + 426-proxy-aware
    trendingItems = data.articles.map((a) => mapNewsItem(a, "var(--c-politics)", "politics"));
    trendingIndex = 0;
    renderTrendingDots();
    renderTrendingSlide();
    trendingUpdated.textContent = `Updated ${timeAgo(new Date())}`;
    renderDashboardHeadlines(); // keep the dashboard's headline list in sync with the banner
  } catch (err) {
    console.error(err);
    trendingStage.innerHTML = `<p class="trending__loading">Trending headlines are unavailable right now (${escapeHTML(friendlyErrorMessage(err))}).</p>`;
    trendingDots.innerHTML = "";
    dashHeadlinesList.innerHTML = `<li class="tile__loading">Unavailable right now.</li>`;
  } finally {
    setTimeout(() => trendingRefreshBtn.classList.remove("is-spinning"), 700); // let the spin finish visually
  }
}

function renderTrendingSlide() {
  if (!trendingItems.length) return; // nothing to show yet
  const item = trendingItems[trendingIndex];
  trendingStage.innerHTML = `
    <div class="trending__slide">
      <div class="trending__media" style="${item.image ? `background-image:url('${item.image}')` : ""}"></div>
      <div class="trending__info">
        <span class="trending__tag">${escapeHTML(item.tag)} · ${escapeHTML(item.meta)}</span>
        <h3 class="trending__title">${escapeHTML(item.title)}</h3>
        <p class="trending__text">${escapeHTML(item.text)}</p>
        ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener" class="trending__link" data-ab-track>${abVariant === "A" ? "Read More →" : "See Full Story →"}</a>` : ""}
      </div>
    </div>`;
  trendingDots.querySelectorAll(".trending__dot").forEach((dot, i) => {
    dot.classList.toggle("is-active", i === trendingIndex); // highlight only the matching dot
  });
}

function renderTrendingDots() {
  trendingDots.innerHTML = trendingItems
    .map((_, i) => `<button class="trending__dot" data-index="${i}" aria-label="Slide ${i + 1}"></button>`)
    .join("");
}

trendingDots.addEventListener("click", (e) => {
  const dot = e.target.closest(".trending__dot");
  if (!dot) return;
  trendingIndex = Number(dot.dataset.index); // jump straight to the clicked slide
  renderTrendingSlide();
  resetRotateTimer();                        // restart the auto-rotate clock from here
});

trendingRefreshBtn.addEventListener("click", () => {
  fetchTrending();
  resetRotateTimer();
});

function resetRotateTimer() {
  clearInterval(rotateTimer); // stop any previous timer so they never stack up
  rotateTimer = setInterval(() => {
    if (!trendingItems.length) return;
    trendingIndex = (trendingIndex + 1) % trendingItems.length; // wrap back to 0 after the last slide
    renderTrendingSlide();
  }, 6000); // advance every 6 seconds
}

// ═══════════════════════════════════════════════════════════════════
// VISIBILITY-AWARE SCHEDULING — background refresh intervals skip
// themselves entirely while the tab isn't visible, so a backgrounded
// tab burns zero API quota until you come back to it.
// ═══════════════════════════════════════════════════════════════════

function scheduleVisible(fn, ms) {
  setInterval(() => {
    if (document.visibilityState === "visible") fn(); // only run the real work if the tab is actually on screen
  }, ms);
}

scheduleVisible(fetchTrending, 60 * 60 * 1000); // hourly, but only while visible

// ═══════════════════════════════════════════════════════════════════
// LIVE DASHBOARD — geolocation weather + forecast chart, headlines,
// now-playing movies. Each tile refreshes on its own schedule.
// ═══════════════════════════════════════════════════════════════════

// Wraps the browser's geolocation API in a Promise that always
// resolves (never rejects) — coords on success, null on any denial
// or timeout, so the caller can just check truthiness.
function getUserCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null); // API not supported in this browser
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }), // success
      () => resolve(null),                                                       // denied or errored
      { timeout: 6000 }                                                          // give up after 6s either way
    );
  });
}

let weatherTrendChartInstance = null; // handle to the dashboard's line chart, so we can destroy() before redrawing

function renderWeatherTrendChart(forecastData) {
  if (weatherTrendChartInstance) weatherTrendChartInstance.destroy();
  // OpenWeatherMap's forecast returns one entry per 3 hours (40 entries
  // for 5 days) — take every 8th entry to get roughly one per day.
  const daily = (forecastData.list || []).filter((_, i) => i % 8 === 0).slice(0, 5);
  weatherTrendChartInstance = new Chart(document.getElementById("weatherTrendChart"), {
    type: "line", // change over time → line chart
    data: {
      labels: daily.map((d) => new Date(d.dt * 1000).toLocaleDateString(undefined, { weekday: "short" })), // "Mon", "Tue", ...
      datasets: [{
        label: "°C",
        data: daily.map((d) => Math.round(d.main.temp)),
        borderColor: "#5ec8d8",
        backgroundColor: "rgba(94,200,216,0.15)",
        fill: true,
        tension: 0.35,   // slightly curved line instead of sharp angles
        pointRadius: 3,
      }],
    },
    options: baseChartOptions(""),
  });
}

async function loadDashboardWeather() {
  try {
    const coords = await getUserCoords();  // try to personalize by location first
    const prefs = getPrefs();              // fall back to the visitor's saved home city
    let data, forecastData;

    if (coords) {
      // Personalized path: query OpenWeatherMap directly by lat/lon.
      data = await guardedFetch("weather", `${WEATHER_BASE}?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${WEATHER_KEY}`);
      forecastData = await guardedFetch("weather", `${WEATHER_FORECAST}?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${WEATHER_KEY}`);
    } else {
      // Fallback path: use the saved home city, or Lagos if none is set yet.
      const city = prefs.homeCity || "Lagos";
      data = await guardedFetch("weather", `${WEATHER_BASE}?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_KEY}`);
      forecastData = await guardedFetch("weather", `${WEATHER_FORECAST}?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_KEY}`);
    }

    dashWeatherHero.innerHTML = `${Math.round(data.main.temp)}°C<span class="tile__hero-sub">${escapeHTML(data.name)} · ${escapeHTML(data.weather?.[0]?.description ?? "")}${coords ? " · detected location" : " · default city"}</span>`;
    dashWeatherUpdated.textContent = `Updated ${timeAgo(new Date())}`;
    renderWeatherTrendChart(forecastData);
  } catch (err) {
    console.error(err);
    dashWeatherHero.textContent = friendlyErrorMessage(err); // graceful fallback text instead of a stuck spinner
  }
}

function renderDashboardHeadlines() {
  if (!trendingItems.length) {
    dashHeadlinesList.innerHTML = `<li class="tile__loading">No headlines available.</li>`;
    return;
  }
  dashHeadlinesList.innerHTML = trendingItems
    .slice(0, 5) // exactly five, deliberately shown as a plain list rather than a chart (see docs panel)
    .map((item) => `<li><a href="${item.url}" target="_blank" rel="noopener">${escapeHTML(item.title)}</a></li>`)
    .join("");
  dashHeadlinesUpdated.textContent = `Updated ${timeAgo(new Date())}`;
}

let movieRatingChartInstance = null; // handle to the dashboard's movie-ratings bar chart

async function loadDashboardMovies() {
  try {
    const data = await guardedFetch("tmdb", `${TMDB_NOW_PLAYING}?api_key=${TMDB_KEY}`);
    const top = (data.results || []).slice(0, 6).sort((a, b) => b.vote_average - a.vote_average); // best-rated first
    if (movieRatingChartInstance) movieRatingChartInstance.destroy();
    movieRatingChartInstance = new Chart(document.getElementById("movieRatingChart"), {
      type: "bar",
      data: {
        labels: top.map((m) => truncate(m.title, 12)),
        datasets: [{ label: "Rating", data: top.map((m) => m.vote_average), backgroundColor: "#c792ea", borderRadius: 4 }],
      },
      options: baseChartOptions("Rating /10"),
    });
    dashMoviesUpdated.textContent = `Updated ${timeAgo(new Date())}`;
  } catch (err) {
    console.error(err);
    dashMoviesUpdated.textContent = "Unavailable";
  }
}

scheduleVisible(loadDashboardWeather, 10 * 60 * 1000); // every 10 minutes, but only while the tab is visible
scheduleVisible(loadDashboardMovies, 60 * 60 * 1000);  // hourly, but only while the tab is visible

// ═══════════════════════════════════════════════════════════════════
// TMDb GENRE LIST — powers the Entertainment filter + preferences
// ═══════════════════════════════════════════════════════════════════

async function loadGenres() {
  try {
    const data = await guardedFetch("tmdb", `${TMDB_GENRES}?api_key=${TMDB_KEY}`); // still goes through the rate limiter
    return data.genres || [];
  } catch (err) {
    console.error(err);
    return []; // fail quietly — the genre dropdown just falls back to "Trending Today" only
  }
}

function populateGenreSelects() {
  const options = movieGenres.map((g) => `<option value="${g.id}">${escapeHTML(g.name)}</option>`).join("");
  prefGenre.insertAdjacentHTML("beforeend", options); // add to the preferences modal's genre dropdown
}

// ═══════════════════════════════════════════════════════════════════
// PREFERENCES — localStorage, cross-session personalization
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = "pulse_prefs";

function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; // {} if never saved before
  } catch {
    return {}; // corrupted value — treat as "no preferences saved"
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); // localStorage — deliberately survives closing the tab
}

// Auto-fills the form every time it's opened, from whatever was last saved.
prefsToggle.addEventListener("click", () => {
  const prefs = getPrefs();
  prefDefaultCategory.value = prefs.defaultCategory || "entertainment";
  prefHomeCity.value = prefs.homeCity || "";
  prefGenre.value = prefs.genre || "";
  prefsModal.hidden = false;
});

prefsClose.addEventListener("click", () => { prefsModal.hidden = true; });
prefsModal.addEventListener("click", (e) => {
  if (e.target === prefsModal) prefsModal.hidden = true; // clicking the dark backdrop also closes it
});

prefsForm.addEventListener("submit", (e) => {
  e.preventDefault(); // stop the browser's default full-page form submit
  const prefs = {
    defaultCategory: prefDefaultCategory.value,
    homeCity: prefHomeCity.value.trim(),
    genre: prefGenre.value,
  };
  savePrefs(prefs);          // persist to localStorage — this is the "remember across sessions" part
  prefsModal.hidden = true;

  if (prefs.homeCity && !compareCities.some((c) => c.toLowerCase() === prefs.homeCity.toLowerCase())) {
    compareCities.unshift(prefs.homeCity); // add it to the front of the comparison list
  }
  currentEntertainmentGenre = prefs.genre || "";
  loadCategory(prefs.defaultCategory || "entertainment", { force: true }); // force: preferences just changed, don't show stale cache
});

// ═══════════════════════════════════════════════════════════════════
// SESSION STATE — sessionStorage, THIS-TAB-ONLY resume state
// Different lifetime than preferences on purpose: refreshing the page
// mid-visit resumes exactly where you were, but a brand-new tab
// starts fresh at your saved default (from localStorage above).
// ═══════════════════════════════════════════════════════════════════

const SESSION_KEY = "pulse_session";

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSession(patch) {
  const merged = { ...getSession(), ...patch };            // merge so unrelated keys aren't lost
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged)); // sessionStorage — cleared when this tab closes
}

// ═══════════════════════════════════════════════════════════════════
// BOOKMARKS / SAVED LOCATIONS — localStorage, cross-session
// A ☆ button on every card saves it; the 🔖 panel lists everything
// saved, with one click to remove.
// ═══════════════════════════════════════════════════════════════════

const BOOKMARKS_KEY = "pulse_bookmarks";

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveBookmarks(list) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
}

function isBookmarked(id) {
  return getBookmarks().some((b) => b.id === id); // linear scan — the list is small, so this is cheap
}

// Adds or removes a card from the saved list, keeping only the fields
// needed to redisplay it later (not the whole raw API response).
function toggleBookmark(card) {
  const list = getBookmarks();
  const idx = list.findIndex((b) => b.id === card.id);
  if (idx >= 0) {
    list.splice(idx, 1); // already saved — remove it
  } else {
    list.push({          // not yet saved — add a trimmed-down copy
      id: card.id, type: card.type, title: card.title, tag: card.tag,
      meta: card.meta, url: card.url, image: card.image, accent: card.accent, emoji: card.emoji,
    });
  }
  saveBookmarks(list);
  renderBookmarksPanel(); // keep the open panel (if any) in sync immediately
}

function renderBookmarksPanel() {
  const list = getBookmarks();
  if (!list.length) {
    bookmarksList.innerHTML = `<p class="modal__note">Nothing saved yet — tap ☆ on any card to bookmark it.</p>`;
    return;
  }
  bookmarksList.innerHTML = list
    .map((b) => `
      <div class="bookmarks__item">
        <div>
          <div>${escapeHTML(b.title)}</div>
          <div class="bookmarks__item-meta">${escapeHTML(b.tag || b.type)}</div>
        </div>
        <button class="bookmarks__remove" data-remove-bookmark="${escapeHTML(b.id)}" type="button" title="Remove">✕</button>
      </div>`)
    .join("");
}

bookmarksToggle.addEventListener("click", () => {
  renderBookmarksPanel();      // always render fresh in case bookmarks changed since it was last opened
  bookmarksModal.hidden = false;
});
bookmarksClose.addEventListener("click", () => { bookmarksModal.hidden = true; });
bookmarksModal.addEventListener("click", (e) => {
  if (e.target === bookmarksModal) bookmarksModal.hidden = true; // click the backdrop to close
});

// Removing a bookmark from inside the panel.
bookmarksList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-bookmark]");
  if (!btn) return;
  const id = btn.dataset.removeBookmark;
  saveBookmarks(getBookmarks().filter((b) => b.id !== id)); // keep everything except the removed id
  renderBookmarksPanel();
  // Also un-star that card if it's currently visible in the grid.
  document.querySelectorAll(`[data-bookmark][data-id="${CSS.escape(id)}"]`).forEach((starBtn) => {
    starBtn.classList.remove("is-active");
    starBtn.textContent = "☆";
    starBtn.title = "Save this";
  });
});

// Bookmarking (or un-bookmarking) from the ☆ button on a card — this
// listener is on `document` because cards are re-rendered constantly,
// so a listener attached to any one card would be destroyed with it.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-bookmark]");
  if (!btn) return;
  const id = btn.dataset.id;
  const card = cardIndex[id];           // look up the full card object we indexed at render time
  if (!card) return;                     // shouldn't happen, but guard anyway
  toggleBookmark(card);
  const nowActive = isBookmarked(id);    // re-check after the toggle to know which state we're now in
  btn.classList.toggle("is-active", nowActive);
  btn.textContent = nowActive ? "★" : "☆";
  btn.title = nowActive ? "Remove bookmark" : "Save this";
});

// ═══════════════════════════════════════════════════════════════════
// A/B TEST — random variant per browser, click tracking in localStorage
// ═══════════════════════════════════════════════════════════════════

function getAbVariant() {
  let v = localStorage.getItem("pulse_ab_variant"); // persisted so the SAME visitor always sees the same variant
  if (!v) {
    v = Math.random() < 0.5 ? "A" : "B"; // first visit — flip a coin
    localStorage.setItem("pulse_ab_variant", v);
  }
  return v;
}

const abVariant = getAbVariant();                                   // this browser's fixed variant for the whole session
const abLabel = { A: "Read More →", B: "See Full Story →" };        // the two CTA wordings being tested

function getAbClicks(variant) {
  return Number(localStorage.getItem(`pulse_ab_clicks_${variant}`) || 0); // 0 if never clicked
}

function renderAbPanel() {
  const clicksA = getAbClicks("A");
  const clicksB = getAbClicks("B");
  abPanel.innerHTML =
    `This browser is in <strong>Variant ${abVariant}</strong> ("${abLabel[abVariant]}").<br>` +
    `Clicks tracked locally — A: ${clicksA} · B: ${clicksB}`;
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-ab-track]")) {                       // any CTA marked for A/B tracking
    const key = `pulse_ab_clicks_${abVariant}`;
    localStorage.setItem(key, getAbClicks(abVariant) + 1);         // increment this variant's counter
    renderAbPanel();                                                // refresh the live readout in the docs footer
  }
});

// ═══════════════════════════════════════════════════════════════════
// NEWSROOM ASSISTANT — rule-based chatbot, some replies API-triggered
// ═══════════════════════════════════════════════════════════════════

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat__msg chat__msg--${role}`; // "chat__msg--bot" or "chat__msg--user"
  div.textContent = text;                          // textContent, not innerHTML — no need to worry about escaping here
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight; // auto-scroll to the newest message
}

async function getBotReply(raw) {
  const m = raw.toLowerCase(); // case-insensitive keyword matching

  if (/\b(hi|hello|hey)\b/.test(m)) {
    return `Hi! Try "show weather", "trending movies", "politics", "fashion", or "what's trending".`;
  }
  if (/weather/.test(m)) {
    const cards = await loadCategory("weather"); // cache-aware — instant if weather was loaded recently
    const first = cards && cards[0];
    return first
      ? `Switched you to Weather — right now ${first.title} is ${first.text}.`
      : `Switched to Weather, but the live feed hiccupped — try again in a moment.`;
  }
  if (/movie|film|entertain/.test(m)) {
    const cards = await loadCategory("entertainment");
    const first = cards && cards[0];
    return first
      ? `Switched to Entertainment — trending right now: "${first.title}".`
      : `Switched to Entertainment, but the live feed hiccupped — try again in a moment.`;
  }
  if (/politic/.test(m)) {
    const cards = await loadCategory("politics");
    const first = cards && cards[0];
    return first
      ? `Switched to Politics — top story: "${first.title}".`
      : `Switched to Politics, but that feed only works from localhost on the free NewsAPI plan.`;
  }
  if (/fashion/.test(m)) {
    const cards = await loadCategory("fashion");
    const first = cards && cards[0];
    return first
      ? `Switched to Fashion — top story: "${first.title}".`
      : `Switched to Fashion, but that feed only works from localhost on the free NewsAPI plan.`;
  }
  if (/trend/.test(m)) {
    const top = trendingItems[0];
    return top
      ? `Top trending right now: "${top.title}" — see the banner up top.`
      : `Trending headlines are still loading — check the banner up top in a moment.`;
  }
  if (/help/.test(m)) {
    return `I can jump you to a category (weather, movies, politics, fashion) or tell you what's trending. Just ask!`;
  }
  return `I'm not sure about that yet — try "weather", "movies", "politics", "fashion", or "trending".`;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();                    // stop the page from reloading on submit
  const text = chatInput.value.trim();
  if (!text) return;                     // ignore empty submits
  appendMessage("user", text);
  chatInput.value = "";                  // clear the box right away for a snappy feel
  appendMessage("bot", "…");             // a lightweight "typing" placeholder
  const thinking = chatMessages.lastElementChild; // the "…" bubble we just added
  const reply = await getBotReply(text);
  thinking.textContent = reply;          // swap the placeholder for the real reply once it's ready
});

chatToggle.addEventListener("click", () => { chatPanel.hidden = !chatPanel.hidden; }); // simple show/hide toggle
chatClose.addEventListener("click", () => { chatPanel.hidden = true; });

// ═══════════════════════════════════════════════════════════════════
// OFFLINE / ONLINE HANDLING — graceful degradation when the network
// actually drops mid-visit.
// ═══════════════════════════════════════════════════════════════════

window.addEventListener("offline", () => { offlineBanner.hidden = false; }); // browser detected we lost connectivity
window.addEventListener("online", () => { offlineBanner.hidden = true; });   // browser detected we're back
if (!navigator.onLine) offlineBanner.hidden = false; // cover the case where the page loads while already offline

// ═══════════════════════════════════════════════════════════════════
// INIT — restore saved state, then kick off the first loads
// ═══════════════════════════════════════════════════════════════════

renderAbPanel(); // show the A/B tally immediately, before any network activity

const initialPrefs = getPrefs();   // cross-session preferences (localStorage)
const initialSession = getSession(); // this-tab-only resume state (sessionStorage) — takes priority if present

if (initialPrefs.homeCity) {
  // Seed the comparison list with the saved home city, keeping the majors too.
  compareCities = [initialPrefs.homeCity, ...WEATHER_CITIES.filter((c) => c.toLowerCase() !== initialPrefs.homeCity.toLowerCase())];
}

// Fold any bookmarked ("saved") weather locations back into the
// comparison list too, so they reappear automatically on every visit.
getBookmarks()
  .filter((b) => b.type === "weather")
  .forEach((b) => {
    const city = b.title.split(",")[0]; // strip the ", NG" country-code suffix back off
    if (!compareCities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      compareCities.push(city);
    }
  });

if (initialPrefs.genre) currentEntertainmentGenre = initialPrefs.genre; // saved favorite genre, if any

if (initialSession.viewMode) {
  // Resume the exact Both/Cards/Chart mode this tab was in before a refresh.
  viewMode = initialSession.viewMode;
  viewToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.view === viewMode));
}

loadGenres().then((genres) => {
  movieGenres = genres;
  populateGenreSelects();
  if (currentCategory === "entertainment") renderFilterBar("entertainment"); // refresh the dropdown if already showing
});

// Session state wins over saved preference (you were just on this
// category in this tab); preference wins over the hard-coded default.
loadCategory(initialSession.category || initialPrefs.defaultCategory || "entertainment");

fetchTrending().then(resetRotateTimer); // first trending fetch, then start the 6s rotation
loadDashboardWeather();                 // first dashboard weather load (geolocation prompt happens here)
loadDashboardMovies();                  // first dashboard "now playing" load
