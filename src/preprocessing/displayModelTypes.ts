import type { HistoryTrimMetadata } from './historyTrim.ts';

export type RepoDisplayNodeType =
  | 'folder'
  | 'file'
  | 'collapsedFolder';

export interface RepoDisplayNodeSizeTracking {
  enabled: boolean;
  maxVisualPercent: number;
  normalizationMaxLines: number;
}

export interface RepoDisplaySizeTrackingStyle {
  baseRowHeightRem: number;
  maxExtraHeightRem: number;
  baseFontSizeRem: number;
  maxExtraFontSizeRem: number;
}

export interface RepoDisplayNode {
  id: string;
  label: string;
  path: string;
  type: RepoDisplayNodeType;
  depth: number;
  parentNodeId: string | null;
  childNodeIds: string[];
  sourceFileIds: string[];
  sourceFolderIds: string[];
  finalLineCount: number;
  maxLineCount: number;
  visualWeight: number;
  childCount: number;
  visibleChildCount: number;
  hiddenChildCount: number;
  hiddenDescendantCount: number;
  sizeTracking?: RepoDisplayNodeSizeTracking;
}

export interface RepoDisplayTimelineUnit {
  unitOrder: number;
  sourceFileId: string;
  sourceFilePath: string;
  displayNodeId: string;
  displayNodePath: string;
  effectiveDisplayNodeId: string;
  effectiveDisplayNodePath: string;
  remappedBecauseHidden: boolean;
  type: string;
  lineDelta: number;
  unitLineAmount: number | null;
  activityWeight: number;
  beforeLineCount: number | null;
  afterLineCount: number | null;
}

export interface RepoDisplayVisibilityFrame {
  startUnitIndex: number;
  endUnitIndex: number;
  startUnitOrder: number;
  endUnitOrder: number;
  visibleNodeIds: string[];
  budgetHiddenNodeIds: string[];
  effectiveChildCountByFolderId: Record<string, number>;
  effectiveVisibleChildCountByFolderId: Record<string, number>;
  effectiveHiddenChildCountByFolderId: Record<string, number>;
  effectiveHiddenDescendantCountByFolderId: Record<string, number>;
  rowCountBeforeBudget: number;
  rowCountAfterBudget: number;
  budgetApplied: boolean;
}

export interface RepoDisplayModel {
  generatedAt: string;
  historyTrim?: HistoryTrimMetadata;
  sourceVisualModelPath: string;
  config: {
    path?: string;
    maxDepth: number;
    maxVisibleRows: number | null;
    hideButCount: string[];
    maxChildrenByFolder: Record<string, number>;
    sizeTrackedNodes?: Record<string, { maxVisualPercent: number }>;
    sizeTrackingStyle?: RepoDisplaySizeTrackingStyle;
    sizeNormalization?: 'trackedMax';
  };
  nodes: RepoDisplayNode[];
  timeline: RepoDisplayTimelineUnit[];
  visibilityFrames: RepoDisplayVisibilityFrame[];
  summary: {
    visibleNodeCount: number;
    maxVisibleRows: number | null;
    visibleRowsBeforeBudget: number;
    visibleRowsAfterBudget: number;
    peakRowsBeforeBudget: number;
    peakRowsAfterBudget: number;
    framesWithBudgetApplied: number;
    totalDynamicHiddenEvents: number;
    foldersReducedByBudget: number;
    timelineUnitsRemappedBecauseHidden: number;
    fileNodeCount: number;
    folderNodeCount: number;
    collapsedFolderCount: number;
    hiddenButCountedFileCount: number;
    autoHiddenFiles: number;
    autoCollapsedFolders: number;
    autoMoreGroups: number;
    timelineUnitCount: number;
    timelineUnitsMapped: number;
    sourceFileCount: number;
    sourceFolderCount: number;
    sourceTimelineUnitCount: number;
    sizeTrackedNodeCount?: number;
    sizeTrackingNormalizationMaxLines?: number | null;
    sizeTrackedWarnings?: string[];
  };
  warnings: string[];
}
