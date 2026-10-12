<!--
NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
SAHIL JABIR KHAN 24AD1199
-->

# Design: "The copy desk"

## Subject, audience, job

- **Subject:** several outlets' reports of the same story, compared line by line.
- **Audience:** students, examiners and editors who want to see what the outlets agree on and what only
  one of them reported.
- **Primary job:** take a pile of articles and hand back one checked consensus account, with every line
  traceable to an outlet.

The reference point is the newsroom **copy desk**, not the printed broadsheet. Reporters' copy lands on a
desk, and an editor with a blue pencil reconciles it into one story, noting in the margin where each fact
came from. The interface follows that working surface:

- the **desk** (left) holds the incoming copy and the settings;
- the **proof** (right) is the edited result;
- **margin notes** say which outlet each line came from.

## Review against the brief (what was changed and why)

| First instinct | Why it was rejected | Revised to |
|---|---|---|
| Cream newsprint background + red accent | Generic "editorial" look; cream with a warm accent is the most common generated palette | Cool white proof on a blue-grey desk, with the copy editor's **blue pencil** as the only accent |
| Broadsheet columns, hairline rules everywhere, zero radius | Reads as a newspaper pastiche, and the app is a working tool, not a newspaper | Two surfaces with different tones (desk / proof). Rules only where they separate rows of data. Small radius (4px) on controls, none on the proof sheet |
| Big stat tiles (articles / stories / redundancy) at the top of results | The default dashboard opening | The consensus lede opens every story. Counts sit in one sentence of plain prose under the story heading |
| ALL-CAPS tracked labels and monospace data labels | Template chrome | Sentence-case labels in the UI sans; figures in tabular-nums of the same sans |
| Source colour chips | Colour alone carries meaning | Every source mark is a coloured **margin bar plus the outlet's name**; colour is never the only signal |

The one bold move is the **lede with margin notes**: the consensus summary is set large in a reading
serif, and each sentence's outlet sits beside it in the right margin with that outlet's pencil colour. On
phones the margin note drops below its sentence. Everything else stays quiet.

## Palette

Tokens live in `src/styles/index.css` as CSS variables, and Tailwind reads them.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--desk` | `#D9DFE3` | `#1A2027` | App background, the left desk column |
| `--paper` | `#FCFCFA` | `#222A33` | The proof sheet and inputs |
| `--ink` | `#1C2532` | `#E7EBF0` | Body text, headings |
| `--ink-muted` | `#4F5A68` | `#A7B1BD` | Secondary text (>= 4.5:1 on paper and desk) |
| `--rule` | `#C3CBD3` | `#3A4552` | Table and row separators |
| `--pencil` | `#1D55C9` | `#8DB1FF` | The one accent: primary action, focus ring, links, selected tab |
| `--pencil-ink` | `#FFFFFF` | `#0F1A2E` | Text on the pencil colour |
| `--alert` | `#B3261E` | `#FF9B8F` | Errors |
| `--ok` | `#1E6B3A` | `#7FD49A` | Success messages |

**Source colours** (`--src-0` … `--src-7`) are pencil and highlighter colours. They were picked to be
distinguishable from one another and to reach at least 3:1 against both surfaces for the margin bars
(non-text graphics). Text is always `--ink`, never the source colour.

| | Light | Dark |
|---|---|---|
| 0 blue | `#2459C7` | `#7EA6FF` |
| 1 vermilion | `#C2410C` | `#FF9467` |
| 2 green | `#18794E` | `#5FD39A` |
| 3 purple | `#7C3AED` | `#B99BFF` |
| 4 teal | `#0F7490` | `#45C4E0` |
| 5 magenta | `#BE185D` | `#FF7AB6` |
| 6 olive | `#6B6A00` | `#D1CF4A` |
| 7 brown | `#8A5A2B` | `#D9A66E` |

Each outlet's colour is fixed by the order in which it first appears in the workspace, so it stays the
same on every tab. A ninth or later outlet reuses the colours with a dashed margin bar, so it is still
told apart by name and pattern.

## Type

- **Newsreader** (variable, optical sizes): headlines, the consensus lede, article excerpts. It was drawn
  for reading news on screens.
