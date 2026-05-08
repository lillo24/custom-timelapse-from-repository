export type RepoDisplayNodeType =
  | 'folder'
  | 'file'
  | 'collapsedFolder'
  | 'moreGroup';

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
  hiddenChildCount: number;
}

export interface RepoDisplayTimelineUnit {
  unitOrder: number;
  sourceFileId: string;
  sourceFilePath: string;
  displayNodeId: string;
  displayNodePath: string;
  type: string;
  lineDelta: number;
  activityWeight: number;
  beforeLineCount: number | null;
  afterLineCount: number | null;
}

export interface RepoDisplayModel {
  generatedAt: string;
  sourceVisualModelPath: string;
  config: {
    path?: string;
    maxDepth: number;
    maxVisibleRows: number | null;
    hideButCount: string[];
    collapseFolders: string[];
    maxChildrenByFolder: Record<string, number>;
  };
  nodes: RepoDisplayNode[];
  timeline: RepoDisplayTimelineUnit[];
  summary: {
    visibleNodeCount: number;
    maxVisibleRows: number | null;
    visibleRowsBeforeBudget: number;
    visibleRowsAfterBudget: number;
    fileNodeCount: number;
    folderNodeCount: number;
    collapsedFolderCount: number;
    moreGroupCount: number;
    hiddenButCountedFileCount: number;
    autoHiddenFiles: number;
    autoCollapsedFolders: number;
    autoMoreGroups: number;
    timelineUnitCount: number;
    timelineUnitsMapped: number;
    sourceFileCount: number;
    sourceFolderCount: number;
    sourceTimelineUnitCount: number;
  };
  warnings: string[];
}
