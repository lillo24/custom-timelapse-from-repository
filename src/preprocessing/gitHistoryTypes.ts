export type GitHistoryFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'unknown';

export interface GitHistoryFileChange {
  path: string;
  oldPath: string | null;
  status: GitHistoryFileStatus;
  addedLines: number | null;
  deletedLines: number | null;
  isBinary: boolean;
}

export interface GitHistoryCommit {
  order: number;
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  parentHashes: string[];
  changedFiles: GitHistoryFileChange[];
}

export interface RawGitHistory {
  schemaVersion: 1;
  sourceRepo: {
    path: string;
    currentHead: string;
  };
  generatedAt: string;
  commits: GitHistoryCommit[];
}
