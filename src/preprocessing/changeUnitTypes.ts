export type RepoChangeUnitType =
  | 'create'
  | 'grow'
  | 'shrink'
  | 'delete'
  | 'rename'
  | 'copy'
  | 'modify';

export interface RepoChangeUnit {
  unitOrder: number;
  commitOrder: number;
  commitHash: string;
  filePath: string;
  previousPath?: string;
  type: RepoChangeUnitType;
  statusFromGit: string;
  lineDelta: number | null;
  unitLineAmount: number | null;
  beforeLineCount: number | null;
  afterLineCount: number | null;
  extension: string;
  folder: string;
  visualMass: number;
}

export interface RepoChangeUnitsOutputSummary {
  commitCount: number;
  fileChangeCount: number;
  unitCount: number;
  totalAddedLines: number;
  totalDeletedLines: number;
  structuralUnitCount: number;
  growthUnitCount: number;
  shrinkUnitCount: number;
  warnings: string[];
}

export interface RepoChangeUnitsOutput {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    historyPath: string;
    statesPath: string;
    lineQuantum: number;
  };
  summary: RepoChangeUnitsOutputSummary;
  units: RepoChangeUnit[];
}
