// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// PDF text via pdfjs-dist, loaded only when a PDF is added. Each page's text items are joined, with a
// line break where pdf.js reports one (pypdf's extract_text works per line too); pages are joined by '\n'.

import { IngestError } from './errors';

export async function readPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: pdfjs.VerbosityLevel.ERRORS });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    const name = e instanceof Error ? e.name : '';
    if (name === 'PasswordException') throw new IngestError('This PDF is password-protected. Remove the password or paste the text instead.');
    throw new IngestError('This file could not be opened as a PDF. It may be damaged or not really a PDF.');
  }
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(text);
    }
    const all = pages.join('\n');
    if (!all.trim()) {
      throw new IngestError('This PDF has no text layer; it is probably a scanned image. Paste the text instead.');
    }
    return all;
  } finally {
    void task.destroy();
  }
}
