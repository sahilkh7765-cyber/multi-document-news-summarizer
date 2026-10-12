#NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
#SAHIL JABIR KHAN 24AD1199
#
# STREAMLIT WEB APP
#   pip install streamlit scikit-learn numpy pandas pypdf python-docx beautifulsoup4
#   streamlit run app.py
#
# Upload news articles (.txt / .md / .pdf / .docx), paste them, or give URLs.
# The app groups articles about the same story, writes a consensus summary for each story,
# shows a summary of every individual article, and lists what each source reported that others did not.

import re
import io
import json
import numpy as np
import pandas as pd
import streamlit as st
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

np.random.seed(42)
st.set_page_config(page_title="News Summarizer", page_icon="📰", layout="wide")

MIN_WORDS = 5

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

# ------------------------------------------------------------------ TEXT HELPERS
def toks(t):
    return [w for w in ''.join(c.lower() if c.isalnum() or c.isspace() else ' ' for c in t).split()]

def ngrams(t, n):
    w = toks(t)
    return [tuple(w[i:i+n]) for i in range(len(w)-n+1)]

def rouge_n(cand, ref, n):
    c, r = ngrams(cand, n), ngrams(ref, n)
    if not r or not c: return 0.0
    cc, rc = defaultdict(int), defaultdict(int)
    for g in c: cc[g] += 1
    for g in r: rc[g] += 1
    ov = sum(min(cc[g], rc[g]) for g in cc)
    p, rr = ov/len(c), ov/len(r)
    return 0.0 if p+rr == 0 else 2*p*rr/(p+rr)

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

ABBR = r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|Govt|Gov|Gen|Col|Lt|No|Rs|Nos|approx|U\.S|U\.K|e\.g|i\.e)\.'

def split_sentences(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(ABBR, lambda m: m.group(0).replace('.', '<DOT>'), text, flags=re.I)
    parts = re.split(r'(?:(?<=[.!?])|(?<=[.!?]["\'”’)\]]))\s+(?=["\'“‘(\[]?[A-Z0-9])', text)
    return [p.replace('<DOT>', '.').strip() for p in parts if len(toks(p)) >= MIN_WORDS]

def parse_header(text):
    """Pull optional 'Source:', 'Event:', 'Title:' lines off the top of an article."""
    meta, lines = {}, text.splitlines()
    while lines:
        line = lines[0].strip()
        m = re.match(r'^(source|event|title)\s*:\s*(.+)$', line, re.I)
        if m:
            meta[m.group(1).lower()] = m.group(2).strip(); lines.pop(0)
        elif not line:
            lines.pop(0)
        else:
            break
    return meta, '\n'.join(lines)

# ------------------------------------------------------------------ READING INPUTS
def read_upload(f):
    name = f.name.lower()
    data = f.getvalue()
    if name.endswith('.pdf'):
        from pypdf import PdfReader
        return '\n'.join((pg.extract_text() or '') for pg in PdfReader(io.BytesIO(data)).pages)
    if name.endswith('.docx'):
        import docx
        return '\n'.join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs)
    return data.decode('utf-8', errors='ignore')

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

def make_article(raw, default_source):
    meta, body = parse_header(raw)
    sents = split_sentences(body)
    if not sents:
        return None
    return {"event": meta.get("event"), "source": meta.get("source") or default_source,
            "title": meta.get("title", ""), "sents": [(s, None) for s in sents]}

def unique_sources(corpus):
    seen = defaultdict(int)
    for d in corpus:
        seen[d["source"]] += 1
        if seen[d["source"]] > 1:
            d["source"] = "%s (%d)" % (d["source"], seen[d["source"]])
    return corpus

# ------------------------------------------------------------------ PIPELINE
def centrality_pick(sents, k, S=None):
    """Return indices of the k most central sentences (in original order)."""
    if len(sents) <= k:
        return list(range(len(sents)))
    if S is None:
        S = cosine_similarity(TfidfVectorizer(stop_words='english', sublinear_tf=True).fit_transform(sents))
        np.fill_diagonal(S, 0)
    cen = S.sum(axis=1) / max(len(sents)-1, 1)
    return sorted(np.argsort(-cen)[:k].tolist())

