export interface AnimationFilterConfigFile {
  include?: string[];
  exclude?: string[];
}

export interface LoadedAnimationFilterConfig {
  path?: string;
  include: string[];
  exclude: string[];
}
