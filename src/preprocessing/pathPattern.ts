export function normalizePathValue(value: string): string {
  return value.replace(/\\/g, '/');
}

export function normalizePathPattern(pattern: string): string {
  return normalizePathValue(pattern.trim());
}

export function matchesPathPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePathValue(filePath).toLowerCase();
  const normalizedPattern = normalizePathPattern(pattern).toLowerCase();

  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.startsWith('**/')) {
    const suffix = normalizedPattern.slice(3);
    return normalizedPath === suffix || normalizedPath.endsWith(`/${suffix}`);
  }

  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1);
    return normalizedPath.endsWith(suffix);
  }

  return normalizedPath === normalizedPattern;
}

export function comparePatternSpecificity(left: string, right: string): number {
  const leftSpecificity = getPatternSpecificity(left);
  const rightSpecificity = getPatternSpecificity(right);

  if (leftSpecificity !== rightSpecificity) {
    return rightSpecificity - leftSpecificity;
  }

  return left.localeCompare(right);
}

function getPatternSpecificity(pattern: string): number {
  return pattern.replace(/\*/g, '').length;
}
