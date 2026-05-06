import type {
  AnimationFilterConfigFile,
  LoadedAnimationFilterConfig,
} from './animationFilterConfigTypes.ts';

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

  return {
    path: configPath,
    include,
    exclude,
  };
}

export function createEmptyAnimationFilterConfig(): LoadedAnimationFilterConfig {
  return {
    include: [],
    exclude: [],
  };
}

function normalizePatternArray(
  value: string[] | undefined,
  fieldName: 'include' | 'exclude',
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

    return trimmed.replace(/\\/g, '/');
  });

  return [...normalized].sort((left, right) => left.localeCompare(right));
}
