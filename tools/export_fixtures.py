#NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
#SAHIL JABIR KHAN 24AD1199
#
# GOLDEN FIXTURES FOR THE TYPESCRIPT PORT
#   python tools/export_fixtures.py
#
# The pipeline functions are NOT rewritten here. app.py is parsed with `ast` and its imports, constants and
# function definitions are executed as-is (only the Streamlit UI statements are skipped). The script then
# calls app.py's own run_pipeline / split_sentences / rouge_n / ... and dumps their outputs to web/fixtures/.
#
# On top of the outputs it records instrumentation the TS tests need:
#   - "gaps": the smallest distance between any compared value and the threshold it was compared to,
#     so we can see whether ulp-level float differences could ever flip a decision;
#   - "ties": where an output depends on np.argsort tie-breaking (not stable in numpy 2.x), with the set of
#     equally valid candidates for each position.
# It also re-runs NLPCapstone.py into a temp file and checks that it reproduces metrics.json.

import ast
import copy
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import unicodedata

import numpy as np
import scipy
import sklearn
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "fixtures")
TIE_EPS = 1e-12
SWEEP = (0.10, 0.15, 0.20, 0.25, 0.30, 0.40)


# ------------------------------------------------------------------ LOAD app.py WITHOUT ITS UI
def load_app():
    src = open(os.path.join(ROOT, "app.py"), encoding="utf-8").read()
    keep = []
    for node in ast.parse(src).body:
        if isinstance(node, ast.FunctionDef):
            keep.append(node)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
            if not any(m.split(".")[0] == "streamlit" for m in mods):
                keep.append(node)
        elif isinstance(node, ast.Assign) and all(isinstance(t, ast.Name) and t.id.isupper() for t in node.targets):
            keep.append(node)
    g = {"__name__": "app_functions"}
    exec(compile(ast.Module(body=keep, type_ignores=[]), "app.py", "exec"), g)
    return g


APP = load_app()
run_pipeline = APP["run_pipeline"]
split_sentences = APP["split_sentences"]
parse_header = APP["parse_header"]
make_article = APP["make_article"]
unique_sources = APP["unique_sources"]
toks = APP["toks"]
rouge_n = APP["rouge_n"]
rouge_l = APP["rouge_l"]
distinct = APP["distinct"]
DEMO_CORPUS = APP["DEMO_CORPUS"]
DEMO_REFERENCES = APP["DEMO_REFERENCES"]


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, np.generic):
        o = o.item()
    if isinstance(o, float) and o in (float("inf"), float("-inf")):
        return None  # JSON has no Infinity; null means "no boundary / no comparison"
    if isinstance(o, np.ndarray):
        return jsonable(o.tolist())
    return o


def dump(name, obj):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        json.dump(jsonable(obj), fh, ensure_ascii=False, indent=1)


# ------------------------------------------------------------------ CORPORA
def demo_articles():
    # exactly what app.py's "Load demo corpus" button builds
    return [dict(d, sents=list(d["sents"]), title="") for d in DEMO_CORPUS]


CUSTOM_TEXTS = [
    ("harbour-a.txt", "Source: Coastal Post\nEvent: H1\nTitle: Harbour bridge closes\n\n"
     "The harbour bridge will close for repairs from Monday, the port authority said. "
     "Dr. Meera Iyer, the chief engineer, said the steel cables had corroded faster than expected. "
     "Repairs are expected to cost Rs. 310 crore and take about eight months. "
     "\u201cWe cannot risk another monsoon on these cables,\u201d Iyer told reporters. "
     "Ferry services will be doubled while the bridge is shut."),
    ("harbour-b.txt", "Source: Wire Service\nEvent: H1\n\n"
     "Port officials announced that the harbour bridge closes on Monday for eight months of repairs. "
     "The corroded steel cables must be replaced, chief engineer Meera Iyer said. "
     "The repair bill is put at 310 crore rupees by the port authority. "
     "Extra ferries will run during the closure, officials said. "
     "Traders in the old market fear a drop in footfall during the closure."),
    ("harbour-c.md", "Source: Wire Service\nEvent: H1\n\n"
     "The harbour bridge shuts on Monday so that its corroded cables can be replaced. "
     "Engineers estimate the work will take eight months to finish. "
     "Ferry frequency on the harbour route will double from Monday. "
     "A U.S. firm, Lattice Corp., won the contract for the cable work. "
     "Commuters said the closure would add an hour to their daily journeys."),
    ("flu-a.txt", "Source: Health Desk\nEvent: F1\n\n"
     "Hospitals across the district reported a sharp rise in seasonal flu cases this week. "
     "Doctors at the general hospital said most patients were children under ten. "
     "The health department has asked schools to report absences daily. "
     "Free vaccination camps will open in twelve wards from Thursday."),
    ("flu-b.txt", "Source: City Bulletin\nEvent: F1\n\n"
     "Seasonal flu cases have risen sharply across district hospitals this week. "
     "Children under ten make up the majority of patients, doctors said. "
     "Vaccination camps offering free shots open in twelve wards on Thursday. "
     "Pharmacies reported shortages of paediatric fever syrup. "
     "Prof. Anil Rao said the peak was likely two weeks away."),
    ("orchestra.txt", "Source: Arts Review\nEvent: O1\n\n"
     "The youth orchestra performed Mahler's fifth symphony to a sold out auditorium on Saturday. "
     "Conductor Lina Duarte drew sustained applause after the final movement. "
     "Tickets for the autumn season go on sale next month."),
]

