/**
 * Context Builders
 *
 * Re-exports all context building functions.
 */

export {
  buildUserProfileContext,
  buildPersonalizationContext,
  buildFullUserContext,
} from './user-profile';

export {
  buildMemoryContext,
  buildSimpleMemoryContext,
  retrieveRelevantContext,
  type MemoryEntry,
} from './chat-memory';

export {
  buildProjectContext,
  buildSimpleProjectContext,
  type ProjectContext,
} from './project-context';
