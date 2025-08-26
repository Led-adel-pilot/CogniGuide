import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import pptxTextParser from 'pptx-text-parser';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Pptx from 'pptx-text-parser/lib/node-pptx';

/**
 * Extracts text content from a DOCX file buffer.
 * @param buffer The buffer containing the DOCX file data.
 * @param userTier The user's tier ('non-auth', 'free', 'paid') to determine content limits.
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromDocx(buffer: Buffer, userTier: 'non-auth' | 'free' | 'paid' = 'non-auth'): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return truncateByUserTier(value, userTier);
  } catch (error) {
    console.error('Error parsing DOCX file:', error);
    throw new Error('Failed to extract text from DOCX file.');
  }
}

/**
 * Extracts text content from a PDF file buffer.
 * @param buffer The buffer containing the PDF file data.
 * @param userTier The user's tier ('non-auth', 'free', 'paid') to determine content limits.
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPdf(buffer: Buffer, userTier: 'non-auth' | 'free' | 'paid' = 'non-auth'): Promise<string> {
  try {
    const data = await pdf(buffer);
    return truncateByUserTier(data.text, userTier);
  } catch (error) {
    console.error('Error parsing PDF file:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

/**
 * Extracts text content from a PPTX file buffer.
 * @param buffer The buffer containing the PPTX file data.
 * @param userTier The user's tier ('non-auth', 'free', 'paid') to determine content limits.
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPptx(buffer: Buffer, userTier: 'non-auth' | 'free' | 'paid' = 'non-auth'): Promise<string> {
  const tempFilePath = join(tmpdir(), `temp-pptx-${Date.now()}.pptx`);
  try {
    await writeFile(tempFilePath, buffer);
    const result = await pptxTextParser(tempFilePath, 'text');
    let text = '';
    if (typeof result === 'string') {
      text = result;
    } else if (typeof result === 'object' && result !== null) {
      text = Object.values(result).join('\n\n');
    }
    return truncateByUserTier(text, userTier);
  } catch (error) {
    console.error('Error parsing PPTX file:', error);
    throw new Error('Failed to extract text from PPTX file.');
  } finally {
    try {
      await unlink(tempFilePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary PPTX file:', unlinkError);
    }
  }
}

/**
 * Truncates text content based on user tier limits.
 * - Non-auth users: 1 credit worth (3,800 characters)
 * - Free plan users: 5 credits worth (19,000 characters)
 * - Paid plan users: 30 credits worth (114,000 characters)
 * @param text The extracted text content.
 * @param userTier The user's tier ('non-auth', 'free', 'paid').
 * @returns The truncated or original text.
 */
function truncateByUserTier(text: string, userTier: 'non-auth' | 'free' | 'paid'): string {
  const CHARS_PER_CREDIT = 3800;

  // Define limits for each tier
  const tierLimits = {
    'non-auth': 1 * CHARS_PER_CREDIT, // 3,800 characters
    'free': 5 * CHARS_PER_CREDIT,     // 19,000 characters
    'paid': 30 * CHARS_PER_CREDIT     // 114,000 characters
  };

  const maxChars = tierLimits[userTier];

  // Paid users have no limit
  if (userTier === 'paid' || text.length <= maxChars) {
    return text;
  }

  // Try to truncate at a word boundary
  const truncated = text.substring(0, maxChars);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  // If we found a space within a reasonable distance from the end, truncate there
  if (lastSpaceIndex > maxChars * 0.8) {
    const result = truncated.substring(0, lastSpaceIndex);
    const upgradeMessage = userTier === 'non-auth'
      ? '\n\n[Content truncated for free users - sign up for unlimited access]'
      : '\n\n[Content truncated for free plan - upgrade for unlimited access]';
    return result + upgradeMessage;
  }

  // Otherwise, truncate at the exact character limit
  const upgradeMessage = userTier === 'non-auth'
    ? '\n\n[Content truncated for free users - sign up for unlimited access]'
    : '\n\n[Content truncated for free plan - upgrade for unlimited access]';
  return truncated + upgradeMessage;
}
