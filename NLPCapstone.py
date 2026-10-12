#NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
#SAHIL JABIR KHAN 24AD1199
#
# USAGE
#   python NLP.py                                   -> runs on the built-in demo corpus (with full evaluation)
#   python NLP.py a.txt b.pdf c.docx                -> runs on your own articles (one file = one source)
#   python NLP.py --dir articles/                   -> runs on every .txt/.md/.pdf/.docx in a folder
#   python NLP.py https://site.com/news-story ...   -> fetches articles from URLs
#   python NLP.py --pick                            -> opens a file picker to choose articles
#   python NLP.py a.txt b.txt --ref reference.txt   -> also scores ROUGE against a reference summary
#
# OPTIONAL HEADER LINES at the top of a .txt/.md article (all optional):
#   Source: Daily Chronicle        (defaults to the file name / website domain)
#   Event: E1                      (if every article has one, clustering accuracy is also reported)
#   Title: Metro line opens        (title line is dropped from the body)
#
# Extra packages only needed for those formats:  pypdf (PDF), python-docx (DOCX), beautifulsoup4 (URLs)

import os
import re
import sys
import glob
import json
import argparse
import numpy as np
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

np.random.seed(42)

# ------------------------------------------------------------------ DEMO CORPUS
# Controlled multi-source corpus. Each sentence carries a fact id.
# A fact reported by only one source is ground-truth source-exclusive.

