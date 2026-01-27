/**
 * PPTX Theme System for PptxGenJS
 * 5 professional themes matching Reveal.js themes
 */

import type PptxGenJS from "pptxgenjs";

export interface PptxTheme {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  colors: {
    primary: string;      // Main accent color (hex without #)
    secondary: string;    // Secondary color
    background: string;   // Slide background
    text: string;         // Main text color
    textLight: string;    // Subtitle/secondary text
    accent: string;       // Bullets, highlights
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export const pptxThemes: Record<string, PptxTheme> = {
  corporate: {
    id: "corporate",
    name: "Corporate",
    nameRu: "Корпоративный",
    description: "Professional blue theme for business presentations",
    colors: {
      primary: "2563EB",
      secondary: "1E40AF",
      background: "FFFFFF",
      text: "1F2937",
      textLight: "6B7280",
      accent: "3B82F6",
    },
    fonts: {
      heading: "Arial",
      body: "Arial",
    },
  },
  modern: {
    id: "modern",
    name: "Modern",
    nameRu: "Современный",
    description: "Vibrant gradient theme with modern aesthetics",
    colors: {
      primary: "8B5CF6",
      secondary: "EC4899",
      background: "FAFAFA",
      text: "18181B",
      textLight: "71717A",
      accent: "A855F7",
    },
    fonts: {
      heading: "Arial",
      body: "Arial",
    },
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    nameRu: "Минималистичный",
    description: "Clean and simple white theme",
    colors: {
      primary: "18181B",
      secondary: "71717A",
      background: "FFFFFF",
      text: "27272A",
      textLight: "A1A1AA",
      accent: "3F3F46",
    },
    fonts: {
      heading: "Arial",
      body: "Arial",
    },
  },
  dark: {
    id: "dark",
    name: "Dark",
    nameRu: "Тёмный",
    description: "Elegant dark theme for impactful presentations",
    colors: {
      primary: "F1F5F9",
      secondary: "94A3B8",
      background: "0F172A",
      text: "E2E8F0",
      textLight: "94A3B8",
      accent: "38BDF8",
    },
    fonts: {
      heading: "Arial",
      body: "Arial",
    },
  },
  creative: {
    id: "creative",
    name: "Creative",
    nameRu: "Креативный",
    description: "Bold and colorful theme for creative presentations",
    colors: {
      primary: "F97316",
      secondary: "EAB308",
      background: "FEF3C7",
      text: "78350F",
      textLight: "92400E",
      accent: "FB923C",
    },
    fonts: {
      heading: "Arial",
      body: "Arial",
    },
  },
};

export const defaultPptxTheme = pptxThemes.corporate;

export function getPptxThemeById(id: string): PptxTheme {
  return pptxThemes[id] || defaultPptxTheme;
}

/**
 * Slide content types for PPTX generation
 */
export type PptxSlideType = "title" | "content" | "bullets" | "quote" | "end";

export interface PptxSlide {
  type: PptxSlideType;
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  quote?: string;
  author?: string;
}

/**
 * Apply theme to presentation and create master slides
 */
export function applyThemeToPresentation(
  pres: PptxGenJS,
  theme: PptxTheme
): void {
  // Define master slide with theme colors
  pres.defineSlideMaster({
    title: "THEMED_MASTER",
    background: { color: theme.colors.background },
    objects: [
      // Footer accent bar
      {
        rect: {
          x: 0,
          y: 5.0,
          w: "100%",
          h: 0.5,
          fill: { color: theme.colors.primary },
        },
      },
    ],
  });

  // Dark theme needs different master without footer bar (looks better)
  if (theme.id === "dark") {
    pres.defineSlideMaster({
      title: "THEMED_MASTER",
      background: { color: theme.colors.background },
    });
  }
}

/**
 * Add a title slide
 */
export function addTitleSlide(
  pres: PptxGenJS,
  theme: PptxTheme,
  slide: PptxSlide
): void {
  const s = pres.addSlide({ masterName: "THEMED_MASTER" });

  // Main title
  s.addText(slide.title || "Презентация", {
    x: 0.5,
    y: 2.0,
    w: "90%",
    h: 1.5,
    fontSize: 44,
    fontFace: theme.fonts.heading,
    color: theme.colors.primary,
    bold: true,
    align: "center",
  });

  // Subtitle
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5,
      y: 3.5,
      w: "90%",
      h: 0.8,
      fontSize: 24,
      fontFace: theme.fonts.body,
      color: theme.colors.textLight,
      align: "center",
    });
  }
}

