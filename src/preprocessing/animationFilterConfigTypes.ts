export interface AnimationFilterConfigFile {
  include?: string[];
  exclude?: string[];
  display?: AnimationDisplayConfigFile;
}

export interface LoadedAnimationFilterConfig {
  path?: string;
  include: string[];
  exclude: string[];
  display: LoadedAnimationDisplayConfig;
}

export interface AnimationDisplayConfigFile {
  maxDepth?: number;
  maxVisibleRows?: number | null;
  hideButCount?: string[];
  collapseFolders?: string[];
  maxChildrenByFolder?: Record<string, number>;
}

export interface LoadedAnimationDisplayConfig {
  maxDepth: number;
  maxVisibleRows: number | null;
  hideButCount: string[];
  collapseFolders: string[];
  maxChildrenByFolder: Record<string, number>;
}
