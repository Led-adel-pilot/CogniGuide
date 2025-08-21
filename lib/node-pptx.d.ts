declare module 'pptx-text-parser/lib/node-pptx' {
  class Pptx {
    constructor(zip: any);
    extract(): Promise<any>;
  }
  export = Pptx;
}