/**
 * Add a content slide with paragraph text
 */
export function addContentSlide(
  pres: PptxGenJS,
  theme: PptxTheme,
  slide: PptxSlide
): void {
  const s = pres.addSlide({ masterName: "THEMED_MASTER" });

  // Title
  s.addText(slide.title || "", {
    x: 0.5,
    y: 0.5,
    w: "90%",
    h: 1,
    fontSize: 32,
    fontFace: theme.fonts.heading,
    color: theme.colors.primary,
    bold: true,
  });

  // Content paragraph
  s.addText(slide.content || "", {
    x: 0.5,
    y: 1.7,
    w: "90%",
    h: 3,
    fontSize: 18,
    fontFace: theme.fonts.body,
    color: theme.colors.text,
    align: "left",
    valign: "top",
  });
}

/**
 * Add a bullet points slide
 */
export function addBulletsSlide(
  pres: PptxGenJS,
  theme: PptxTheme,
  slide: PptxSlide
): void {
  const s = pres.addSlide({ masterName: "THEMED_MASTER" });

  // Title
  s.addText(slide.title || "", {
    x: 0.5,
    y: 0.5,
    w: "90%",
    h: 1,
    fontSize: 32,
    fontFace: theme.fonts.heading,
    color: theme.colors.primary,
    bold: true,
  });

  // Bullet points
  const bulletItems = (slide.bullets || []).map((text) => ({
    text,
    options: {
      bullet: { type: "bullet" as const, color: theme.colors.accent },
      color: theme.colors.text,
    },
  }));

  s.addText(bulletItems as any, {
    x: 0.5,
    y: 1.7,
    w: "90%",
    h: 3,
    fontSize: 20,
    fontFace: theme.fonts.body,
    paraSpaceAfter: 14,
  });
}

/**
 * Add a quote slide
 */
export function addQuoteSlide(
  pres: PptxGenJS,
  theme: PptxTheme,
  slide: PptxSlide
): void {
  const s = pres.addSlide({ masterName: "THEMED_MASTER" });

  // Quote text
  s.addText(`"${slide.quote || ""}"`, {
    x: 0.8,
    y: 1.5,
    w: "85%",
    h: 2,
    fontSize: 28,
    fontFace: theme.fonts.body,
    color: theme.colors.text,
    align: "center",
    italic: true,
  });

  // Author
  if (slide.author) {
    s.addText(`— ${slide.author}`, {
      x: 0.5,
      y: 3.8,
      w: "90%",
      h: 0.5,
      fontSize: 18,
      fontFace: theme.fonts.body,
      color: theme.colors.textLight,
      align: "center",
    });
  }
}

/**
 * Add an end/thank you slide
 */
export function addEndSlide(
  pres: PptxGenJS,
  theme: PptxTheme,
  slide: PptxSlide
): void {
  const s = pres.addSlide({ masterName: "THEMED_MASTER" });

  // Main text
  s.addText(slide.title || "Спасибо!", {
    x: 0.5,
    y: 2.0,
    w: "90%",
    h: 1.5,
    fontSize: 48,
    fontFace: theme.fonts.heading,
    color: theme.colors.primary,
    bold: true,
    align: "center",
  });

  // Subtitle
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5,
      y: 3.5,
      w: "90%",
      h: 0.5,
      fontSize: 24,
      fontFace: theme.fonts.body,
      color: theme.colors.textLight,
      align: "center",
    });
  }
}

/**
 * Generate PPTX presentation from slides array
 */
export function generatePptxFromSlides(
  pres: PptxGenJS,
  slides: PptxSlide[],
  theme: PptxTheme
): void {
  // Apply theme
  applyThemeToPresentation(pres, theme);

  // Add each slide
  for (const slide of slides) {
    switch (slide.type) {
      case "title":
        addTitleSlide(pres, theme, slide);
        break;
      case "content":
        addContentSlide(pres, theme, slide);
        break;
      case "bullets":
        addBulletsSlide(pres, theme, slide);
        break;
      case "quote":
        addQuoteSlide(pres, theme, slide);
        break;
      case "end":
        addEndSlide(pres, theme, slide);
        break;
      default:
        addContentSlide(pres, theme, slide);
    }
  }
}
