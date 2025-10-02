import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import pptxTextParser from 'pptx-text-parser';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Pptx from 'pptx-text-parser/lib/node-pptx';

// Constants for tier-based limits
const CHARS_PER_CREDIT = 3800;
const TIER_LIMITS = {
  'non-auth': 15 * CHARS_PER_CREDIT, // 57,000 characters
  'free': 32 * CHARS_PER_CREDIT,     // 121,600 characters
  'paid': 50 * CHARS_PER_CREDIT     // 190,000 characters
} as const;

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
 * Processes plain text or markdown content with user tier limits.
 * @param buffer The buffer containing the text file data.
 * @param userTier The user's tier ('non-auth', 'free', 'paid') to determine content limits.
 * @returns The processed text with appropriate truncation.
 */
export function getTextFromPlainText(buffer: Buffer, userTier: 'non-auth' | 'free' | 'paid' = 'non-auth'): string {
  const text = buffer.toString('utf-8');
  return truncateByUserTier(text, userTier);
}

/**
 * Truncates text content based on user tier limits.
 * - Non-auth users: 1 credit worth (3,800 characters)
 * - Free plan users: 5 credits worth (19,000 characters)
 * - Paid plan users: 30 credits worth (114,000 characters)
 * @param text The extracted text content.
 * @param userTier The user's tier ('non-auth', 'free', 'paid').
 * @returns The truncated or original text with appropriate limits applied.
 */
function truncateByUserTier(text: string, userTier: 'non-auth' | 'free' | 'paid'): string {
  const maxChars = TIER_LIMITS[userTier];

  // Check if content is within tier limits
  if (text.length <= maxChars) {
    return text;
  }

  // Try to truncate at a word boundary
  const truncated = text.substring(0, maxChars);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  // If we found a space within a reasonable distance from the end, truncate there
  if (lastSpaceIndex > maxChars * 0.8) {
    const result = truncated.substring(0, lastSpaceIndex);
    const upgradeMessage = getUpgradeMessage(userTier);
    return result + upgradeMessage;
  }

  // Otherwise, truncate at the exact character limit
  const upgradeMessage = getUpgradeMessage(userTier);
  return truncated + upgradeMessage;
}

/**
 * Gets the appropriate upgrade message based on user tier.
 */
function getUpgradeMessage(userTier: 'non-auth' | 'free' | 'paid'): string {
  switch (userTier) {
    case 'non-auth':
      return '\n\n[Content truncated for free users - sign up for more access]';
    case 'free':
      return '\n\n[Content truncated for free plan - upgrade for higher limits]';
    case 'paid':
      return '\n\n[Content truncated - file exceeds plan limit]';
    default:
      return '\n\n[Content truncated]';
  }
}

/**
 * Interface for the result of processing multiple files.
 */
export interface MultiFileProcessResult {
  success: boolean;
  extractedParts: string[];
  imageDataUrls: string[];
  totalRawChars: number;
  // cumulative limit info
  maxChars: number;
  limitExceeded: boolean;
  // which files were included/excluded (by name/size)
  includedFiles: { name: string; size: number }[];
  excludedFiles: { name: string; size: number }[];
  // if a file was partially included, details here
  partialFile?: { name: string; size: number; includedChars: number };
}

/**
 * Processes multiple files with cumulative character limits based on user tier.
 * Stops processing when the tier limit would be exceeded and returns an error.
 * @param files Array of File objects to process
 * @param userTier The user's tier ('non-auth', 'free', 'paid')
 * @returns MultiFileProcessResult with success status and extracted content or error
 */
export async function processMultipleFiles(
  files: File[],
  userTier: 'non-auth' | 'free' | 'paid' = 'non-auth'
): Promise<MultiFileProcessResult> {
  const maxChars = TIER_LIMITS[userTier];
  const extractedParts: string[] = [];
  const imageDataUrls: string[] = [];
  const includedFiles: { name: string; size: number }[] = [];
  const excludedFiles: { name: string; size: number }[] = [];
  let totalRawChars = 0;
  let partialFile: { name: string; size: number; includedChars: number } | undefined;
  let limitExceeded = false;

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = '';

      // Handle image files separately
      if (file.type.startsWith('image/')) {
        try {
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${file.type};base64,${base64}`;
          imageDataUrls.push(dataUrl);
          continue;
        } catch {
          continue; // Skip problematic images
        }
      }

      // Extract text based on file type without tier-based truncation
      if (file.type === 'application/pdf') {
        text = await getTextFromPdfRaw(buffer);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await getTextFromDocxRaw(buffer);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        text = await getTextFromPptxRaw(buffer);
      } else if (file.type === 'text/plain') {
        text = getTextFromPlainTextRaw(buffer);
      } else if (
        file.type === 'text/markdown' ||
        file.name.toLowerCase().endsWith('.md') ||
        file.name.toLowerCase().endsWith('.markdown')
      ) {
        text = getTextFromPlainTextRaw(buffer);
      } else {
        // Unsupported type; skip
        continue;
      }

      // Check cumulative limit and possibly include partial content
      const fileTextLength = text.length;
      const remaining = maxChars - totalRawChars;
      
      if (remaining <= 0) {
        // No more room for text content - exclude this file
        excludedFiles.push({ name: file.name, size: (file as any).size ?? 0 });
        limitExceeded = true;
        continue;
      }

      if (fileTextLength <= remaining) {
        // Include fully
        totalRawChars += fileTextLength;
        includedFiles.push({ name: file.name, size: (file as any).size ?? 0 });
        extractedParts.push(`--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---`);
      } else {
        // Include partially up to remaining, cut on a word boundary if possible
        const truncated = truncateToLimit(text, remaining);
        totalRawChars += truncated.length;
        includedFiles.push({ name: file.name, size: (file as any).size ?? 0 });
        partialFile = { name: file.name, size: (file as any).size ?? 0, includedChars: truncated.length };
        extractedParts.push(`--- START OF FILE: ${file.name} ---\n\n${truncated}\n\n--- END OF FILE: ${file.name} ---`);
        limitExceeded = true;
        // After partial inclusion, all subsequent text files will be excluded in next iterations
      }

    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      // Continue with other files rather than failing completely
      continue;
    }
  }

  return {
    success: true,
    extractedParts,
    imageDataUrls,
    totalRawChars,
    maxChars,
    limitExceeded,
    includedFiles,
    excludedFiles,
    partialFile,
  };
}

/**
 * Raw text extraction functions without tier-based truncation
 */
async function getTextFromDocxRaw(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } catch (error) {
    console.error('Error parsing DOCX file:', error);
    throw new Error('Failed to extract text from DOCX file.');
  }
}

async function getTextFromPdfRaw(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF file:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

async function getTextFromPptxRaw(buffer: Buffer): Promise<string> {
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
    return text;
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

function getTextFromPlainTextRaw(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Truncate text to a hard limit, preferring a word boundary near the end.
 * Does not append any upgrade message.
 */
function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const truncated = text.substring(0, limit);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > Math.floor(limit * 0.8)) {
    return truncated.substring(0, lastSpaceIndex);
  }
  return truncated;
}