UNRELATED_TEXTS = [
    ("alpha.txt", "Volcanic ash grounded flights across northern airports overnight. "
     "Airlines cancelled dozens of departures until the plume drifts east."),
    ("beta.txt", "Chess prodigy wins junior championship with a stunning queen sacrifice. "
     "Spectators applauded as the eleven year old shook hands with opponents."),
    ("gamma.txt", "Bakery chain launches sourdough subscriptions delivered weekly. "
     "Customers pick loaves online and collect them every Friday morning."),
    ("delta.txt", "Glaciers in the valley retreated faster this decade, satellite surveys show. "
     "Researchers measured meltwater runoff using drones and buoys."),
]


def custom_articles(texts):
    arts = []
    for fname, raw in texts:
        a = make_article(raw, fname.rsplit(".", 1)[0])
        assert a is not None, fname
        arts.append(a)
    return arts


def strip_labels(arts):
    return [dict(a, event=None, sents=[(s, None) for s, _ in a["sents"]]) for a in arts]


CORPORA = {
    "demo": demo_articles,
    "custom": lambda: custom_articles(CUSTOM_TEXTS),
    "unrelated": lambda: custom_articles(UNRELATED_TEXTS),
    "demo_unlabelled": lambda: strip_labels(demo_articles()),
    "single": lambda: [demo_articles()[0]],
    "two_stories": lambda: [demo_articles()[0], demo_articles()[4]],
}

PARAMS = [  # (delta, tau_dup, tau_uniq, k)
    (0.85, 0.20, 0.20, 5),   # app.py defaults == metrics.json
    (0.50, 0.20, 0.20, 5),
    (0.99, 0.20, 0.20, 5),
    (0.70, 0.10, 0.30, 3),
    (0.90, 0.40, 0.10, 8),
    (0.60, 0.05, 0.60, 2),
    (0.85, 0.60, 0.05, 10),
    (0.95, 0.30, 0.25, 4),
]


# ------------------------------------------------------------------ INSTRUMENTATION
class Gaps:
    def __init__(self):
        self.g = {}

    def add(self, kind, value, threshold):
        d = abs(float(value) - float(threshold))
        self.g[kind] = min(self.g.get(kind, float("inf")), d)

    def out(self):
        return {k: v for k, v in self.g.items()}


def sim(sents):
    S = cosine_similarity(TfidfVectorizer(stop_words="english", sublinear_tf=True).fit_transform(sents))
    np.fill_diagonal(S, 0)
    return S


def rank_candidates(values, chosen):
    """For each chosen index, every index whose value equals it (within TIE_EPS)."""
    return [[int(j) for j in np.flatnonzero(np.abs(values - values[c]) <= TIE_EPS)] for c in chosen]


def boundary_gap(sorted_desc, k):
    """Distance between the k-th and (k+1)-th value when they are NOT tied; inf if tied or no boundary."""
    if len(sorted_desc) <= k:
        return float("inf")
    d = sorted_desc[k - 1] - sorted_desc[k]
    return float(d) if d > TIE_EPS else float("inf")