def run_pipeline(corpus, delta, tau_dup, tau_uniq, k):
    docs = [' '.join(s for s, _ in d["sents"]) for d in corpus]
    vec = TfidfVectorizer(stop_words='english', sublinear_tf=True)
    dv = vec.fit_transform(docs)
    vocab = np.array(vec.get_feature_names_out())

    # stage 1 : clustering
    if len(docs) == 1:
        labels = np.array([0])
    else:
        D = 1 - cosine_similarity(dv)
        np.fill_diagonal(D, 0); D[D < 0] = 0
        labels = AgglomerativeClustering(n_clusters=None, distance_threshold=delta,
                                         metric='precomputed', linkage='average').fit_predict(D)
    clusters = sorted(set(labels))

    has_event = all(d.get("event") for d in corpus)
    has_facts = all(f is not None for d in corpus for _, f in d["sents"])
    cluster_acc = None
    if has_event and len(docs) > 1:
        ok = tot = 0
        for i in range(len(docs)):
            for j in range(i+1, len(docs)):
                tot += 1
                ok += (labels[i] == labels[j]) == (corpus[i]["event"] == corpus[j]["event"])
        cluster_acc = ok / tot

    out = []
    for n, cl in enumerate(clusters):
        members = [i for i in range(len(docs)) if labels[i] == cl]
        evs = {corpus[i]["event"] for i in members}
        name = evs.pop() if has_event and len(evs) == 1 else "Story %d" % (n+1)
        centroid = np.asarray(dv[members].mean(axis=0)).ravel()
        keywords = list(vocab[centroid.argsort()[::-1][:6]])

        sents, srcs, facts = [], [], []
        for m in members:
            for s, f in corpus[m]["sents"]:
                sents.append(s); srcs.append(corpus[m]["source"]); facts.append(f)
        V = TfidfVectorizer(stop_words='english', sublinear_tf=True).fit_transform(sents)
        S = cosine_similarity(V); np.fill_diagonal(S, 0)

        # stage 2 : redundancy reduction
        pool = []
        for i in range(len(sents)):
            if not pool or max(S[i][p] for p in pool) < tau_dup:
                pool.append(i)

        # stage 3 : consensus summary
        if len(pool) == 1:
            top = pool
        else:
            cen = {i: float(np.mean([S[i][j] for j in pool if j != i])) for i in pool}
            top = sorted(sorted(cen, key=lambda i: -cen[i])[:k])
        summary_idx = top

        # stage 4 : divergence detection
        def detect(t):
            p = []
            for i in range(len(sents)):
                other = [j for j in range(len(sents)) if srcs[j] != srcs[i]]
                p.append(1 if (other and max(S[i][j] for j in other) < t) else 0)
            return p
        pred = detect(tau_uniq)
        exclusive = defaultdict(list)
        for i, p in enumerate(pred):
            if p: exclusive[srcs[i]].append(sents[i])

        gold = None
        if has_facts:
            fact_src = defaultdict(set)
            for f, s in zip(facts, srcs): fact_src[f].add(s)
            gold = [1 if len(fact_src[f]) == 1 else 0 for f in facts]

        def prf(p):
            if gold is None: return None
            tp = sum(1 for a, b in zip(p, gold) if a and b)
            fp = sum(1 for a, b in zip(p, gold) if a and not b)
            fn = sum(1 for a, b in zip(p, gold) if not a and b)
            return tp, fp, fn

        sweep = []
        for t in (0.10, 0.15, 0.20, 0.25, 0.30, 0.40):
            p = detect(t)
            sweep.append((t, sum(p), prf(p)))

        # coverage : which source reports each summary sentence
        source_list = [corpus[m]["source"] for m in members]
        coverage = []
        for i in summary_idx:
            row = {}
            for s in source_list:
                if s == srcs[i]:
                    row[s] = True
                else:
                    idx = [j for j in range(len(sents)) if srcs[j] == s]
                    row[s] = bool(idx) and max(S[i][j] for j in idx) >= tau_uniq
            coverage.append(row)

        # per-article summaries
        articles = []
        for m in members:
            a_sents = [s for s, _ in corpus[m]["sents"]]
            articles.append({"source": corpus[m]["source"], "title": corpus[m].get("title", ""),
                             "n_sent": len(a_sents),
                             "summary": [a_sents[i] for i in centrality_pick(a_sents, min(3, k))]})

        lead = []
        for m in members:
            lead += [s for s, _ in corpus[m]["sents"][:2]]

        out.append({"name": name, "keywords": keywords, "sources": source_list,
                    "n_sent": len(sents), "pool": len(pool),
                    "summary": [sents[i] for i in summary_idx],
                    "summary_from": [srcs[i] for i in summary_idx],
                    "coverage": coverage, "exclusive": dict(exclusive),
                    "detected": sum(pred), "prf": prf(pred), "sweep": sweep,
                    "articles": articles, "lead": ' '.join(lead[:k])})
    return {"clusters": out, "cluster_acc": cluster_acc, "has_facts": has_facts,
            "n_docs": len(docs)}

