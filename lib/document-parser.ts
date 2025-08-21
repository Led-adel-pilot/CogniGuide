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
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } catch (error) {
    console.error('Error parsing DOCX file:', error);
    throw new Error('Failed to extract text from DOCX file.');
  }
}

/**
 * Extracts text content from a PDF file buffer.
 * @param buffer The buffer containing the PDF file data.
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF file:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

/**
 * Extracts text content from a PPTX file buffer.
 * @param buffer The buffer containing the PPTX file data.
 * @returns A promise that resolves to the extracted text.
 */
export async function getTextFromPptx(buffer: Buffer): Promise<string> {
  const tempFilePath = join(tmpdir(), `temp-pptx-${Date.now()}.pptx`);
  try {
    await writeFile(tempFilePath, buffer);
    const result = await pptxTextParser(tempFilePath, 'text');
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object' && result !== null) {
      return Object.values(result).join('\n\n');
    }
    return '';
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
