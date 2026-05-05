export interface RepoFileState {
  path: string;
  name: string;
  folder: string;
  extension: string;
  exists: true;
  lineCount: number | null;
  lineCountUnknown: boolean;
  createdOrder: number;
  firstSeenCommit: string;
  lastChangedCommit: string;
  changeCount: number;
  accumulatedAddedLines: number;
  accumulatedDeletedLines: number;
}

export interface FileStateStepTotals {
  existingFiles: number;
  totalKnownLines: number;
  unknownLineFiles: number;
  changedFiles: number;
  addedLines: number;
  deletedLines: number;
}

export interface FileStateStep {
  stepIndex: number;
  commitHash: string;
  commitOrder: number;
  commitMessage: string;
  totals: FileStateStepTotals;
  changedPaths: string[];
  files: RepoFileState[];
}

export interface RepoFileStatesMetadata {
  generatedAt: string;
  inputPath: string;
  commitCount: number;
  stepCount: number;
  warningCount: number;
}

export interface ReconstructedRepoFileStates {
  metadata: RepoFileStatesMetadata;
  steps: FileStateStep[];
  warnings: string[];
}