def order_gap(sorted_desc, upto):
    """Smallest non-tie gap between consecutive values among the first `upto` (ordering matters there)."""
    m = float("inf")
    for a, b in zip(sorted_desc[:upto], sorted_desc[1:upto + 1]):
        if a - b > TIE_EPS:
            m = min(m, float(a - b))
    return m


def pick_info(sents, k):
    """Tie analysis for app.py's centrality_pick(sents, k)."""
    if len(sents) <= k:
        return {"required": list(range(len(sents))), "tied": [], "need_from_tied": 0, "gap": float("inf")}
    S = sim(sents)
    cen = S.sum(axis=1) / max(len(sents) - 1, 1)
    srt = np.sort(cen)[::-1]
    cut = srt[k - 1]
    required = [int(i) for i in np.flatnonzero(cen > cut + TIE_EPS)]
    tied = [int(i) for i in np.flatnonzero(np.abs(cen - cut) <= TIE_EPS)]
    return {"required": required, "tied": tied, "need_from_tied": k - len(required),
            "gap": boundary_gap(srt, k), "cen": cen}


def instrument(corpus, res, delta, tau_dup, tau_uniq, k):
    gaps = Gaps()
    docs = [" ".join(s for s, _ in d["sents"]) for d in corpus]
    vec = TfidfVectorizer(stop_words="english", sublinear_tf=True)
    dv = vec.fit_transform(docs)
    vocab = np.array(vec.get_feature_names_out())
    info = {}
    if len(docs) == 1:
        labels = np.array([0])
        info["children"], info["distances"] = [], []
    else:
        D = 1 - cosine_similarity(dv)
        np.fill_diagonal(D, 0)
        D[D < 0] = 0
        ac = AgglomerativeClustering(n_clusters=None, distance_threshold=delta, metric="precomputed",
                                     linkage="average").fit(D)
        labels = ac.labels_
        info["children"] = ac.children_.tolist()
        info["distances"] = ac.distances_.tolist()
        for dist in ac.distances_:
            gaps.add("cluster_threshold", dist, delta)
        ds = np.sort(ac.distances_)
        dd = np.diff(ds)
        info["merge_distance_exact_ties"] = int(np.count_nonzero(dd == 0))
        nz = dd[dd > 0]
        gaps.add("merge_order", nz.min() if len(nz) else float("inf"), 0)
    info["labels"] = [int(x) for x in labels]

    per_cluster = []
    for cl, c in zip(sorted(set(labels)), res["clusters"]):
        members = [i for i in range(len(docs)) if labels[i] == cl]
        assert [corpus[m]["source"] for m in members] == c["sources"]

        # keywords (np.argsort, unstable on ties)
        centroid = np.asarray(dv[members].mean(axis=0)).ravel()
        chosen = [int(np.flatnonzero(vocab == w)[0]) for w in c["keywords"]]
        cands = rank_candidates(centroid, chosen)
        srt = np.sort(centroid)[::-1]
        gaps.add("keyword_order", order_gap(srt, 6), 0)
        kw = {"candidates": [[str(vocab[j]) for j in cs] for cs in cands],
              "tie_dependent": any(len(cs) > 1 for cs in cands)}

        sents, srcs = [], []
        for m in members:
            for s, _ in corpus[m]["sents"]:
                sents.append(s)
                srcs.append(corpus[m]["source"])
        S = sim(sents)
        n = len(sents)

        pool = []
        for i in range(n):
            if pool:
                mx = max(S[i][p] for p in pool)
                gaps.add("tau_dup", mx, tau_dup)
                if mx < tau_dup:
                    pool.append(i)
            else:
                pool.append(i)
        assert len(pool) == c["pool"]

        consensus_tie = False
        if len(pool) > 1:
            cen = np.array([float(np.mean([S[i][j] for j in pool if j != i])) for i in pool])
            srt_c = np.sort(cen)[::-1]
            gaps.add("consensus_rank", boundary_gap(srt_c, k), 0)
            if len(pool) > k and srt_c[k - 1] - srt_c[k] <= TIE_EPS:
                consensus_tie = True  # Python's sorted() is stable, so this is still deterministic

        for i in range(n):
            other = [j for j in range(n) if srcs[j] != srcs[i]]
            if other:
                mx = max(S[i][j] for j in other)
                for t in set(SWEEP) | {tau_uniq}:
                    gaps.add("tau_uniq", mx, t)

        for i in [sents.index(s) for s in c["summary"]]:
            for s in c["sources"]:
                if s != srcs[i]:
                    idx = [j for j in range(n) if srcs[j] == s]
                    if idx:
                        gaps.add("coverage", max(S[i][j] for j in idx), tau_uniq)

        arts = []
        for m in members:
            a_sents = [s for s, _ in corpus[m]["sents"]]
            p = pick_info(a_sents, min(3, k))
            gaps.add("article_pick", p["gap"], 0)
            arts.append({"required": p["required"], "tied": p["tied"], "need_from_tied": p["need_from_tied"],
                         "tie_dependent": p["need_from_tied"] > 0 and len(p["tied"]) > p["need_from_tied"]})

        per_cluster.append({"members": members, "keywords": kw, "consensus_boundary_tie": consensus_tie,
                            "articles": arts})
    info["clusters"] = per_cluster
    info["gaps"] = gaps.out()
    return info


