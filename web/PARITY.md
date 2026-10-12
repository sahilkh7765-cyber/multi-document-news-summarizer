<!--
NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
SAHIL JABIR KHAN 24AD1199
-->

# Parity with the Python pipeline

The TypeScript pipeline in `src/nlp/` is a port of `run_pipeline` and its helpers in `app.py`.
Parity is checked against golden output from the Python code itself, not against a re-implementation.

## How it is checked

```powershell
python tools/export_fixtures.py     # from the repo root; writes web/fixtures/*.json
cd web; npm test                     # vitest
```

`tools/export_fixtures.py` parses `app.py` with `ast` and executes its imports, constants and function
definitions unchanged (only the Streamlit UI statements are skipped). It then calls app.py's own
`run_pipeline`, `split_sentences`, `parse_header`, `make_article`, `unique_sources`, `toks`, `rouge_n`,
`rouge_l` and `distinct`. It also re-runs `NLPCapstone.py` into a temp file and stops if the result is
not identical to `metrics.json`.

| Fixture | Contents |
|---|---|
| `pipeline_runs.json` | 6 corpora x 8 (delta, tau_dup, tau_uniq, k) sets = 48 runs: full `run_pipeline` output, ROUGE/Distinct per story, cluster labels, merge tree, threshold gaps and tie analysis |
| `tfidf_demo.json` | Demo-corpus vocabulary, idf, every CSR row in storage order, document distance matrix |
| `text_cases.json` | Sentence splitting, `toks`, `parse_header`, `make_article`, `unique_sources`, ROUGE and Distinct cases |
| `unicode_table.json` | 6,300 sampled code points: `isalnum`, `isspace`, `re \w`, `lower()`, category |
| `stop_words.json` | sklearn's `ENGLISH_STOP_WORDS` |

Corpora: `demo` (app.py's "Load demo corpus"), `custom` (6 raw articles with headers, abbreviations, curly
quotes, a duplicate source name and a single-source story), `unrelated` (4 articles sharing no terms, so
every merge distance is exactly 1.0, which stresses tie handling in the merge tree), `demo_unlabelled` (no
events, no fact ids), `single` (one article) and `two_stories`.

Parameter sets: the app.py defaults (0.85, 0.20, 0.20, 5), which produce `metrics.json`, plus
(0.50, 0.20, 0.20, 5), (0.99, 0.20, 0.20, 5), (0.70, 0.10, 0.30, 3), (0.90, 0.40, 0.10, 8),
(0.60, 0.05, 0.60, 2), (0.85, 0.60, 0.05, 10) and (0.95, 0.30, 0.25, 4).

What the tests require:

- **Identical:** cluster partitions *and* sklearn's label order (it decides story order and "Story N"
  names), pool sizes, consensus summaries and their sources, exclusives (including key order), coverage,
  sweep counts, TP/FP/FN, LEAD-2 text, sentence splits, tokens, headers.
- **Within 1e-9:** cluster accuracy, ROUGE-1/2/L, Distinct-1/2, sweep P/R/F.
- **`metrics.json`:** P 0.9231, R 1.0, F 0.96, TP 12, FP 1, FN 0, cluster_acc 1.0, the sweep, per-story
  summaries/exclusives, the first 5 keywords (app.py shows 6), and the mean ROUGE/Distinct rows for LEAD-2
  and the pipeline.

Result at the time of writing: **711 tests pass**. Environment: Python 3.12.10, numpy 2.5.4,
scipy 1.18.1, sklearn 1.9.1 and Node 24.20.

## Numerical margin

The port reproduces sklearn's arithmetic order wherever it was cheap to do so:
- Row terms are stored in the order of each term's first appearance in the corpus, as sklearn's CSR does.
  This fixes the summation order of norms and dot products.
- `cosine_similarity` normalises a second time.
- The centroid is `sum(row * (1/m))`, as scipy's sparse mean computes it.
- idf is `ln((n+1)/(df+1)) + 1`.

The remaining difference comes from `Math.log` versus numpy's `log`:

| Quantity (demo corpus) | max \|TS - Python\| |
|---|---|
| idf | 2.2e-16 |
| TF-IDF values | 1.1e-16 |
| document distances | 3.3e-16 |

The exporter records, for every comparison the pipeline makes, how far the value was from its threshold.
Minimum over all 48 runs:

| Decision | Minimum gap |
|---|---|
| tau_uniq (detection, incl. sweep) | 8.8e-05 |
| keyword ordering (non-tied neighbours) | 1.0e-04 |
| per-article centrality cut-off | 1.1e-04 |
| consensus centrality cut-off | 3.2e-04 |
| merge-distance ordering | 5.8e-04 |
| tau_dup | 1.1e-03 |
| coverage (tau_uniq) | 1.6e-03 |
| delta (cluster cut) | 2.4e-03 |

