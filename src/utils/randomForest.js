/**
 * RandomForest - simple JS implementation for numeric features.
 * - Decision trees built by recursive greedy binary splits (depth-limited).
 * - Uses bootstrap sampling for each tree and majority vote.
 *
 * NOT for production: educational, configurable and fast enough for small prototyping.
 */

function gini(labels) {
  if (!labels || labels.length === 0) return 0;
  const counts = {};
  labels.forEach(l => counts[l] = (counts[l] || 0) + 1);
  let impurity = 1;
  const total = labels.length;
  for (const k in counts) {
    const p = counts[k] / total;
    impurity -= p * p;
  }
  return impurity;
}

function unique(values) {
  return Array.from(new Set(values));
}

class TreeNode {
  constructor() {
    this.left = null;
    this.right = null;
    this.featureIndex = null;
    this.threshold = null;
    this.prediction = null;
    this.isLeaf = false;
  }
}

class DecisionTree {
  constructor({ maxDepth = 6, minSamplesSplit = 4, maxFeatures = null } = {}) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.maxFeatures = maxFeatures;
    this.root = null;
  }

  fit(X, y) {
    this.nFeatures = X[0].length;
    this.featuresToTry = this.maxFeatures ? Math.max(1, Math.floor(this.maxFeatures)) : this.nFeatures;
    this.root = this._buildTree(X, y, 0);
  }

  _buildTree(X, y, depth) {
    const node = new TreeNode();
    const numSamples = y.length;
    const numLabels = unique(y).length;

    // stopping conditions
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || numLabels === 1) {
      node.isLeaf = true;
      node.prediction = this._majorityClass(y);
      return node;
    }

    // choose a subset of features to try
    const featIndices = shuffle(Array.from(Array(this.nFeatures).keys())).slice(0, this.featuresToTry);

    // find best split
    let bestGain = 0;
    let bestFeature = null;
    let bestThreshold = null;
    let bestLeftIdx = null;
    let bestRightIdx = null;

    const parentGini = gini(y);

    for (const fi of featIndices) {
      // compute candidate thresholds as midpoints of sorted unique feature values
      const vals = X.map(r => r[fi]);
      const sorted = Array.from(new Set(vals)).sort((a,b) => a-b);
      if (sorted.length <= 1) continue;
      const thresholds = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        thresholds.push((sorted[i] + sorted[i+1]) / 2.0);
      }
      for (const thr of thresholds) {
        const leftIdx = [];
        const rightIdx = [];
        for (let i = 0; i < X.length; i++) {
          if (X[i][fi] <= thr) leftIdx.push(i);
          else rightIdx.push(i);
        }
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;
        const leftY = leftIdx.map(i => y[i]);
        const rightY = rightIdx.map(i => y[i]);
        const gain = parentGini - (leftY.length / y.length) * gini(leftY) - (rightY.length / y.length) * gini(rightY);
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = fi;
          bestThreshold = thr;
          bestLeftIdx = leftIdx;
          bestRightIdx = rightIdx;
        }
      }
    }

    if (bestGain === 0 || !bestFeature) {
      node.isLeaf = true;
      node.prediction = this._majorityClass(y);
      return node;
    }

    // Build child nodes
    node.featureIndex = bestFeature;
    node.threshold = bestThreshold;

    const Xleft = bestLeftIdx.map(i => X[i]);
    const yleft = bestLeftIdx.map(i => y[i]);
    const Xright = bestRightIdx.map(i => X[i]);
    const yright = bestRightIdx.map(i => y[i]);

    node.left = this._buildTree(Xleft, yleft, depth + 1);
    node.right = this._buildTree(Xright, yright, depth + 1);
    return node;
  }

  _majorityClass(labels) {
    const counts = {};
    labels.forEach(l => counts[l] = (counts[l] || 0) + 1);
    let best = null;
    let bestCount = -1;
    for (const k in counts) {
      if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
    }
    return best;
  }

  predictRow(row) {
    let node = this.root;
    while (!node.isLeaf) {
      if (row[node.featureIndex] <= node.threshold) node = node.left;
      else node = node.right;
    }
    return node.prediction;
  }

  predict(X) {
    return X.map(r => this.predictRow(r));
  }
}

/* Utilities */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* RandomForest class */
export class RandomForest {
  constructor({ nEstimators = 10, maxDepth = 6, minSamplesSplit = 4, sampleRatio = 0.7, maxFeatures = null } = {}) {
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.sampleRatio = sampleRatio;
    this.maxFeatures = maxFeatures || Math.floor(Math.sqrt(5)); // default sqrt(#features)
    this.trees = [];
  }

  fit(X, y) {
    this.trees = [];
    const nSamples = X.length;
    for (let i = 0; i < this.nEstimators; i++) {
      // bootstrap sample
      const sampleSize = Math.max(2, Math.floor(this.sampleRatio * nSamples));
      const Xs = [];
      const ys = [];
      for (let j = 0; j < sampleSize; j++) {
        const idx = Math.floor(Math.random() * nSamples);
        Xs.push(X[idx]);
        ys.push(y[idx]);
      }
      const tree = new DecisionTree({ maxDepth: this.maxDepth, minSamplesSplit: this.minSamplesSplit, maxFeatures: this.maxFeatures });
      tree.fit(Xs, ys);
      this.trees.push(tree);
    }
  }

  predict(X) {
    if (!this.trees || this.trees.length === 0) return Array(X.length).fill(null);
    // collect votes
    const votes = X.map(() => ({}));
    for (const tree of this.trees) {
      const preds = tree.predict(X);
      preds.forEach((p, i) => votes[i][p] = (votes[i][p] || 0) + 1);
    }
    return votes.map(v => {
      let best = null, bestCount = -1;
      for (const k in v) {
        if (v[k] > bestCount) { best = k; bestCount = v[k]; }
      }
      return best;
    });
  }
}