def evaluation(res, refs):
    out = []
    for c in res["clusters"]:
        summ = " ".join(c["summary"])
        ref = refs.get(c["name"], "")
        rows = {}
        for nm, cand in (("lead", c["lead"]), ("pipeline", summ)):
            row = {}
            if ref.strip():
                row.update({"rouge1": rouge_n(cand, ref, 1), "rouge2": rouge_n(cand, ref, 2),
                            "rougeL": rouge_l(cand, ref)})
            row.update({"distinct1": distinct(cand, 1), "distinct2": distinct(cand, 2)})
            rows[nm] = row
        out.append({"name": c["name"], "reference": ref, **rows})
    return out


# ------------------------------------------------------------------ TEXT-LEVEL CASES
SPLIT_CASES = [
    "The minister spoke on Tuesday. The bridge opened later that evening to traffic.",
    "Dr. Rao met Mr. Singh at St. Mary's hospital. They discussed the U.S. trade deal at length today.",
    "MR. SMITH and DR. JONES arrived early today. vs. the others who arrived late at night yesterday.",
    "\u201cWe will win this,\u201d she said firmly to the crowd. \u2018Not today,\u2019 he replied quickly to everyone there.",
    "He asked, \"Is it done?\" The answer came back slowly from the far room. (This was expected by everyone involved.)",
    "Costs rose 3.5 per cent this year alone. 2024 was a record year for the whole sector overall.",
    "Short one. This sentence has enough words to survive the filter easily.",
    "Line one has five words here\nand continues on the next line. Then\r\nanother sentence follows right after this.",
    "Tabs\tand\u00a0non breaking\u2003spaces appear in this sentence today. Next sentence starts here now ok.",
    "The company, i.e. the parent firm, said e.g. costs would fall soon. Approx. ten people left early today.",
    "A literal <DOT> marker sits inside this sentence for testing. Another sentence follows after that one here.",
    "Prices hit Rs. 500 and Nos. 4 and 5 were sold out quickly today. Gen. Patel and Col. Das were present at the event.",
    "Ends with exclamation! Then a question follows here for sure? and lowercase start continues the same sentence here.",
    "Unicode caf\u00e9 r\u00e9sum\u00e9 na\u00efve words are all fine here today. \u00c9tienne said the na\u00efve plan failed badly.",
    "\u0391\u03b8\u03ae\u03bd\u03b1 \u03ba\u03b1\u03b9 \u0398\u0395\u03a3\u03a3\u0391\u039b\u039f\u039d\u0399\u039a\u0397 \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03cc\u03bb\u03b5\u03b9\u03c2 \u03bc\u03b5\u03b3\u03ac\u03bb\u03b5\u03c2. Next sentence is plain English with words.",
    "Kelvin \u212a test: Co\u212a. ignored? The \u212ao. case is odd. Fine sentence here with many words in it.",
    "Ellipsis here... And then the next sentence begins right here today. [Bracketed start] works too in this case.",
    "",
    "   ",
    "one two three four",
    "\ufeffBOM at start of this sentence with words. Second\x1cfile separator\x1d sentence goes here now.",
    "No.5 is not split. No. 5 is the house number on the street here. Inc. Ltd. Co. Corp. Govt. names.",
    "\u0130nc. and \u0131.e. and INC. are abbreviations in Python's re.I here. Next sentence comes after them now.",
    "Mixed: \u0661\u0662\u0663 Arabic digits and \u0968 Devanagari digits here. Superscript x\u00b2 and \u2155 fraction in text now.",
]

