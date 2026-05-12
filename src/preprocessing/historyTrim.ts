import type { RepoChangeUnit } from './changeUnitTypes.ts';

export interface HistoryTrimMetadata {
  trimEndProgressPercent: number;
  sourceUnitCount: number;
  keptUnitCount: number;
  droppedUnitCount: number;
  cutoffUnitOrder: number | null;
}

export function createDefaultHistoryTrimMetadata(
  sourceUnitCount: number,
): HistoryTrimMetadata {
  return {
    trimEndProgressPercent: 0,
    sourceUnitCount,
    keptUnitCount: sourceUnitCount,
    droppedUnitCount: 0,
    cutoffUnitOrder: sourceUnitCount > 0 ? sourceUnitCount - 1 : null,
  };
}

export function resolveHistoryTrim(
  units: RepoChangeUnit[],
  trimEndProgressPercent: number,
): {
  historyTrim: HistoryTrimMetadata;
  retainedUnits: RepoChangeUnit[];
} {
  const sourceUnitCount = units.length;

  if (sourceUnitCount === 0 || trimEndProgressPercent === 0) {
    return {
      historyTrim: createDefaultHistoryTrimMetadata(sourceUnitCount),
      retainedUnits: [...units],
    };
  }

  const keptUnitCount = Math.min(
    sourceUnitCount,
    Math.max(
      0,
      Math.ceil(sourceUnitCount * ((100 - trimEndProgressPercent) / 100)),
    ),
  );
  const droppedUnitCount = sourceUnitCount - keptUnitCount;
  const retainedUnits = units.slice(0, keptUnitCount);

  return {
    historyTrim: {
      trimEndProgressPercent,
      sourceUnitCount,
      keptUnitCount,
      droppedUnitCount,
      cutoffUnitOrder: retainedUnits.at(-1)?.unitOrder ?? null,
    },
    retainedUnits,
  };
}

export function normalizeHistoryTrimMetadata(
  value: HistoryTrimMetadata | undefined,
  sourceUnitCount: number,
): HistoryTrimMetadata {
  if (!value) {
    return createDefaultHistoryTrimMetadata(sourceUnitCount);
  }

  return {
    trimEndProgressPercent: value.trimEndProgressPercent,
    sourceUnitCount: value.sourceUnitCount,
    keptUnitCount: value.keptUnitCount,
    droppedUnitCount: value.droppedUnitCount,
    cutoffUnitOrder: value.cutoffUnitOrder,
  };
}

