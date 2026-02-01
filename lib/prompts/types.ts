/**
 * Prompt System Types
 *
 * TypeScript-based prompt configuration system.
 * Replaces database-driven agents with file-based configs.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Prompt configuration identifier
 */
export type PromptId = 'chat' | 'ben' | 'prompt-agent';

/**
 * AI model identifier
 */
export type ModelId =
  | 'gemini-3-pro'
  | 'gemini-2.5-flash'
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'gpt-4o'
  | 'gpt-4o-mini';

/**
 * Communication style for personalization
 */
export type CommunicationStyle = 'formal' | 'friendly' | 'expert';

// =============================================================================
// User Context
// =============================================================================

/**
 * User profile data for context building
 */
export interface UserProfile {
  displayName?: string | null;
  pronouns?: string | null;
  occupation?: string | null;
  bio?: string | null;
}

/**
 * User personalization settings
 */
export interface UserPersonalization {
  communicationStyle?: CommunicationStyle;
  specialization?: string;
}

// =============================================================================
// Build Context
// =============================================================================

/**
 * Context passed to prompt builder
 */
export interface BuildContext {
  /** User profile data */
  user?: UserProfile;

  /** User personalization settings */
  personalization?: UserPersonalization;

  /** Chat memory (previous context) */
  memory?: string;

  /** Request hints (geo, time) */
  requestHints?: {
    latitude?: string;
    longitude?: string;
    city?: string;
    country?: string;
  };

  /** Override default model */
  model?: ModelId;

  /** Additional template variables */
  variables?: Record<string, string>;
}

// =============================================================================
// Prompt Config
// =============================================================================

/**
 * Base prompt configuration
 */
export interface PromptConfig {
  /** Unique identifier */
  id: PromptId;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Default AI model */
  defaultModel: ModelId;

  /** System prompt template (supports {{variables}}) */
  systemPrompt: string;

  /** Optional greeting message */
  greeting?: string;

  /** Tool access restrictions (null = all tools) */
  toolAccess?: string[] | null;

  /** Whether this prompt supports streaming */
  supportsStreaming?: boolean;
}

// =============================================================================
// Built Prompt
// =============================================================================

/**
 * Result of building a prompt
 */
export interface BuiltPrompt {
  /** Assembled system prompt */
  systemPrompt: string;

  /** Selected model */
  model: ModelId;

  /** Optional greeting (for new conversations) */
  greeting?: string;

  /** Tool restrictions */
  toolAccess?: string[] | null;
}

// =============================================================================
// Core Blocks
// =============================================================================

/**
 * Reusable prompt block
 */
export interface PromptBlock {
  /** Block identifier */
  id: string;

  /** Block content */
  content: string;

  /** Priority for ordering (lower = earlier) */
  priority?: number;
}
