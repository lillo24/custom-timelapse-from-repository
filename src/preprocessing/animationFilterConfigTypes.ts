export interface AnimationFilterConfigFile {
  include?: string[];
  exclude?: string[];
  history?: AnimationHistoryConfigFile;
  display?: AnimationDisplayConfigFile;
}

export interface LoadedAnimationFilterConfig {
  path?: string;
  include: string[];
  exclude: string[];
  history: LoadedAnimationHistoryConfig;
  display: LoadedAnimationDisplayConfig;
}

export interface AnimationHistoryConfigFile {
  trimEndProgressPercent?: number;
}

export interface LoadedAnimationHistoryConfig {
  trimEndProgressPercent: number;
}

export interface AnimationDisplayConfigFile {
  maxDepth?: number;
  maxVisibleRows?: number | null;
  hideButCount?: string[];
  maxChildrenByFolder?: Record<string, number>;
  sizeTrackedNodes?: Record<string, AnimationDisplaySizeTrackedNodeConfigFile>;
  sizeTrackingStyle?: AnimationDisplaySizeTrackingStyleConfigFile;
  sizeNormalization?: AnimationDisplaySizeNormalization;
}

export interface AnimationDisplaySizeTrackedNodeConfigFile {
  maxVisualPercent?: number;
}

export interface AnimationDisplaySizeTrackingStyleConfigFile {
  baseRowHeightRem?: number;
  maxExtraHeightRem?: number;
  baseFontSizeRem?: number;
  maxExtraFontSizeRem?: number;
}

export type AnimationDisplaySizeNormalization = 'trackedMax';

export interface LoadedAnimationDisplaySizeTrackedNodeConfig {
  maxVisualPercent: number;
}

export interface LoadedAnimationDisplaySizeTrackingStyleConfig {
  baseRowHeightRem: number;
  maxExtraHeightRem: number;
  baseFontSizeRem: number;
  maxExtraFontSizeRem: number;
}

export interface LoadedAnimationDisplayConfig {
  maxDepth: number;
  maxVisibleRows: number | null;
  hideButCount: string[];
  maxChildrenByFolder: Record<string, number>;
  sizeTrackedNodes: Record<string, LoadedAnimationDisplaySizeTrackedNodeConfig>;
  sizeTrackingStyle: LoadedAnimationDisplaySizeTrackingStyleConfig;
  sizeNormalization: AnimationDisplaySizeNormalization;
}
