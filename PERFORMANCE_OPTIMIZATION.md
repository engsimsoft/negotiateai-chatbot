# 🗺️ Дорожная карта оптимизации производительности NegotiateAI Chatbot

**Версия:** 1.0.0
**Цель:** Устранить зависания, оптимизировать производительность до уровня "работает как iPhone"
**Статус:** 🔴 Не начато
**Дата создания:** 2025-12-01

---

## 📊 Общий прогресс

**Всего задач:** 47
**Выполнено:** 0 (0%)
**В работе:** 0
**Осталось:** 47

**Обновляется автоматически при выполнении задач**

---

## 📋 Содержание

1. [Фаза 1: Quick Wins (День 1)](#фаза-1-quick-wins-день-1) - 🔴 КРИТИЧНО
2. [Фаза 2: Streaming Optimization (День 2)](#фаза-2-streaming-optimization-день-2)
3. [Фаза 3: UX Enhancements (День 3-4)](#фаза-3-ux-enhancements-день-3-4)
4. [Фаза 4: Monitoring & Observability (День 5)](#фаза-4-monitoring--observability-день-5)
5. [Фаза 5: Advanced Features (День 6-7)](#фаза-5-advanced-features-день-6-7-опционально)
6. [Ожидаемые результаты](#ожидаемые-результаты)
7. [Правила выполнения](#правила-выполнения)

---

## ⚡ Фаза 1: Quick Wins (День 1)

**Цель:** Немедленно устранить критические проблемы производительности
**Ожидаемый эффект:** Ускорение ответов в 2-5 раз, устранение зависаний
**Приоритет:** 🔴 КРИТИЧНО

### 1.1 Исправление temperature параметра

- [ ] **Задача 1.1.1:** Изменить `temperature: 0.3` на `1.0` в `app/(chat)/api/chat/route.ts:215`
  - **Файл:** `app/(chat)/api/chat/route.ts`
  - **Строка:** 215
  - **Изменение:** `temperature: 0.3` → `temperature: 1.0`
  - **Причина:** Google рекомендует 1.0 для Gemini (значения < 1.0 вызывают зацикливание)

**Верификация:**
```bash
# 1. Проверить изменение в коде
grep -n "temperature:" app/\(chat\)/api/chat/route.ts

# 2. Запустить dev server
npm run dev

# 3. Открыть http://localhost:3000
# 4. Отправить тестовый запрос: "Привет, как дела?"
# 5. ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Ответ приходит плавно без задержек
# 6. Проверить в Network tab: нет долгого pending
```

**Git Commit:**
```bash
git add app/\(chat\)/api/chat/route.ts
git commit -m "fix: change temperature from 0.3 to 1.0 for Gemini compatibility

- Update temperature parameter to recommended 1.0
- Prevent potential looping and performance degradation
- According to Google Gemini official documentation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 1.2 Настройка thinkingConfig для chat

- [ ] **Задача 1.2.1:** Добавить `providerOptions` с `thinkingConfig` в `streamText`
  - **Файл:** `app/(chat)/api/chat/route.ts`
  - **Позиция:** После параметра `temperature` (строка ~216)
  - **Добавить:**
    ```typescript
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 1024, // Минимальный бюджет для сложных задач
        },
      },
    },
    ```
  - **Причина:** Контролировать фазу "мышления" модели, уменьшить задержку с 5-30 сек до предсказуемой

**Верификация:**
```bash
# 1. Проверить код
grep -A 5 "providerOptions" app/\(chat\)/api/chat/route.ts

# 2. Запустить dev server
npm run dev

# 3. Тест с простым запросом (без документов)
# - Отправить: "Что такое переговоры?"
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Ответ начинается в течение 3-5 секунд

# 4. Тест со сложным запросом (с документами)
# - Отправить: "Прочитай документ index.md и расскажи о нём"
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Ответ начинается в течение 10-15 секунд

# 5. Проверить в консоли браузера (Network → Response)
# - Первый chunk должен прийти быстрее чем раньше
```

**Git Commit:**
```bash
git add app/\(chat\)/api/chat/route.ts
git commit -m "feat: add thinkingConfig to optimize Gemini response time

- Configure thinkingBudget: 1024 for optimal performance
- Reduce thinking phase from 5-30s to predictable duration
- Improve Time To First Token (TTFT)

Expected improvement: 2-5x faster initial response

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 1.3 Оптимизация OCR: переход на gemini-2.5-flash

- [ ] **Задача 1.3.1:** Изменить модель в `extractTextFromImage` на Flash
  - **Файл:** `lib/ai/vision-ocr.ts`
  - **Строка:** ~55
  - **Изменение:**
    ```typescript
    // ДО:
    model: google("gemini-2.5-pro"),

    // ПОСЛЕ:
    model: google("gemini-2.5-flash"),
    ```
  - **Причина:** Flash достаточен для OCR и в 2-3 раза быстрее

- [ ] **Задача 1.3.2:** Добавить `thinkingConfig` для OCR изображений
  - **Файл:** `lib/ai/vision-ocr.ts`
  - **Позиция:** В вызове `generateText` для изображений (после `messages`)
  - **Добавить:**
    ```typescript
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 0, // Мышление не нужно для OCR
        },
      },
    },
    ```

- [ ] **Задача 1.3.3:** Изменить модель в `extractTextFromPDF` на Flash
  - **Файл:** `lib/ai/vision-ocr.ts`
  - **Строка:** ~97
  - **Изменение:** `google("gemini-2.5-pro")` → `google("gemini-2.5-flash")`

- [ ] **Задача 1.3.4:** Добавить `thinkingConfig` для OCR PDF
  - **Файл:** `lib/ai/vision-ocr.ts`
  - **Позиция:** В вызове `generateText` для PDF
  - **Добавить:** `thinkingBudget: 0` в `providerOptions`

**Верификация:**
```bash
# 1. Проверить изменения
grep -n "gemini-2.5" lib/ai/vision-ocr.ts
grep -A 3 "thinkingConfig" lib/ai/vision-ocr.ts

# 2. Подготовить тестовые файлы (если нет)
# - Создать test.png (скриншот текста)
# - Создать test.pdf (1-2 страницы с текстом)

# 3. Запустить dev server
npm run dev

# 4. Тест OCR изображения
# - Загрузить test.png через UI
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Текст распознан в течение 5-10 секунд
# - Раньше было: 15-30 секунд

# 5. Тест OCR PDF
# - Загрузить test.pdf через UI
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Текст распознан в течение 15-30 секунд
# - Раньше было: 30-90 секунд

# 6. Проверить в логах сервера
# - Должны быть сообщения о времени обработки
# - Время должно быть меньше чем раньше
```

**Git Commit:**
```bash
git add lib/ai/vision-ocr.ts
git commit -m "perf: migrate OCR from gemini-2.5-pro to gemini-2.5-flash

- Use gemini-2.5-flash for both image and PDF OCR
- Add thinkingConfig with thinkingBudget: 0
- Flash is sufficient for OCR tasks and much faster
- Reduce OCR processing time by 50-70%

Benefits:
- Faster document reading (5-10s vs 15-30s for images)
- Lower API costs
- Better user experience

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 1.4 Checkpoint: Тестирование Quick Wins

- [ ] **Задача 1.4.1:** Запустить полный набор тестов

**Полное тестирование:**
```bash
# 1. Build проверка
npm run build
# ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Build успешен без ошибок

# 2. Запустить production build локально
npm run start

# 3. Функциональные тесты:

# ТЕСТ 1: Простой чат (без инструментов)
# - Запрос: "Привет! Как работают переговоры?"
# - ✅ Ответ начинается в течение 3-5 секунд
# - ✅ Текст приходит плавно (streaming)
# - ✅ Нет зависаний UI

# ТЕСТ 2: Чтение документа
# - Запрос: "Прочитай файл knowledge/index.md"
# - ✅ Инструмент readDocument запускается
# - ✅ Прогресс-индикатор показывает "Running"
# - ✅ Документ прочитан в течение 10-20 секунд
# - ✅ Ответ содержит информацию из документа

# ТЕСТ 3: OCR изображения
# - Загрузить изображение с текстом
# - ✅ OCR завершается в течение 5-10 секунд
# - ✅ Текст распознан корректно

# ТЕСТ 4: OCR PDF
# - Загрузить PDF документ
# - ✅ OCR завершается в течение 15-30 секунд
# - ✅ Текст извлечен корректно

# ТЕСТ 5: Web Search
# - Запрос: "Найди последние новости о переговорах"
# - ✅ Поиск выполняется в течение 5-10 секунд
# - ✅ Результаты релевантны

# 4. Performance метрики (в браузере)
# - Открыть DevTools → Network
# - Отправить запрос
# - ✅ Time To First Byte (TTFB) < 2s
# - ✅ Первый chunk в течение 5s
# - ✅ Нет long pending requests

# 5. Проверка логов
# - ✅ Нет ошибок
# - ✅ Token usage логируется
# - ✅ Нет warnings о performance
```

- [ ] **Задача 1.4.2:** Документировать результаты тестирования
  - **Создать файл:** `docs/testing/quick-wins-results.md`
  - **Записать:** метрики "до" и "после"
  - **Приложить:** скриншоты Network tab (опционально)

**Git Commit:**
```bash
git add docs/testing/quick-wins-results.md
git commit -m "docs: add Quick Wins testing results

- Document performance improvements
- Include before/after metrics
- Verify all critical functionality works

Phase 1 Complete: Quick Wins ✅
- temperature fixed (0.3 → 1.0)
- thinkingConfig added
- OCR migrated to Flash
- All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🚀 Фаза 2: Streaming Optimization (День 2)

**Цель:** Оптимизировать streaming для улучшения perceived latency
**Ожидаемый эффект:** Более плавный вывод текста, лучший UX

### 2.1 Включение smoothStream

- [ ] **Задача 2.1.1:** Раскомментировать `smoothStream` в chat route
  - **Файл:** `app/(chat)/api/chat/route.ts`
  - **Строка:** 235
  - **Изменение:**
    ```typescript
    // ДО:
    // experimental_transform: smoothStream({ chunking: "word" }),

    // ПОСЛЕ:
    experimental_transform: smoothStream({ chunking: "word" }),
    ```
  - **Причина:** Улучшает perceived latency - текст появляется плавнее

**Верификация:**
```bash
# 1. Проверить код
grep -n "smoothStream" app/\(chat\)/api/chat/route.ts

# 2. Запустить dev server
npm run dev

# 3. Визуальный тест
# - Отправить длинный запрос: "Расскажи подробно о переговорах"
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Текст появляется плавно, слово за словом
# - НЕ должно быть: резких скачков больших блоков текста

# 4. Сравнительный тест (опционально)
# - Закомментировать smoothStream обратно
# - Отправить тот же запрос - текст приходит блоками
# - Раскомментировать smoothStream
# - Отправить запрос снова - текст плавный
```

**Git Commit:**
```bash
git add app/\(chat\)/api/chat/route.ts
git commit -m "feat: enable smoothStream for better streaming UX

- Uncomment experimental_transform: smoothStream
- Configure chunking by word for smoother output
- Improve perceived latency and user experience

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 2.2 Добавление TTFT (Time To First Token) мониторинга

- [ ] **Задача 2.2.1:** Добавить временные метки в `streamText`
  - **Файл:** `app/(chat)/api/chat/route.ts`
  - **Позиция:** Перед вызовом `streamText`
  - **Добавить:**
    ```typescript
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    ```

- [ ] **Задача 2.2.2:** Логировать TTFT при первом токене
  - **Добавить в onFinish callback:**
    ```typescript
    onFinish: async ({ usage }) => {
      const totalTime = Date.now() - startTime;
      console.log(`[Performance] Chat ${id}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms`);
      // ... existing code
    },
    ```

**Верификация:**
```bash
# 1. Запустить dev server с логами
npm run dev

# 2. Отправить запрос: "Привет"

# 3. Проверить логи консоли
# ОЖИДАЕМЫЙ ВЫВОД:
# [Performance] Chat abc123: TTFT = 2345ms, Total = 15678ms

# 4. Метрики должны быть:
# - TTFT < 5000ms для простых запросов
# - TTFT < 15000ms для запросов с инструментами
# - Total зависит от длины ответа
```

**Git Commit:**
```bash
git add app/\(chat\)/api/chat/route.ts
git commit -m "feat: add TTFT (Time To First Token) monitoring

- Add performance timestamps in streamText
- Log TTFT and total response time
- Enable diagnostics for latency issues

Metrics tracked:
- Time to first token (TTFT)
- Total response duration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 2.3 Оптимизация провайдеров

- [ ] **Задача 2.3.1:** Добавить Flash модель в конфигурацию
  - **Файл:** `lib/ai/providers.ts`
  - **Изменить:**
    ```typescript
    languageModels: {
      "claude-sonnet-4": google("gemini-2.5-pro"),
      "claude-haiku-3.5": google("gemini-2.5-flash"), // Быстрая модель
      "title-model": google("gemini-2.5-flash"),      // Flash для titles
      "artifact-model": google("gemini-2.5-pro"),
    },
    ```

- [ ] **Задача 2.3.2:** Обновить `models.ts` с новой моделью
  - **Файл:** `lib/ai/models.ts`
  - **Добавить:**
    ```typescript
    {
      id: "claude-haiku-3.5",
      name: "Gemini 2.5 Flash (Быстрый)",
      description: "Fast model for quick responses",
      pricing: {
        input: "Ниже",
        output: "Ниже",
      },
    },
    ```

**Верификация:**
```bash
# 1. Проверить конфигурацию
grep -n "gemini-2.5-flash" lib/ai/providers.ts
grep -n "claude-haiku" lib/ai/models.ts

# 2. Запустить dev server
npm run dev

# 3. Проверить UI
# - Открыть настройки модели в чате
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Видны обе модели (Pro и Flash)

# 4. Тест Flash модели
# - Выбрать "Gemini 2.5 Flash (Быстрый)"
# - Отправить запрос: "Привет!"
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Ответ приходит быстрее чем с Pro

# 5. Сравнительный тест
# - Pro: отправить "Расскажи о переговорах"
# - Засечь время TTFT
# - Flash: отправить "Расскажи о переговорах"
# - Засечь время TTFT
# - Flash должен быть быстрее на 30-50%
```

**Git Commit:**
```bash
git add lib/ai/providers.ts lib/ai/models.ts
git commit -m "feat: add gemini-2.5-flash model option

- Configure Flash for haiku and title models
- Add Flash model to UI selection
- Enable users to choose between Pro (quality) and Flash (speed)

Benefits:
- Faster responses for simple queries (2-3x)
- Lower API costs
- Better user choice

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 2.4 Checkpoint: Performance Testing

- [ ] **Задача 2.4.1:** Benchmark тесты и документирование

**Performance Benchmarking:**
```bash
# 1. Manual performance tests
# ТЕСТ: Pro vs Flash сравнение
# Запустить npm run dev

# A. Тест с Pro:
# - Выбрать "Gemini 2.5 Pro"
# - Отправить: "Расскажи о переговорах"
# - Записать: TTFT = ___ms, total time = ___ms

# B. Тест с Flash:
# - Выбрать "Gemini 2.5 Flash"
# - Отправить: "Расскажи о переговорах"
# - Записать: TTFT = ___ms, total time = ___ms

# ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
# - Flash TTFT на 30-50% меньше
# - Flash total time может быть сопоставимо (качество ответа)

# 2. Stress test
# - Открыть 3-5 вкладок браузера
# - Отправить запросы одновременно
# - ✅ Все запросы обрабатываются
# - ✅ Нет timeout errors
# - ✅ UI остается отзывчивым

# 3. Документировать результаты
# - Создать docs/testing/phase-2-performance.md
# - Записать все метрики
# - Добавить выводы и рекомендации
```

**Git Commit:**
```bash
git add docs/testing/phase-2-performance.md
git commit -m "test: add performance benchmarks for Phase 2

- Document Pro vs Flash comparison
- Record latency metrics (TTFT, total time)
- Verify stress test results

Phase 2 Complete: Streaming Optimization ✅
- smoothStream enabled
- TTFT monitoring added
- Flash model available
- All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 💎 Фаза 3: UX Enhancements (День 3-4)

**Цель:** Улучшить пользовательский опыт, добавить retry logic, error handling
**Ожидаемый эффект:** Приложение "прощает ошибки", работает стабильно

### 3.1 Retry Logic на клиенте

- [ ] **Задача 3.1.1:** Добавить retry state в `useChat`
  - **Файл:** `components/chat.tsx`
  - **Добавить перед useChat:**
    ```typescript
    const [retryConfig, setRetryConfig] = useState({
      count: 0,
      maxRetries: 3,
      backoffMs: 1000,
    });
    ```

- [ ] **Задача 3.1.2:** Реализовать exponential backoff в `onError`
  - **Модифицировать onError callback:**
    ```typescript
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // ... existing code

        // Retry logic
        if (retryConfig.count < retryConfig.maxRetries && isRetryable(error)) {
          const delay = retryConfig.backoffMs * Math.pow(2, retryConfig.count);
          setTimeout(() => {
            // Retry the last message
            setRetryConfig(prev => ({ ...prev, count: prev.count + 1 }));
            // Re-send message
          }, delay);
        }
      }
    },
    ```

**Верификация:**
```bash
# 1. Симуляция network error
# - Отключить интернет (Wi-Fi off)
# - Отправить запрос
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Показывается "Retrying... (1/3)"
# - Включить интернет
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Запрос успешно повторен автоматически

# 2. Проверка backoff timing
# - Проверить в console логах
# - Retry 1: ~1s delay
# - Retry 2: ~2s delay
# - Retry 3: ~4s delay

# 3. Максимум retries
# - Отключить интернет
# - Отправить запрос
# - Дождаться 3 retries
# - ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: После 3 попыток показывается финальная ошибка
```

**Git Commit:**
```bash
git add components/chat.tsx
git commit -m "feat: add retry logic with exponential backoff

- Implement automatic retry for failed requests
- Add exponential backoff (1s, 2s, 4s)
- Maximum 3 retries before showing error
- Improve reliability and user experience

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 3.2 Client-side Timeout

- [ ] **Задача 3.2.1:** Добавить timeout для зависших запросов
  - **Файл:** `components/chat.tsx`
  - **Добавить:** 60-секундный timeout для запросов без токенов
  - **Показывать:** "Taking longer than usual..." после 30 секунд

**Верификация:**
```bash
# 1. Тест timeout
# - Отправить запрос
# - Если через 60 секунд нет ответа: ✅ Показывается timeout error
# - ✅ Предлагается retry button

# 2. Тест "stuck" индикатора
# - Отправить запрос
# - Через 30 секунд: ✅ Показывается "Taking longer than usual..."
# - ✅ Кнопка "Stop" доступна
```

**Git Commit:**
```bash
git add components/chat.tsx
git commit -m "feat: add client-side timeout handling

- Implement 60s timeout for stuck requests
- Show 'Taking longer than usual' after 30s
- Allow users to stop long-running requests
- Improve UX for slow network conditions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 3.3 Enhanced Error Messages

- [ ] **Задача 3.3.1:** Создать error categorization
  - **Создать файл:** `lib/errors.ts`
  - **Определить типы:**
    ```typescript
    export enum ErrorType {
      NETWORK = "network",
      AUTH = "auth",
      RATE_LIMIT = "rate_limit",
      TIMEOUT = "timeout",
      API_ERROR = "api_error",
      UNKNOWN = "unknown",
    }

    export const errorMessages: Record<ErrorType, string> = {
      [ErrorType.NETWORK]: "Проблема с подключением. Проверьте интернет.",
      [ErrorType.RATE_LIMIT]: "Превышен лимит запросов. Попробуйте через минуту.",
      [ErrorType.TIMEOUT]: "Запрос занял слишком много времени. Попробуйте еще раз.",
      [ErrorType.API_ERROR]: "Ошибка API. Проверьте настройки.",
      [ErrorType.AUTH]: "Ошибка авторизации. Войдите снова.",
      [ErrorType.UNKNOWN]: "Неизвестная ошибка. Попробуйте позже.",
    };
    ```

**Верификация:**
```bash
# Тест различных типов ошибок:

# ТЕСТ 1: Network error
# - Отключить интернет
# - Отправить запрос
# - ✅ Сообщение: "Проблема с подключением. Проверьте интернет."

# ТЕСТ 2: Timeout
# - Симулировать долгий запрос (через DevTools > Network > Throttling)
# - ✅ Сообщение: "Запрос занял слишком много времени..."

# ТЕСТ 3: API error
# - Использовать неверный API key (в .env.local)
# - Перезапустить server
# - Отправить запрос
# - ✅ Сообщение: "Ошибка API. Проверьте настройки."
```

**Git Commit:**
```bash
git add lib/errors.ts components/chat.tsx
git commit -m "feat: add error categorization and user-friendly messages

- Create error type enum
- Add specific handling for each error type
- Show helpful messages to users
- Suggest recovery actions

Improves error UX and user guidance

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 3.4 Tool Execution Progress

- [ ] **Задача 3.4.1:** Добавить execution time в tool indicators
  - **Файл:** `components/elements/tool.tsx`
  - **Добавить:** elapsed time display для running tools
  - **Показывать:** "Completed in Xs" после завершения

**Верификация:**
```bash
# 1. Тест readDocument progress
# - Отправить: "Прочитай документ index.md"
# - ✅ Показывается "Reading document... (3s)"
# - ✅ Время обновляется каждую секунду
# - ✅ После завершения: "Completed in 5s"

# 2. Тест webSearch progress
# - Отправить: "Найди информацию о переговорах"
# - ✅ Показывается "Searching web... (2s)"
# - ✅ После завершения показываются результаты

# 3. Визуальная проверка
# - ✅ Spinner анимация плавная
# - ✅ Цвета: синий (running), зеленый (done), красный (error)
```

**Git Commit:**
```bash
git add components/elements/tool.tsx
git commit -m "feat: add execution time to tool progress indicators

- Show elapsed time for running tools
- Display completion time after tool finishes
- Improve user awareness of progress
- Add smooth spinner animation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 3.5 Checkpoint: UX Testing

- [ ] **Задача 3.5.1:** Comprehensive UX testing

**UX Test Suite:**
```bash
# 1. Happy Path Tests
# ✅ Простой чат работает плавно
# ✅ Инструменты показывают прогресс с таймерами
# ✅ Ошибки показывают полезные сообщения
# ✅ Retry работает корректно с backoff

# 2. Edge Cases
# ✅ Очень длинный запрос (5000+ символов)
# ✅ Быстрая отмена нескольких запросов подряд
# ✅ Network disconnection во время streaming
# ✅ Параллельные запросы в разных чатах

# 3. Error Recovery
# ✅ Network error → retry → success
# ✅ Timeout → показывается сообщение → retry button
# ✅ API error → показывается причина

# 4. Документировать результаты
# - Создать docs/testing/phase-3-ux.md
# - Записать все сценарии
# - Добавить скриншоты (опционально)
```

**Git Commit:**
```bash
git add docs/testing/phase-3-ux.md
git commit -m "docs: document Phase 3 UX improvements and testing

- Record all UX enhancements
- Include edge case testing results
- Document error recovery scenarios

Phase 3 Complete: UX Enhancements ✅
- Retry logic with exponential backoff
- Client-side timeout (60s)
- Enhanced error messages
- Tool execution progress
- All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 📊 Фаза 4: Monitoring & Observability (День 5)

**Цель:** Добавить полный мониторинг производительности и ошибок
**Ожидаемый эффект:** Возможность диагностировать проблемы в production

### 4.1 Enhanced Performance Monitoring

- [ ] **Задача 4.1.1:** Расширить `use-performance.ts` hook
  - **Файл:** `hooks/use-performance.ts`
  - **Добавить:** метрики для API calls, TTFT tracking

- [ ] **Задача 4.1.2:** Создать Performance Dashboard (dev-only)
  - **Создать файл:** `components/dev/performance-dashboard.tsx`
  - **Показывать:** real-time метрики в dev mode

**Верификация:**
```bash
# 1. Проверка в dev mode
npm run dev

# 2. Проверка в browser console
window.showPerformanceReport()
# - ✅ Выводится детальный отчет
# - ✅ Показывает TTFT, response times, tool execution times
# - ✅ Данные за последние 100 запросов
```

**Git Commit:**
```bash
git add hooks/use-performance.ts components/dev/performance-dashboard.tsx
git commit -m "feat: add enhanced performance monitoring

- Extend usePerformance hook with API metrics
- Track TTFT, response times, tool execution
- Enable real-time performance diagnostics

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 4.2 Production Logging

- [ ] **Задача 4.2.1:** Настроить structured logging
  - **Создать файл:** `lib/logger.ts`
  - **Использовать:** JSON structured format

**Верификация:**
```bash
# 1. Build для production
npm run build
npm run start

# 2. Отправить несколько запросов

# 3. Проверить логи (если доступны)
# ОЖИДАЕМЫЙ ФОРМАТ:
# {
#   "timestamp": "2025-12-01...",
#   "level": "info",
#   "chatId": "abc123",
#   "event": "chat_request",
#   "duration_ms": 5234,
#   "ttft_ms": 2100
# }
```

**Git Commit:**
```bash
git add lib/logger.ts
git commit -m "feat: add structured logging for production

- Implement JSON-structured logging
- Track request/response timing
- Include context in all logs

Enables better production diagnostics

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 4.3 Health Check Endpoint

- [ ] **Задача 4.3.1:** Создать `/api/health` endpoint
  - **Создать файл:** `app/api/health/route.ts`
  - **Проверять:**
    - Доступность Gemini API
    - Доступность Database
    - Доступность Brave Search

**Верификация:**
```bash
# 1. Запустить server
npm run dev

# 2. Тест health endpoint
curl http://localhost:3000/api/health

# ОЖИДАЕМЫЙ ОТВЕТ:
# {
#   "status": "healthy",
#   "timestamp": "2025-12-01...",
#   "services": {
#     "gemini_api": { "status": "ok", "latency_ms": 234 },
#     "database": { "status": "ok", "latency_ms": 12 },
#     "brave_search": { "status": "ok", "latency_ms": 456 }
#   }
# }

# 3. Uptime monitoring (опционально)
# - Настроить периодическую проверку
watch -n 60 'curl -s http://localhost:3000/api/health | jq .status'
```

**Git Commit:**
```bash
git add app/api/health/route.ts
git commit -m "feat: add health check endpoint

- Create /api/health for monitoring
- Check Gemini API availability
- Check Database connectivity
- Check Brave Search availability
- Return latency metrics

Enables uptime monitoring and alerting

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 4.4 Checkpoint: Monitoring Verification

- [ ] **Задача 4.4.1:** Comprehensive monitoring test

**Monitoring Test Suite:**
```bash
# 1. Performance Monitoring
# - Отправить 10 запросов
# - Проверить window.showPerformanceReport()
# - ✅ Все метрики собираются
# - ✅ Данные корректны

# 2. Logging
# - Отправить несколько запросов
# - Проверить логи
# - ✅ Все логируется в structured format
# - ✅ Нет missing fields

# 3. Health Check
# - curl http://localhost:3000/api/health
# - ✅ Всегда отвечает (даже если services degraded)
# - ✅ Latency < 1000ms

# 4. Production Readiness
npm run build
npm run start
# - ✅ Build успешен
# - ✅ Логи работают в production mode
# - ✅ Нет performance регрессий

# 5. Документировать
# - Создать docs/testing/phase-4-monitoring.md
```

**Git Commit:**
```bash
git add docs/testing/phase-4-monitoring.md
git commit -m "docs: document Phase 4 monitoring implementation

- Record all monitoring features
- Include testing procedures
- Document production readiness checks

Phase 4 Complete: Monitoring & Observability ✅
- Enhanced performance monitoring
- Structured logging
- Health check endpoint
- All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🌟 Фаза 5: Advanced Features (День 6-7, опционально)

**Цель:** Продвинутые функции для production-grade приложения
**Ожидаемый эффект:** Enterprise-ready приложение

### 5.1 Model Selection UI

- [ ] **Задача 5.1.1:** Добавить UI для выбора модели
  - **Файл:** `components/chat.tsx`
  - **Добавить:** dropdown для выбора между Pro и Flash
  - **Сохранять:** выбор в localStorage

**Верификация:**
```bash
# 1. UI Test
# - Открыть чат
# - ✅ Видна кнопка/dropdown выбора модели
# - ✅ Показаны: "Pro (умный)" и "Flash (быстрый)"

# 2. Переключение
# - Выбрать Flash → отправить запрос
# - ✅ Используется Flash (проверить в логах)
# - Выбрать Pro → отправить запрос
# - ✅ Используется Pro

# 3. Persistence
# - Выбрать Flash
# - Перезагрузить страницу
# - ✅ Flash остается выбранным
```

**Git Commit:**
```bash
git add components/chat.tsx components/model-selector.tsx
git commit -m "feat: add model selection UI

- Allow users to choose between Pro and Flash
- Save preference in localStorage
- Show model benefits in UI
- Enable smart model switching

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 5.2 Final Production Deployment

- [ ] **Задача 5.2.1:** Pre-deployment checklist

**Production Deployment Checklist:**
```bash
# 1. Code Quality
npm run lint
# ✅ No linting errors

# 2. Build
npm run build
# ✅ Build успешен
# ✅ No warnings

# 3. Performance
npm run start
# - Отправить 10 тестовых запросов
# - ✅ TTFT < 5s для простых запросов
# - ✅ TTFT < 15s для сложных запросов
# - ✅ Нет memory leaks (Chrome DevTools)

# 4. Security
npm audit
# ✅ No critical vulnerabilities

# 5. Environment Variables
# ✅ Все переменные в .env.example документированы
# ✅ Production переменные настроены

# 6. Documentation
# ✅ README.md обновлен
# ✅ CHANGELOG.md обновлен
# ✅ PERFORMANCE_OPTIMIZATION.md завершен

# 7. Git
git status
# ✅ Все изменения закоммичены
```

- [ ] **Задача 5.2.2:** Final commit и deploy

**Git Commit:**
```bash
git add .
git commit -m "chore: production ready - all optimizations complete

All phases completed:
✅ Phase 1: Quick Wins (temperature, thinkingConfig, OCR)
✅ Phase 2: Streaming (smoothStream, TTFT, Flash model)
✅ Phase 3: UX (retry, timeout, errors, progress)
✅ Phase 4: Monitoring (logging, health checks)
✅ Phase 5: Advanced (model selection)

Performance improvements:
- TTFT: 10-30s → 3-5s (5-10x faster)
- OCR: 30-90s → 15-30s (2-3x faster)
- Automatic retry and error recovery
- Full monitoring and observability

Version: 1.1.0

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin main

# Vercel автоматически задеплоит (если настроено)
```

- [ ] **Задача 5.2.3:** Update documentation

**Final Documentation Update:**
```bash
# Обновить CHANGELOG.md с версией 1.1.0
# Обновить README.md с новыми возможностями
# Пометить PERFORMANCE_OPTIMIZATION.md как completed

git add CHANGELOG.md README.md PERFORMANCE_OPTIMIZATION.md
git commit -m "docs: update documentation for v1.1.0 release

- Update CHANGELOG with all improvements
- Update README with performance metrics
- Mark PERFORMANCE_OPTIMIZATION as completed (47/47 tasks)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 📈 Ожидаемые результаты

### Performance Improvements

| Метрика | До | После | Улучшение |
|---------|-----|-------|-----------|
| TTFT (простой запрос) | 10-30s | 3-5s | 🚀 5-10x |
| TTFT (с инструментами) | 20-60s | 10-15s | 🚀 2-4x |
| OCR изображения | 15-30s | 5-10s | 🚀 2-3x |
| OCR PDF | 30-90s | 15-30s | 🚀 2-3x |
| Streaming плавность | Рывками | Плавно | ✨ Значительно |
| Error recovery | Нет | Автоматически | ✅ Новое |

### User Experience

- ✅ Нет зависаний UI
- ✅ Понятные индикаторы прогресса
- ✅ Автоматический retry при ошибках
- ✅ Дружественные сообщения об ошибках
- ✅ Выбор модели (Pro vs Flash)
- ✅ Real-time feedback

### Reliability

- ✅ Automatic error recovery (retry с backoff)
- ✅ Health monitoring (/api/health)
- ✅ Structured logging
- ✅ Performance tracking (TTFT, response time)
- ✅ Production-ready

---

## 📝 Правила выполнения

### Обязательные требования

#### 1. НИКОГДА не помечать задачу выполненной без верификации
- Каждая задача имеет секцию "Верификация"
- ВСЕ пункты верификации должны пройти ✅
- Только после этого ставить `[x]` в чекбокс

#### 2. Git commits обязательны после каждой значительной группы задач
- Используйте предоставленные commit messages
- Проверяйте что все файлы добавлены в commit
- Commit message должен быть информативным

#### 3. Тестирование обязательно
- Запускать `npm run build` после каждой фазы
- Проводить функциональные тесты
- Проверять в браузере реальное поведение
- Использовать DevTools для проверки performance

#### 4. Checkpoint'ы критичны
- В конце каждой фазы есть Checkpoint задача
- НЕ переходить к следующей фазе без прохождения Checkpoint
- Документировать результаты тестирования в `docs/testing/`

#### 5. Откат при проблемах
- Если что-то сломалось: `git revert HEAD`
- Анализировать проблему
- Фиксить и повторять
- Не коммитить сломанный код

---

## 🎯 Порядок выполнения

1. **Начать с Фазы 1** (Quick Wins) - самые критичные проблемы
2. **После каждой задачи:** код → тест → верификация → commit
3. **После каждой фазы:** checkpoint → full testing → документация
4. **Не пропускать верификации!**
5. **Не переходить к следующей фазе** пока текущая не завершена на 100%

---

## 📞 Поддержка

### При проблемах:

1. **Проверить логи:**
   ```bash
   # Dev server logs
   npm run dev

   # Build logs
   npm run build
   ```

2. **Проверить Network tab** в браузере (DevTools)

3. **Проверить git log:**
   ```bash
   git log --oneline -10
   ```

4. **При необходимости откатить:**
   ```bash
   git revert HEAD
   # или
   git reset --hard HEAD~1  # ОСТОРОЖНО: потеря uncommitted changes
   ```

5. **Проверить environment variables:**
   ```bash
   # Убедиться что .env.local настроен правильно
   cat .env.local
   ```

---

## 🎉 После завершения всех фаз

### Что будет достигнуто:

✅ **Производительность:**
- Приложение отвечает в 5-10 раз быстрее
- TTFT: 3-5 секунд для простых запросов
- OCR: 15-30 секунд для PDF (вместо 30-90 сек)
- Плавный streaming без рывков

✅ **Надежность:**
- Автоматический retry при ошибках
- Graceful degradation при проблемах с сетью
- Health monitoring для production

✅ **Пользовательский опыт:**
- Понятные сообщения об ошибках
- Прогресс-индикаторы для всех операций
- Выбор между быстрой и умной моделью
- Работает "как iPhone" - плавно и отзывчиво

✅ **Мониторинг:**
- Полное логирование всех операций
- Performance метрики (TTFT, response time)
- Health check endpoint
- Возможность диагностировать проблемы

---

**Начать выполнение с [Фазы 1, Задачи 1.1.1](#11-исправление-temperature-параметра)** ⬆️

**Удачи! 🚀**
