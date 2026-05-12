import type {
  AnimationDisplayConfigFile,
  AnimationHistoryConfigFile,
  AnimationDisplaySizeNormalization,
  AnimationFilterConfigFile,
  LoadedAnimationDisplayConfig,
  LoadedAnimationHistoryConfig,
  LoadedAnimationFilterConfig,
  LoadedAnimationDisplaySizeTrackedNodeConfig,
  LoadedAnimationDisplaySizeTrackingStyleConfig,
} from './animationFilterConfigTypes.ts';
import { normalizePathPattern } from './pathPattern.ts';

// 0.8125rem = 13px at the browser-default 16px root font size.
const DEFAULT_TRACKED_BASE_FONT_REM = 0.8125;

export function parseAnimationFilterConfig(
  configPath: string,
  content: string,
): LoadedAnimationFilterConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to read or parse animation filter config ${configPath}: ${error.message}`,
        { cause: error },
      );
    }

    throw new Error(`Failed to read or parse animation filter config ${configPath}.`, {
      cause: error,
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Animation filter config must be a JSON object: ${configPath}`);
  }

  const config = parsed as AnimationFilterConfigFile;
  const include = normalizePatternArray(config.include, 'include', configPath);
  const exclude = normalizePatternArray(config.exclude, 'exclude', configPath);
  const history = normalizeHistoryConfig(config.history, configPath);
  const display = normalizeDisplayConfig(config.display, configPath);

  return {
    path: configPath,
    include,
    exclude,
    history,
    display,
  };
}

export function createEmptyAnimationFilterConfig(): LoadedAnimationFilterConfig {
  return {
    include: [],
    exclude: [],
    history: createDefaultHistoryConfig(),
    display: createDefaultDisplayConfig(),
  };
}

