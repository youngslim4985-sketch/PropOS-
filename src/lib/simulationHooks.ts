import { useMemo } from 'react';
import { WelfordStats, buildHistogramStats } from './simulationStats';

/**
 * Hook to compute O(N) simulation statistics.
 * Avoids expensive sorting and excessive memory allocations.
 */
export const useSimulationStats = (simulatedRaw: any[]) => {
  return useMemo(() => {
    const welford = new WelfordStats();
    const values = new Array(simulatedRaw.length);

    for (let i = 0; i < simulatedRaw.length; i++) {
      // Assuming the value to track is simulatedScore
      const v = simulatedRaw[i].simulatedScore || 0;
      values[i] = v;
      welford.update(v);
    }

    const hist = buildHistogramStats(values, 64);

    return {
      mean: welford.meanValue,
      stdDev: welford.stdDev,

      // Approx distribution
      median: hist.median,
      p25: hist.p25,
      p75: hist.p75,
      min: hist.min,
      max: hist.max,

      count: values.length
    };
  }, [simulatedRaw]);
};
