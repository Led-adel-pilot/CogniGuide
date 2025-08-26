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
 * @param isNonAuthUser Whether this is for a non-authenticated user (limits content to 3 credits worth).
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromDocx(buffer: Buffer, isNonAuthUser = false): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return truncateForNonAuthUser(value, isNonAuthUser);
  } catch (error) {
    console.error('Error parsing DOCX file:', error);
    throw new Error('Failed to extract text from DOCX file.');
  }
}

/**
 * Extracts text content from a PDF file buffer.
 * @param buffer The buffer containing the PDF file data.
 * @param isNonAuthUser Whether this is for a non-authenticated user (limits content to 3 credits worth).
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPdf(buffer: Buffer, isNonAuthUser = false): Promise<string> {
  try {
    const data = await pdf(buffer);
    return truncateForNonAuthUser(data.text, isNonAuthUser);
  } catch (error) {
    console.error('Error parsing PDF file:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

/**
 * Extracts text content from a PPTX file buffer.
 * @param buffer The buffer containing the PPTX file data.
 * @param isNonAuthUser Whether this is for a non-authenticated user (limits content to 3 credits worth).
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPptx(buffer: Buffer, isNonAuthUser = false): Promise<string> {
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
    return truncateForNonAuthUser(text, isNonAuthUser);
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
 * Truncates text content for non-authenticated users to fit within 1 credit worth of content.
 * 1 credit = 3800 characters, so 1 credit = 3800 characters maximum.
 * @param text The extracted text content.
 * @param isNonAuthUser Whether this is for a non-authenticated user.
 * @returns The truncated or original text.
 */
function truncateForNonAuthUser(text: string, isNonAuthUser: boolean): string {
  if (!isNonAuthUser) {
    return text;
  }

  const MAX_CHARS = 1 * 3800; // 1 credit * 3800 characters per credit

  if (text.length <= MAX_CHARS) {
    return text;
  }

  // Try to truncate at a word boundary
  const truncated = text.substring(0, MAX_CHARS);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  // If we found a space within a reasonable distance from the end, truncate there
  if (lastSpaceIndex > MAX_CHARS * 0.8) {
    const result = truncated.substring(0, lastSpaceIndex);
    return result + '\n\n[Content truncated for free users - sign up for unlimited access]';
  }

  // Otherwise, truncate at the exact character limit
  return truncated + '\n\n[Content truncated for free users - sign up for unlimited access]';
}
