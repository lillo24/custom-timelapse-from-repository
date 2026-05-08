import type {
  AnimationDisplayConfigFile,
  AnimationFilterConfigFile,
  LoadedAnimationDisplayConfig,
  LoadedAnimationFilterConfig,
} from './animationFilterConfigTypes.ts';
import { normalizePathPattern } from './pathPattern.ts';

export function parseAnimationFilterConfig(
  configPath: string,
  content: string,
): LoadedAnimationFilterConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse animation filter config ${configPath}: ${error.message}`);
    }

    throw new Error(`Failed to read or parse animation filter config ${configPath}.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Animation filter config must be a JSON object: ${configPath}`);
  }

  const config = parsed as AnimationFilterConfigFile;
  const include = normalizePatternArray(config.include, 'include', configPath);
  const exclude = normalizePatternArray(config.exclude, 'exclude', configPath);
  const display = normalizeDisplayConfig(config.display, configPath);

  return {
    path: configPath,
    include,
    exclude,
    display,
  };
}

export function createEmptyAnimationFilterConfig(): LoadedAnimationFilterConfig {
  return {
    include: [],
    exclude: [],
    display: createDefaultDisplayConfig(),
  };
}

function normalizeDisplayConfig(
  value: AnimationDisplayConfigFile | undefined,
  configPath: string,
): LoadedAnimationDisplayConfig {
  if (value === undefined) {
    return createDefaultDisplayConfig();
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Animation filter config field "display" must be a JSON object: ${configPath}`);
  }

  const maxDepth = normalizeMaxDepth(value.maxDepth, configPath);
  const maxVisibleRows = normalizeMaxVisibleRows(value.maxVisibleRows, configPath);
  const hideButCount = normalizePatternArray(
    value.hideButCount,
    'display.hideButCount',
    configPath,
  );
  const collapseFolders = normalizePatternArray(
    value.collapseFolders,
    'display.collapseFolders',
    configPath,
  );
  const maxChildrenByFolder = normalizeMaxChildrenByFolder(
    value.maxChildrenByFolder,
    configPath,
  );

  return {
    maxDepth,
    maxVisibleRows,
    hideButCount,
    collapseFolders,
    maxChildrenByFolder,
  };
}

function createDefaultDisplayConfig(): LoadedAnimationDisplayConfig {
  return {
    maxDepth: 4,
    maxVisibleRows: null,
    hideButCount: [],
    collapseFolders: [],
    maxChildrenByFolder: {},
  };
}

function normalizePatternArray(
  value: string[] | undefined,
  fieldName:
    | 'include'
    | 'exclude'
    | 'display.hideButCount'
    | 'display.collapseFolders',
  configPath: string,
): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Animation filter config field "${fieldName}" must be an array of strings: ${configPath}`);
  }

  const normalized = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(
        `Animation filter config field "${fieldName}" must contain only strings. Invalid entry at index ${index} in ${configPath}.`,
      );
    }

    const trimmed = entry.trim();

    if (trimmed.length === 0) {
      throw new Error(
        `Animation filter config field "${fieldName}" cannot contain empty patterns. Invalid entry at index ${index} in ${configPath}.`,
      );
    }

    return normalizePathPattern(trimmed);
  });

  return [...normalized].sort((left, right) => left.localeCompare(right));
}

function normalizeMaxDepth(value: number | undefined, configPath: string): number {
  if (value === undefined) {
    return 4;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Animation filter config field "display.maxDepth" must be a non-negative integer: ${configPath}`,
    );
  }

  return value;
}

function normalizeMaxVisibleRows(
  value: number | null | undefined,
  configPath: string,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Animation filter config field "display.maxVisibleRows" must be null or a positive integer: ${configPath}`,
    );
  }

  return value;
}

function normalizeMaxChildrenByFolder(
  value: Record<string, number> | undefined,
  configPath: string,
): Record<string, number> {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `Animation filter config field "display.maxChildrenByFolder" must be an object of pattern-to-integer entries: ${configPath}`,
    );
  }

  const entries = Object.entries(value).map(([pattern, limit]) => {
    const normalizedPattern = normalizePathPattern(pattern);

    if (normalizedPattern.length === 0) {
      throw new Error(
        `Animation filter config field "display.maxChildrenByFolder" cannot contain empty patterns: ${configPath}`,
      );
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        `Animation filter config field "display.maxChildrenByFolder" must contain only positive integers. Invalid limit for pattern "${pattern}" in ${configPath}.`,
      );
    }

    return [normalizedPattern, limit] as const;
  });

  return Object.fromEntries(
    entries.sort(([leftPattern], [rightPattern]) =>
      leftPattern.localeCompare(rightPattern),
    ),
  );
}
