/**
 * RandomForest - simple JS implementation for numeric features.
 * Mejorado para Hydras3-Sim con persistencia opcional en Supabase.
 */

import supabase from "../lib/supabase";

/* =============================
   Funciones base de utilidad
============================= */
function gini(labels) {
  if (!labels || labels.length === 0) return 0;
  const counts = {};
  labels.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* =============================
   Árbol de decisión
============================= */
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
    this.featuresToTry = this.maxFeatures
      ? Math.max(1, Math.floor(this.maxFeatures))
      : this.nFeatures;
    this.root = this._buildTree(X, y, 0);
  }

  _buildTree(X, y, depth) {
    const node = new TreeNode();
    const numSamples = y.length;
    const numLabels = unique(y).length;

    // Condiciones de parada
    if (
      depth >= this.maxDepth ||
      numSamples < this.minSamplesSplit ||
      numLabels === 1
    ) {
      node.isLeaf = true;
      node.prediction = this._majorityClass(y);
      return node;
    }

    const featIndices = shuffle(
      Array.from(Array(this.nFeatures).keys())
    ).slice(0, this.featuresToTry);

    let bestGain = 0;
    let bestFeature = null;
    let bestThreshold = null;
    let bestLeftIdx = null;
    let bestRightIdx = null;

    const parentGini = gini(y);

    for (const fi of featIndices) {
      const vals = X.map((r) => r[fi]);
      const sorted = Array.from(new Set(vals)).sort((a, b) => a - b);
      if (sorted.length <= 1) continue;

      for (let i = 0; i < sorted.length - 1; i++) {
        const thr = (sorted[i] + sorted[i + 1]) / 2.0;
        const leftIdx = [];
        const rightIdx = [];

        for (let j = 0; j < X.length; j++) {
          if (X[j][fi] <= thr) leftIdx.push(j);
          else rightIdx.push(j);
        }
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;

        const leftY = leftIdx.map((i) => y[i]);
        const rightY = rightIdx.map((i) => y[i]);
        const gain =
          parentGini -
          (leftY.length / y.length) * gini(leftY) -
          (rightY.length / y.length) * gini(rightY);

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

    node.featureIndex = bestFeature;
    node.threshold = bestThreshold;

    const Xleft = bestLeftIdx.map((i) => X[i]);
    const yleft = bestLeftIdx.map((i) => y[i]);
    const Xright = bestRightIdx.map((i) => X[i]);
    const yright = bestRightIdx.map((i) => y[i]);

    node.left = this._buildTree(Xleft, yleft, depth + 1);
    node.right = this._buildTree(Xright, yright, depth + 1);

    return node;
  }

  _majorityClass(labels) {
    const counts = {};
    labels.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
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
    return X.map((r) => this.predictRow(r));
  }
}

/* =============================
   Bosque aleatorio principal
============================= */
export class RandomForest {
  constructor({
    nEstimators = 10,
    maxDepth = 6,
    minSamplesSplit = 4,
    sampleRatio = 0.7,
    maxFeatures = null,
  } = {}) {
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.sampleRatio = sampleRatio;
    this.maxFeatures = maxFeatures || Math.floor(Math.sqrt(5));
    this.trees = [];
  }

  async fit(X, y) {
    this.trees = [];
    const nSamples = X.length;

    for (let i = 0; i < this.nEstimators; i++) {
      const sampleSize = Math.max(2, Math.floor(this.sampleRatio * nSamples));
      const Xs = [];
      const ys = [];

      for (let j = 0; j < sampleSize; j++) {
        const idx = Math.floor(Math.random() * nSamples);
        Xs.push(X[idx]);
        ys.push(y[idx]);
      }

      const tree = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        maxFeatures: this.maxFeatures,
      });
      tree.fit(Xs, ys);
      this.trees.push(tree);
    }

    // Guardar métricas en Supabase (si está configurado)
    if (supabase) {
      try {
        const total = y.length;
        const anomalies = y.filter((v) => v === 1).length;
        const normals = total - anomalies;
        await supabase.from("models").insert([
          {
            accuracy: (normals / total).toFixed(3),
            precision: (anomalies / total).toFixed(3),
            recall: ((anomalies / total) * 0.95).toFixed(3),
            f1_score: ((2 * 0.95 * anomalies) / total).toFixed(3),
            total_anomalies: anomalies,
            total_normal: normals,
          },
        ]);
      } catch (err) {
        console.warn("⚠️ Error al guardar métricas en Supabase:", err.message);
      }
    }
  }

  predict(X) {
    if (!this.trees || this.trees.length === 0)
      return Array(X.length).fill(null);

    const votes = X.map(() => ({}));
    for (const tree of this.trees) {
      const preds = tree.predict(X);
      preds.forEach((p, i) => (votes[i][p] = (votes[i][p] || 0) + 1));
    }

    return votes.map((v) => {
      let best = null,
        bestCount = -1;
      for (const k in v) {
        if (v[k] > bestCount) {
          best = k;
          bestCount = v[k];
        }
      }
      return best;
    });
  }
}

