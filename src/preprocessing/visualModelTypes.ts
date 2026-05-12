import type { HistoryTrimMetadata } from './historyTrim.ts';

export type VisualFileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface VisualFile {
  id: string;
  path: string;
  name: string;
  folderPath: string;
  extension: string | null;
  category: string;
  language: string | null;
  finalLineCount: number;
  maxLineCount: number;
  visualSize: VisualFileSize;
  visualWeight: number;
  firstUnitOrder: number | null;
  lastUnitOrder: number | null;
}

export interface VisualFolder {
  id: string;
  path: string;
  name: string;
  depth: number;
  parentPath: string | null;
  fileCount: number;
  totalFinalLines: number;
  categories: string[];
}

export interface VisualTimelineUnit {
  unitOrder: number;
  fileId: string;
  filePath: string;
  folderPath: string;
  type: string;
  lineDelta: number;
  unitLineAmount: number | null;
  activityWeight: number;
  beforeLineCount: number | null;
  afterLineCount: number | null;
}

export interface RepoVisualModel {
  generatedAt: string;
  historyTrim?: HistoryTrimMetadata;
  sourceDatasetPath: string;
  files: VisualFile[];
  folders: VisualFolder[];
  timeline: VisualTimelineUnit[];
  summary: {
    fileCount: number;
    folderCount: number;
    unitCount: number;
    maxFileLines: number;
    totalFinalLines: number;
  };
  warnings: string[];
}