# ------------------------------------------------------------------ SESSION STATE
if "articles" not in st.session_state:
    st.session_state.articles = []      # list of article dicts
if "result" not in st.session_state:
    st.session_state.result = None
if "refs" not in st.session_state:
    st.session_state.refs = {}

def add_articles(new):
    st.session_state.articles.extend(new)
    st.session_state.result = None

# ------------------------------------------------------------------ SIDEBAR
with st.sidebar:
    st.header("Settings")
    k = st.slider("Sentences in consensus summary", 2, 10, 5)
    delta = st.slider("Clustering threshold (δ)", 0.50, 0.99, 0.85, 0.01,
                      help="Higher = articles are grouped more easily into the same story.")
    tau_dup = st.slider("Redundancy threshold (τ_dup)", 0.05, 0.60, 0.20, 0.01,
                        help="A sentence is dropped as a duplicate if it is at least this similar to one already kept.")
    tau_uniq = st.slider("Exclusivity threshold (τ_uniq)", 0.05, 0.60, 0.20, 0.01,
                         help="A sentence is 'reported only by this source' if no other source has a sentence this similar.")
    st.divider()
    if st.button("Load demo corpus"):
        st.session_state.articles = [dict(d, sents=list(d["sents"]), title="") for d in DEMO_CORPUS]
        st.session_state.refs = {}
        st.session_state.result = None
    if st.button("Clear all articles"):
        st.session_state.articles, st.session_state.result, st.session_state.refs = [], None, {}

# ------------------------------------------------------------------ HEADER
st.title("📰 Multi-Document News Summarizer")
st.caption("Upload several articles about the same news story from different sources. The app groups them by story, "
           "writes a consensus summary, summarises each article, and shows what each source reported that the others did not.")

# ------------------------------------------------------------------ INPUT
st.subheader("1. Add articles")
t_up, t_paste, t_url = st.tabs(["Upload files", "Paste text", "From URL"])

with t_up:
    files = st.file_uploader("Article files (.txt, .md, .pdf, .docx) — one file per source",
                             type=["txt", "md", "pdf", "docx"], accept_multiple_files=True)
    st.caption("Tip: a first line like `Source: Times of India` sets the source name; otherwise the file name is used.")
    if st.button("Add uploaded files", disabled=not files):
        new, bad = [], []
        for f in files:
            try:
                a = make_article(read_upload(f), f.name.rsplit('.', 1)[0])
            except Exception as e:
                bad.append("%s (%s)" % (f.name, e)); continue
            if a: new.append(a)
            else: bad.append(f.name)
        add_articles(new)
        if new: st.success("Added %d article(s)." % len(new))
        if bad: st.warning("Could not read: " + ", ".join(bad))

with t_paste:
    with st.form("paste_form", clear_on_submit=True):
        src = st.text_input("Source name", placeholder="e.g. The Hindu")
        body = st.text_area("Article text", height=200, placeholder="Paste the full article here...")
        if st.form_submit_button("Add article"):
            a = make_article(body, src.strip() or "Pasted article %d" % (len(st.session_state.articles)+1))
            if a:
                if src.strip(): a["source"] = src.strip()
                add_articles([a]); st.success("Added article from %s." % a["source"])
            else:
                st.warning("No usable sentences found in that text.")

