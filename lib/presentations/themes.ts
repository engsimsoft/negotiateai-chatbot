/**
 * Reveal.js Theme System
 * 5 professional themes for presentations
 */

export interface RevealTheme {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  revealTheme: string; // Built-in Reveal.js theme name
}

export const revealThemes: Record<string, RevealTheme> = {
  corporate: {
    id: "corporate",
    name: "Corporate",
    nameRu: "Корпоративный",
    description: "Professional blue theme for business presentations",
    colors: {
      primary: "#2563eb",
      secondary: "#1e40af",
      background: "#ffffff",
      text: "#1f2937",
      accent: "#3b82f6",
    },
    fonts: {
      heading: "Source Sans Pro, Helvetica, sans-serif",
      body: "Source Sans Pro, Helvetica, sans-serif",
    },
    revealTheme: "white",
  },
  modern: {
    id: "modern",
    name: "Modern",
    nameRu: "Современный",
    description: "Vibrant gradient theme with modern aesthetics",
    colors: {
      primary: "#8b5cf6",
      secondary: "#ec4899",
      background: "#fafafa",
      text: "#18181b",
      accent: "#a855f7",
    },
    fonts: {
      heading: "Source Sans Pro, Helvetica, sans-serif",
      body: "Source Sans Pro, Helvetica, sans-serif",
    },
    revealTheme: "white",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    nameRu: "Минималистичный",
    description: "Clean and simple white theme",
    colors: {
      primary: "#18181b",
      secondary: "#71717a",
      background: "#ffffff",
      text: "#27272a",
      accent: "#3f3f46",
    },
    fonts: {
      heading: "Source Sans Pro, Helvetica, sans-serif",
      body: "Source Sans Pro, Helvetica, sans-serif",
    },
    revealTheme: "white",
  },
  dark: {
    id: "dark",
    name: "Dark",
    nameRu: "Тёмный",
    description: "Elegant dark theme for impactful presentations",
    colors: {
      primary: "#f1f5f9",
      secondary: "#94a3b8",
      background: "#0f172a",
      text: "#e2e8f0",
      accent: "#38bdf8",
    },
    fonts: {
      heading: "Source Sans Pro, Helvetica, sans-serif",
      body: "Source Sans Pro, Helvetica, sans-serif",
    },
    revealTheme: "black",
  },
  creative: {
    id: "creative",
    name: "Creative",
    nameRu: "Креативный",
    description: "Bold and colorful theme for creative presentations",
    colors: {
      primary: "#f97316",
      secondary: "#eab308",
      background: "#fef3c7",
      text: "#78350f",
      accent: "#fb923c",
    },
    fonts: {
      heading: "Source Sans Pro, Helvetica, sans-serif",
      body: "Source Sans Pro, Helvetica, sans-serif",
    },
    revealTheme: "white",
  },
};

export const defaultTheme = revealThemes.corporate;

export function getThemeById(id: string): RevealTheme {
  return revealThemes[id] || defaultTheme;
}

export function getThemeCSS(theme: RevealTheme): string {
  return `
    :root {
      --r-background-color: ${theme.colors.background};
      --r-main-font: ${theme.fonts.body};
      --r-main-font-size: 38px;
      --r-main-color: ${theme.colors.text};
      --r-heading-font: ${theme.fonts.heading};
      --r-heading-color: ${theme.colors.primary};
      --r-heading-line-height: 1.2;
      --r-heading-letter-spacing: normal;
      --r-heading-text-transform: none;
      --r-heading-font-weight: 600;
      --r-link-color: ${theme.colors.accent};
      --r-link-color-hover: ${theme.colors.secondary};
      --r-selection-background-color: ${theme.colors.accent}40;
    }

    .reveal {
      background: ${theme.colors.background};
    }

    .reveal h1, .reveal h2, .reveal h3 {
      color: ${theme.colors.primary};
    }

    .reveal p, .reveal li {
      color: ${theme.colors.text};
    }

    .reveal .slide-title {
      font-size: 2.5em;
      margin-bottom: 0.5em;
    }

    .reveal .slide-subtitle {
      font-size: 1.2em;
      color: ${theme.colors.secondary};
      margin-top: 0;
    }

    .reveal ul {
      list-style: none;
      padding-left: 0;
    }

    .reveal li {
      margin: 0.5em 0;
      padding-left: 1.5em;
      position: relative;
    }

    .reveal li::before {
      content: "\\2022";
      color: ${theme.colors.accent};
      font-weight: bold;
      position: absolute;
      left: 0;
    }
  `;
}

export type SlideType = "title" | "content" | "bullets" | "image" | "quote" | "end";

export interface Slide {
  type: SlideType;
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  quote?: string;
  author?: string;
  imageUrl?: string;
}

export function generateRevealHTML(slides: Slide[], theme: RevealTheme): string {
  const slidesHTML = slides
    .map((slide) => {
      switch (slide.type) {
        case "title":
          return `
            <section>
              <h1 class="slide-title">${escapeHtml(slide.title || "")}</h1>
              ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ""}
            </section>
          `;
        case "content":
          return `
            <section>
              <h2>${escapeHtml(slide.title || "")}</h2>
              <p>${escapeHtml(slide.content || "")}</p>
            </section>
          `;
        case "bullets":
          return `
            <section>
              <h2>${escapeHtml(slide.title || "")}</h2>
              <ul>
                ${(slide.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join("\n")}
              </ul>
            </section>
          `;
        case "quote":
          return `
            <section>
              <blockquote>
                <p>"${escapeHtml(slide.quote || "")}"</p>
                ${slide.author ? `<cite>— ${escapeHtml(slide.author)}</cite>` : ""}
              </blockquote>
            </section>
          `;
        case "end":
          return `
            <section>
              <h1>${escapeHtml(slide.title || "Спасибо!")}</h1>
              ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ""}
            </section>
          `;
        default:
          return `
            <section>
              <h2>${escapeHtml(slide.title || "")}</h2>
              <p>${escapeHtml(slide.content || "")}</p>
            </section>
          `;
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/${theme.revealTheme}.css">
  <style>
    ${getThemeCSS(theme)}
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      ${slidesHTML}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      transition: 'slide',
      controls: true,
      progress: true,
      center: true,
      keyboard: true
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
