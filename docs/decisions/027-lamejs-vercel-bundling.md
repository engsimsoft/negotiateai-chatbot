# ADR 027: lamejs на Vercel — lazy loading, pnpm path resolution, outputFileTracingIncludes

**Дата:** 2026-02-28
**Статус:** Принято

---

## Контекст

Подкаст-движок (`lib/podcast/`) использует **lamejs** (чистый JS MP3-кодер) для конвертации PCM → MP3. В web UI (`/api/briefing/podcast/generate`) это работало, но при вызове из **cron-функции** (`/api/cron/briefing`) lamejs не загружался — ENOENT.

**Почему проблема существовала 5 дней (v3.43.0 → v3.55.0):**
1. Подкаст из UI работал — у route `/api/briefing/podcast/generate` свой бандл, куда lamejs попадал
2. Cron route (`/api/cron/briefing`) — **отдельная** serverless-функция с **отдельным** бандлом
3. lamejs не попадал в бандл cron-функции, т.к. Next.js NFT (Node File Tracing) не трассирует динамически вычисленные пути

**Исследованные причины:**
- `require.resolve("lamejs/lame.all.js")` — webpack/turbopack **заменяет** `require.resolve` на свою реализацию, которая возвращает числовой module ID (87812), а не путь к файлу
- `path.join(process.cwd(), "node_modules", "lamejs", ...)` — на Vercel pnpm-симлинки **не сохраняются**. Реальный файл лежит в `.pnpm/lamejs@1.2.1/node_modules/lamejs/`, а `node_modules/lamejs` — битый симлинк
- `outputFileTracingIncludes` с glob `./node_modules/lamejs/**/*` — Vercel packager выдаёт ошибку "invalid deployment package... symlinked directories" при попытке следовать за pnpm-симлинкой

---

## Решение

Комбинация трёх подходов:

### 1. Lazy loading (audio-converter.ts)

```typescript
let _Mp3Encoder: any = null;

function getMp3Encoder() {
  if (_Mp3Encoder) return _Mp3Encoder;
  // pnpm: реальный путь (симлинки не работают на Vercel)
  const pnpmPath = path.join(
    process.cwd(), "node_modules", ".pnpm", "lamejs@1.2.1",
    "node_modules", "lamejs", "lame.all.js",
  );
  // npm/yarn: прямой путь
  const symlinkPath = path.join(
    process.cwd(), "node_modules", "lamejs", "lame.all.js",
  );
  const lamejsPath = fs.existsSync(pnpmPath) ? pnpmPath : symlinkPath;
  const code = fs.readFileSync(lamejsPath, "utf-8");
  const loader = new Function(code + "\nreturn { Mp3Encoder: lamejs.Mp3Encoder };");
  _Mp3Encoder = loader().Mp3Encoder;
  return _Mp3Encoder;
}
```

**Зачем lazy:** route `/api/cron/briefing` загружает модуль `audio-converter.ts` при import, но не всем пользователям нужен подкаст. Lazy loading откладывает загрузку lamejs до момента использования.

### 2. outputFileTracingIncludes (next.config.ts)

```typescript
outputFileTracingIncludes: {
  "/api/cron/briefing": [
    "./node_modules/.pnpm/lamejs@1.2.1/node_modules/lamejs/lame.all.js",
  ],
},
```

**Зачем:** NFT не может трассировать `fs.readFileSync(dynamicPath)`. `outputFileTracingIncludes` принудительно включает файл в бандл конкретной serverless-функции.

**Важно:** путь должен быть **реальным** (через `.pnpm/`), а не симлинкой. Glob `./node_modules/lamejs/**/*` вызывает ошибку деплоя.

### 3. serverExternalPackages (next.config.ts)

```typescript
serverExternalPackages: ["lamejs"],
```

**Зачем:** предотвращает попытку webpack/turbopack бандлить lamejs как CJS-модуль (что вызывает `MPEGMode is not defined`).

### 4. Audio Merger (lib/podcast/audio-merger.ts)

Новый модуль для склейки per-section MP3-треков в один файл подкаста:

```typescript
export async function mergeAndUploadPodcast({
  userId, audioUrls, audioDurations, sectionOrder,
}): Promise<{ url: string; totalDuration: number }>
```

- Fetch каждый MP3 по URL в порядке `sectionOrder`
- `Buffer.concat()` — MP3 потоковый формат, конкатенация = валидный файл
- `put()` в Vercel Blob → URL для Telegram delivery

---

## Причины

### Почему НЕ `require.resolve`

1. webpack/turbopack **подменяет** `require.resolve` на свою реализацию
2. В production возвращает числовой module ID (87812), не путь
3. Проверено эмпирически: `typeof require.resolve("lamejs/lame.all.js") === "number"`

### Почему pnpm path first, symlink fallback

1. На Vercel с pnpm `node_modules/lamejs` — **битый симлинк** (Vercel не сохраняет симлинки)
2. Реальные файлы в `.pnpm/lamejs@1.2.1/node_modules/lamejs/`
3. Локально (dev) symlink работает → fallback для разработки
4. `fs.existsSync(pnpmPath)` — проверка в runtime