Every gap is at least 11 orders of magnitude larger than the float differences. So, as agreed, the
simple implementations are used: a plain greedy average-linkage instead of scipy's nn-chain,
left-to-right sums instead of numpy's pairwise summation, and regex Unicode classes checked on a sampled
table. If a future input lands within ~1e-15 of a threshold, the two implementations could disagree on
that one decision.

## Where exact parity is not possible

### 1. `np.argsort` tie-breaking (keywords, per-article summaries)

app.py uses `np.argsort` in two places:
- keywords: `centroid.argsort()[::-1][:6]`
- `centrality_pick`: `np.argsort(-cen)[:k]`

numpy 2.x's default `argsort` dispatches to a SIMD sort that is **not stable**. On the reference machine
(AVX2), it disagreed with a stable sort in 37 of 200 random tied arrays of length 5, and in every array of
length 16 or more. The Python output for tied values therefore depends on the numpy version and the CPU.

Ties are common:
- **Keywords:** terms with the same tf and df in the same article get identical centroid weights. In the
  demo, E3 has a 3-way tie across positions 6 to 8.
- **Per-article summaries:** sentences that share no terms with the rest of the article all have
  centrality 0.

The TS port breaks ties deterministically, the way `np.argsort(kind='stable')` would:
- keywords: equal weights put the higher vocabulary index first, because of the `[::-1]`
- `centrality_pick`: equal centrality puts the lower sentence index first

Across the fixtures, 133 keyword lists and 83 per-article summaries depend on ties. Neither direction of
stable tie-breaking reproduces this machine's numpy order:
- keyword lists identical to numpy's: 0 of 133 with the rule above, 2 of 133 with the opposite rule
- per-article summaries identical to numpy's: 62 of 83

For these outputs the tests check what *is* determined:
- every keyword equals Python's keyword in value at that position, i.e. it comes from the same tie group;
- every per-article summary contains the sentences that must be picked, plus the right number from the
  tied group.

Untied outputs, including the first five demo keywords that `metrics.json` records, must match exactly.

The consensus summary uses Python's `sorted()`, which is stable, so it is reproduced exactly. In the merge
tree, the `unrelated` corpus has only tied merge distances and its labels still match.

### 2. Unicode database version

Python 3.12 ships Unicode 15.0 and Node 24's ICU is newer. 14 of the 6,300 sampled code points are
unassigned (`Cn`) in Python but letters in JS, for example U+A7CC. The table test therefore compares only
code points that Python considers assigned. All other sampled characters agree on `isalnum`, `isspace`,
`\w` and `lower()`.

### 3. Python `re.IGNORECASE` versus JS `/iu`

Python matches `i` against U+0130 `İ` and U+0131 `ı` under `re.I`; JS case folding does not. The `i` in
app.py's patterns (`title`, `Inc`, `i.e`) is spelled out as `[iİı]`, and fixture cases cover it.
ſ↔s and the Kelvin sign↔k fold the same way in both engines.

## Intentional differences from app.py

| app.py | TS port | Why |
|---|---|---|
| `unique_sources` can still produce duplicates: `["A", "A", "A (2)"]` gives `A, A (2), A (2)`. The two articles named `A (2)` are then treated as one source. | The suffix number keeps increasing until the name is free: `A, A (2), A (2) (2)`. Non-colliding inputs give exactly app.py's names (tested). | Bug fix, agreed. The collision cases are excluded from parity. |
| `unique_sources` mutates the stored articles on every run | Applied to a copy at run time; the workspace shows the resulting names | Same output; avoids hidden state |
| `TfidfVectorizer` raises "empty vocabulary" when every token is a stop word, which crashes the run | All-zero vectors: similarities are 0, so nothing is merged or deduplicated | A crash is not a useful result |
| `exclusive` / `coverage` are dicts | JS objects with the same keys | Integer-like source names (e.g. `"2024"`) would be ordered first by JS. The UI orders by the `sources` array, so only the raw JSON key order can differ. |

## Outside the parity scope

The input parsers are different software from app.py's:
- PDF: pdfjs-dist instead of pypdf
- DOCX: mammoth instead of python-docx
- URLs: the browser's `DOMParser` instead of BeautifulSoup's `html.parser`

They may produce different raw text from the same file. Once the text exists, everything downstream
(`parse_header`, sentence splitting, the pipeline) is covered by the tests above.
