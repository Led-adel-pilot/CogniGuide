declare module 'pptx-text-parser' {
  /**
   * Parses a PPTX file and extracts the text content.
   * @param filePath The path to the PPTX file.
   * @param mode The output mode, either 'text' or 'json'.
   * @returns A promise that resolves to the extracted text as a string or a JSON object.
   */
  function pptxTextParser(filePath: string, mode?: 'text' | 'json'): Promise<string | { [key: string]: string }>;
  export = pptxTextParser;
}
