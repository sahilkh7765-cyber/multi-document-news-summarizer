<!--
NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
SAHIL JABIR KHAN 24AD1199
-->

# Multi-Document News Summarization with Cross-Source Coverage Comparison

Give the app several reports of the same news from different outlets. It groups the articles into
stories, writes one consensus summary per story with every sentence traced to the outlet it came from,
and shows which outlet covers which point. It also lists what only one outlet reported. With the built-in
demo corpus, whose sentences carry fact labels, it scores how well those single-outlet details are found.

The project has two versions:

- **`web/`: the JavaScript app** (React + TypeScript). The whole NLP pipeline runs in your browser, in a
  Web Worker. A tiny optional Node helper fetches web pages for the "From URL" tab.
- **`app.py` / `NLPCapstone.py`: the original Python versions** (Streamlit app and command-line script).
  They are unchanged and still work (see below).

## How the pipeline works

Each article is split into sentences: a regular-expression splitter that knows common abbreviations, and
keeps only sentences of at least 5 words. Then:

1. **Group into stories.** Each whole article becomes a TF-IDF vector (English stop words removed,
   sublinear term frequency). Articles are joined by average-linkage clustering on cosine distance,
   stopping at the threshold δ.
2. **Remove repeats.** Within a story, a sentence is kept only if it is less than τ_dup similar to every
   sentence already kept.
3. **Consensus summary.** The k most central kept sentences, shown in their original order, each with
   its outlet.
4. **Find source-exclusive details.** A sentence counts as "reported by one outlet only" if no other
   outlet has a sentence at least τ_uniq similar.

Each story also shows:
- keywords
- a coverage matrix (which outlet reports each summary sentence)
- a 3-sentence summary of each article
- ROUGE-1/2/L against an optional reference summary
- Distinct-1/2, compared with a LEAD-2 baseline

On the demo corpus it also shows precision, recall and F1 of exclusive-detail detection, a τ_uniq sweep,
and clustering accuracy against the event labels.

## Run it (Windows PowerShell)

You need **Node.js 22.18 or newer**; it was tested with Node 24.20. Windows PowerShell 5.1 has no `&&`,
so the commands below are on separate lines or joined with `;`.

### Install once

```powershell
cd "C:\path\to\Text S\web"
npm install
```

### Development mode

```powershell
# terminal 1: the app, at http://localhost:5173
cd web
npm run dev
```

```powershell
# terminal 2: only needed for the "From URL" tab (URL helper on 127.0.0.1:8787)
cd web
npm run server
```

Without the helper, everything except fetching URLs works. The URL tab then says the helper is not
running and how to start it.

### One-process production mode

```powershell
cd web
npm run build
npm start
```

Open http://127.0.0.1:8787. The helper serves the built app and the URL endpoint together. Stop it with
Ctrl+C.

### Using the app

1. Add articles: **Upload** (.txt, .md, .pdf or .docx; several at once or drag and drop), **Paste**, or
   **From URL** (one address per line). Optional first lines `Source:`, `Event:` and `Title:` set the
   outlet name, event label and title. Or click **Load demo corpus**.
2. Adjust the four settings if you like (defaults as in app.py: k = 5, δ = 0.85, τ_dup = 0.20,
   τ_uniq = 0.20), then **Run summarizer**.
3. Read each story's tab and download the results as **Markdown** or **JSON**.

The desk (articles, settings, references and the last results) is saved in your browser's IndexedDB, so
it is still there after a reload. Articles never leave your computer. The only network use is the URL
helper fetching the pages you ask for.

## Tests

```powershell
cd web
npm test                          # unit and parity tests (Vitest): 732 tests
npx playwright install chromium   # once, for the browser tests
npm run e2e                       # browser tests (Playwright): 78 at 1440, 1024 and 390 px
                                  # (76 run; the phone-only test is skipped at the two wider sizes)
npm run typecheck                 # TypeScript strict mode
```

`npm run e2e` starts the dev server and the URL helper itself and stops them when it finishes. The URL
tests fetch `example.com` and `httpbin.org`, so they need internet access.

**What the unit and parity tests prove:**
- The TypeScript pipeline gives the same results as app.py's own functions on 48 runs (6 corpora × 8
  settings).
- Identical: clusters (partition and story order), duplicate removal, summaries, exclusives, coverage,
  the τ_uniq sweep and TP/FP/FN.
- Within 1e-9: clustering accuracy, ROUGE and Distinct.
- Also covered: sentence splitting, header parsing, tokenization, Unicode handling, sklearn's stop-word
  list, and the TF-IDF vectors and document distances (within 1e-12).
- **The demo run reproduces `metrics.json`:** P 0.9231, R 1.0, F1 0.96, TP 12 / FP 1 / FN 0, clustering
  accuracy 1.0, the threshold sweep, every story's summary and exclusives, and the mean ROUGE/Distinct
  rows.

