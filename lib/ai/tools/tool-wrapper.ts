import { tool, type Tool } from "ai";
import type { z } from "zod";

/**
 * Tool execution result with standardized error handling
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    toolName: string;
    executionTimeMs: number;
    timestamp: string;
  };
}

/**
 * Configuration for tool wrapping
 */
export interface ToolWrapperConfig {
  /** Tool name for logging */
  name: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable detailed logging (default: true) */
  enableLogging?: boolean;
}

/**
 * Creates a timeout promise that rejects after specified milliseconds
 */
function createTimeout(ms: number, toolName: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Wraps a tool execution function with error handling, logging, and timeout
 *
 * @example
 * ```ts
 * const myTool = tool({
 *   description: "My tool",
 *   inputSchema: z.object({ query: z.string() }),
 *   execute: wrapToolExecution(
 *     { name: "myTool", timeout: 10000 },
 *     async ({ query }) => {
 *       // Your tool logic here
 *       return { result: "success" };
 *     }
 *   ),
 * });
 * ```
 */
export function wrapToolExecution<TInput, TOutput>(
  config: ToolWrapperConfig,
  executeFn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput | ToolResult<TOutput>> {
  const {
    name,
    timeout = 30000,
    enableLogging = true,
  } = config;

  return async (input: TInput): Promise<TOutput | ToolResult<TOutput>> => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (enableLogging) {
      console.log(`[Tool:${name}] Starting execution at ${timestamp}`, {
        input: JSON.stringify(input).substring(0, 200),
      });
    }

    try {
      // Race between execution and timeout
      const result = await Promise.race([
        executeFn(input),
        createTimeout(timeout, name),
      ]);

      const executionTimeMs = Date.now() - startTime;

      if (enableLogging) {
        console.log(`[Tool:${name}] Completed successfully in ${executionTimeMs}ms`);
      }

      // Check if result already has success/error structure
      if (
        typeof result === "object" &&
        result !== null &&
        ("success" in result || "error" in result)
      ) {
        return result as TOutput;
      }

      // Wrap successful result
      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (enableLogging) {
        console.error(`[Tool:${name}] Failed after ${executionTimeMs}ms:`, errorMessage);
      }

      // Return standardized error result
      return {
        success: false,
        error: errorMessage,
        metadata: {
          toolName: name,
          executionTimeMs,
          timestamp,
        },
      } as ToolResult<TOutput>;
    }
  };
}

/**
 * Wraps multiple tool executions with Promise.allSettled for parallel execution
 * Ensures all tools complete (either successfully or with error) before returning
 *
 * @example
 * ```ts
 * const results = await executeToolsInParallel([
 *   { name: "tool1", execute: () => readDocument({ filepath: "file1.pdf" }) },
 *   { name: "tool2", execute: () => readDocument({ filepath: "file2.pdf" }) },
 * ]);
 * ```
 */
export async function executeToolsInParallel<T>(
  tools: Array<{
    name: string;
    execute: () => Promise<T>;
  }>
): Promise<Array<ToolResult<T>>> {
  console.log(`[ToolParallel] Executing ${tools.length} tools in parallel`);

  const results = await Promise.allSettled(
    tools.map((tool) => tool.execute())
  );

  return results.map((result, index) => {
    const toolName = tools[index].name;

    if (result.status === "fulfilled") {
      return {
        success: true,
        data: result.value,
        metadata: {
          toolName,
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        metadata: {
          toolName,
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }
  });
}
