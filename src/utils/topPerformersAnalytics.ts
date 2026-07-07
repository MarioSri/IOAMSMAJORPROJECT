/**
 * Top Performers Analytics Utility
 *
 * Computes composite workflow-performance scores for each module using
 * real document data fetched from Supabase (no localStorage, no mock data).
 *
 * Composite Score = 40% success rate + 30% speed score + 30% volume score
 */

export interface TopPerformer {
  rank: number;
  name: string;
  score: number; // 0-100 composite score
  label: string; // display label for the % value
  breakdown: {
    successRate: number;
    speedScore: number;
    volumeScore: number;
  };
}

export interface ModuleDocStats {
  total: number;
  approved: number;
  rejected: number;
  /** Average processing time in milliseconds (submit → complete). null if no completed docs. */
  avgProcessingMs: number | null;
}

/** Normalise a value in [min, max] to a 0–100 score.
 *  Returns 50 (neutral) when all values are equal to avoid division by zero. */
function minMaxNormalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Extract workflow stats for a group of documents.
 * Handles field-name variations across tables (submitted_date vs submittedDate, etc.)
 */
export function computeModuleStats(docs: any[]): ModuleDocStats {
  const total = docs.length;
  const approved = docs.filter(d => d.status === 'approved').length;
  const rejected = docs.filter(d => d.status === 'rejected').length;

  const completedDocs = docs.filter(d => d.status === 'approved' || d.status === 'rejected');
  let avgProcessingMs: number | null = null;

  if (completedDocs.length > 0) {
    const times = completedDocs.map(doc => {
      const submitRaw =
        doc.submitted_date || doc.submittedDate || doc.created_at || null;
      const completeRaw = doc.updated_at || null;
      if (!submitRaw || !completeRaw) return 0;
      const diff = new Date(completeRaw).getTime() - new Date(submitRaw).getTime();
      return Math.max(0, diff);
    });
    avgProcessingMs = times.reduce((s, t) => s + t, 0) / times.length;
  }

  return { total, approved, rejected, avgProcessingMs };
}

/**
 * Given per-module stats, compute composite scores and return modules
 * sorted from highest to lowest score.
 */
export function rankModules(
  modules: Array<{ name: string; stats: ModuleDocStats }>
): TopPerformer[] {
  // ── 1. Per-module success rates
  const successRates = modules.map(m => {
    if (m.stats.total === 0) return 0;
    return (m.stats.approved / m.stats.total) * 100;
  });

  // ── 2. Speed scores: lower avgProcessingMs → better.
  //       Modules with no completed docs get the worst speed score (0).
  const processingTimes = modules.map(m =>
    m.stats.avgProcessingMs !== null ? m.stats.avgProcessingMs : Infinity
  );
  const finiteProcessingTimes = processingTimes.filter(t => t !== Infinity);
  const minTime = finiteProcessingTimes.length > 0 ? Math.min(...finiteProcessingTimes) : 0;
  const maxTime = finiteProcessingTimes.length > 0 ? Math.max(...finiteProcessingTimes) : 1;

  const speedScores = processingTimes.map(t => {
    if (t === Infinity) return 0;
    // Invert: fastest time gets the highest score
    return 100 - minMaxNormalize(t, minTime, maxTime);
  });

  // ── 3. Volume scores: more documents → better
  const volumes = modules.map(m => m.stats.total);
  const minVol = Math.min(...volumes);
  const maxVol = Math.max(...volumes);
  const volumeScores = volumes.map(v => minMaxNormalize(v, minVol, maxVol));

  // ── 4. Weighted composite
  const compositeScores = modules.map((_, i) => {
    if (modules[i].stats.total === 0) return 0;
    return successRates[i] * 0.4 + speedScores[i] * 0.3 + volumeScores[i] * 0.3;
  });

  // ── 5. Sort descending and assign ranks
  const indexed = modules.map((m, i) => ({ module: m, index: i }));
  indexed.sort((a, b) => compositeScores[b.index] - compositeScores[a.index]);

  return indexed.map((item, rankIdx) => {
    const i = item.index;
    const score = compositeScores[i];
    return {
      rank: rankIdx + 1,
      name: item.module.name,
      score: parseFloat(score.toFixed(1)),
      label: item.module.stats.total === 0 ? 'N/A' : `${score.toFixed(1)}%`,
      breakdown: {
        successRate: parseFloat(successRates[i].toFixed(1)),
        speedScore: parseFloat(speedScores[i].toFixed(1)),
        volumeScore: parseFloat(volumeScores[i].toFixed(1)),
      },
    };
  });
}
