// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
// @vitest-environment happy-dom
//
// Ingestion helpers: app.py's naming rules, UTF-8 'ignore' decoding, and the BeautifulSoup-style
// paragraph extraction used for web pages.

import { describe, expect, it } from 'vitest';
import { IngestError } from '../errors';
import { articleFromText, defaultSourceFromFileName, extensionOf } from '../files';
import { paragraphsFromHtml, sourceFromUrl } from '../html';
import { decodeUtf8Ignore } from '../text';
import { parseUrlList } from '../url';

describe('naming (app.py rules)', () => {
  it("file name without the last extension: f.name.rsplit('.', 1)[0]", () => {
    expect(defaultSourceFromFileName('The Hindu.txt')).toBe('The Hindu');
    expect(defaultSourceFromFileName('report.final.pdf')).toBe('report.final');
    expect(defaultSourceFromFileName('noext')).toBe('noext');
    expect(extensionOf('A.DOCX')).toBe('.docx');
  });

  it("URL host as typed, minus a leading www.: re.sub(r'^www\.', '', u.split('/')[2])", () => {
    expect(sourceFromUrl('https://www.thehindu.com/news/a.html')).toBe('thehindu.com');
    expect(sourceFromUrl('https://news.example.org:8080/x')).toBe('news.example.org:8080');
    expect(sourceFromUrl('http://WWW.Example.com/')).toBe('WWW.Example.com');
  });

  it('one URL per line, blanks ignored', () => {
    expect(parseUrlList(' https://a.example/x \r\n\n https://b.example/y\n')).toEqual(['https://a.example/x', 'https://b.example/y']);
  });
});

describe("bytes.decode('utf-8', errors='ignore')", () => {
  it('drops invalid bytes and keeps valid multi-byte text', () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xc3, 0xa9, 0xff, 0x21]);
    expect(decodeUtf8Ignore(bytes)).toBe('café!');
  });
  it('removes a leading byte-order mark', () => {
    expect(decodeUtf8Ignore(new Uint8Array([0xef, 0xbb, 0xbf, 0x53, 0x6f]))).toBe('So');
  });
});

describe('paragraphs from HTML (BeautifulSoup get_text(" ", strip=True) on every <p>)', () => {
  it('keeps <p> text with at least 5 words; strips each text node (internal spaces kept) and joins with a space', () => {
    const html = `<html><head><title>T</title><script>var x = "<p>not this</p>";</script></head><body>
      <nav><p>Home</p></nav>
      <p>The   council <b>approved</b>\n the <a href="#">budget</a> on Monday.</p>
      <div>Text outside paragraphs is ignored by app.py.</div>
      <p>Too short here.</p>
      <p>  Members argued about <em> road </em>repairs for hours.  </p>
    </body></html>`;
    expect(paragraphsFromHtml(html)).toBe('The   council approved the budget on Monday.\nMembers argued about road repairs for hours.');
  });

  it('returns empty text when there are no paragraphs', () => {
    expect(paragraphsFromHtml('<div>No paragraphs at all on this page here.</div>')).toBe('');
  });
});

describe('articleFromText errors', () => {
  it('empty text', () => {
    expect(() => articleFromText('  \n ', 'x')).toThrow(IngestError);
    expect(() => articleFromText('  \n ', 'x')).toThrow('No text was found');
  });
  it('text with no usable sentences', () => {
    expect(() => articleFromText('Too short. Nope.', 'x')).toThrow('at least 5 words');
  });
  it('header lines are honoured', () => {
    const a = articleFromText('Source: Wire\nEvent: E7\nTitle: Hello\n\nThe council approved the new budget on Monday evening.', 'file');
    expect([a.source, a.event, a.title, a.sents.length]).toEqual(['Wire', 'E7', 'Hello', 1]);
  });
});
