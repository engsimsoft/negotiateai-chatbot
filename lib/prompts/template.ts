/**
 * Simple Template Engine
 *
 * Lightweight regex-based template replacement.
 * Supports {{variable}} syntax.
 *
 * Why not Handlebars? -80KB bundle size, and we only need variable replacement.
 */

/**
 * Replace {{variable}} placeholders in template string
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variables - Object with variable values
 * @returns Processed string with variables replaced
 *
 * @example
 * ```ts
 * const result = render('Hello, {{name}}!', { name: 'Владимир' });
 * // => 'Hello, Владимир!'
 * ```
 */
export function render(
  template: string,
  variables: Record<string, string | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    // Return empty string for null/undefined, otherwise the value
    return value ?? '';
  });
}

/**
 * Check if template contains a specific variable
 *
 * @param template - Template string
 * @param variable - Variable name to check
 * @returns true if variable is used in template
 */
export function hasVariable(template: string, variable: string): boolean {
  const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
  return regex.test(template);
}

/**
 * Extract all variable names from template
 *
 * @param template - Template string
 * @returns Array of variable names found
 *
 * @example
 * ```ts
 * const vars = extractVariables('{{name}} from {{city}}');
 * // => ['name', 'city']
 * ```
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Conditionally include a section if variable has value
 *
 * @param condition - Include section if truthy
 * @param content - Content to include
 * @returns Content if condition is truthy, empty string otherwise
 *
 * @example
 * ```ts
 * const section = conditional(user.bio, `Bio: ${user.bio}`);
 * ```
 */
export function conditional(
  condition: string | undefined | null | boolean,
  content: string
): string {
  return condition ? content : '';
}

/**
 * Join multiple blocks with separator, filtering out empty ones
 *
 * @param blocks - Array of content blocks
 * @param separator - Separator between blocks (default: double newline)
 * @returns Joined string
 */
export function joinBlocks(
  blocks: (string | undefined | null)[],
  separator: string = '\n\n'
): string {
  return blocks
    .filter((block): block is string => Boolean(block && block.trim()))
    .join(separator);
}
