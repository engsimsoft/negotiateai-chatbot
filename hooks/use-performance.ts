"use client";

import { useEffect, useRef } from "react";

type PerformanceMetrics = {
  componentName: string;
  renderTime: number;
  timestamp: number;
};

/**
 * Hook for measuring React component render performance
 * Logs metrics to console in development mode
 */
export function usePerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);

  // Measure render start time
  renderStartTime.current = performance.now();
  renderCount.current += 1;

  useEffect(() => {
    // Measure render end time
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;
    totalRenderTime.current += renderDuration;

    const metrics: PerformanceMetrics = {
      componentName,
      renderTime: renderDuration,
      timestamp: Date.now(),
    };

    // Log metrics in development mode
    if (process.env.NODE_ENV === "development") {
      const avgRenderTime = totalRenderTime.current / renderCount.current;

      console.log(
        `[Performance] ${componentName}:`,
        `Render #${renderCount.current}`,
        `Time: ${renderDuration.toFixed(2)}ms`,
        `Avg: ${avgRenderTime.toFixed(2)}ms`
      );

      // Warn if render is slow
      if (renderDuration > 100) {
        console.warn(
          `[Performance] ⚠️ Slow render detected in ${componentName}: ${renderDuration.toFixed(2)}ms`
        );
      }
    }

    // Store metrics in sessionStorage for analysis
    try {
      const existingMetrics = sessionStorage.getItem("performance-metrics");
      const metricsArray = existingMetrics ? JSON.parse(existingMetrics) : [];
      metricsArray.push(metrics);

      // Keep only last 100 measurements
      if (metricsArray.length > 100) {
        metricsArray.shift();
      }

      sessionStorage.setItem("performance-metrics", JSON.stringify(metricsArray));
    } catch (error) {
      // Ignore storage errors
    }
  });

  return {
    renderCount: renderCount.current,
    averageRenderTime: totalRenderTime.current / renderCount.current,
  };
}

/**
 * Get all performance metrics from sessionStorage
 */
export function getPerformanceMetrics(): PerformanceMetrics[] {
  try {
    const metrics = sessionStorage.getItem("performance-metrics");
    return metrics ? JSON.parse(metrics) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all performance metrics
 */
export function clearPerformanceMetrics(): void {
  try {
    sessionStorage.removeItem("performance-metrics");
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(): string {
  const metrics = getPerformanceMetrics();

  if (metrics.length === 0) {
    return "No performance data available";
  }

  const componentStats = new Map<string, { count: number; totalTime: number; maxTime: number }>();

  metrics.forEach((metric) => {
    const existing = componentStats.get(metric.componentName) || {
      count: 0,
      totalTime: 0,
      maxTime: 0,
    };

    componentStats.set(metric.componentName, {
      count: existing.count + 1,
      totalTime: existing.totalTime + metric.renderTime,
      maxTime: Math.max(existing.maxTime, metric.renderTime),
    });
  });

  let report = "=== Performance Report ===\n\n";

  componentStats.forEach((stats, componentName) => {
    const avgTime = stats.totalTime / stats.count;
    report += `${componentName}:\n`;
    report += `  Renders: ${stats.count}\n`;
    report += `  Avg Time: ${avgTime.toFixed(2)}ms\n`;
    report += `  Max Time: ${stats.maxTime.toFixed(2)}ms\n\n`;
  });

  return report;
}
