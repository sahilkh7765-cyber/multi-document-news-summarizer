// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Decode text files the way app.py does: bytes.decode('utf-8', errors='ignore').
// TextDecoder replaces bad bytes with U+FFFD; those are dropped to match 'ignore'. A leading byte-order
// mark is removed (Python keeps it, which would hide a "Source:" header on the first line).

export function decodeUtf8Ignore(bytes: ArrayBuffer | Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replaceAll('\uFFFD', '');
}