DEMO_CORPUS = [
 # ---------------- EVENT 1 : METRO LINE EXTENSION ----------------
 {"event":"E1","source":"Nagar Times","sents":[
  ("The Coastal Metro Line 4 extension was formally opened on Tuesday by the state transport minister.","c1"),
  ("The new stretch adds 11.4 kilometres of track and nine additional stations to the network.","c2"),
  ("It connects Sector 22 in the western suburbs directly to Harbour Junction.","c3"),
  ("Officials placed the total project cost at 4,850 crore rupees.","c4"),
  ("Daily ridership on the extended corridor is expected to reach 2.1 lakh passengers.","c5"),
  ("The extension was completed roughly 14 months behind its original schedule.","c6"),
  ("Fares on the new stretch have been frozen for the first three months of operation.","e1a")]},
 {"event":"E1","source":"Daily Chronicle","sents":[
  ("The state transport minister inaugurated the Coastal Metro Line 4 extension on Tuesday morning.","c1"),
  ("Nine new stations and 11.4 kilometres of track have been added to the existing corridor.","c2"),
  ("The line now runs from Sector 22 through to Harbour Junction without an interchange.","c3"),
  ("The project carried a final cost of 4,850 crore rupees according to the transport department.","c4"),
  ("Completion came 14 months later than the schedule announced at groundbreaking.","c6"),
  ("Around 240 families were relocated from the alignment during construction of the corridor.","e1b")]},
 {"event":"E1","source":"Metro Mirror","sents":[
  ("Tuesday saw the opening of the Coastal Metro Line 4 extension by the transport minister.","c1"),
  ("The extension brings nine stations and 11.4 kilometres of new track into service.","c2"),
  ("Trains will now travel from Sector 22 to Harbour Junction on a single line.","c3"),
  ("Ridership of about 2.1 lakh passengers a day is projected for the corridor.","c5"),
  ("The corridor opened 14 months after the deadline set at the start of work.","c6"),
  ("The leader of the opposition described the cost overrun on the project as unacceptable.","e1c")]},
 {"event":"E1","source":"Civic Herald","sents":[
  ("The transport minister opened the Coastal Metro Line 4 extension to the public on Tuesday.","c1"),
  ("Passengers can now ride from Sector 22 to Harbour Junction without changing trains.","c3"),
  ("The transport department put the cost of the work at 4,850 crore rupees.","c4"),
  ("Projected daily ridership for the new section stands at 2.1 lakh passengers.","c5"),
  ("Three of the nine new stations still have no working lift access for passengers.","e1d")]},

 # ---------------- EVENT 2 : STATE CRICKET FINAL ----------------
 {"event":"E2","source":"Nagar Times","sents":[
  ("State XI defeated Northern XI by six wickets in the final on Sunday evening.","d1"),
  ("The side chased down a target of 214 runs inside 48 overs.","d2"),
  ("Captain Rehan Sethi finished unbeaten on 96 to carry the innings.","d3"),
  ("The win gives State XI their first title in twelve years.","d4"),
  ("The final was played at Green Park Stadium in front of a full house.","d5"),
  ("Northern XI seamer Aditya Rao claimed four wickets in a losing cause.","d6"),
  ("A crowd of roughly 28,000 spectators attended the match.","e2a")]},
 {"event":"E2","source":"Daily Chronicle","sents":[
  ("A six wicket win over Northern XI on Sunday handed the trophy to State XI.","d1"),
  ("The target of 214 was overhauled with two overs to spare in the 48th.","d2"),
  ("An unbeaten 96 from captain Rehan Sethi anchored the successful chase.","d3"),
  ("It is the first time in twelve years that State XI have won the competition.","d4"),
  ("Aditya Rao took four wickets for Northern XI but could not stop the chase.","d6"),
  ("Prize money for the competition was doubled by the board this season.","e2b")]},
 {"event":"E2","source":"Metro Mirror","sents":[
  ("State XI beat Northern XI by six wickets to lift the title on Sunday.","d1"),
  ("Captain Rehan Sethi remained not out on 96 as the chase was completed.","d3"),
  ("The victory ends a twelve year wait for silverware at the state association.","d4"),
  ("Green Park Stadium hosted the final in front of a capacity crowd.","d5"),
  ("Sethi indicated after the match that he is considering retirement from the format.","e2c")]},
 {"event":"E2","source":"Civic Herald","sents":[
  ("Northern XI were beaten by six wickets in Sunday's final at Green Park Stadium.","d1"),
  ("State XI needed 214 to win and reached the total in 48 overs.","d2"),
  ("The unbeaten innings of 96 by Rehan Sethi proved to be the difference.","d3"),
  ("Green Park Stadium was the venue for the final on Sunday.","d5"),
  ("Four wickets from Aditya Rao briefly gave Northern XI hope of defending the total.","d6"),
  ("Rain delayed the start of play by forty minutes on the morning of the final.","e2d")]},

 # ---------------- EVENT 3 : DATA CENTRE INVESTMENT ----------------
 {"event":"E3","source":"Nagar Times","sents":[
  ("The technology firm announced an investment of 3,200 crore rupees in a new data centre.","f1"),
  ("The facility will come up near the Panvel industrial belt on the outskirts of the city.","f2"),
  ("The company expects the project to create 1,400 direct jobs.","f3"),
  ("The data centre is scheduled to be operational by 2028.","f4"),
  ("A large share of the power for the site will be drawn from solar generation.","f5"),
  ("A memorandum of understanding was signed with the state government this week.","f6"),
  ("The land parcel acquired for the facility measures 62 acres.","e3a")]},
 {"event":"E3","source":"Daily Chronicle","sents":[
  ("An investment of 3,200 crore rupees in a data centre was announced by the technology firm.","f1"),
  ("Panvel industrial belt has been selected as the location for the new facility.","f2"),
  ("The project is expected to generate 1,400 direct jobs once complete.","f3"),
  ("Operations at the data centre are targeted to begin in 2028.","f4"),
  ("The state government and the company signed a memorandum of understanding this week.","f6"),
  ("The local civic body has raised concerns about the water consumption of the facility.","e3b")]},
 {"event":"E3","source":"Metro Mirror","sents":[
  ("The technology company will put 3,200 crore rupees into a new data centre project.","f1"),
  ("The site chosen is close to the Panvel industrial belt.","f2"),
  ("Around 1,400 direct jobs are expected to follow from the investment.","f3"),
  ("Solar generation will supply much of the electricity required by the site.","f5"),
  ("A memorandum of understanding with the state was signed earlier in the week.","f6"),
  ("A second phase of the project is planned and will depend on demand.","e3c")]},
 {"event":"E3","source":"Civic Herald","sents":[
  ("A data centre investment of 3,200 crore rupees was confirmed by the technology firm.","f1"),
  ("The facility is planned near the Panvel industrial belt.","f2"),
  ("The company has said 1,400 direct jobs will be created.","f3"),
  ("The centre is expected to be running by 2028.","f4"),
  ("Solar power will meet a large part of the energy demand at the site.","f5"),
  ("The firm has been granted a five year exemption from state tax on the project.","e3d")]},
]

