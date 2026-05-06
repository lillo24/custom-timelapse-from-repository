import type { RepoChangeUnit } from './changeUnitTypes.ts';

export type AnimationFileCategory =
  | 'source'
  | 'test'
  | 'config'
  | 'docs'
  | 'data'
  | 'ui'
  | 'backend'
  | 'script'
  | 'unknown';

export interface AnimationFile {
  path: string;
  name: string;
  folder: string;
  extension: string;
  category: AnimationFileCategory;
  language?: string;
  maxLineCount: number;
  finalLineCount: number;
  createdUnitOrder?: number;
  deletedUnitOrder?: number;
}

export interface AnimationUnit extends RepoChangeUnit {
  name: string;
  category: AnimationFileCategory;
  language?: string;
}

export interface ExcludedFile {
  path: string;
  name: string;
  folder: string;
  extension: string;
  reason: string;
}

export interface RepoAnimationDataset {
  generatedAt: string;
  sourceFiles: {
    history: string;
    states: string;
    units: string;
  };
  filters: {
    excludedPatterns: string[];
    includeLockfiles: boolean;
    filterConfig?: {
      path?: string;
      includePatterns: string[];
      excludePatterns: string[];
    };
  };
  files: AnimationFile[];
  units: AnimationUnit[];
  excludedFiles: ExcludedFile[];
  warnings: string[];
}
