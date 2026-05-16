/**
 * High-performance statistics utilities using O(N) algorithms.
 */

/**
 * Welford's algorithm for computing running mean and variance.
 * Provides numerically stable stats in a single pass O(N).
 */
export class WelfordStats {
  private n = 0;
  private mean = 0;
  private m2 = 0;

  update(x: number) {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.m2 += delta * delta2;
  }

  get meanValue() {
    return this.mean;
  }

  get variance() {
    return this.n > 1 ? this.m2 / (this.n - 1) : 0;
  }

  get stdDev() {
    return Math.sqrt(this.variance) || 0;
  }

  get count() {
    return this.n;
  }
}

/**
 * Approximate percentiles using a histogram.
 * Eliminates O(N log N) sorting requirement.
 */
export function buildHistogramStats(
  values: number[],
  buckets = 64
) {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      median: 0,
      p25: 0,
      p75: 0
    };
  }

  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Edge case: flat distribution
  if (min === max) {
    return {
      min,
      max,
      median: min,
      p25: min,
      p75: min
    };
  }

  const range = max - min;
  const hist = new Uint32Array(buckets);

  // Populate histogram (O(N))
  for (let i = 0; i < values.length; i++) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, ((values[i] - min) / range * buckets) | 0)
    );
    hist[idx]++;
  }

  const total = values.length;

  const percentileFromHist = (target: number) => {
    const threshold = total * target;
    let cumulative = 0;

    for (let i = 0; i < buckets; i++) {
      cumulative += hist[i];
      if (cumulative >= threshold) {
        return min + (i / buckets) * range;
      }
    }

    return max;
  };

  return {
    min,
    max,
    median: percentileFromHist(0.5),
    p25: percentileFromHist(0.25),
    p75: percentileFromHist(0.75),
  };
}
