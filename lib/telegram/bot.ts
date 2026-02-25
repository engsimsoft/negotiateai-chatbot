import { Bot } from "grammy";
import {
  getTelegramLinkToken,
  deleteTelegramLinkToken,
  getTelegramConnectionByTelegramId,
  createTelegramConnection,
  deleteTelegramConnection,
  setTelegramConnectionActive,
} from "@/lib/db/queries";

// ============================================================================
// Bot instance (singleton per module load, reused in warm serverless invocations)
// ============================================================================

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// ============================================================================
// Helpers
// ============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app";

function simplyButton(text: string, path: string) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text, url: `${APP_URL}${path}` }]],
    },
  };
}

// ============================================================================
// /start {token} — deep link linking
// ============================================================================

bot.command("start", async (ctx) => {
  const token = ctx.match; // deep link payload (text after /start)
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return;

  // --- Cold /start (no token) ---
  if (!token) {
    // Check if this user was previously linked and used /stop
    const existing = await getTelegramConnectionByTelegramId({ telegramUserId });

    if (existing && !existing.isActive) {
      // Returning after /stop
      await setTelegramConnectionActive({ userId: existing.userId, isActive: true });
      await ctx.reply(
        "С возвращением. Доставка брифинга включена.\n\nЗавтра утром придёт первый выпуск.",
        simplyButton("Открыть Simply →", "/dashboard"),
      );
      return;
    }

    if (existing && existing.isActive) {
      // Already linked and active
      await ctx.reply(
        "Этот аккаунт Telegram уже связан с Simply.\n\nЕсли хотите привязать другой аккаунт — сначала отключите текущий в настройках Simply.",
        simplyButton("Настройки Simply →", "/settings"),
      );
      return;
    }

    // Unknown user — cold start
    await ctx.reply(
      "Это бот Simply — доставляет утренний брифинг в Telegram.\n\nЧтобы подключить, откройте Simply → Настройки → «Подключить Telegram».",
      simplyButton("Открыть Simply →", "/settings"),
    );
    return;
  }

  // --- Deep link /start {token} ---

  // 1. Find and validate token
  const linkToken = await getTelegramLinkToken({ token });

  if (!linkToken || new Date() > linkToken.expiresAt) {
    // Token not found or expired
    if (linkToken) {
      await deleteTelegramLinkToken({ token }); // cleanup expired
    }
    await ctx.reply(
      "Ссылка больше не действует — они работают 10 минут.\n\nОткройте Simply и нажмите «Подключить Telegram» ещё раз.",
      simplyButton("Открыть Simply →", "/settings"),
    );
    return;
  }

  // 2. Check if this Telegram is already linked to ANOTHER Simply account
  const existingByTg = await getTelegramConnectionByTelegramId({ telegramUserId });

  if (existingByTg && existingByTg.userId !== linkToken.userId) {
    // This Telegram is linked to a different Simply account
    // Unlink from old account first
    await deleteTelegramConnection({ userId: existingByTg.userId });
  }

  // 3. Check if the Simply user already has a DIFFERENT Telegram linked (re-linking)
  const existingByUser = await getTelegramConnectionByTelegramId({ telegramUserId });
  // Also check by userId — another Telegram was linked
  if (!existingByUser) {
    // The user might have a connection with a different telegramUserId
    const { getTelegramConnection } = await import("@/lib/db/queries");
    const userConnection = await getTelegramConnection({ userId: linkToken.userId });
    if (userConnection) {
      // Unlink old Telegram, link new one
      await deleteTelegramConnection({ userId: linkToken.userId });
    }
  }

  // 4. Create the connection (or update if same Telegram re-linking)
  if (existingByTg && existingByTg.userId === linkToken.userId) {
    // Same user, same Telegram — just ensure active
    await setTelegramConnectionActive({ userId: linkToken.userId, isActive: true });
  } else {
    await createTelegramConnection({
      userId: linkToken.userId,
      telegramUserId,
      telegramUsername: ctx.from?.username ?? null,
      telegramFirstName: ctx.from?.first_name ?? null,
    });
  }

  // 5. Delete used token
  await deleteTelegramLinkToken({ token });

  // 6. Reply success
  await ctx.reply(
    "✅ Аккаунт Simply подключён.\n\nТеперь брифинг будет приходить сюда каждое утро. Время и формат — в настройках Simply.",
    simplyButton("Открыть Simply →", "/dashboard"),
  );
});

// ============================================================================
// /stop — pause delivery
// ============================================================================

bot.command("stop", async (ctx) => {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const existing = await getTelegramConnectionByTelegramId({ telegramUserId });

  if (existing) {
    await setTelegramConnectionActive({ userId: existing.userId, isActive: false });
  }

  await ctx.reply(
    "Доставка приостановлена.\n\nАккаунт Simply остаётся активным. Чтобы возобновить — отправьте /start.",
  );
});

// ============================================================================
// /help
// ============================================================================

bot.command("help", async (ctx) => {
  await ctx.reply(
    "Simply Bot — доставка утреннего брифинга.\n\n/stop — приостановить доставку\n/start — возобновить доставку\n\nНастройки брифинга, темы и источники — в Simply.",
    simplyButton("Открыть Simply →", "/dashboard"),
  );
});

// ============================================================================
// Any other message
// ============================================================================

bot.on("message", async (ctx) => {
  await ctx.reply(
    "Я доставляю брифинги, но не веду переписку.\n\nЕсли нужно что-то обсудить или спросить — это в Simply.",
    simplyButton("Открыть Simply →", "/dashboard"),
  );
});

export { bot };
