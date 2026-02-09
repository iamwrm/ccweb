export interface FuzzyResult {
  path: string;
  score: number;
  matches: number[];
}

export function fuzzyMatch(query: string, path: string): FuzzyResult | null {
  const lq = query.toLowerCase();
  const lp = path.toLowerCase();

  let qi = 0;
  let score = 0;
  const matches: number[] = [];
  let prevMatch = -1;

  for (let i = 0; i < lp.length && qi < lq.length; i++) {
    if (lp[i] === lq[qi]) {
      matches.push(i);
      // Bonus for consecutive matches
      score += prevMatch === i - 1 ? 10 : 1;
      // Bonus for matching after separator or start
      if (i === 0 || lp[i - 1] === '/' || lp[i - 1] === '.') {
        score += 5;
      }
      prevMatch = i;
      qi++;
    }
  }

  if (qi !== lq.length) return null;

  // Penalty for longer paths
  score -= path.length * 0.1;

  // Bonus for filename match
  const filename = path.split('/').pop() || '';
  if (filename.toLowerCase().includes(lq)) {
    score += 20;
  }

  return { path, score, matches };
}

export function fuzzySearch(query: string, paths: string[], limit = 20): FuzzyResult[] {
  if (!query) {
    return paths.slice(0, limit).map(p => ({ path: p, score: 0, matches: [] }));
  }

  return paths
    .map(p => fuzzyMatch(query, p))
    .filter((r): r is FuzzyResult => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
