/**
 * URL canonical normalization for observability comparison.
 *
 * ТЗ-UrlVerificationMetricNormalization (2026-04-16): до этой правки
 * classifyUrl делал наивное `Set.has(url)` сравнение, из-за чего любая
 * форматная разница между URL фетчера и URL в статье (anchor-фрагмент,
 * UTM-параметры, trailing slash, www./без, http/https) классифицировала
 * живой реально скопированный URL как "fabricated". Реальный инцидент:
 * briefing 09b01675 — метрика показала 9/11 (82%) fabricated, все 11
 * URLs при этом отдавали HTTP 200 с контентом (curl-проверено).
 *
 * Нормализация приводит оба URL к canonical форме перед сравнением:
 *   - hostname lowercase, без `www.`
 *   - protocol → https (для сравнения — без apples vs oranges)
 *   - hash/anchor убирается (`#atom-everything` и т.п.)
 *   - tracking query-params убираются (набор ниже)
 *   - остальные query-params сортируются для стабильного порядка
 *   - trailing `/` убирается (кроме root `/`)
 *
 * Если URL malformed — возвращаем как есть (не ломаем pipeline на плохом
 * входе, пусть классификатор честно скажет "fabricated").
 *
 * Контракт tracking params (SSOT для observability-сравнения URL):
 *   - Google Analytics / кампании: utm_*, _ga, mc_* (Mailchimp)
 *   - Ad platforms: fbclid, gclid, yclid (Yandex), msclkid (Bing)
 *   - Social share: igshid (Instagram), share_source, share_from
 *   - Referral: ref, ref_src, ref_url (Twitter/X)
 *   - Video/audio platforms: si (Spotify/YouTube), feature (YouTube)
 *   - E-commerce трекинг: spm, spm_* (Alibaba)
 * Добавлять новые — только с документированной причиной (не гадать).
 *
 * Модуль намеренно изолирован от server-only импортов — тестируется через
 * `scripts/test-url-verification-normalization.ts` (npx tsx).
 */

const TRACKING_PARAM_REGEX =
  /^(utm_|fbclid$|gclid$|yclid$|msclkid$|mc_|ref$|ref_src$|ref_url$|_ga$|igshid$|share_source$|share_from$|si$|feature$|spm$|spm_)/;

export function normalizeUrlForComparison(url: string): string {
  try {
    const u = new URL(url);
    // Host: lowercase + strip www.
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    // Protocol: canonical https
    u.protocol = "https:";
    // Hash: always drop
    u.hash = "";
    // Query params: filter tracking + sort remaining
    const keepKeys = [...u.searchParams.keys()].filter(
      (k) => !TRACKING_PARAM_REGEX.test(k),
    );
    const sortedParams = new URLSearchParams();
    for (const key of keepKeys.sort()) {
      for (const val of u.searchParams.getAll(key)) {
        sortedParams.append(key, val);
      }
    }
    u.search = sortedParams.toString();
    // Trailing slash: strip if pathname > "/"
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    // Malformed URL — return as-is. classifyUrl will treat it as fabricated.
    return url;
  }
}
