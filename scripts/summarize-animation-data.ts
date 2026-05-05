import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RepoAnimationDataset } from '../src/preprocessing/animationDatasetTypes.ts';
import type { RepoChangeUnitsOutput } from '../src/preprocessing/changeUnitTypes.ts';
import type { RepoAnimationSummary } from '../src/preprocessing/animationSummaryTypes.ts';

const DEFAULT_DATASET_PATH = 'data/generated/repo-animation-dataset.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-animation-summary.json';
const SUMMARY_LIMIT = 10;
const HUGE_FILE_LINE_THRESHOLD = 3000;

interface CliOptions {
  datasetPath: string;
  outputPath: string;
}

type SummaryCategory =
  | 'source'
  | 'test'
  | 'config'
  | 'docs'
  | 'data'
  | 'ui'
  | 'backend'
  | 'script'
  | 'unknown';

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const datasetPath = resolveInputFile(options.datasetPath, 'Dataset input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const dataset = await loadDataset(datasetPath);
    const sourceUnitsPath = resolveDatasetUnitsPath(datasetPath, dataset.sourceFiles.units);
    const sourceUnits = await loadChangeUnits(sourceUnitsPath);
    const summary = buildSummary(datasetPath, dataset, sourceUnits);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    const topCategory = summary.byCategory[0]?.category ?? 'none';
    console.log('Repository animation summary');
    console.log(`Included files: ${summary.totals.includedFiles}`);
    console.log(`Included units: ${summary.totals.includedUnits}`);
    console.log(`Final lines: ${formatNumber(summary.totals.totalFinalLines)}`);
    console.log(`Top category: ${topCategory}`);
    console.log(`Warnings: ${summary.warnings.length}`);
    console.log(`Wrote ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let datasetPath = DEFAULT_DATASET_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dataset') {
      datasetPath = getFlagValue(argv, index, '--dataset');
      index += 1;
      continue;
    }

    if (argument.startsWith('--dataset=')) {
      datasetPath = argument.slice('--dataset='.length);
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

    if (argument === '--help' || argument === '-h') {
      printUsageAndExit();
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    datasetPath,
    outputPath,
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
    'Usage: npm run summarize:animation-data -- [--dataset data/generated/repo-animation-dataset.json] [--out data/generated/repo-animation-summary.json]',
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

function resolveDatasetUnitsPath(datasetPath: string, unitsPath: string): string {
  const normalizedUnitsPath = path.isAbsolute(unitsPath)
    ? unitsPath
    : path.resolve(path.dirname(datasetPath), unitsPath);

  return resolveInputFile(normalizedUnitsPath, 'Dataset source units');
}

async function loadDataset(datasetPath: string): Promise<RepoAnimationDataset> {
  const parsed = await loadJsonFile(datasetPath);

  if (!isRepoAnimationDataset(parsed)) {
    throw new Error(`Dataset input does not match the expected animation dataset schema: ${datasetPath}`);
  }

  return parsed;
}

async function loadChangeUnits(unitsPath: string): Promise<RepoChangeUnitsOutput> {
  const parsed = await loadJsonFile(unitsPath);

  if (!isRepoChangeUnitsOutput(parsed)) {
    throw new Error(`Dataset source units do not match the expected change-unit schema: ${unitsPath}`);
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

function isRepoAnimationDataset(value: unknown): value is RepoAnimationDataset {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RepoAnimationDataset>;
  return (
    Array.isArray(candidate.files) &&
    Array.isArray(candidate.units) &&
    Array.isArray(candidate.excludedFiles) &&
    Array.isArray(candidate.warnings) &&
    !!candidate.sourceFiles
  );
}

function isRepoChangeUnitsOutput(value: unknown): value is RepoChangeUnitsOutput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RepoChangeUnitsOutput>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.units);
}

function buildSummary(
  datasetPath: string,
  dataset: RepoAnimationDataset,
  sourceUnits: RepoChangeUnitsOutput,
): RepoAnimationSummary {
  const warnings = [...dataset.warnings];
  const includedFilePaths = new Set(dataset.files.map((file) => normalizePath(file.path)));
  const includedUnitCount = dataset.units.length;
  const excludedUnitCount = sourceUnits.units.length - includedUnitCount;
  const totalFinalLines = dataset.files.reduce((sum, file) => sum + file.finalLineCount, 0);
  const totalMaxLines = dataset.files.reduce((sum, file) => sum + file.maxLineCount, 0);

  validateDataset(dataset, sourceUnits.units.length, warnings, includedFilePaths);

  const byCategory = Array.from(groupByCategory(dataset).entries())
    .map(([category, bucket]) => ({
      category,
      fileCount: bucket.fileCount,
      unitCount: bucket.unitCount,
      finalLines: bucket.finalLines,
    }))
    .sort(compareSummaryRows('fileCount', 'unitCount', 'category'))
    .slice(0, SUMMARY_LIMIT);

  const byLanguage = Array.from(groupByLanguage(dataset).entries())
    .map(([language, bucket]) => ({
      language,
      fileCount: bucket.fileCount,
      unitCount: bucket.unitCount,
      finalLines: bucket.finalLines,
    }))
    .sort(compareSummaryRows('fileCount', 'unitCount', 'language'))
    .slice(0, SUMMARY_LIMIT);

  const topFoldersByLines = Array.from(groupByFolder(dataset).entries())
    .map(([folder, bucket]) => ({
      folder,
      fileCount: bucket.fileCount,
      finalLines: bucket.finalLines,
    }))
    .sort(compareSummaryRows('finalLines', 'fileCount', 'folder'))
    .slice(0, SUMMARY_LIMIT);

  const largestFiles = [...dataset.files]
    .map((file) => ({
      path: file.path,
      category: file.category,
      language: file.language ?? 'Unknown',
      finalLineCount: file.finalLineCount,
      maxLineCount: file.maxLineCount,
    }))
    .sort((left, right) => {
      if (right.finalLineCount !== left.finalLineCount) {
        return right.finalLineCount - left.finalLineCount;
      }

      if (right.maxLineCount !== left.maxLineCount) {
        return right.maxLineCount - left.maxLineCount;
      }

      return left.path.localeCompare(right.path);
    })
    .slice(0, SUMMARY_LIMIT);

  const unitsByPath = new Map<string, number>();

  for (const unit of dataset.units) {
    const filePath = normalizePath(unit.filePath);
    unitsByPath.set(filePath, (unitsByPath.get(filePath) ?? 0) + 1);
  }

  const mostChangedFiles = [...dataset.files]
    .map((file) => ({
      path: file.path,
      unitCount: unitsByPath.get(normalizePath(file.path)) ?? 0,
      category: file.category,
      language: file.language ?? 'Unknown',
    }))
    .sort((left, right) => {
      if (right.unitCount !== left.unitCount) {
        return right.unitCount - left.unitCount;
      }

      return left.path.localeCompare(right.path);
    })
    .slice(0, SUMMARY_LIMIT);

  return {
    generatedAt: new Date().toISOString(),
    inputDatasetPath: datasetPath,
    totals: {
      includedFiles: dataset.files.length,
      excludedFiles: dataset.excludedFiles.length,
      includedUnits: includedUnitCount,
      excludedUnits: Math.max(0, excludedUnitCount),
      totalFinalLines,
      totalMaxLines,
    },
    byCategory,
    byLanguage,
    topFoldersByLines,
    largestFiles,
    mostChangedFiles,
    warnings,
  };
}

function validateDataset(
  dataset: RepoAnimationDataset,
  sourceUnitCount: number,
  warnings: string[],
  includedFilePaths: Set<string>,
): void {
  if (dataset.files.length === 0) {
    warnings.push('Dataset has zero included files.');
  }

  if (dataset.units.length === 0) {
    warnings.push('Dataset has zero included units.');
  }

  if (dataset.units.length > sourceUnitCount) {
    warnings.push('Dataset includes more units than the referenced source unit file.');
  }

  if (sourceUnitCount > 0 && dataset.units.length > 0) {
    const excludedUnits = sourceUnitCount - dataset.units.length;

    if (excludedUnits > dataset.units.length) {
      warnings.push(
        `Excluded units (${excludedUnits}) exceed included units (${dataset.units.length}).`,
      );
    }
  }

  for (const file of dataset.files) {
    if (file.finalLineCount < 0 || file.maxLineCount < 0) {
      warnings.push(`${file.path}: file has a negative line count.`);
    }

    if (file.finalLineCount > file.maxLineCount) {
      warnings.push(`${file.path}: finalLineCount is greater than maxLineCount.`);
    }

    if (file.finalLineCount > HUGE_FILE_LINE_THRESHOLD) {
      warnings.push(
        `${file.path}: unusually large filtered file (${file.finalLineCount} lines).`,
      );
    }

    if (!isKnownCategory(file.category)) {
      warnings.push(`${file.path}: unknown category value "${file.category}".`);
    }

    if (file.category === 'unknown') {
      warnings.push(`${file.path}: file remains in the unknown category.`);
    }

    if (!file.language && file.category !== 'unknown') {
      warnings.push(`${file.path}: missing language for category "${file.category}".`);
    }
  }

  for (const unit of dataset.units) {
    const filePath = normalizePath(unit.filePath);

    if (!includedFilePaths.has(filePath)) {
      warnings.push(
        `${filePath}: included unit ${unit.unitOrder} references a file missing from dataset.files.`,
      );
    }

    if (!isKnownCategory(unit.category)) {
      warnings.push(
        `${filePath}: included unit ${unit.unitOrder} has unknown category "${unit.category}".`,
      );
    }
  }
}

function groupByCategory(dataset: RepoAnimationDataset): Map<string, SummaryBucket> {
  const buckets = new Map<string, SummaryBucket>();

  for (const file of dataset.files) {
    const key = file.category;
    const bucket = buckets.get(key) ?? createSummaryBucket();
    bucket.fileCount += 1;
    bucket.finalLines += file.finalLineCount;
    buckets.set(key, bucket);
  }

  for (const unit of dataset.units) {
    const key = unit.category;
    const bucket = buckets.get(key) ?? createSummaryBucket();
    bucket.unitCount += 1;
    buckets.set(key, bucket);
  }

  return buckets;
}

function groupByLanguage(dataset: RepoAnimationDataset): Map<string, SummaryBucket> {
  const buckets = new Map<string, SummaryBucket>();

  for (const file of dataset.files) {
    const key = file.language ?? 'Unknown';
    const bucket = buckets.get(key) ?? createSummaryBucket();
    bucket.fileCount += 1;
    bucket.finalLines += file.finalLineCount;
    buckets.set(key, bucket);
  }

  for (const unit of dataset.units) {
    const key = unit.language ?? 'Unknown';
    const bucket = buckets.get(key) ?? createSummaryBucket();
    bucket.unitCount += 1;
    buckets.set(key, bucket);
  }

  return buckets;
}

function groupByFolder(dataset: RepoAnimationDataset): Map<string, SummaryBucket> {
  const buckets = new Map<string, SummaryBucket>();

  for (const file of dataset.files) {
    const key = file.folder || '(root)';
    const bucket = buckets.get(key) ?? createSummaryBucket();
    bucket.fileCount += 1;
    bucket.finalLines += file.finalLineCount;
    buckets.set(key, bucket);
  }

  return buckets;
}

interface SummaryBucket {
  fileCount: number;
  unitCount: number;
  finalLines: number;
}

function createSummaryBucket(): SummaryBucket {
  return {
    fileCount: 0,
    unitCount: 0,
    finalLines: 0,
  };
}

function compareSummaryRows<
  T extends Record<string, string | number>,
  P extends keyof T,
  S extends keyof T,
  N extends keyof T,
>(primary: P, secondary: S, nameKey: N) {
  return (left: T, right: T): number => {
    const primaryDiff = Number(right[primary]) - Number(left[primary]);

    if (primaryDiff !== 0) {
      return primaryDiff;
    }

    const secondaryDiff = Number(right[secondary]) - Number(left[secondary]);

    if (secondaryDiff !== 0) {
      return secondaryDiff;
    }

    return String(left[nameKey]).localeCompare(String(right[nameKey]));
  };
}

function isKnownCategory(category: string): category is SummaryCategory {
  return (
    category === 'source' ||
    category === 'test' ||
    category === 'config' ||
    category === 'docs' ||
    category === 'data' ||
    category === 'ui' ||
    category === 'backend' ||
    category === 'script' ||
    category === 'unknown'
  );
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
