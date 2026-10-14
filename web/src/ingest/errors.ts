// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// A reading failure with a message written for the person, not the console.

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestError';
  }
}

export function reason(e: unknown): string {
  if (e instanceof IngestError) return e.message;
  if (e instanceof Error && e.message) return `Unexpected error: ${e.message}`;
  return 'Unexpected error.';
}
