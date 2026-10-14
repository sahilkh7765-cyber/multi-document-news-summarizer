// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Word (.docx) text via mammoth, loaded only when a .docx is added. app.py joins python-docx paragraphs
// with '\n'; mammoth separates paragraphs with a blank line, which the sentence splitter treats the same.

import { IngestError } from './errors';

export async function readDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: data });
    return value;
  } catch {
    throw new IngestError('This file could not be opened as a Word document. Only .docx is supported; save older .doc files as .docx first.');
  }
}