with t_url:
    urls = st.text_area("One URL per line", placeholder="https://...")
    if st.button("Fetch articles", disabled=not urls.strip()):
        new, bad = [], []
        for u in [u.strip() for u in urls.splitlines() if u.strip()]:
            try:
                a = make_article(read_url(u), re.sub(r'^www\.', '', u.split('/')[2]))
                (new if a else bad).append(a or u)
            except Exception as e:
                bad.append("%s (%s)" % (u, e))
        add_articles(new)
        if new: st.success("Fetched %d article(s)." % len(new))
        if bad: st.warning("Could not read: " + ", ".join(map(str, bad)))

# ------------------------------------------------------------------ ARTICLE LIST
arts = st.session_state.articles
if arts:
    st.markdown("**%d article(s) loaded**" % len(arts))
    for i, a in enumerate(arts):
        c1, c2, c3 = st.columns([4, 2, 1])
        c1.write("**%s**  —  %s" % (a["source"], a["sents"][0][0][:90] + ("…" if len(a["sents"][0][0]) > 90 else "")))
        c2.caption("%d sentences" % len(a["sents"]))
        if c3.button("Remove", key="rm_%d" % i):
            arts.pop(i); st.session_state.result = None; st.rerun()
else:
    st.info("No articles yet. Upload, paste or fetch at least two articles on the same story "
            "— or click **Load demo corpus** in the sidebar.")

# ------------------------------------------------------------------ RUN
st.subheader("2. Summarize")
if st.button("▶ Run summarization", type="primary", disabled=not arts):
    unique_sources(arts)
    st.session_state.result = run_pipeline(arts, delta, tau_dup, tau_uniq, k)
    st.session_state.params = dict(delta=delta, tau_dup=tau_dup, tau_uniq=tau_uniq, k=k)
    if all(a.get("event") in DEMO_REFERENCES for a in arts):
        st.session_state.refs = {c["name"]: DEMO_REFERENCES.get(c["name"], "")
                                 for c in st.session_state.result["clusters"]}

res = st.session_state.result
if res and st.session_state.get("params") != dict(delta=delta, tau_dup=tau_dup, tau_uniq=tau_uniq, k=k):
    st.caption("⚠️ Settings changed — press **Run summarization** again to update the results.")

