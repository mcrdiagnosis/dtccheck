declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; letterRendering?: boolean };
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: string };
    pagebreak?: { mode?: string[]; before?: string; after?: string; avoid?: string };
  }

  interface Html2PdfInstance {
    from(element: HTMLElement | string): Html2PdfInstance;
    set(options: Html2PdfOptions): Html2PdfInstance;
    toPdf(): Html2PdfInstance;
    toContainer(): Html2PdfInstance;
    toCanvas(): Html2PdfInstance;
    toImg(): Html2PdfInstance;
    save(): Promise<void>;
    output(type: string): Promise<any>;
    then(onFulfilled: (value: any) => any): Promise<any>;
  }

  function html2pdf(): Html2PdfInstance;
  export = html2pdf;
}
