declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdf(dataBuffer: Buffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }>;
  export = pdf;
}