HEADER_CASES = [
    "Source: The Hindu\nEvent: E9\nTitle: Something\n\nBody text here.",
    "\n\n  source :  Lower Case  \nTITLE:Caps\nBody",
    "Title: Only title\r\nBody line one\r\nBody line two",
    "Body first\nSource: not a header",
    "Source:\nBody",
    "Event: E1\n\n\nEvent: E2\nBody",
    "Source: A\x0bB\nBody",
    "Source: X\u2028Body after LS",
    "\u017fource: long s\nBody",
    "",
    "Source: Trailing\n",
    "Source: Tabs\tinside\n\tBody",
    "T\u0130TLE: dotted capital I\nBody",
    "\u0405OURCE: Cyrillic DZE is not S\nBody",
]

ROUGE_CASES = [
    ("the cat sat on the mat", "the cat sat on the mat"),
    ("the cat sat on the mat", "a dog lay on a rug"),
    ("the the the the", "the cat"),
    ("", "something here"),
    ("something here", ""),
    ("word", "word"),
    ("Caf\u00e9 owners said: prices rose 3.5% in 2024!", "caf\u00e9 OWNERS say prices rose 3 5 percent in 2024"),
    ("\u0130stanbul \u03a3\u039f\u03a3 test", "i\u0307stanbul \u03c3\u03bf\u03c3 test"),
    ("State XI beat Northern XI by six wickets.", "State XI defeated Northern XI by six wickets in the final."),
    ("a b c d e f g h", "h g f e d c b a"),
]

UNIQUE_SOURCE_CASES = [
    {"names": ["A", "B", "C"], "collides": False},
    {"names": ["A", "A", "B", "A"], "collides": False},
    {"names": ["Wire", "Wire", "Wire", "Desk", "Desk"], "collides": False},
    {"names": ["A", "A", "A (2)"], "collides": True},
    {"names": ["A (2)", "A", "A"], "collides": True},
]


def unicode_table():
    rng = random.Random(7)
    cps = set(range(0, 0x400))
    cps |= {0x85, 0xa0, 0x130, 0x131, 0x17f, 0x1e9e, 0x212a, 0x2126, 0x3a3, 0xdf, 0xfb00, 0x1680, 0x180e,
            0x200b, 0x200c, 0x200d, 0x2028, 0x2029, 0x202f, 0x205f, 0x2060, 0x3000, 0xfeff, 0x2155, 0x2160,
            0x3007, 0x4e00, 0x4e94, 0x96f6, 0xf96b, 0x0660, 0x0966, 0x0e50, 0xff10, 0xff21, 0x1d7ce, 0x1f600,
            0x10400, 0x1d400, 0x20000, 0x0903, 0x093f, 0x0300, 0x0345, 0x2070, 0x00b2, 0x00bc, 0x2460, 0x24b6}
    cps |= set(range(0x2000, 0x2070))
    while len(cps) < 6000:
        c = rng.randrange(0x400, 0x10000)
        if not 0xD800 <= c <= 0xDFFF:
            cps.add(c)
    for _ in range(300):
        cps.add(rng.randrange(0x10000, 0x30000))
    rows = []
    for c in sorted(cps):
        ch = chr(c)
        rows.append([c, ch.isalnum(), ch.isspace(), re.fullmatch(r"\w", ch) is not None, ch.lower(),
                     unicodedata.category(ch)])
    return {"unidata_version": unicodedata.unidata_version, "rows": rows}


def tfidf_fixture(corpus):
    docs = [" ".join(s for s, _ in d["sents"]) for d in corpus]
    vec = TfidfVectorizer(stop_words="english", sublinear_tf=True)
    X = vec.fit_transform(docs)
    rows = []
    for i in range(X.shape[0]):
        a, b = X.indptr[i], X.indptr[i + 1]
        rows.append([[int(j), float(v)] for j, v in zip(X.indices[a:b], X.data[a:b])])
    D = 1 - cosine_similarity(X)
    np.fill_diagonal(D, 0)
    D[D < 0] = 0
    return {"docs": docs, "vocab": vec.get_feature_names_out().tolist(), "idf": vec.idf_.tolist(),
            "rows": rows, "distance": D.tolist()}


