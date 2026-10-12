// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// AgglomerativeClustering(n_clusters=None, distance_threshold=delta, metric='precomputed', linkage='average').
//   1. average-linkage merge tree (sklearn hands this to scipy.cluster.hierarchy.linkage); here a plain greedy
//      implementation using scipy's update formula and scipy's node numbering (union-find relabelling);
//   2. n_clusters = (number of merge distances >= delta) + 1, as sklearn computes it;
//   3. sklearn's _hc_cut, including its heapq-based ordering, which decides the label ids (and therefore
//      the order of stories and their "Story N" names).

export interface LinkageTree {
  /** children[i] = the two nodes merged to form node n + i (smaller id first) */
  children: [number, number][];
  distances: number[];
}

/** Average linkage over a dense n x n distance matrix (row-major). */
export function averageLinkage(D: Float64Array, n: number): LinkageTree {
  const d = Float64Array.from(D);
  const size = new Array<number>(n).fill(1);
  const node = Array.from({ length: n }, (_, i) => i); // node id currently held by each slot
  const children: [number, number][] = [];
  const distances: number[] = [];

  for (let step = 0; step < n - 1; step++) {
    let bx = -1;
    let by = -1;
    let best = Infinity;
    for (let x = 0; x < n; x++) {
      if (size[x] === 0) continue;
      for (let y = x + 1; y < n; y++) {
        if (size[y] === 0) continue;
        const v = d[x * n + y]!;
        if (v < best) {
          best = v;
          bx = x;
          by = y;
        }
      }
    }
    const nx = size[bx]!;
    const ny = size[by]!;
    const a = node[bx]!;
    const b = node[by]!;
    children.push(a < b ? [a, b] : [b, a]);
    distances.push(best);
    // merged cluster lives in slot `by`, like scipy's nn_chain
    size[bx] = 0;
    size[by] = nx + ny;
    node[by] = n + step;
    for (let i = 0; i < n; i++) {
      if (size[i] === 0 || i === by) continue;
      const v = (nx * d[i * n + bx]! + ny * d[i * n + by]!) / (nx + ny);
      d[i * n + by] = v;
      d[by * n + i] = v;
    }
  }
  return { children, distances };
}

// ---- Python heapq (min-heap on plain numbers), needed verbatim for _hc_cut's ordering
function siftDown(heap: number[], start: number, pos: number): void {
  const item = heap[pos]!;
  while (pos > start) {
    const parentPos = (pos - 1) >> 1;
    const parent = heap[parentPos]!;
    if (item < parent) {
      heap[pos] = parent;
      pos = parentPos;
      continue;
    }
    break;
  }
  heap[pos] = item;
}

function siftUp(heap: number[], pos: number): void {
  const end = heap.length;
  const start = pos;
  const item = heap[pos]!;
  let child = 2 * pos + 1;
  while (child < end) {
    const right = child + 1;
    if (right < end && !(heap[child]! < heap[right]!)) child = right;
    heap[pos] = heap[child]!;
    pos = child;
    child = 2 * pos + 1;
  }
  heap[pos] = item;
  siftDown(heap, start, pos);
}

function heappush(heap: number[], item: number): void {
  heap.push(item);
  siftDown(heap, 0, heap.length - 1);
}

function heappushpop(heap: number[], item: number): number {
  if (heap.length > 0 && heap[0]! < item) {
    const top = heap[0]!;
    heap[0] = item;
    siftUp(heap, 0);
    return top;
  }
  return item;
}

function descendants(nodeId: number, children: [number, number][], nLeaves: number): number[] {
  const out: number[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const v = stack.pop()!;
    if (v < nLeaves) out.push(v);
    else stack.push(...children[v - nLeaves]!);
  }
  return out;
}

/** sklearn.cluster._agglomerative._hc_cut */
export function hcCut(nClusters: number, children: [number, number][], nLeaves: number): number[] {
  if (nClusters > nLeaves) throw new Error(`Cannot extract ${nClusters} clusters from ${nLeaves} leaves`);
  const last = children[children.length - 1]!;
  const nodes = [-(Math.max(last[0], last[1]) + 1)];
  for (let i = 0; i < nClusters - 1; i++) {
    const these = children[-nodes[0]! - nLeaves]!;
    heappush(nodes, -these[0]);
    heappushpop(nodes, -these[1]);
  }
  const label = new Array<number>(nLeaves).fill(0);
  nodes.forEach((nd, i) => {
    for (const leaf of descendants(-nd, children, nLeaves)) label[leaf] = i;
  });
  return label;
}

/** Cluster labels for n items given their dense distance matrix and sklearn's distance_threshold. */
export function agglomerative(D: Float64Array, n: number, threshold: number): number[] {
  if (n === 1) return [0];
  const tree = averageLinkage(D, n);
  const nClusters = tree.distances.filter((x) => x >= threshold).length + 1;
  return hcCut(nClusters, tree.children, n);
}
