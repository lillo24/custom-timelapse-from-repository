export interface RepoLineMetricsFrame {
  unitIndex: number;
  unitOrder: number;
  currentLoc: number;
  addedTotal: number;
  deletedTotal: number;
}

export interface RepoSourceFileReplayState {
  exists: boolean;
  currentLineCount: number;
}

type TimelineUnitLike = {
  unitOrder: number;
  sourceFileId: string;
  type: string;
  lineDelta: number;
  unitLineAmount: number | null;
  beforeLineCount: number | null;
  afterLineCount: number | null;
};

export function buildRepoLineMetricsTimeline<Unit extends TimelineUnitLike>(
  timeline: readonly Unit[],
): RepoLineMetricsFrame[] {
  const sourceFileStateById = new Map<string, RepoSourceFileReplayState>();
  const lineMetricsTimeline: RepoLineMetricsFrame[] = [];
  let currentLoc = 0;
  let addedTotal = 0;
  let deletedTotal = 0;

  for (const [unitIndex, unit] of timeline.entries()) {
    const currentFileState = sourceFileStateById.get(unit.sourceFileId) ?? {
      exists: false,
      currentLineCount: 0,
    };
    const nextFileState = applyTimelineUnitToSourceFileState(currentFileState, unit);

    currentLoc = Math.max(
      0,
      currentLoc -
        getCurrentLocContribution(currentFileState) +
        getCurrentLocContribution(nextFileState),
    );

    sourceFileStateById.set(unit.sourceFileId, nextFileState);

    const lineChange = getExactTimelineUnitLineChange(unit);
    addedTotal += lineChange.addedLines;
    deletedTotal += lineChange.deletedLines;

    lineMetricsTimeline.push({
      unitIndex,
      unitOrder: unit.unitOrder,
      currentLoc,
      addedTotal,
      deletedTotal,
    });
  }

  return lineMetricsTimeline;
}

export function applyTimelineUnitToSourceFileState<Unit extends TimelineUnitLike>(
  fileState: RepoSourceFileReplayState,
  unit: Unit,
): RepoSourceFileReplayState {
  if (unit.type === 'delete') {
    return {
      ...fileState,
      exists: false,
      currentLineCount: 0,
    };
  }

  let nextLineCount = fileState.currentLineCount;

  if (unit.afterLineCount !== null) {
    nextLineCount = Math.max(0, unit.afterLineCount);
  } else if (unit.beforeLineCount !== null) {
    nextLineCount = Math.max(0, unit.beforeLineCount + unit.lineDelta);
  } else if (unit.type === 'create' || unit.type === 'copy') {
    nextLineCount = Math.max(0, unit.lineDelta);
  } else {
    nextLineCount = Math.max(0, fileState.currentLineCount + unit.lineDelta);
  }

  return {
    ...fileState,
    exists: true,
    currentLineCount: nextLineCount,
  };
}

export function sumCurrentLocFromSourceFileStates(
  sourceFileStates: Iterable<RepoSourceFileReplayState>,
): number {
  let currentLoc = 0;

  for (const fileState of sourceFileStates) {
    currentLoc += getCurrentLocContribution(fileState);
  }

  return currentLoc;
}

function getCurrentLocContribution(fileState: RepoSourceFileReplayState): number {
  return fileState.exists ? Math.max(0, fileState.currentLineCount) : 0;
}

function getExactTimelineUnitLineChange<Unit extends TimelineUnitLike>(unit: Unit) {
  const unitLineAmount = normalizeUnitLineAmount(unit.unitLineAmount);

  if (unit.type === 'grow' && unitLineAmount !== null) {
    return {
      addedLines: unitLineAmount,
      deletedLines: 0,
    };
  }

  if (unit.type === 'shrink' && unitLineAmount !== null) {
    return {
      addedLines: 0,
      deletedLines: unitLineAmount,
    };
  }

  return {
    addedLines: 0,
    deletedLines: 0,
  };
}

function normalizeUnitLineAmount(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}
