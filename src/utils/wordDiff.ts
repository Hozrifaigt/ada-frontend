export type DiffPart = { type: 'equal' | 'added' | 'removed'; value: string };

/**
 * Word-level diff using an LCS over whitespace-delimited tokens.
 * Returns ordered parts so the proposed text can be rendered with red (removed)
 * and green (added) highlights against the current content. No dependencies.
 */
export function wordDiff(oldText: string, newText: string): DiffPart[] {
  const tokenize = (s: string): string[] => s.match(/\S+\s*/g) || [];
  const a = tokenize(oldText || '');
  const b = tokenize(newText || '');
  const n = a.length;
  const m = b.length;

  // LCS length table over trimmed tokens.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].trim() === b[j].trim()
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], value: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.value += value;
    else parts.push({ type, value });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      push('equal', b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('removed', a[i]);
      i++;
    } else {
      push('added', b[j]);
      j++;
    }
  }
  while (i < n) push('removed', a[i++]);
  while (j < m) push('added', b[j++]);
  return parts;
}