- **Public Sans** (variable): all UI, labels, tables and figures (with `font-variant-numeric:
  tabular-nums`). Plain and civic, with no personality to compete with the serif.

Scale (px), after the traditional typographic scale:

| Step | Size / line-height | Face | Use |
|---|---|---|---|
| xs | 12 / 16 | sans | Footnotes in tables |
| sm | 14 / 20 | sans | Labels, help text, table cells |
| base | 16 / 24 | sans | UI body |
| reading | 18 / 30 | serif | Article excerpts, exclusives |
| lede | 24 / 36 (phones 20 / 31) | serif 400 | Consensus summary |
| h2 | 30 / 36 | serif 600 | Story heading |
| h1 | 36 / 40 | serif 650 | Masthead (one per page) |

Reading measure: at most about 68 characters for the serif lede (`max-width: 34em` at 24px).

## Spacing and layout

The base unit is 4px; Tailwind's default steps (4, 8, 12, 16, 24, 32, 48) are used and nothing else.

```
1440 / 1024                                          390
┌──────────────────────────────────────────────┐     ┌────────────────────┐
│ Masthead: name · one-line purpose     theme  │     │ Masthead     theme │
├─────────────┬────────────────────────────────┤     ├────────────────────┤
│ DESK        │ PROOF                          │     │ Desk: articles     │
│ Articles    │ Story tabs                     │     │ Add  · Settings    │
│ ▌Nagar Times│ ┌────────────────────────────┐ │     │ [Run]              │
│ ▌Daily Chr. │ │ Lede sentence ......  ▌NT  │ │     ├────────────────────┤
│ Add article │ │ Lede sentence ......  ▌DC  │ │     │ Proof: tabs scroll │
│ Settings    │ └────────────────────────────┘ │     │ Lede, notes below  │
│ [Run]       │ Coverage · Only reported by …  │     │ Coverage as rows   │
└─────────────┴────────────────────────────────┘     └────────────────────┘
```

- The desk column is 360px at 1440 and 320px at 1024; it scrolls on its own and is sticky.
- Below 900px the desk stacks above the proof.
- Content is left-aligned throughout, with ragged-right text and no justification.
- The proof sheet has 48px side padding at 1440, 32px at 1024 and 16px on phones.

## Components

- **Article row:** a margin bar in the outlet colour, then the outlet name, the title or first sentence
  (one line, truncated) and "n sentences · event". Edit and remove are icon buttons with text labels for
  screen readers.
- **Buttons:** primary = pencil fill; secondary = paper with a rule border; quiet = text only. Every
  button has a visible label, and busy states keep the label ("Running…").
- **Focus:** a 2px pencil outline with a 2px offset on every interactive element.
- **Settings:** sliders with the value printed beside them and a one-line explanation under each. A
  "Settings changed — run again to update" note appears when the settings differ from the last run.

## Charts

- **Threshold sweep:** hand-drawn SVG line chart with precision, recall and F1 as three lines in
  `--ink`, `--pencil` and `--ink-muted`. The lines use different dash patterns and are labelled directly
  at their right end, with no legend box.
- The x-axis is τ_uniq (0.10–0.40) and the y-axis 0–1, with light rule gridlines at 0.5 and 1.
- The current τ_uniq is a vertical pencil line labelled with its value.
- Every chart has a table equivalent directly under it.
- **Coverage matrix:** sources as rows and summary sentences S1…Sk as columns. A filled pencil square
  plus a ✓ glyph means "reports this"; an empty outlined square plus "—" means it doesn't. On phones it
  turns into one block per summary sentence listing the outlets that report it.

## Motion

- One orchestrated moment: when a run finishes, the lede sentences appear one after another (opacity
  only, 40ms apart).
- Everything else answers an action: tab underline slides, dialogs fade in, a row being removed
  collapses.
- `prefers-reduced-motion: reduce` turns all of it off.

## Voice

- Plain, active, sentence case.
- Actions are named by their effect, and the same name carries through: "Add article" → "Article
  added".
- Errors say what happened and what to do next ("This PDF has no text layer — it is probably a scan.
  Paste the text instead.").
