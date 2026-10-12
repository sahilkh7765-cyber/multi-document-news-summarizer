#NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
#SAHIL JABIR KHAN 24AD1199

import numpy as np
import json
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity

np.random.seed(42)

# ------------------------------------------------------------------ CORPUS
# Controlled multi-source corpus. Each sentence carries a fact id.
# A fact reported by only one source is ground-truth source-exclusive.

CORPUS = [
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

REFERENCES = {
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

# ------------------------------------------------------------------ STAGE 1 : CLUSTERING
docs = [' '.join(s for s, _ in d["sents"]) for d in CORPUS]
gold_event = [d["event"] for d in CORPUS]
dv = TfidfVectorizer(stop_words='english', sublinear_tf=True).fit_transform(docs)
D = 1 - cosine_similarity(dv)
np.fill_diagonal(D, 0)
D[D < 0] = 0
labels = AgglomerativeClustering(n_clusters=None, distance_threshold=DELTA,
                                 metric='precomputed', linkage='average').fit_predict(D)

pair_ok = pair_tot = 0
for i in range(len(docs)):
    for j in range(i+1, len(docs)):
        pair_tot += 1
        if (labels[i] == labels[j]) == (gold_event[i] == gold_event[j]): pair_ok += 1
cluster_acc = pair_ok/pair_tot

print("="*74)
print("STAGE 1  EVENT CLUSTERING")
print("="*74)
print("documents                :", len(docs))
print("clusters formed          :", len(set(labels)), " (gold = 3)")
print("pairwise clustering acc. : %.4f" % cluster_acc)
for cl in sorted(set(labels)):
    mem = [CORPUS[i]["source"] for i in range(len(docs)) if labels[i] == cl]
    ev = {CORPUS[i]["event"] for i in range(len(docs)) if labels[i] == cl}
    print("  cluster %d -> %s  %s" % (cl, sorted(ev), mem))

# ------------------------------------------------------------------ PER-CLUSTER PIPELINE
results, sweep_rows, all_outputs = [], [], []

def run_cluster(idx, tau_dup=TAU_DUP, tau_uniq=TAU_UNIQ, verbose=True):
    members = [i for i in range(len(docs)) if labels[i] == idx]
    ev = CORPUS[members[0]]["event"]
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
    cen = {i: float(np.mean([S[i][j] for j in pool if j != i])) for i in pool}
    top = sorted(sorted(cen, key=lambda i: -cen[i])[:SUMMARY_SENTS])
    summary = ' '.join(sents[i] for i in top)

    # divergence detection
    pred = []
    for i in range(len(sents)):
        other = [j for j in range(len(sents)) if srcs[j] != srcs[i]]
        pred.append(1 if (not other or max(S[i][j] for j in other) < tau_uniq) else 0)
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
                            "pool": len(pool), "summary": summary,
                            "exclusive": {k: v for k, v in exc.items()}})
    return dict(event=ev, n_src=len(members), n_sent=len(sents), pool=len(pool),
                summary=summary, tp=tp, fp=fp, fn=fn)

for cl in sorted(set(labels)):
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
    print("CONSENSUS SUMMARY")
    for s in o["summary"].split('. '):
        if s.strip(): print("  " + s.strip().rstrip('.') + ".")
    print()
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

print()
print("%-26s %8s %8s %8s %8s %8s" % ("SYSTEM / EVENT", "R-1", "R-2", "R-L", "D-1", "D-2"))
print("-"*74)
agg = {"lead": [], "sys": []}
for cl, r in zip(sorted(set(labels)), results):
    ref = REFERENCES[r["event"]]
    lead = lead_baseline(cl)
    for name, cand, key in (("LEAD-2  " + r["event"], lead, "lead"), ("PIPELINE " + r["event"], r["summary"], "sys")):
        r1 = rouge_n(cand, ref, 1)[2]; r2 = rouge_n(cand, ref, 2)[2]; rl = rouge_l(cand, ref)
        d1 = distinct(cand, 1); d2 = distinct(cand, 2)
        agg[key].append((r1, r2, rl, d1, d2))
        print("%-26s %8.4f %8.4f %8.4f %8.4f %8.4f" % (name, r1, r2, rl, d1, d2))
print("-"*74)
for key, nm in (("lead", "LEAD-2 baseline  MEAN"), ("sys", "THIS PIPELINE    MEAN")):
    m = np.mean(np.array(agg[key]), axis=0)
    print("%-26s %8.4f %8.4f %8.4f %8.4f %8.4f" % (nm, m[0], m[1], m[2], m[3], m[4]))

TP = sum(r["tp"] for r in results); FP = sum(r["fp"] for r in results); FN = sum(r["fn"] for r in results)
P = TP/(TP+FP) if TP+FP else 0.0
R = TP/(TP+FN) if TP+FN else 0.0
F = 2*P*R/(P+R) if P+R else 0.0
print()
print("DIVERGENCE DETECTION  (tau_uniq = %.2f)" % TAU_UNIQ)
print("  true positives  :", TP)
print("  false positives :", FP)
print("  false negatives :", FN)
print("  precision       : %.4f" % P)
print("  recall          : %.4f" % R)
print("  f1 score        : %.4f" % F)

tot_s = sum(r["n_sent"] for r in results); tot_p = sum(r["pool"] for r in results)
print()
print("REDUNDANCY REDUCTION  (tau_dup = %.2f)" % TAU_DUP)
print("  sentences before : %d   (mean %.2f per cluster)" % (tot_s, tot_s/len(results)))
print("  sentences after  : %d   (mean %.2f per cluster)" % (tot_p, tot_p/len(results)))
print("  compression      : %.2f %%" % (100*(1-tot_p/tot_s)))

print()
print("THRESHOLD SENSITIVITY  (tau_uniq)")
print("  %-10s %8s %8s %8s %8s" % ("tau_uniq", "detected", "prec", "rec", "f1"))
for t in (0.10, 0.15, 0.20, 0.25, 0.30, 0.40):
    a = b = c = 0
    for cl in sorted(set(labels)):
        rr = run_cluster(cl, tau_uniq=t, verbose=False)
        a += rr["tp"]; b += rr["fp"]; c += rr["fn"]
    p = a/(a+b) if a+b else 0.0
    q = a/(a+c) if a+c else 0.0
    f = 2*p*q/(p+q) if p+q else 0.0
    sweep_rows.append((t, a+b, p, q, f))
    print("  %-10.2f %8d %8.4f %8.4f %8.4f" % (t, a+b, p, q, f))

json.dump({"cluster_acc": cluster_acc, "results": results,
           "P": P, "R": R, "F": F, "TP": TP, "FP": FP, "FN": FN,
           "tot_s": tot_s, "tot_p": tot_p, "sweep": sweep_rows,
           "lead": np.mean(np.array(agg["lead"]), axis=0).tolist(),
           "sys": np.mean(np.array(agg["sys"]), axis=0).tolist(),
           "outputs": all_outputs},
          open('metrics.json', 'w'), indent=1)
print()
print("done")