function normalizeHistoryConfig(
  value: AnimationHistoryConfigFile | undefined,
  configPath: string,
): LoadedAnimationHistoryConfig {
  if (value === undefined) {
    return createDefaultHistoryConfig();
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Animation filter config field "history" must be a JSON object: ${configPath}`);
  }

  const trimEndProgressPercent = value.trimEndProgressPercent ?? 0;

  if (
    typeof trimEndProgressPercent !== 'number' ||
    !Number.isFinite(trimEndProgressPercent) ||
    trimEndProgressPercent < 0 ||
    trimEndProgressPercent >= 100
  ) {
    throw new Error(
      `Animation filter config field "history.trimEndProgressPercent" must be a number >= 0 and < 100: ${configPath}`,
    );
  }

  return {
    trimEndProgressPercent,
  };
}

function createDefaultHistoryConfig(): LoadedAnimationHistoryConfig {
  return {
    trimEndProgressPercent: 0,
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
  const sizeTrackedNodes = normalizeSizeTrackedNodes(
    value.sizeTrackedNodes,
    configPath,
  );
  const sizeTrackingStyle = normalizeSizeTrackingStyle(
    value.sizeTrackingStyle,
    configPath,
  );
  const sizeNormalization = normalizeSizeNormalization(
    value.sizeNormalization,
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
    maxChildrenByFolder,
    sizeTrackedNodes,
    sizeTrackingStyle,
    sizeNormalization,
  };
}

function createDefaultDisplayConfig(): LoadedAnimationDisplayConfig {
  return {
    maxDepth: 4,
    maxVisibleRows: null,
    hideButCount: [],
    maxChildrenByFolder: {},
    sizeTrackedNodes: {},
    sizeTrackingStyle: {
      baseRowHeightRem: 1.1,
      maxExtraHeightRem: 2,
      baseFontSizeRem: DEFAULT_TRACKED_BASE_FONT_REM,
      maxExtraFontSizeRem: 0.25,
    },
    sizeNormalization: 'trackedMax',
  };
}

function normalizePatternArray(
  value: string[] | undefined,
  fieldName:
    | 'include'
    | 'exclude'
    | 'display.hideButCount',
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

function normalizeSizeTrackedNodes(
  value: Record<string, { maxVisualPercent?: number }> | undefined,
  configPath: string,
): Record<string, LoadedAnimationDisplaySizeTrackedNodeConfig> {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `Animation filter config field "display.sizeTrackedNodes" must be an object of path-to-config entries: ${configPath}`,
    );
  }

  const entries = Object.entries(value).map(([rawPath, config]) => {
    const normalizedPath = normalizePathPattern(rawPath);

    if (normalizedPath.length === 0) {
      throw new Error(
        `Animation filter config field "display.sizeTrackedNodes" cannot contain empty paths: ${configPath}`,
      );
    }

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error(
        `Animation filter config field "display.sizeTrackedNodes" must contain object values. Invalid config for path "${rawPath}" in ${configPath}.`,
      );
    }

    const maxVisualPercent = config.maxVisualPercent ?? 100;

    if (
      typeof maxVisualPercent !== 'number' ||
      !Number.isFinite(maxVisualPercent) ||
      maxVisualPercent < 0
    ) {
      throw new Error(
        `Animation filter config field "display.sizeTrackedNodes" must contain maxVisualPercent values >= 0. Invalid config for path "${rawPath}" in ${configPath}.`,
      );
    }

    return [normalizedPath, { maxVisualPercent }] as const;
  });

  return Object.fromEntries(
    entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)),
  );
}

function normalizeSizeTrackingStyle(
  value:
    | {
        baseRowHeightRem?: number
        maxExtraHeightRem?: number
        baseFontSizeRem?: number
        maxExtraFontSizeRem?: number
      }
    | undefined,
  configPath: string,
): LoadedAnimationDisplaySizeTrackingStyleConfig {
  const defaults = createDefaultDisplayConfig().sizeTrackingStyle;

  if (value === undefined) {
    return { ...defaults };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `Animation filter config field "display.sizeTrackingStyle" must be a JSON object: ${configPath}`,
    );
  }

  const baseRowHeightRem = normalizePositiveNumber(
    value.baseRowHeightRem,
    defaults.baseRowHeightRem,
    'display.sizeTrackingStyle.baseRowHeightRem',
    configPath,
  );
  const maxExtraHeightRem = normalizeNonNegativeNumber(
    value.maxExtraHeightRem,
    defaults.maxExtraHeightRem,
    'display.sizeTrackingStyle.maxExtraHeightRem',
    configPath,
  );
  const baseFontSizeRem = normalizePositiveNumber(
    value.baseFontSizeRem,
    defaults.baseFontSizeRem,
    'display.sizeTrackingStyle.baseFontSizeRem',
    configPath,
  );
  const maxExtraFontSizeRem = normalizeNonNegativeNumber(
    value.maxExtraFontSizeRem,
    defaults.maxExtraFontSizeRem,
    'display.sizeTrackingStyle.maxExtraFontSizeRem',
    configPath,
  );

  return {
    baseRowHeightRem,
    maxExtraHeightRem,
    baseFontSizeRem,
    maxExtraFontSizeRem,
  };
}

function normalizeSizeNormalization(
  value: AnimationDisplaySizeNormalization | undefined,
  configPath: string,
): AnimationDisplaySizeNormalization {
  if (value === undefined) {
    return 'trackedMax';
  }

  if (value !== 'trackedMax') {
    throw new Error(
      `Animation filter config field "display.sizeNormalization" must be "trackedMax": ${configPath}`,
    );
  }

  return value;
}

function normalizePositiveNumber(
  value: number | undefined,
  defaultValue: number,
  fieldName: string,
  configPath: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Animation filter config field "${fieldName}" must be a positive number: ${configPath}`,
    );
  }

  return value;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
  defaultValue: number,
  fieldName: string,
  configPath: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `Animation filter config field "${fieldName}" must be a non-negative number: ${configPath}`,
    );
  }

  return value;
}