# ------------------------------------------------------------------ METRICS.JSON CHECK
def check_capstone():
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "metrics.json")
        subprocess.run([sys.executable, os.path.join(ROOT, "NLPCapstone.py"), "--out", out],
                       cwd=tmp, check=True, capture_output=True)
        rerun = json.load(open(out, encoding="utf-8"))
    original = json.load(open(os.path.join(ROOT, "metrics.json"), encoding="utf-8"))
    return rerun == original


# ------------------------------------------------------------------ MAIN
def main():
    os.makedirs(OUT, exist_ok=True)
    env = {"python": sys.version.split()[0], "numpy": np.__version__, "scipy": scipy.__version__,
           "sklearn": sklearn.__version__, "unidata": unicodedata.unidata_version}

    capstone_ok = check_capstone()
    print("NLPCapstone.py reproduces metrics.json:", capstone_ok)
    if not capstone_ok:
        sys.exit("metrics.json is NOT reproduced in this environment - stopping.")

    runs, all_gaps = [], {}
    for cname, make in CORPORA.items():
        for delta, tau_dup, tau_uniq, k in PARAMS:
            corpus = unique_sources(make())
            snapshot = copy.deepcopy(corpus)
            res = run_pipeline(corpus, delta, tau_dup, tau_uniq, k)
            refs = {}
            if all(a.get("event") in DEMO_REFERENCES for a in snapshot):
                refs = {c["name"]: DEMO_REFERENCES.get(c["name"], "") for c in res["clusters"]}
            info = instrument(snapshot, res, delta, tau_dup, tau_uniq, k)
            for kind, v in info["gaps"].items():
                all_gaps[kind] = min(all_gaps.get(kind, float("inf")), v)
            runs.append({"corpus": cname, "params": {"delta": delta, "tau_dup": tau_dup, "tau_uniq": tau_uniq, "k": k},
                         "articles": snapshot, "result": res, "eval": evaluation(res, refs), "instrument": info})

    raw_texts = {"custom": CUSTOM_TEXTS, "unrelated": UNRELATED_TEXTS}
    dump("pipeline_runs.json", {"env": env, "sweep": SWEEP, "tie_eps": TIE_EPS, "raw_texts": raw_texts, "runs": runs})
    dump("text_cases.json", {
        "split": [{"text": t, "out": split_sentences(t)} for t in SPLIT_CASES],
        "header": [{"text": t, "meta": parse_header(t)[0], "body": parse_header(t)[1]} for t in HEADER_CASES],
        "toks": [{"text": t, "out": toks(t)} for t in SPLIT_CASES + [a for a, _ in ROUGE_CASES]],
        "rouge": [{"cand": a, "ref": b, "r1": rouge_n(a, b, 1), "r2": rouge_n(a, b, 2), "rl": rouge_l(a, b),
                   "d1": distinct(a, 1), "d2": distinct(a, 2)} for a, b in ROUGE_CASES],
        "unique_sources": [dict(c, out=[d["source"] for d in unique_sources([{"source": n} for n in c["names"]])])
                           for c in UNIQUE_SOURCE_CASES],
        "make_article": [{"name": f, "raw": t, "out": make_article(t, f.rsplit(".", 1)[0])}
                         for f, t in CUSTOM_TEXTS + UNRELATED_TEXTS],
    })
    dump("stop_words.json", sorted(ENGLISH_STOP_WORDS))
    dump("unicode_table.json", unicode_table())
    dump("tfidf_demo.json", tfidf_fixture(demo_articles()))
    dump("summary.json", {"env": env, "capstone_reproduces_metrics": capstone_ok, "min_gaps": all_gaps,
                          "n_runs": len(runs)})

    print("runs:", len(runs))
    print("minimum gaps to thresholds / between ranked values:")
    for kind, v in sorted(all_gaps.items()):
        print("  %-18s %.3e" % (kind, v))
    ties = [(r["corpus"], r["params"], ci) for r in runs for ci, c in enumerate(r["instrument"]["clusters"])
            if c["keywords"]["tie_dependent"]]
    print("keyword lists that depend on argsort ties:", len(ties))
    ptie = sum(1 for r in runs for c in r["instrument"]["clusters"] for a in c["articles"] if a["tie_dependent"])
    print("per-article summaries that depend on argsort ties:", ptie)


if __name__ == "__main__":
    main()