DEMO_REFERENCES = {
 "E1": ("The state transport minister opened the Coastal Metro Line 4 extension on Tuesday. "
        "The stretch adds 11.4 kilometres of track and nine stations, linking Sector 22 with Harbour Junction. "
        "The transport department put the cost at 4,850 crore rupees. "
        "Daily ridership is projected at 2.1 lakh passengers. "
        "The corridor opened 14 months behind schedule."),
 "E2": ("State XI beat Northern XI by six wickets in Sunday's final at Green Park Stadium. "
        "The side chased 214 in 48 overs, with captain Rehan Sethi unbeaten on 96. "
        "Aditya Rao took four wickets for Northern XI. "
        "The result gives State XI their first title in twelve years."),
 "E3": ("A technology firm announced a 3,200 crore rupee data centre near the Panvel industrial belt. "
        "The project is expected to create 1,400 direct jobs and to be operational by 2028. "
        "Much of the power for the site will come from solar generation. "
        "A memorandum of understanding was signed with the state government."),
}

TAU_DUP, TAU_UNIQ, DELTA, SUMMARY_SENTS = 0.20, 0.20, 0.85, 5
MIN_WORDS = 5                     # sentences shorter than this (bylines, captions) are dropped
ARTICLE_EXT = ('.txt', '.md', '.pdf', '.docx')

# ------------------------------------------------------------------ HELPERS
def toks(t):
    return [w for w in ''.join(c.lower() if c.isalnum() or c.isspace() else ' ' for c in t).split()]

def ngrams(t, n):
    w = toks(t)
    return [tuple(w[i:i+n]) for i in range(len(w)-n+1)]

def rouge_n(cand, ref, n):
    c, r = ngrams(cand, n), ngrams(ref, n)
    if not r or not c: return 0.0, 0.0, 0.0
    cc, rc = defaultdict(int), defaultdict(int)
    for g in c: cc[g] += 1
    for g in r: rc[g] += 1
    ov = sum(min(cc[g], rc[g]) for g in cc)
    p, rr = ov/len(c), ov/len(r)
    return p, rr, 0.0 if p+rr == 0 else 2*p*rr/(p+rr)

def rouge_l(cand, ref):
    a, b = toks(cand), toks(ref)
    if not a or not b: return 0.0
    dp = [[0]*(len(b)+1) for _ in range(len(a)+1)]
    for i in range(1, len(a)+1):
        for j in range(1, len(b)+1):
            dp[i][j] = dp[i-1][j-1]+1 if a[i-1] == b[j-1] else max(dp[i-1][j], dp[i][j-1])
    l = dp[-1][-1]
    p, r = l/len(a), l/len(b)
    return 0.0 if p+r == 0 else 2*p*r/(p+r)

def distinct(text, n):
    g = ngrams(text, n)
    return 0.0 if not g else len(set(g))/len(g)

# ------------------------------------------------------------------ ARTICLE LOADING
ABBR = r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|Govt|Gov|Gen|Col|Lt|No|Rs|Nos|approx|U\.S|U\.K|e\.g|i\.e)\.'

