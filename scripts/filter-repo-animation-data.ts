import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  AnimationFile,
  AnimationFileCategory,
  AnimationUnit,
  ExcludedFile,
  RepoAnimationDataset,
} from '../src/preprocessing/animationDatasetTypes.ts';
import type { LoadedAnimationFilterConfig } from '../src/preprocessing/animationFilterConfigTypes.ts';
import type { RepoChangeUnit, RepoChangeUnitsOutput } from '../src/preprocessing/changeUnitTypes.ts';
import type {
  FileStateStep,
  ReconstructedRepoFileStates,
  RepoFileState,
} from '../src/preprocessing/fileStateTypes.ts';
import type { RawGitHistory } from '../src/preprocessing/gitHistoryTypes.ts';
import {
  createEmptyAnimationFilterConfig,
  parseAnimationFilterConfig,
} from '../src/preprocessing/loadAnimationFilterConfig.ts';

const DEFAULT_HISTORY_PATH = 'data/generated/raw-git-history.json';
const DEFAULT_STATES_PATH = 'data/generated/repo-file-states.json';
const DEFAULT_UNITS_PATH = 'data/generated/repo-change-units.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-animation-dataset.json';

const DEFAULT_EXCLUDED_PATTERNS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.pytest_cache/**',
  '__pycache__/**',
  '.venv/**',
  'venv/**',
  'data/raw/**',
  'data/generated/**',
  '*.pyc',
  '*.pyo',
  '*.log',
  '*.tsbuildinfo',
] as const;

const DEFAULT_LOCKFILES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'poetry.lock',
] as const;

interface CliOptions {
  historyPath: string;
  statesPath: string;
  unitsPath: string;
  outputPath: string;
  includeLockfiles: boolean;
  configPath?: string;
}

interface FileDescriptor {
  path: string;
  name: string;
  folder: string;
  extension: string;
}

interface ClassifiedFile extends FileDescriptor {
  category: AnimationFileCategory;
  language?: string;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const historyPath = resolveInputFile(options.historyPath, 'History input');
    const statesPath = resolveInputFile(options.statesPath, 'State input');
    const unitsPath = resolveInputFile(options.unitsPath, 'Units input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const configPath = options.configPath
      ? resolveInputFile(options.configPath, 'Filter config')
      : undefined;

    const history = await loadRawHistory(historyPath);
    const states = await loadReconstructedStates(statesPath);
    const unitsOutput = await loadChangeUnits(unitsPath);
    const filterConfig = configPath
      ? parseAnimationFilterConfig(configPath, await readFile(configPath, 'utf8'))
      : createEmptyAnimationFilterConfig();
    const warnings: string[] = [];

    const dataset = buildAnimationDataset(
      historyPath,
      statesPath,
      unitsPath,
      history,
      states,
      unitsOutput,
      options.includeLockfiles,
      filterConfig,
      warnings,
    );
    const excludedUnitCount = unitsOutput.units.length - dataset.units.length;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

    const categoryCounts = countByCategory(dataset.files);
    console.log(`Included files: ${dataset.files.length}`);
    console.log(`Excluded files: ${dataset.excludedFiles.length}`);
    console.log(`Included units: ${dataset.units.length}`);
    console.log(`Excluded units: ${excludedUnitCount}`);
    console.log(
      `Categories: ${formatCategoryCounts(categoryCounts)}`,
    );
    console.log(`Warnings: ${dataset.warnings.length}`);
    console.log(`Wrote ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let historyPath = DEFAULT_HISTORY_PATH;
  let statesPath = DEFAULT_STATES_PATH;
  let unitsPath = DEFAULT_UNITS_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;
  let includeLockfiles = false;
  let configPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--history') {
      historyPath = getFlagValue(argv, index, '--history');
      index += 1;
      continue;
    }

    if (argument.startsWith('--history=')) {
      historyPath = argument.slice('--history='.length);
      continue;
    }

    if (argument === '--states') {
      statesPath = getFlagValue(argv, index, '--states');
      index += 1;
      continue;
    }

    if (argument.startsWith('--states=')) {
      statesPath = argument.slice('--states='.length);
      continue;
    }

    if (argument === '--units') {
      unitsPath = getFlagValue(argv, index, '--units');
      index += 1;
      continue;
    }

    if (argument.startsWith('--units=')) {
      unitsPath = argument.slice('--units='.length);
      continue;
    }

    if (argument === '--out') {
      outputPath = getFlagValue(argv, index, '--out');
      index += 1;
      continue;
    }

    if (argument.startsWith('--out=')) {
      outputPath = argument.slice('--out='.length);
      continue;
    }

    if (argument === '--include-lockfiles') {
      includeLockfiles = true;
      continue;
    }

    if (argument === '--config') {
      configPath = getFlagValue(argv, index, '--config');
      index += 1;
      continue;
    }

    if (argument.startsWith('--config=')) {
      configPath = argument.slice('--config='.length);
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      printUsageAndExit();
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    historyPath,
    statesPath,
    unitsPath,
    outputPath,
    includeLockfiles,
    configPath,
  };
}

function getFlagValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

function printUsageAndExit(): never {
  console.log(
    'Usage: npm run filter:animation-data -- [--history data/generated/raw-git-history.json] [--states data/generated/repo-file-states.json] [--units data/generated/repo-change-units.json] [--out data/generated/repo-animation-dataset.json] [--include-lockfiles] [--config repo-animation.config.json]',
  );
  process.exit(0);
}

function resolveInputFile(inputPath: string, label: string): string {
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`${label} does not exist: ${resolvedPath}`);
  }

  if (!statSync(resolvedPath).isFile()) {
    throw new Error(`${label} is not a file: ${resolvedPath}`);
  }

  return resolvedPath;
}

async function loadRawHistory(historyPath: string): Promise<RawGitHistory> {
  const parsed = await loadJsonFile(historyPath);

  if (!isRawGitHistory(parsed)) {
    throw new Error(`History input does not match the expected raw Git history schema: ${historyPath}`);
  }

  return parsed;
}

async function loadReconstructedStates(statesPath: string): Promise<ReconstructedRepoFileStates> {
  const parsed = await loadJsonFile(statesPath);

  if (!isReconstructedRepoFileStates(parsed)) {
    throw new Error(`State input does not match the expected reconstructed state schema: ${statesPath}`);
  }

  return parsed;
}

async function loadChangeUnits(unitsPath: string): Promise<RepoChangeUnitsOutput> {
  const parsed = await loadJsonFile(unitsPath);

  if (!isRepoChangeUnitsOutput(parsed)) {
    throw new Error(`Units input does not match the expected change-unit schema: ${unitsPath}`);
  }

  return parsed;
}

async function loadJsonFile(filePath: string): Promise<unknown> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse JSON from ${filePath}: ${error.message}`);
    }

    throw new Error(`Failed to read or parse JSON from ${filePath}.`);
  }
}

function isRawGitHistory(value: unknown): value is RawGitHistory {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RawGitHistory>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.commits);
}

function isReconstructedRepoFileStates(
  value: unknown,
): value is ReconstructedRepoFileStates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReconstructedRepoFileStates>;
  return Array.isArray(candidate.steps) && Array.isArray(candidate.warnings);
}

function isRepoChangeUnitsOutput(value: unknown): value is RepoChangeUnitsOutput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RepoChangeUnitsOutput>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.units);
}

function buildAnimationDataset(
  historyPath: string,
  statesPath: string,
  unitsPath: string,
  history: RawGitHistory,
  states: ReconstructedRepoFileStates,
  unitsOutput: RepoChangeUnitsOutput,
  includeLockfiles: boolean,
  filterConfig: LoadedAnimationFilterConfig,
  warnings: string[],
): RepoAnimationDataset {
  const excludedPatterns = [...DEFAULT_EXCLUDED_PATTERNS];
  const fileDescriptors = collectFileDescriptors(history, states, unitsOutput);
  const exclusionMap = new Map<string, ExcludedFile>();
  const includedDescriptors: FileDescriptor[] = [];

  for (const descriptor of fileDescriptors) {
    const exclusion = getExclusion(
      descriptor.path,
      includeLockfiles,
      excludedPatterns,
      filterConfig,
    );

    if (exclusion) {
      exclusionMap.set(descriptor.path, {
        ...descriptor,
        reason: exclusion.reason,
      });
      continue;
    }

    includedDescriptors.push(descriptor);
  }

  const includedPathSet = new Set(includedDescriptors.map((descriptor) => descriptor.path));
  const statesByPath = buildStateHistoryMap(states.steps);
  const units = unitsOutput.units
    .filter((unit) => includedPathSet.has(normalizePath(unit.filePath)))
    .map((unit) => enrichUnit(unit));

  for (const unit of unitsOutput.units) {
    const previousPath = unit.previousPath ? normalizePath(unit.previousPath) : undefined;

    if (previousPath && !includedPathSet.has(previousPath) && !exclusionMap.has(previousPath)) {
      const descriptor = createDescriptor(previousPath);
      const exclusion = getExclusion(
        previousPath,
        includeLockfiles,
        excludedPatterns,
        filterConfig,
      );

      if (exclusion) {
        exclusionMap.set(previousPath, {
          ...descriptor,
          reason: exclusion.reason,
        });
      }
    }
  }

  const files = includedDescriptors
    .map((descriptor) =>
      buildAnimationFile(descriptor, statesByPath.get(descriptor.path) ?? [], units),
    )
    .sort((left, right) => left.path.localeCompare(right.path));

  const excludedFiles = Array.from(exclusionMap.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );

  if (unitsOutput.summary.warnings.length > 0) {
    warnings.push(
      ...unitsOutput.summary.warnings.map((warning) => `change-units: ${warning}`),
    );
  }

  if (states.warnings.length > 0) {
    warnings.push(...states.warnings.map((warning) => `file-states: ${warning}`));
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      history: historyPath,
      states: statesPath,
      units: unitsPath,
    },
    filters: {
      excludedPatterns: includeLockfiles
        ? excludedPatterns
        : [...excludedPatterns, ...DEFAULT_LOCKFILES],
      includeLockfiles,
      filterConfig:
        filterConfig.path || filterConfig.include.length > 0 || filterConfig.exclude.length > 0
          ? {
              path: filterConfig.path,
              includePatterns: filterConfig.include,
              excludePatterns: filterConfig.exclude,
            }
          : undefined,
    },
    files,
    units,
    excludedFiles,
    warnings,
  };
}

function collectFileDescriptors(
  history: RawGitHistory,
  states: ReconstructedRepoFileStates,
  unitsOutput: RepoChangeUnitsOutput,
): FileDescriptor[] {
  const descriptors = new Map<string, FileDescriptor>();

  for (const commit of history.commits) {
    for (const changedFile of commit.changedFiles) {
      addDescriptor(descriptors, changedFile.path);

      if (changedFile.oldPath) {
        addDescriptor(descriptors, changedFile.oldPath);
      }
    }
  }

  for (const step of states.steps) {
    for (const file of step.files) {
      descriptors.set(normalizePath(file.path), descriptorFromState(file));
    }
  }

  for (const unit of unitsOutput.units) {
    addDescriptor(descriptors, unit.filePath);

    if (unit.previousPath) {
      addDescriptor(descriptors, unit.previousPath);
    }
  }

  return Array.from(descriptors.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function addDescriptor(descriptors: Map<string, FileDescriptor>, filePath: string): void {
  const descriptor = createDescriptor(filePath);
  descriptors.set(descriptor.path, descriptor);
}

function descriptorFromState(file: RepoFileState): FileDescriptor {
  return {
    path: normalizePath(file.path),
    name: file.name,
    folder: file.folder,
    extension: file.extension,
  };
}

function createDescriptor(filePath: string): FileDescriptor {
  const normalizedPath = normalizePath(filePath);
  const parsedPath = path.posix.parse(normalizedPath);
  return {
    path: normalizedPath,
    name: parsedPath.base,
    folder: parsedPath.dir,
    extension: parsedPath.ext.startsWith('.') ? parsedPath.ext.slice(1) : parsedPath.ext,
  };
}

function getExclusion(
  filePath: string,
  includeLockfiles: boolean,
  excludedPatterns: readonly string[],
  filterConfig: LoadedAnimationFilterConfig,
): { reason: string } | null {
  const normalizedPath = normalizePath(filePath);
  const basename = path.posix.basename(normalizedPath).toLowerCase();

  if (
    !includeLockfiles &&
    DEFAULT_LOCKFILES.some((lockfile) => basename === lockfile.toLowerCase())
  ) {
    return { reason: 'Excluded lockfile by default.' };
  }

  for (const pattern of excludedPatterns) {
    if (matchesPattern(normalizedPath, pattern)) {
      return { reason: `Excluded by pattern "${pattern}".` };
    }
  }

  for (const pattern of filterConfig.exclude) {
    if (matchesPattern(normalizedPath, pattern)) {
      return { reason: `config-exclude: ${pattern}` };
    }
  }

  if (filterConfig.include.length > 0) {
    const isIncluded = filterConfig.include.some((pattern) =>
      matchesPattern(normalizedPath, pattern),
    );

    if (!isIncluded) {
      return { reason: 'config-include-miss' };
    }
  }

  return null;
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1);
    return normalizedPath.endsWith(suffix);
  }

  return normalizedPath === normalizedPattern;
}

function enrichUnit(unit: RepoChangeUnit): AnimationUnit {
  const descriptor = createDescriptor(unit.filePath);
  const classified = classifyFile(descriptor.path);

  return {
    ...unit,
    name: descriptor.name,
    category: classified.category,
    language: classified.language,
  };
}

function buildStateHistoryMap(
  steps: FileStateStep[],
): Map<string, RepoFileState[]> {
  const statesByPath = new Map<string, RepoFileState[]>();

  for (const step of steps) {
    for (const file of step.files) {
      const filePath = normalizePath(file.path);
      const existing = statesByPath.get(filePath) ?? [];
      existing.push(file);
      statesByPath.set(filePath, existing);
    }
  }

  return statesByPath;
}

function buildAnimationFile(
  descriptor: FileDescriptor,
  stateHistory: RepoFileState[],
  units: AnimationUnit[],
): AnimationFile {
  const classified = classifyFile(descriptor.path);
  const fileUnits = units.filter((unit) => normalizePath(unit.filePath) === descriptor.path);
  const maxLineCount = stateHistory.reduce(
    (max, state) => Math.max(max, state.lineCount ?? 0),
    0,
  );
  const finalState = stateHistory.at(-1);
  const finalLineCount = finalState?.lineCount ?? 0;
  const createdUnitOrder = fileUnits.find((unit) => unit.type === 'create' || unit.type === 'copy')
    ?.unitOrder;
  const deletedUnitOrder = [...fileUnits]
    .reverse()
    .find((unit) => unit.type === 'delete')?.unitOrder;

  return {
    ...descriptor,
    category: classified.category,
    language: classified.language,
    maxLineCount,
    finalLineCount,
    createdUnitOrder,
    deletedUnitOrder,
  };
}

function classifyFile(filePath: string): ClassifiedFile {
  const descriptor = createDescriptor(filePath);
  const lowerPath = descriptor.path.toLowerCase();
  const lowerName = descriptor.name.toLowerCase();
  const extension = descriptor.extension.toLowerCase();

  if (lowerName === '.gitignore') {
    return {
      ...descriptor,
      category: 'config',
      language: 'GitIgnore',
    };
  }

  if (
    lowerPath.startsWith('history-implementations/') ||
    lowerPath.startsWith('history_implementation_plans/')
  ) {
    return {
      ...descriptor,
      category: 'docs',
      language: inferLanguage(extension) ?? 'Text',
    };
  }

  if (
    lowerPath.startsWith('tests/') ||
    lowerPath.includes('/tests/') ||
    lowerName.includes('.test.') ||
    lowerName.includes('.spec.')
  ) {
    return {
      ...descriptor,
      category: 'test',
      language: inferLanguage(extension),
    };
  }

  if (
    lowerName === 'vite.config.ts' ||
    lowerName === 'tailwind.config.js' ||
    lowerName.startsWith('tsconfig') ||
    lowerName.startsWith('.eslintrc') ||
    lowerName === 'eslint.config.js' ||
    lowerName === 'postcss.config.js'
  ) {
    return {
      ...descriptor,
      category: 'config',
      language: inferLanguage(extension),
    };
  }

  if (lowerPath.startsWith('scripts/')) {
    return {
      ...descriptor,
      category: 'script',
      language: inferLanguage(extension),
    };
  }

  if (
    extension === 'md' ||
    lowerPath.startsWith('docs/') ||
    lowerPath.includes('/docs/')
  ) {
    return {
      ...descriptor,
      category: 'docs',
      language: 'Markdown',
    };
  }

  if (
    lowerPath.startsWith('backend/') ||
    lowerPath.startsWith('server/') ||
    lowerPath.startsWith('api/') ||
    lowerPath.includes('/backend/') ||
    lowerPath.includes('/server/') ||
    lowerPath.includes('/api/')
  ) {
    return {
      ...descriptor,
      category: 'backend',
      language: inferLanguage(extension),
    };
  }

  if (
    extension === 'tsx' ||
    extension === 'jsx' ||
    lowerPath.startsWith('src/components/') ||
    lowerPath.startsWith('frontend/') ||
    lowerPath.includes('/frontend/')
  ) {
    return {
      ...descriptor,
      category: 'ui',
      language: inferLanguage(extension),
    };
  }

  if (
    extension === 'html' ||
    extension === 'css' ||
    extension === 'svg' ||
    lowerPath.startsWith('src/styles/') ||
    lowerPath.includes('/styles/') ||
    lowerPath.includes('/public/') ||
    lowerPath.includes('/assets/')
  ) {
    return {
      ...descriptor,
      category: 'ui',
      language: inferLanguage(extension),
    };
  }

  if (
    extension === 'txt' ||
    extension === 'json' ||
    extension === 'csv' ||
    extension === 'toml' ||
    extension === 'yaml' ||
    extension === 'yml'
  ) {
    return {
      ...descriptor,
      category: extension === 'txt' ? 'docs' : 'data',
      language: inferLanguage(extension),
    };
  }

  if (
    extension === 'ts' ||
    extension === 'js' ||
    extension === 'py' ||
    extension === 'tsx' ||
    extension === 'jsx' ||
    extension === 'java' ||
    extension === 'go' ||
    extension === 'rs'
  ) {
    return {
      ...descriptor,
      category: 'source',
      language: inferLanguage(extension),
    };
  }

  return {
    ...descriptor,
    category: 'unknown',
    language: inferLanguage(extension),
  };
}

function inferLanguage(extension: string): string | undefined {
  switch (extension) {
    case 'ts':
      return 'TypeScript';
    case 'tsx':
      return 'TypeScript React';
    case 'js':
      return 'JavaScript';
    case 'jsx':
      return 'JavaScript React';
    case 'json':
      return 'JSON';
    case 'md':
      return 'Markdown';
    case 'py':
      return 'Python';
    case 'css':
      return 'CSS';
    case 'html':
      return 'HTML';
    case 'yml':
    case 'yaml':
      return 'YAML';
    case 'toml':
      return 'TOML';
    case 'csv':
      return 'CSV';
    case 'txt':
      return 'Text';
    case 'svg':
      return 'SVG';
    default:
      return undefined;
  }
}

function countByCategory(files: AnimationFile[]): Map<AnimationFileCategory, number> {
  const counts = new Map<AnimationFileCategory, number>();

  for (const file of files) {
    counts.set(file.category, (counts.get(file.category) ?? 0) + 1);
  }

  return counts;
}

function formatCategoryCounts(counts: Map<AnimationFileCategory, number>): string {
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, count]) => `${category}=${count}`)
    .join(', ');
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
