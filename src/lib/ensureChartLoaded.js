/**
 * ensureChartLoaded — loads Chart.js from npm (not CDN).
 * Works in Next.js SSR safely. Singleton promise prevents double-loading.
 */
let chartLoadPromise = null;

export function ensureChartLoaded() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Chart) return Promise.resolve(window.Chart);

  if (!chartLoadPromise) {
    chartLoadPromise = import('chart.js/auto')
      .then((mod) => {
        const Chart = mod.default || mod.Chart || mod;
        window.Chart = Chart;
        return Chart;
      })
      .catch((err) => {
        chartLoadPromise = null;
        console.warn('[OmniSensus] Chart.js failed to load:', err);
        throw err;
      });
  }
  return chartLoadPromise;
}