def split_sentences(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(ABBR, lambda m: m.group(0).replace('.', '<DOT>'), text, flags=re.I)
    parts = re.split(r'(?:(?<=[.!?])|(?<=[.!?]["\'”’)\]]))\s+(?=["\'“‘(\[]?[A-Z0-9])', text)
    out = []
    for p in parts:
        p = p.replace('<DOT>', '.').strip()
        if len(toks(p)) >= MIN_WORDS:
            out.append(p)
    return out

def read_pdf(path):
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("PDF support needs pypdf:  pip install pypdf")
    return '\n'.join((pg.extract_text() or '') for pg in PdfReader(path).pages)

def read_docx(path):
    try:
        import docx
    except ImportError:
        sys.exit("DOCX support needs python-docx:  pip install python-docx")
    return '\n'.join(p.text for p in docx.Document(path).paragraphs)

def read_url(url):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        paras = [p.get_text(' ', strip=True) for p in soup.find_all('p')]
        return '\n'.join(p for p in paras if len(p.split()) >= MIN_WORDS)
    except ImportError:
        html = re.sub(r'(?is)<(script|style).*?</\1>', ' ', html)
        return re.sub(r'<[^>]+>', ' ', html)

def parse_header(text):
    """Pull optional 'Source:', 'Event:', 'Title:' lines off the top of an article."""
    meta, lines = {}, text.splitlines()
    while lines:
        line = lines[0].strip()
        m = re.match(r'^(source|event|title)\s*:\s*(.+)$', line, re.I)
        if m:
            meta[m.group(1).lower()] = m.group(2).strip()
            lines.pop(0)
        elif not line:
            lines.pop(0)
        else:
            break
    return meta, '\n'.join(lines)

def load_article(path):
    if path.lower().startswith(('http://', 'https://')):
        raw = read_url(path)
        default_src = re.sub(r'^www\.', '', path.split('/')[2])
    else:
        ext = os.path.splitext(path)[1].lower()
        raw = read_pdf(path) if ext == '.pdf' else read_docx(path) if ext == '.docx' \
              else open(path, encoding='utf-8', errors='ignore').read()
        default_src = os.path.splitext(os.path.basename(path))[0]
    meta, body = parse_header(raw)
    sents = split_sentences(body)
    if not sents:
        print("  [skip] no usable sentences found in", path)
        return None
    return {"event": meta.get("event"), "source": meta.get("source", default_src),
            "sents": [(s, None) for s in sents], "path": path}

def pick_files():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk(); root.withdraw()
        files = filedialog.askopenfilenames(title="Select news articles",
                    filetypes=[("Articles", "*.txt *.md *.pdf *.docx"), ("All files", "*.*")])
        root.destroy()
        return list(files)
    except Exception as e:
        sys.exit("Could not open a file picker (%s). Pass file paths on the command line instead." % e)

def read_text_file(path):
    ext = os.path.splitext(path)[1].lower()
    return read_pdf(path) if ext == '.pdf' else read_docx(path) if ext == '.docx' \
           else open(path, encoding='utf-8', errors='ignore').read()

# ------------------------------------------------------------------ ARGUMENTS
ap = argparse.ArgumentParser(description="Multi-document news summarization with cross-source comparison")
ap.add_argument("articles", nargs="*", help="article files (.txt .md .pdf .docx) or URLs; one per source")
ap.add_argument("--dir", help="folder containing article files")
ap.add_argument("--pick", action="store_true", help="choose article files with a file dialog")
ap.add_argument("--ref", nargs="*", default=[], help="optional reference summary file(s) for ROUGE")
ap.add_argument("--delta", type=float, default=DELTA, help="clustering distance threshold (default 0.85)")
ap.add_argument("--sents", type=int, default=SUMMARY_SENTS, help="sentences in each summary (default 5)")
ap.add_argument("--out", default="metrics.json", help="where to save the JSON output")
args, _unknown = ap.parse_known_args()      # parse_known_args keeps it working inside Jupyter
DELTA, SUMMARY_SENTS = args.delta, args.sents

paths = [a for a in args.articles if not a.endswith('.json')]
if args.dir:
    paths += sorted(p for p in glob.glob(os.path.join(args.dir, '*')) if p.lower().endswith(ARTICLE_EXT))
if args.pick:
    paths += pick_files()

if paths:
    MODE = "user"
    print("Loading %d article(s)..." % len(paths))
    CORPUS = [a for a in (load_article(p) for p in paths) if a]
    if not CORPUS:
        sys.exit("None of the given articles contained usable text.")
    seen = defaultdict(int)                    # make duplicate source names unique
    for d in CORPUS:
        seen[d["source"]] += 1
        if seen[d["source"]] > 1:
            d["source"] = "%s (%d)" % (d["source"], seen[d["source"]])
    REF_TEXTS = [' '.join(split_sentences(parse_header(read_text_file(r))[1])) for r in args.ref]
else:
    MODE = "demo"
    print("No articles given - running on the built-in demo corpus. (python NLP.py --help for options)")
    CORPUS = DEMO_CORPUS
    REF_TEXTS = []

HAS_EVENT = all(d.get("event") for d in CORPUS)                      # clustering can be scored
HAS_FACTS = all(f is not None for d in CORPUS for _, f in d["sents"])  # divergence can be scored

# ------------------------------------------------------------------ STAGE 1 : CLUSTERING
docs = [' '.join(s for s, _ in d["sents"]) for d in CORPUS]
doc_vec = TfidfVectorizer(stop_words='english', sublinear_tf=True)
dv = doc_vec.fit_transform(docs)
vocab = np.array(doc_vec.get_feature_names_out())

if len(docs) == 1:
    labels = np.array([0])
else:
    D = 1 - cosine_similarity(dv)
    np.fill_diagonal(D, 0)
    D[D < 0] = 0
    labels = AgglomerativeClustering(n_clusters=None, distance_threshold=DELTA,
                                     metric='precomputed', linkage='average').fit_predict(D)
CLUSTERS = sorted(set(labels))

def cluster_name(cl):
    members = [i for i in range(len(docs)) if labels[i] == cl]
    evs = {CORPUS[i]["event"] for i in members}
    if HAS_EVENT and len(evs) == 1:
        return evs.pop()
    return "C%d" % (CLUSTERS.index(cl) + 1)

def cluster_keywords(cl, k=5):
    members = [i for i in range(len(docs)) if labels[i] == cl]
    centroid = np.asarray(dv[members].mean(axis=0)).ravel()
    return list(vocab[centroid.argsort()[::-1][:k]])

cluster_acc = None
print("="*74)
print("STAGE 1  EVENT CLUSTERING")
print("="*74)
print("mode                     :", "built-in demo corpus" if MODE == "demo" else "user-supplied articles")
print("documents                :", len(docs))
print("clusters formed          :", len(CLUSTERS),
      " (gold = %d)" % len({d['event'] for d in CORPUS}) if HAS_EVENT else "")
if HAS_EVENT and len(docs) > 1:
    gold_event = [d["event"] for d in CORPUS]
    pair_ok = pair_tot = 0
    for i in range(len(docs)):
        for j in range(i+1, len(docs)):
            pair_tot += 1
            if (labels[i] == labels[j]) == (gold_event[i] == gold_event[j]): pair_ok += 1
    cluster_acc = pair_ok/pair_tot
    print("pairwise clustering acc. : %.4f" % cluster_acc)
for cl in CLUSTERS:
    mem = [CORPUS[i]["source"] for i in range(len(docs)) if labels[i] == cl]
    print("  cluster %s -> %s   keywords: %s" % (cluster_name(cl), mem, ', '.join(cluster_keywords(cl))))
if len(docs) == 1:
    print("  note: only one article given - cross-source comparison needs 2+ articles on the same story.")

# ------------------------------------------------------------------ PER-CLUSTER PIPELINE
results, sweep_rows, all_outputs = [], [], []

def run_cluster(idx, tau_dup=TAU_DUP, tau_uniq=TAU_UNIQ, verbose=True):
    members = [i for i in range(len(docs)) if labels[i] == idx]
    ev = cluster_name(idx)
    sents, srcs, facts = [], [], []
    for m in members:
        for s, f in CORPUS[m]["sents"]:
            sents.append(s); srcs.append(CORPUS[m]["source"]); facts.append(f)

    V = TfidfVectorizer(stop_words='english', sublinear_tf=True).fit_transform(sents)
    S = cosine_similarity(V)
    np.fill_diagonal(S, 0)

    # redundancy reduction
    pool = []
    for i in range(len(sents)):
        if not pool or max(S[i][p] for p in pool) < tau_dup:
            pool.append(i)

    # consensus summary : centrality over the reduced pool
    if len(pool) == 1:
        cen = {pool[0]: 0.0}
    else:
        cen = {i: float(np.mean([S[i][j] for j in pool if j != i])) for i in pool}
    top = sorted(sorted(cen, key=lambda i: -cen[i])[:SUMMARY_SENTS])
    summary = ' '.join(sents[i] for i in top)

    # divergence detection (only meaningful when 2+ sources are in the cluster)
    multi = len(set(srcs)) > 1
    pred = []
    for i in range(len(sents)):
        other = [j for j in range(len(sents)) if srcs[j] != srcs[i]]
        pred.append(1 if (other and max(S[i][j] for j in other) < tau_uniq) else 0)

    tp = fp = fn = None
    if HAS_FACTS:
        fact_src = defaultdict(set)
        for f, s in zip(facts, srcs): fact_src[f].add(s)
        gold = [1 if len(fact_src[f]) == 1 else 0 for f in facts]
        tp = sum(1 for p, g in zip(pred, gold) if p == 1 and g == 1)
        fp = sum(1 for p, g in zip(pred, gold) if p == 1 and g == 0)
        fn = sum(1 for p, g in zip(pred, gold) if p == 0 and g == 1)

    if verbose:
        exc = defaultdict(list)
        for i in range(len(sents)):
            if pred[i] == 1: exc[srcs[i]].append(sents[i])
        all_outputs.append({"event": ev, "n_src": len(members), "n_sent": len(sents),
                            "pool": len(pool), "summary_sents": [sents[i] for i in top],
                            "summary": summary, "multi_source": multi,
                            "keywords": cluster_keywords(idx),
                            "exclusive": {k: v for k, v in exc.items()}})
    return dict(event=ev, n_src=len(members), n_sent=len(sents), pool=len(pool),
                summary=summary, detected=sum(pred), tp=tp, fp=fp, fn=fn)

for cl in CLUSTERS:
    results.append(run_cluster(cl))

# ------------------------------------------------------------------ STAGE 2-4 : OUTPUT
print()
print("="*74)
print("STAGE 2-4  SYSTEM OUTPUT PER EVENT CLUSTER")
print("="*74)
for o in all_outputs:
    print()
    print("EVENT CLUSTER %s   sources = %d   sentences = %d   pool = %d"
          % (o["event"], o["n_src"], o["n_sent"], o["pool"]))
    print("-"*74)
    print("CONSENSUS SUMMARY" if o["multi_source"] else "SUMMARY (single source)")
    for s in o["summary_sents"]:
        print("  " + s)
    print()
    if not o["multi_source"]:
        print("(no cross-source comparison - this story has only one source)")
    elif not o["exclusive"]:
        print("(no source-exclusive details detected)")
    for src, lines in o["exclusive"].items():
        print("REPORTED ONLY BY %s" % src.upper())
        for l in lines: print("  - " + l)
    print()

# ------------------------------------------------------------------ STAGE 5 : METRICS
print("="*74)
print("STAGE 5  EVALUATION")
print("="*74)

def lead_baseline(idx, k=SUMMARY_SENTS):
    members = [i for i in range(len(docs)) if labels[i] == idx]
    out = []
    for m in members:
        for s, _ in CORPUS[m]["sents"][:2]:
            out.append(s)
    return ' '.join(out[:k])

# reference summaries: demo uses its built-in ones; user refs are matched to the most similar cluster
refs = {}
if MODE == "demo":
    refs = {cl: DEMO_REFERENCES[cluster_name(cl)] for cl in CLUSTERS if cluster_name(cl) in DEMO_REFERENCES}
elif REF_TEXTS:
    cl_text = [' '.join(docs[i] for i in range(len(docs)) if labels[i] == cl) for cl in CLUSTERS]
    rv = TfidfVectorizer(stop_words='english').fit(cl_text + REF_TEXTS)
    sim = cosine_similarity(rv.transform(REF_TEXTS), rv.transform(cl_text))
    for r_i, ref in enumerate(REF_TEXTS):
        refs[CLUSTERS[int(sim[r_i].argmax())]] = ref

print()
agg = {"lead": [], "sys": []}
if refs:
    print("%-26s %8s %8s %8s %8s %8s" % ("SYSTEM / EVENT", "R-1", "R-2", "R-L", "D-1", "D-2"))
else:
    print("(no reference summary given - ROUGE skipped; pass --ref summary.txt to enable it)")
    print("%-26s %8s %8s" % ("SYSTEM / EVENT", "D-1", "D-2"))
print("-"*74)
for cl, r in zip(CLUSTERS, results):
    lead = lead_baseline(cl)
    for name, cand, key in (("LEAD-2  " + r["event"], lead, "lead"), ("PIPELINE " + r["event"], r["summary"], "sys")):
        d1 = distinct(cand, 1); d2 = distinct(cand, 2)
        if refs:
            ref = refs.get(cl)
            if ref is None: continue
            r1 = rouge_n(cand, ref, 1)[2]; r2 = rouge_n(cand, ref, 2)[2]; rl = rouge_l(cand, ref)
            agg[key].append((r1, r2, rl, d1, d2))
            print("%-26s %8.4f %8.4f %8.4f %8.4f %8.4f" % (name, r1, r2, rl, d1, d2))
        else:
            agg[key].append((d1, d2))
            print("%-26s %8.4f %8.4f" % (name, d1, d2))
print("-"*74)
for key, nm in (("lead", "LEAD-2 baseline  MEAN"), ("sys", "THIS PIPELINE    MEAN")):
    if agg[key]:
        m = np.mean(np.array(agg[key]), axis=0)
        print(("%-26s" + " %8.4f"*len(m)) % ((nm,) + tuple(m)))

P = R = F = TP = FP = FN = None
print()
if HAS_FACTS:
    TP = sum(r["tp"] for r in results); FP = sum(r["fp"] for r in results); FN = sum(r["fn"] for r in results)
    P = TP/(TP+FP) if TP+FP else 0.0
    R = TP/(TP+FN) if TP+FN else 0.0
    F = 2*P*R/(P+R) if P+R else 0.0
    print("DIVERGENCE DETECTION  (tau_uniq = %.2f)" % TAU_UNIQ)
    print("  true positives  :", TP)
    print("  false positives :", FP)
    print("  false negatives :", FN)
    print("  precision       : %.4f" % P)
    print("  recall          : %.4f" % R)
    print("  f1 score        : %.4f" % F)
else:
    print("DIVERGENCE DETECTION  (tau_uniq = %.2f)" % TAU_UNIQ)
    print("  source-exclusive sentences flagged :", sum(r["detected"] for r in results))
    print("  (precision/recall need fact-labelled data, so they are only shown for the demo corpus)")

tot_s = sum(r["n_sent"] for r in results); tot_p = sum(r["pool"] for r in results)
print()
print("REDUNDANCY REDUCTION  (tau_dup = %.2f)" % TAU_DUP)
print("  sentences before : %d   (mean %.2f per cluster)" % (tot_s, tot_s/len(results)))
print("  sentences after  : %d   (mean %.2f per cluster)" % (tot_p, tot_p/len(results)))
print("  compression      : %.2f %%" % (100*(1-tot_p/tot_s)))

print()
print("THRESHOLD SENSITIVITY  (tau_uniq)")
if HAS_FACTS:
    print("  %-10s %8s %8s %8s %8s" % ("tau_uniq", "detected", "prec", "rec", "f1"))
else:
    print("  %-10s %8s" % ("tau_uniq", "detected"))
for t in (0.10, 0.15, 0.20, 0.25, 0.30, 0.40):
    rr_all = [run_cluster(cl, tau_uniq=t, verbose=False) for cl in CLUSTERS]
    det = sum(rr["detected"] for rr in rr_all)
    if HAS_FACTS:
        a = sum(rr["tp"] for rr in rr_all); b = sum(rr["fp"] for rr in rr_all); c = sum(rr["fn"] for rr in rr_all)
        p = a/(a+b) if a+b else 0.0
        q = a/(a+c) if a+c else 0.0
        f = 2*p*q/(p+q) if p+q else 0.0
        sweep_rows.append((t, det, p, q, f))
        print("  %-10.2f %8d %8.4f %8.4f %8.4f" % (t, det, p, q, f))
    else:
        sweep_rows.append((t, det))
        print("  %-10.2f %8d" % (t, det))

with open(args.out, 'w', encoding='utf-8') as fh:
    json.dump({"mode": MODE, "cluster_acc": cluster_acc, "results": results,
               "P": P, "R": R, "F": F, "TP": TP, "FP": FP, "FN": FN,
               "tot_s": tot_s, "tot_p": tot_p, "sweep": sweep_rows,
               "lead": np.mean(np.array(agg["lead"]), axis=0).tolist() if agg["lead"] else None,
               "sys": np.mean(np.array(agg["sys"]), axis=0).tolist() if agg["sys"] else None,
               "outputs": all_outputs},
              fh, indent=1, ensure_ascii=False)
print()
print("results saved to", args.out)
print("done")
