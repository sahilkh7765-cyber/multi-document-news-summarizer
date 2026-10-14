// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Turn an uploaded file into an article, following app.py: .pdf and .docx go through their parsers,
// everything else (.txt, .md) is decoded as UTF-8; the default outlet name is the file name without its
// extension (f.name.rsplit('.', 1)[0]).

import { MIN_WORDS, makeArticle } from '@/nlp/sentences';
import type { Article } from '@/nlp/types';
import { IngestError } from './errors';
import { decodeUtf8Ignore } from './text';

export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx'] as const;
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');
const MAX_BYTES = 25 * 1024 * 1024;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export function defaultSourceFromFileName(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? name : name.slice(0, i);
}

export async function rawTextOfFile(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new IngestError(`Unsupported file type ${ext || '(no extension)'}. Use .txt, .md, .pdf or .docx.`);
  }
  if (file.size === 0) throw new IngestError('The file is empty.');
  if (file.size > MAX_BYTES) throw new IngestError('The file is larger than 25 MB.');
  const data = await file.arrayBuffer();
  if (ext === '.pdf') return (await import('./pdf')).readPdf(data);
  if (ext === '.docx') return (await import('./docx')).readDocx(data);
  return decodeUtf8Ignore(data);
}

export function articleFromText(raw: string, defaultSource: string): Article {
  if (!raw.trim()) throw new IngestError('No text was found in it.');
  const a = makeArticle(raw, defaultSource);
  if (!a) throw new IngestError(`No usable sentences were found. Each sentence needs at least ${MIN_WORDS} words.`);
  return a;
}

export async function articleFromFile(file: File): Promise<Article> {
  return articleFromText(await rawTextOfFile(file), defaultSourceFromFileName(file.name));
}
