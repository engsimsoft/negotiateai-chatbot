/**
 * Performance analysis utilities for browser console
 *
 * Usage in browser console:
 * - window.showPerformanceReport() - Display performance report
 * - window.clearPerformanceMetrics() - Clear all metrics
 */

import {
  clearPerformanceMetrics,
  generatePerformanceReport,
  getPerformanceMetrics,
} from "@/hooks/use-performance";

// Expose to window for browser console access
if (typeof window !== "undefined") {
  (window as any).showPerformanceReport = () => {
    console.log(generatePerformanceReport());
  };

  (window as any).clearPerformanceMetrics = () => {
    clearPerformanceMetrics();
    console.log("Performance metrics cleared");
  };

  (window as any).getPerformanceMetrics = () => {
    return getPerformanceMetrics();
  };

  // Log helper message on load
  if (process.env.NODE_ENV === "development") {
    console.log(
      "%c📊 Performance Monitoring Active",
      "color: #4CAF50; font-weight: bold; font-size: 14px;"
    );
    console.log(
      "%cAvailable commands:",
      "color: #2196F3; font-weight: bold;"
    );
    console.log("  window.showPerformanceReport() - Show performance report");
    console.log("  window.clearPerformanceMetrics() - Clear metrics");
    console.log("  window.getPerformanceMetrics() - Get raw metrics data");
  }
}

export {};
