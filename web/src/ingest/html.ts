// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Article text from a web page, as app.py's read_url does with BeautifulSoup:
//   paras = [p.get_text(' ', strip=True) for p in soup.find_all('p')]
//   '\n'.join(p for p in paras if len(p.split()) >= MIN_WORDS)
// get_text(' ', strip=True) strips every text node and joins the non-empty ones with a space.
// The browser's HTML5 parser can nest malformed markup differently from html.parser (see PARITY.md).

import { MIN_WORDS } from '@/nlp/sentences';
import { pySplitWhitespace, pyStrip } from '@/nlp/unicode';

function getText(el: Element): string {
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = pyStrip(n.nodeValue ?? '');
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

export function paragraphsFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('p')]
    .map(getText)
    .filter((p) => pySplitWhitespace(p).length >= MIN_WORDS)
    .join('\n');
}

/** app.py's default source name for a URL: re.sub(r'^www\.', '', u.split('/')[2]) */
export function sourceFromUrl(url: string): string {
  return (url.split('/')[2] ?? url).replace(/^www\./, '');
}
