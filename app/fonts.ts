import { Lora, Source_Sans_3, JetBrains_Mono } from 'next/font/google';

export const fontSerif = Lora({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-lora',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const fontSans = Source_Sans_3({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-source-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});