**What the browser tests prove:**
- The numbers shown on screen for the demo match `metrics.json` at every width.
- Every control works by mouse, keyboard and touch.
- Real .txt, .md, .pdf and .docx files upload, and bad files are rejected with a clear reason.
- URLs work through the helper, each failure is explained, and the app says how to start the helper if
  it is not running.
- Work is saved across reloads, and both downloads are correct.
- Accessibility (axe, WCAG 2.1 AA, including contrast) passes in light and dark themes, keyboard focus is
  visible, and reduced-motion preferences are honoured.
- No width scrolls sideways.
- The browser console stays clean. The only lines allowed are the helper's deliberate 400/502 answers for
  the intentionally bad URLs, and they are counted exactly.

**Regenerating the golden data** (needs Python with scikit-learn, numpy and scipy):

```powershell
python tools\export_fixtures.py     # from the repo root; writes web\fixtures\*.json
python tools\make_test_files.py     # writes the test documents in web\e2e\assets
```

`export_fixtures.py` loads app.py's real functions (it does not rewrite them) and dumps their outputs. It
also re-runs `NLPCapstone.py` into a temporary file and stops if the result is not identical to
`metrics.json`.

## Parity with the Python version

The details are in [`web/PARITY.md`](web/PARITY.md): how parity is tested, numerical margins, and every
known difference.

- **Tie-breaking.** When keywords or per-article sentences have exactly equal scores, numpy's default
  `argsort` picks among them in an order that depends on the numpy version and the CPU (it is not
  stable). The JS app breaks ties the way a stable sort would, so it gives the same result on every
  machine. For those tied outputs the tests accept any member of the tied group. Everything that is not
  tied must match exactly.
- **Numerical margins.** The TS and Python values differ by at most about 3e-16. The closest any value
  comes to a threshold it is compared with is 8.8e-5, so no decision flips.
- **Duplicate outlet names (intentional fix).** app.py renames repeated names to "Name (2)", "Name (3)",
  … but can still produce duplicates: `["A", "A", "A (2)"]` gives `A, A (2), A (2)`. The JS app keeps
  counting until a name is free (`A (2) (2)`). For every input without such a clash, the names are
  identical to app.py's.

## The original Python app still works

```powershell
pip install streamlit scikit-learn numpy pandas pypdf python-docx beautifulsoup4
streamlit run app.py
```

```powershell
python NLPCapstone.py                      # demo corpus; prints the evaluation
python NLPCapstone.py --out run.json       # the same, written to run.json
python NLPCapstone.py a.txt b.pdf c.docx   # your own articles
```

`NLPCapstone.py` writes `metrics.json` in the current folder unless you pass `--out`, so plain
`python NLPCapstone.py` overwrites the committed file (with identical content when nothing has changed).

Checked on 2026-10-14 in a fresh virtual environment with the packages above (Streamlit 1.65.0,
scikit-learn 1.9.1, Python 3.12.10):
- `streamlit run app.py` loads.
- Its demo run shows P 0.9231, R 1.0000, F1 0.9600, 12 / 1 / 0 and clustering accuracy 1.0000.
- It reads the test PDF, DOCX and TXT files.
- `NLPCapstone.py` reproduces `metrics.json` exactly.

## Known limits

- **Different file and page parsers.** The JS app reads PDFs with pdf.js, Word files with mammoth and web
  pages with the browser's HTML parser; app.py uses pypdf, python-docx and BeautifulSoup. The same file
  can produce slightly different text. Examples:
  - word spacing in PDFs
  - mammoth includes text from tables in Word files, python-docx skips it
  - badly nested HTML is parsed differently
- **PDFs need a text layer.** Scanned PDFs are reported as such; paste their text instead. Only .docx is
  supported, not the older .doc format.
- **Some sites cannot be fetched.** Some sites block automated readers (403), need a login, or build
  their text with JavaScript, and those come back empty or with an error. The helper also refuses
  addresses on your own computer or private network, gives up after 20 seconds, and stops at 5 MB.
- **`npm audit` reports 3 moderate issues** in `argparse` / `sprintf-js`. They come in through mammoth's
  command-line tool, which the browser build does not include. `npm audit fix --force` would downgrade
  mammoth to 0.3.x, so it has not been applied.
- **Empty vocabulary.** If every word in a set of sentences is a stop word, sklearn raises an error and
  app.py stops. The JS app treats those sentences as having no similarity instead.

## Layout

```
app.py, NLPCapstone.py, NLP.py, metrics.json   original Python versions (unchanged)
tools/export_fixtures.py                       golden data from app.py's own functions
tools/make_test_files.py                       test documents for the browser tests
web/src/nlp/                                   the pipeline in TypeScript (no React)
web/src/ingest/                                reading files and web pages
web/src/features/, web/src/components/         the interface
web/server/index.ts                            optional URL helper (also serves the built app)
web/e2e/                                       Playwright tests
web/PARITY.md, web/DESIGN.md                   parity notes and design decisions
```
