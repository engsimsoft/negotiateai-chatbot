/**
 * User Profile Context Builder
 *
 * Builds personalized context block from user profile data.
 * This context is injected into prompts to personalize responses.
 */

import type { UserProfile, UserPersonalization, CommunicationStyle } from '../types';

/**
 * Style descriptions for communication style setting
 */
const STYLE_DESCRIPTIONS: Record<CommunicationStyle, string> = {
  friendly: 'Дружелюбный — общайся как с коллегой, неформально, но профессионально',
  formal: 'Деловой — чётко и по делу, без лишних слов, структурированно',
  expert: 'Экспертный — подробно и профессионально, с глубоким анализом',
};

/**
 * Build user context block from profile
 *
 * @param profile - User profile data
 * @returns Formatted context string or empty string
 *
 * @example
 * ```ts
 * const context = buildUserProfileContext({
 *   displayName: 'Владимир',
 *   occupation: 'Маркетолог',
 * });
 * // => "## Информация о пользователе\n\n- Имя: Владимир\n- Сфера: Маркетолог"
 * ```
 */
export function buildUserProfileContext(profile?: UserProfile): string {
  if (!profile) return '';

  const { displayName, pronouns, occupation, bio } = profile;

  // Skip if no meaningful data
  if (!displayName && !occupation && !bio) {
    return '';
  }

  const lines: string[] = ['## Информация о пользователе', ''];

  if (displayName) {
    lines.push(`- Имя: ${displayName}`);
  }

  // Always include pronouns (default to "вы")
  lines.push(`- Обращение: на "${pronouns || 'вы'}"`);

  if (occupation) {
    lines.push(`- Сфера деятельности: ${occupation}`);
  }

  if (bio) {
    lines.push(`- Контекст: ${bio}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Build personalization context block
 *
 * @param personalization - User personalization settings
 * @returns Formatted context string or empty string
 */
export function buildPersonalizationContext(
  personalization?: UserPersonalization
): string {
  if (!personalization) return '';

  const { communicationStyle, specialization } = personalization;

  // Skip if no settings
  if (!communicationStyle && !specialization) {
    return '';
  }

  const lines: string[] = ['## Персонализация', ''];

  if (communicationStyle) {
    const description = STYLE_DESCRIPTIONS[communicationStyle];
    lines.push(`- Стиль общения: ${description}`);
  }

  if (specialization) {
    lines.push(`- Специализация: ${specialization}`);
    lines.push('  Учитывай эту специализацию при ответах.');
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Build full user context (profile + personalization)
 *
 * @param profile - User profile data
 * @param personalization - User personalization settings
 * @returns Combined context string
 */
export function buildFullUserContext(
  profile?: UserProfile,
  personalization?: UserPersonalization
): string {
  const profileContext = buildUserProfileContext(profile);
  const personalizationContext = buildPersonalizationContext(personalization);

  if (!profileContext && !personalizationContext) {
    return '';
  }

  return [profileContext, personalizationContext]
    .filter(Boolean)
    .join('\n');
}