# ------------------------------------------------------------------ RESULTS
if res:
    st.subheader("3. Results")
    clusters = res["clusters"]
    tot_s = sum(c["n_sent"] for c in clusters); tot_p = sum(c["pool"] for c in clusters)
    m = st.columns(4)
    m[0].metric("Articles", res["n_docs"])
    m[1].metric("Stories found", len(clusters))
    m[2].metric("Redundancy removed", "%.1f %%" % (100*(1-tot_p/tot_s)))
    m[3].metric("Exclusive details", sum(c["detected"] for c in clusters))
    if res["cluster_acc"] is not None:
        st.caption("Pairwise clustering accuracy against the Event labels: **%.4f**" % res["cluster_acc"])

    tabs = st.tabs(["%s (%d sources)" % (c["name"], len(c["sources"])) for c in clusters])
    for c, tab in zip(clusters, tabs):
        with tab:
            st.caption("Keywords: " + ", ".join(c["keywords"]) +
                       "   ·   %d sentences → %d after removing duplicates" % (c["n_sent"], c["pool"]))
            multi = len(c["sources"]) > 1

            st.markdown("#### %s" % ("Consensus summary" if multi else "Summary (single source)"))
            for s, frm in zip(c["summary"], c["summary_from"]):
                st.markdown("- %s  <span style='opacity:.55;font-size:.85em'>— %s</span>" % (s, frm),
                            unsafe_allow_html=True)

            if multi:
                st.markdown("#### Coverage across sources")
                cov = pd.DataFrame(c["coverage"], index=["S%d" % (i+1) for i in range(len(c["summary"]))])
                cov = cov.replace({True: "✅", False: "—"})
                st.dataframe(cov)
                st.caption("S1, S2… are the summary sentences above, in order. ✅ = that source reports this point.")

                st.markdown("#### Reported only by one source")
                if c["exclusive"]:
                    cols = st.columns(min(len(c["exclusive"]), 3))
                    for n, (src, lines) in enumerate(c["exclusive"].items()):
                        with cols[n % len(cols)]:
                            st.markdown("**%s**" % src)
                            for l in lines: st.markdown("- " + l)
                else:
                    st.write("No source-exclusive details detected.")
            else:
                st.info("Only one source covers this story, so there is nothing to compare it with. "
                        "Add another article on the same story to see cross-source differences.")

            st.markdown("#### Summary of each article")
            for a in c["articles"]:
                with st.expander("%s  (%d sentences)" % (a["source"], a["n_sent"])):
                    for s in a["summary"]: st.markdown("- " + s)

            st.markdown("#### Evaluation")
            ref = st.text_area("Reference summary (optional — enables ROUGE)", key="ref_" + c["name"],
                               value=st.session_state.refs.get(c["name"], ""), height=100)
            summ = ' '.join(c["summary"])
            rows = []
            for nm, cand in (("LEAD-2 baseline", c["lead"]), ("This pipeline", summ)):
                row = {"System": nm}
                if ref.strip():
                    row.update({"ROUGE-1": rouge_n(cand, ref, 1), "ROUGE-2": rouge_n(cand, ref, 2),
                                "ROUGE-L": rouge_l(cand, ref)})
                row.update({"Distinct-1": distinct(cand, 1), "Distinct-2": distinct(cand, 2)})
                rows.append(row)
            st.dataframe(pd.DataFrame(rows).set_index("System").style.format("{:.4f}"))

            if multi:
                sw = []
                for t, det, p in c["sweep"]:
                    r = {"τ_uniq": "%.2f" % t, "Detected": det}
                    if p:
                        tp, fp, fn = p
                        P = tp/(tp+fp) if tp+fp else 0.0; R = tp/(tp+fn) if tp+fn else 0.0
                        r.update({"Precision": round(P, 4), "Recall": round(R, 4),
                                  "F1": round(2*P*R/(P+R) if P+R else 0.0, 4)})
                    sw.append(r)
                st.markdown("**Threshold sensitivity**")
                st.dataframe(pd.DataFrame(sw).set_index("τ_uniq"))

    # overall divergence P/R/F (only for fact-labelled demo data)
    if res["has_facts"]:
        TP = sum(c["prf"][0] for c in clusters); FP = sum(c["prf"][1] for c in clusters)
        FN = sum(c["prf"][2] for c in clusters)
        P = TP/(TP+FP) if TP+FP else 0.0; R = TP/(TP+FN) if TP+FN else 0.0
        F = 2*P*R/(P+R) if P+R else 0.0
        st.markdown("#### Divergence detection (all stories, τ_uniq = %.2f)" % tau_uniq)
        d = st.columns(4)
        d[0].metric("Precision", "%.4f" % P); d[1].metric("Recall", "%.4f" % R)
        d[2].metric("F1", "%.4f" % F); d[3].metric("TP / FP / FN", "%d / %d / %d" % (TP, FP, FN))

    # downloads
    st.divider()
    lines = []
    for c in clusters:
        lines += ["=" * 70, "STORY: %s   sources: %s" % (c["name"], ", ".join(c["sources"])), "=" * 70,
                  "CONSENSUS SUMMARY"] + ["  " + s for s in c["summary"]] + [""]
        for src, ls in c["exclusive"].items():
            lines += ["REPORTED ONLY BY " + src.upper()] + ["  - " + l for l in ls] + [""]
        for a in c["articles"]:
            lines += ["SUMMARY OF " + a["source"].upper()] + ["  - " + s for s in a["summary"]] + [""]
    dl1, dl2 = st.columns(2)
    dl1.download_button("⬇ Download report (.txt)", "\n".join(lines), "summary_report.txt")
    dl2.download_button("⬇ Download results (.json)", json.dumps(res, indent=1, ensure_ascii=False, default=str),
                        "metrics.json")
