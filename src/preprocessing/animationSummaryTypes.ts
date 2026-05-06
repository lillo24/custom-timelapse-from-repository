export interface RepoAnimationSummaryTotals {
  includedFiles: number;
  excludedFiles: number;
  includedUnits: number;
  excludedUnits: number;
  totalFinalLines: number;
  totalMaxLines: number;
}

export interface RepoAnimationSummaryBucket {
  category?: string;
  language?: string;
  folder?: string;
  fileCount: number;
  unitCount?: number;
  finalLines: number;
}

export interface RepoAnimationSummaryLargestFile {
  path: string;
  category: string;
  language: string;
  finalLineCount: number;
  maxLineCount: number;
}

export interface RepoAnimationSummaryMostChangedFile {
  path: string;
  unitCount: number;
  category: string;
  language: string;
}

export interface RepoAnimationSummary {
  generatedAt: string;
  inputDatasetPath: string;
  filterConfig?: {
    path?: string;
    includeCount: number;
    excludeCount: number;
  };
  totals: RepoAnimationSummaryTotals;
  byCategory: Array<{
    category: string;
    fileCount: number;
    unitCount: number;
    finalLines: number;
  }>;
  byLanguage: Array<{
    language: string;
    fileCount: number;
    unitCount: number;
    finalLines: number;
  }>;
  topFoldersByLines: Array<{
    folder: string;
    fileCount: number;
    finalLines: number;
  }>;
  largestFiles: RepoAnimationSummaryLargestFile[];
  mostChangedFiles: RepoAnimationSummaryMostChangedFile[];
  excludedReasons?: Array<{
    reason: string;
    fileCount: number;
  }>;
  warnings: string[];
}
