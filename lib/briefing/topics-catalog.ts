// ТЗ-BR1: Topics catalog with recommended sources

export interface RecommendedSource {
  name: string;
  url: string;
  rss?: string;
  language: string;
  tier: "original" | "analytics" | "derivative";
  fetchMethod: "rss" | "jina" | "telegram_parse";
}

export interface TopicEntry {
  name: string;
  emoji: string;
  keywords: string[];
  sources: RecommendedSource[];
}

export interface TopicsCatalog {
  [topicId: string]: TopicEntry;
}

export const TOPICS_CATALOG: TopicsCatalog = {
  ai: {
    name: "Искусственный интеллект",
    emoji: "\u{1F916}",
    keywords: ["AI", "ML", "LLM", "нейросеть", "GPT", "Claude", "Gemini"],
    sources: [
      {
        name: "OpenAI Blog",
        url: "https://openai.com/blog",
        rss: "https://openai.com/blog/rss.xml",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "The Verge — AI",
        url: "https://www.theverge.com/ai-artificial-intelligence",
        rss: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        language: "en",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Habr — AI",
        url: "https://habr.com/ru/hub/artificial_intelligence/",
        rss: "https://habr.com/ru/rss/hub/artificial_intelligence/all/?fl=ru",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "AI News (Telegram)",
        url: "https://t.me/s/ai_newz",
        language: "ru",
        tier: "derivative",
        fetchMethod: "telegram_parse",
      },
    ],
  },

  tech: {
    name: "Технологии",
    emoji: "\u{1F4BB}",
    keywords: ["технологии", "IT", "software", "hardware", "гаджеты"],
    sources: [
      {
        name: "TechCrunch",
        url: "https://techcrunch.com",
        rss: "https://techcrunch.com/feed/",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Habr — Все подряд",
        url: "https://habr.com/ru/all/",
        rss: "https://habr.com/ru/rss/all/all/?fl=ru",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "3DNews",
        url: "https://3dnews.ru",
        rss: "https://3dnews.ru/breaking/rss/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "vc.ru — Технологии",
        url: "https://vc.ru/tech",
        rss: "https://vc.ru/rss/tech",
        language: "ru",
        tier: "derivative",
        fetchMethod: "rss",
      },
    ],
  },

  startups: {
    name: "Стартапы",
    emoji: "\u{1F680}",
    keywords: ["стартап", "венчур", "инвестиции", "Y Combinator", "раунд"],
    sources: [
      {
        name: "vc.ru — Стартапы",
        url: "https://vc.ru/startups",
        rss: "https://vc.ru/rss/startups",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "TechCrunch — Startups",
        url: "https://techcrunch.com/category/startups/",
        rss: "https://techcrunch.com/category/startups/feed/",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Rusbase",
        url: "https://rb.ru",
        rss: "https://rb.ru/feeds/all/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
    ],
  },

  finance: {
    name: "Финансы",
    emoji: "\u{1F4B0}",
    keywords: ["финансы", "банки", "ЦБ", "курс", "акции", "рынок"],
    sources: [
      {
        name: "РБК",
        url: "https://www.rbc.ru",
        rss: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss",
        language: "ru",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Коммерсантъ",
        url: "https://www.kommersant.ru",
        rss: "https://www.kommersant.ru/RSS/news.xml",
        language: "ru",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Bloomberg (Telegram)",
        url: "https://t.me/s/bloomberg_rus",
        language: "ru",
        tier: "derivative",
        fetchMethod: "telegram_parse",
      },
    ],
  },

  marketing: {
    name: "Маркетинг",
    emoji: "\u{1F4E3}",
    keywords: ["маркетинг", "реклама", "SEO", "SMM", "контент", "бренд"],
    sources: [
      {
        name: "vc.ru — Маркетинг",
        url: "https://vc.ru/marketing",
        rss: "https://vc.ru/rss/marketing",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Cossa",
        url: "https://www.cossa.ru",
        rss: "https://www.cossa.ru/rss/all/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Marketing Examples",
        url: "https://marketingexamples.com",
        rss: "https://marketingexamples.com/feed.xml",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
    ],
  },

  ecommerce: {
    name: "E-commerce",
    emoji: "\u{1F6D2}",
    keywords: ["ecommerce", "маркетплейс", "Wildberries", "Ozon", "торговля"],
    sources: [
      {
        name: "vc.ru — Торговля",
        url: "https://vc.ru/trade",
        rss: "https://vc.ru/rss/trade",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "E-pepper",
        url: "https://e-pepper.ru",
        rss: "https://e-pepper.ru/feed/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Retail.ru",
        url: "https://www.retail.ru",
        rss: "https://www.retail.ru/rss/news/",
        language: "ru",
        tier: "original",
        fetchMethod: "rss",
      },
    ],
  },

  management: {
    name: "Управление",
    emoji: "\u{1F4CB}",
    keywords: ["менеджмент", "управление", "HR", "лидерство", "продуктивность"],
    sources: [
      {
        name: "vc.ru — Управление",
        url: "https://vc.ru/management",
        rss: "https://vc.ru/rss/management",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Harvard Business Review",
        url: "https://hbr.org",
        rss: "https://hbr.org/resources/images/HBR_Syndication_Feed.rss",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Habr — Управление",
        url: "https://habr.com/ru/hub/pm/",
        rss: "https://habr.com/ru/rss/hub/pm/all/?fl=ru",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
    ],
  },

  crypto: {
    name: "Криптовалюты",
    emoji: "\u{1FA99}",
    keywords: ["крипто", "биткоин", "ethereum", "DeFi", "web3", "блокчейн"],
    sources: [
      {
        name: "CoinDesk",
        url: "https://www.coindesk.com",
        rss: "https://www.coindesk.com/arc/outboundfeeds/rss/",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Forklog",
        url: "https://forklog.com",
        rss: "https://forklog.com/feed/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Bits.media",
        url: "https://bits.media",
        rss: "https://bits.media/rss2/",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
    ],
  },

  f1: {
    name: "Формула-1",
    emoji: "\u{1F3CE}\u{FE0F}",
    keywords: ["F1", "Формула-1", "Гран-при", "пилот", "FIA"],
    sources: [
      {
        name: "Motorsport.com — F1",
        url: "https://www.motorsport.com/f1/",
        rss: "https://www.motorsport.com/rss/f1/news/",
        language: "en",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "F1News.ru",
        url: "https://www.f1news.ru",
        rss: "https://www.f1news.ru/export/news.xml",
        language: "ru",
        tier: "analytics",
        fetchMethod: "rss",
      },
      {
        name: "Чемпионат — F1",
        url: "https://www.championat.com/auto/formula-1/",
        rss: "https://www.championat.com/auto/formula-1/rss.xml",
        language: "ru",
        tier: "derivative",
        fetchMethod: "rss",
      },
    ],
  },

  misc: {
    name: "Разное",
    emoji: "\u{1F30D}",
    keywords: ["наука", "космос", "образование", "культура"],
    sources: [
      {
        name: "N+1",
        url: "https://nplus1.ru",
        rss: "https://nplus1.ru/rss",
        language: "ru",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Медуза",
        url: "https://meduza.io",
        rss: "https://meduza.io/rss2/all",
        language: "ru",
        tier: "original",
        fetchMethod: "rss",
      },
      {
        name: "Ars Technica",
        url: "https://arstechnica.com",
        rss: "https://feeds.arstechnica.com/arstechnica/index",
        language: "en",
        tier: "analytics",
        fetchMethod: "rss",
      },
    ],
  },
};

/** Get all topic IDs */
export function getTopicIds(): string[] {
  return Object.keys(TOPICS_CATALOG);
}

/** Get topic by ID */
export function getTopic(topicId: string): TopicEntry | undefined {
  return TOPICS_CATALOG[topicId];
}

/** Get default sources for seed (2 per topic) */
export function getDefaultSources(): Array<{
  topicId: string;
  source: RecommendedSource;
}> {
  const result: Array<{ topicId: string; source: RecommendedSource }> = [];

  for (const [topicId, topic] of Object.entries(TOPICS_CATALOG)) {
    const picked = topic.sources.slice(0, 2);
    for (const source of picked) {
      result.push({ topicId, source });
    }
  }

  return result;
}