### Почему точный путь, а не glob в outputFileTracingIncludes

1. Glob `./node_modules/lamejs/**/*` следует за pnpm-симлинкой
2. Vercel packager: `"invalid deployment package... symlinked directories"`
3. Точный путь к `.pnpm/...` — работает, файл (530KB) попадает в бандл

### Почему Buffer.concat для MP3 merge

1. MP3 — потоковый формат (stream of frames), конкатенация валидных файлов = валидный файл
2. Не нужен ffmpeg или другие бинарные зависимости
3. Работает в serverless без ограничений

---

## Последствия

### Плюсы

- Подкаст генерируется из cron → полноценный MP3 в Telegram
- Lazy loading — routes без аудио не платят за инициализацию lamejs
- Двойная гарантия: `serverExternalPackages` + `outputFileTracingIncludes`
- pnpm + npm/yarn совместимость через fallback

### Минусы

- **Хрупкий путь**: `lamejs@1.2.1` захардкожен. При обновлении версии нужно обновить в 2 местах (audio-converter.ts + next.config.ts)
- **`new Function()`**: нестандартный подход загрузки, может быть заблокирован CSP в некоторых средах (на Vercel serverless — ОК)
- **Нет автоматического fallback**: если lamejs обновится, ENOENT вернётся
- **Тайминг**: podcast generation + merge + delivery добавляет ~60-90с к cron execution (итого ~100-160с из 240с maxDuration)

### Риски масштабирования → Vercel Pro план

При росте числа пользователей может потребоваться переход на **Vercel Pro** ($20/month):

| Ограничение Hobby | Pro |  Когда критично |
|---|---|---|
| maxDuration: 60с (300с Fluid Compute) | 900с | 10+ пользователей с audio (pipeline ~100-160с × N, p-limit(3)) |
| Cron: min 1 day | min 1 minute | Нужна доставка с точностью ±15 мин вместо 1 раза в день |
| 1 concurrent build | 3+ | Частые деплои при активной разработке |
| Bandwidth: 100GB | 1TB | Рост аудио-трафика (MP3 ~5-10MB × users × days) |
| Blob Storage: 100MB | 500MB → custom | Накопление MP3 подкастов |

**Рекомендация:** при 5+ активных пользователей с audio-доставкой — переход на Pro.

---

## Хронология отладки

| Попытка | Подход | Результат |
|---------|--------|-----------|
| 1 | `require.resolve("lamejs/lame.all.js")` | Возвращает числовой ID (87812), не путь |
| 2 | `path.join(process.cwd(), "node_modules", "lamejs", ...)` | ENOENT — симлинк не работает на Vercel |
| 3 | `outputFileTracingIncludes: ["./node_modules/lamejs/**/*"]` | Deploy error: symlinked directories |
| 4 | Точный pnpm-путь + `outputFileTracingIncludes` + `fs.existsSync` | **Работает**. `ready(2/2),merged`, `deliveryStatus: "sent"` |

---

## Альтернативы

### Альтернатива 1: ffmpeg-wasm

**Что это:** WebAssembly-версия ffmpeg для конвертации аудио.

**Почему отклонили:**
- ~30MB бандл — неприемлемо для serverless (cold start)
- Сложная инициализация (WASM memory)
- Overkill для PCM → MP3

### Альтернатива 2: Cloud-based конвертация (CloudConvert, etc.)

**Что это:** Отправить PCM на внешний сервис, получить MP3.

**Почему отклонили:**
- Дополнительная зависимость и latency
- Платный API
- PCM → MP3 — тривиальная операция, не требующая cloud service

### Альтернатива 3: Отказ от lamejs, хранение PCM

**Что это:** Хранить аудио как PCM/WAV, конвертировать на клиенте.

**Почему отклонили:**
- PCM в 10× больше MP3 (Blob Storage)
- Telegram не принимает PCM/WAV как audio
- Client-side конвертация невозможна для cron delivery

---

## Ключевые файлы

```
lib/podcast/audio-converter.ts  — PCM → MP3, lazy loading, pnpm path resolution
lib/podcast/audio-merger.ts     — склейка MP3 треков + upload в Blob
next.config.ts                  — serverExternalPackages + outputFileTracingIncludes
app/api/cron/briefing/route.ts  — cron handler (podcast + merge + delivery)
```

---

## Ссылки

- [Next.js outputFileTracingIncludes](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats) — документация Next.js
- [Vercel NFT](https://github.com/vercel/nft) — Node File Tracing
- ADR 017: [Podcast Engine Architecture](017-podcast-engine-architecture.md) — родительское решение
- ADR 026: [Background Briefing Architecture](026-background-briefing-architecture.md) — cron инфраструктура

---

## История изменений

- **2026-02-28** — ADR создан. Podcast from cron fix (v3.55.1)
