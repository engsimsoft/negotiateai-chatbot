/**
 * ТЗ-UrlVerificationMetricNormalization: keepable регрессионный тест для
 * normalizeUrlForComparison (lib/ai/pipeline-trace.ts).
 *
 * Основной фикс — commit 58d9d2e — добавил нормализацию URL перед сравнением
 * article-URL vs fetched-URL в observability-метрике urlVerification. Без теста
 * регрессии возможны при любой правке regex/логики.
 *
 * Запуск:  npx tsx scripts/test-url-verification-normalization.ts
 * Ожидание: все кейсы PASS, exit 0. Падение = exit 1.
 */

import { normalizeUrlForComparison } from "@/lib/ai/url-normalize";

type Case = {
  name: string;
  a: string;
  b: string;
  shouldMatch: boolean;
};

const cases: Case[] = [
  // --- Anchor / hash fragment ---
  {
    name: "anchor fragment (#atom-everything) игнорируется",
    a: "https://simonwillison.net/2026/Apr/15/post/",
    b: "https://simonwillison.net/2026/Apr/15/post/#atom-everything",
    shouldMatch: true,
  },
  {
    name: "anchor #comments игнорируется",
    a: "https://example.com/post",
    b: "https://example.com/post#comments",
    shouldMatch: true,
  },

  // --- UTM / tracking params ---
  {
    name: "utm_campaign + utm_source + utm_medium убираются (Habr RSS)",
    a: "https://habr.com/ru/articles/123/",
    b: "https://habr.com/ru/articles/123/?utm_campaign=123&utm_source=habrahabr&utm_medium=rss",
    shouldMatch: true,
  },
  {
    name: "fbclid (Facebook) убирается",
    a: "https://example.com/x",
    b: "https://example.com/x?fbclid=IwAR123",
    shouldMatch: true,
  },
  {
    name: "gclid (Google Ads) убирается",
    a: "https://example.com/x",
    b: "https://example.com/x?gclid=ABC",
    shouldMatch: true,
  },
  {
    name: "yclid (Yandex Direct) убирается",
    a: "https://example.com/x",
    b: "https://example.com/x?yclid=12345",
    shouldMatch: true,
  },
  {
    name: "msclkid (Bing Ads) убирается",
    a: "https://example.com/x",
    b: "https://example.com/x?msclkid=abc",
    shouldMatch: true,
  },
  {
    name: "si (Spotify/YouTube share) убирается",
    a: "https://youtu.be/dQw4w9WgXcQ",
    b: "https://youtu.be/dQw4w9WgXcQ?si=ABC123",
    shouldMatch: true,
  },
  {
    name: "feature (YouTube) убирается",
    a: "https://youtube.com/watch?v=abc",
    b: "https://youtube.com/watch?v=abc&feature=share",
    shouldMatch: true,
  },
  {
    name: "spm (Alibaba) + spm_* prefix убираются",
    a: "https://aliexpress.com/item/1.html",
    b: "https://aliexpress.com/item/1.html?spm=a2g0o.home&spm_id=111",
    shouldMatch: true,
  },
  {
    name: "ref_src / ref_url (Twitter/X) убираются",
    a: "https://x.com/user/status/123",
    b: "https://x.com/user/status/123?ref_src=twsrc&ref_url=https%3A%2F%2Fexample.com",
    shouldMatch: true,
  },
  {
    name: "igshid (Instagram) убирается",
    a: "https://instagram.com/p/abc",
    b: "https://instagram.com/p/abc?igshid=XYZ",
    shouldMatch: true,
  },

  // --- Preserve legitimate query params ---
  {
    name: "легитимный ?page=2 сохраняется (разные страницы = разные URL)",
    a: "https://example.com/list",
    b: "https://example.com/list?page=2",
    shouldMatch: false,
  },
  {
    name: "легитимный ?v= (YouTube video id) сохраняется",
    a: "https://youtube.com/watch?v=abc",
    b: "https://youtube.com/watch?v=xyz",
    shouldMatch: false,
  },
  {
    name: "легитимный ?id= сохраняется",
    a: "https://example.com/item?id=1",
    b: "https://example.com/item?id=2",
    shouldMatch: false,
  },

  // --- Query param sorting ---
  {
    name: "разный порядок query params → canonical match",
    a: "https://example.com/x?a=1&b=2",
    b: "https://example.com/x?b=2&a=1",
    shouldMatch: true,
  },

  // --- Trailing slash ---
  {
    name: "trailing slash / отсутствие — не различают",
    a: "https://example.com/path",
    b: "https://example.com/path/",
    shouldMatch: true,
  },
  {
    name: "root / сохраняется (не матчится с пустым)",
    a: "https://example.com/",
    b: "https://example.com",
    shouldMatch: true,
  },

  // --- www / non-www ---
  {
    name: "www. / без www. — не различают",
    a: "https://example.com/x",
    b: "https://www.example.com/x",
    shouldMatch: true,
  },

  // --- http / https ---
  {
    name: "http / https канонизируются в https",
    a: "http://example.com/x",
    b: "https://example.com/x",
    shouldMatch: true,
  },

  // --- Hostname case ---
  {
    name: "uppercase hostname приводится к lowercase",
    a: "https://EXAMPLE.com/X",
    b: "https://example.com/X",
    shouldMatch: true,
  },

  // --- Malformed URL fallback ---
  {
    name: "malformed URL возвращается as-is (не крашит)",
    a: "not-a-url",
    b: "not-a-url",
    shouldMatch: true,
  },
  {
    name: "malformed vs real — не матчится",
    a: "not-a-url",
    b: "https://example.com/x",
    shouldMatch: false,
  },

  // --- Control: действительно разные URL ---
  {
    name: "разные хосты — не матчатся",
    a: "https://habr.com/ru/articles/1/",
    b: "https://example.com/ru/articles/1/",
    shouldMatch: false,
  },
  {
    name: "разные пути — не матчатся",
    a: "https://example.com/a",
    b: "https://example.com/b",
    shouldMatch: false,
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const na = normalizeUrlForComparison(c.a);
  const nb = normalizeUrlForComparison(c.b);
  const match = na === nb;
  const ok = match === c.shouldMatch;

  if (ok) {
    passed += 1;
    console.log(`✅ ${c.name}`);
  } else {
    failed += 1;
    console.log(`❌ ${c.name}`);
    console.log(`   a → ${c.a}`);
    console.log(`   b → ${c.b}`);
    console.log(`   normalized a: ${na}`);
    console.log(`   normalized b: ${nb}`);
    console.log(`   expected match=${c.shouldMatch}, got match=${match}`);
  }
}

console.log(`\n${passed} passed / ${failed} failed / ${cases.length} total`);

if (failed > 0) {
  process.exit(1);
}
