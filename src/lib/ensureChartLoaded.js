let chartLoadPromise = null;

export function ensureChartLoaded() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.Chart) {
    return Promise.resolve(window.Chart);
  }

  if (!chartLoadPromise) {
    chartLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="chart.js"]');
      const onReady = () => {
        if (window.Chart) {
          resolve(window.Chart);
          return;
        }

        const started = Date.now();
        const timer = window.setInterval(() => {
          if (window.Chart) {
            window.clearInterval(timer);
            resolve(window.Chart);
            return;
          }
          if (Date.now() - started > 10000) {
            window.clearInterval(timer);
            reject(new Error('Chart.js load timeout'));
          }
        }, 50);
      };

      if (existing) {
        if (window.Chart) {
          resolve(window.Chart);
        } else {
          existing.addEventListener('load', onReady, { once: true });
          existing.addEventListener('error', () => reject(new Error('Chart.js script failed to load')), { once: true });
          onReady();
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.async = true;
      script.onload = onReady;
      script.onerror = () => reject(new Error('Chart.js script failed to load'));
      document.head.appendChild(script);
    }).catch((err) => {
      chartLoadPromise = null;
      throw err;
    });
  }

  return chartLoadPromise;
}
