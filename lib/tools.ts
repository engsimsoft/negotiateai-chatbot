/**
 * AI Tools for NegotiateAI Chatbot
 *
 * This file contains implementations of tools (functions) that Claude can call
 * during conversations to access external data and perform actions.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * read_document - Reads a document from the knowledge base
 *
 * Uses Anthropic's native document reading capability to extract content
 * from DOCX, PDF, and other supported formats without conversion.
 *
 * @param filepath - Relative path to document in knowledge/ folder
 * @returns Document content as text
 */
export async function read_document(filepath: string): Promise<string> {
  try {
    // Security: Validate that path is within knowledge/ folder
    const normalizedPath = path.normalize(filepath);

    if (!normalizedPath.startsWith('knowledge/')) {
      throw new Error(
        'Security error: Can only read documents from knowledge/ folder'
      );
    }

    // Construct absolute path
    const projectRoot = process.cwd();
    const absolutePath = path.join(projectRoot, normalizedPath);

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(`File not found: ${filepath}`);
    }

    // Get file stats
    const stats = await fs.stat(absolutePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    // Anthropic limit: 32MB for PDFs, 30MB for other files
    if (fileSizeMB > 30) {
      throw new Error(
        `File too large: ${fileSizeMB.toFixed(2)}MB (limit: 30MB)`
      );
    }

    // Determine file type
    const ext = path.extname(absolutePath).toLowerCase();
    const supportedFormats = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.html'];

    if (!supportedFormats.includes(ext)) {
      throw new Error(
        `Unsupported file format: ${ext}. Supported: ${supportedFormats.join(', ')}`
      );
    }

    // Read file as base64
    const fileBuffer = await fs.readFile(absolutePath);
    const base64Content = fileBuffer.toString('base64');

    // Determine media type
    let mediaType: string;
    switch (ext) {
      case '.pdf':
        mediaType = 'application/pdf';
        break;
      case '.docx':
        mediaType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.doc':
        mediaType = 'application/msword';
        break;
      case '.csv':
        mediaType = 'text/csv';
        break;
      case '.html':
        mediaType = 'text/html';
        break;
      case '.txt':
      default:
        mediaType = 'text/plain';
        break;
    }

    // Use Anthropic API to extract document content
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: 'Пожалуйста, извлеки и верни весь текстовый контент из этого документа. Сохрани структуру и форматирование насколько возможно.',
            },
          ],
        },
      ],
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response format from Anthropic API');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read document: ${error.message}`);
    }
    throw new Error('Failed to read document: Unknown error');
  }
}

/**
 * get_current_date - Returns current date and time
 *
 * Provides Claude with temporal context for understanding
 * deadlines, tender dates, and time-sensitive information.
 *
 * @returns Current date and time in ISO 8601 format
 */
export function get_current_date(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Tool definitions for Claude function calling
 *
 * These schemas tell Claude what tools are available,
 * what parameters they accept, and how to use them.
 */
export const toolDefinitions = [
  {
    name: 'read_document',
    description:
      'Читает документ из базы знаний проекта MIR.TRADE. Используй эту функцию когда нужно получить детальную информацию из конкретного документа. Поддерживаемые форматы: PDF, DOCX, DOC, TXT, CSV, HTML.',
    input_schema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description:
            'Путь к документу относительно папки knowledge/. Например: "knowledge/Алжир/тендерные площадки Алжира.docx" или "knowledge/КП AGORA - Мир Групп от 20.04.2022_КРАТКО.pdf"',
        },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'get_current_date',
    description:
      'Возвращает текущую дату и время. Используй эту функцию когда нужно узнать сегодняшнюю дату для расчёта сроков, дедлайнов тендеров, или для контекста времени.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
