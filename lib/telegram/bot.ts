import { Bot } from "grammy";
import type { Message } from "grammy/types";
import {
  getTelegramLinkToken,
  deleteTelegramLinkToken,
  getTelegramConnectionByTelegramId,
  createTelegramConnection,
  deleteTelegramConnection,
  setTelegramConnectionActive,
  upsertTelegramGroup,
  getTelegramGroupByChatId,
  deactivateTelegramGroup,
  upsertTelegramGroupTopic,
  getTelegramTopicByTelegramId,
  createTelegramMessage,
} from "@/lib/db/queries";
import { downloadAndUploadTelegramFile } from "./file-downloader";

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

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://negotiateai-chatbot.vercel.app").trim();

function simplyButton(text: string, path: string) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text, url: `${APP_URL}${path}` }]],
    },
  };
}

const MEDIA_LABELS: Record<string, string> = {
  photo: "Фото",
  video: "Видео",
  document: "Документ",
  voice: "Голосовое сообщение",
  sticker: "Стикер",
};

function mediaPlaceholder(mediaType: string | null): string {
  const label = mediaType ? MEDIA_LABELS[mediaType] || "Медиа" : "Медиа";
  return `[${label}]`;
}

/** Extract the best file_id from a message (largest photo, or document/video/voice). */
function extractFileId(msg: Message): string | null {
  if (msg.photo) return msg.photo[msg.photo.length - 1].file_id;
  if (msg.document) return msg.document.file_id;
  if (msg.video) return msg.video.file_id;
  if (msg.voice) return msg.voice.file_id;
  return null;
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
// ТЗ-TG5: my_chat_member — bot added/removed from group
// ============================================================================

bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.myChatMember.chat;
  const newStatus = ctx.myChatMember.new_chat_member.status;

  // Only handle group/supergroup events
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const telegramChatId = chat.id;
  const title = chat.title || "Unnamed group";
  const isForum = "is_forum" in chat && chat.is_forum === true;

  if (newStatus === "member" || newStatus === "administrator") {
    // --- Bot added to group ---

    // Find owner: who added the bot → check TelegramConnection
    const addedByTelegramId = ctx.from?.id;
    let ownerUserId: string | null = null;

    if (addedByTelegramId) {
      const connection = await getTelegramConnectionByTelegramId({
        telegramUserId: addedByTelegramId,
      });
      if (connection) {
        ownerUserId = connection.userId;
      }
    }

    const group = await upsertTelegramGroup({
      telegramChatId,
      title,
      type: chat.type,
      isForum,
      ownerUserId,
      memberCount: null,
    });

    // Auto-create "Общее" topic for forum groups (thread_id = 1)
    if (isForum) {
      await upsertTelegramGroupTopic({
        groupId: group.id,
        telegramTopicId: 1,
        name: "Общее",
      });
    }

    // Notify owner in DM (if connected via TelegramConnection)
    if (addedByTelegramId && ownerUserId) {
      try {
        await bot.api.sendMessage(
          addedByTelegramId,
          `Группа «${title}» подключена к Simply.\n\nНовые сообщения будут сохраняться автоматически.`,
          simplyButton("Открыть Simply →", "/groups"),
        );
      } catch {
        // DM might fail if user hasn't started the bot — ignore silently
      }
    }
  } else if (newStatus === "left" || newStatus === "kicked") {
    // --- Bot removed from group ---
    await deactivateTelegramGroup({ telegramChatId });
  }
});

// ============================================================================
// ТЗ-TG5: Group messages — save to DB silently
// ============================================================================

bot.on("message", async (ctx) => {
  const chatType = ctx.chat.type;

  // --- Private chat: catch-all reply (existing behavior) ---
  if (chatType === "private") {
    await ctx.reply(
      "Я доставляю брифинги, но не веду переписку.\n\nЕсли нужно что-то обсудить или спросить — это в Simply.",
      simplyButton("Открыть Simply →", "/dashboard"),
    );
    return;
  }

  // --- Group/supergroup: save message silently ---
  if (chatType !== "group" && chatType !== "supergroup") return;

  const msg = ctx.message;
  if (!msg) return;

  // Handle forum_topic_created / forum_topic_edited service messages
  if (msg.forum_topic_created || msg.forum_topic_edited) {
    const group = await getTelegramGroupByChatId({
      telegramChatId: ctx.chat.id,
    });
    if (!group) return;

    const threadId = msg.message_thread_id;
    if (!threadId) return;

    const topicName =
      msg.forum_topic_created?.name ||
      msg.forum_topic_edited?.name;
    if (topicName) {
      await upsertTelegramGroupTopic({
        groupId: group.id,
        telegramTopicId: threadId,
        name: topicName,
      });
    }
    return; // Don't save service messages as regular messages
  }

  // Determine media type
  let hasMedia = false;
  let mediaType: string | null = null;
  if (msg.photo) {
    hasMedia = true;
    mediaType = "photo";
  } else if (msg.video) {
    hasMedia = true;
    mediaType = "video";
  } else if (msg.document) {
    hasMedia = true;
    mediaType = "document";
  } else if (msg.voice) {
    hasMedia = true;
    mediaType = "voice";
  } else if (msg.sticker) {
    hasMedia = true;
    mediaType = "sticker";
  }

  // Extract text: text > caption > media placeholder > skip
  const text = msg.text || msg.caption || (hasMedia ? mediaPlaceholder(mediaType) : null);
  if (!text) return; // Skip service messages without any content

  // Look up the group in DB
  const group = await getTelegramGroupByChatId({
    telegramChatId: ctx.chat.id,
  });
  if (!group) return; // Group not registered (shouldn't happen, but defensive)

  // Resolve topic if message is in a forum thread
  let topicId: string | null = null;
  if (msg.message_thread_id) {
    // Try to find existing topic, or create placeholder
    let topic = await getTelegramTopicByTelegramId({
      groupId: group.id,
      telegramTopicId: msg.message_thread_id,
    });
    if (!topic) {
      topic = await upsertTelegramGroupTopic({
        groupId: group.id,
        telegramTopicId: msg.message_thread_id,
        name: `Топик #${msg.message_thread_id}`,
      });
    }
    topicId = topic.id;
  }

  // Download file if media present (skip stickers — no practical value)
  let blobUrl: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (hasMedia && mediaType !== "sticker") {
    const fileId = extractFileId(msg);
    if (fileId) {
      try {
        const result = await downloadAndUploadTelegramFile(fileId, group.id, {
          fileName: msg.document?.file_name,
          mimeType: msg.document?.mime_type,
        });
        if (result) {
          blobUrl = result.blobUrl;
          fileName = result.fileName;
          fileSize = result.fileSize;
        }
      } catch (err) {
        console.error("[bot] File download failed:", err);
        // Continue without file — message is still saved
      }
    }
  }

  // Save message
  await createTelegramMessage({
    groupId: group.id,
    topicId,
    telegramMessageId: msg.message_id,
    fromUserId: msg.from?.id ?? 0,
    fromUsername: msg.from?.username ?? null,
    fromFirstName: msg.from?.first_name ?? null,
    text,
    hasMedia,
    mediaType,
    sentAt: new Date(msg.date * 1000),
    blobUrl,
    fileName,
    fileSize,
  });
});

export { bot };
