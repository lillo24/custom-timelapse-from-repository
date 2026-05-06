import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  AnimationFile,
  AnimationUnit,
  RepoAnimationDataset,
} from '../src/preprocessing/animationDatasetTypes.ts';
import type {
  RepoVisualModel,
  VisualFile,
  VisualFileSize,
  VisualFolder,
  VisualTimelineUnit,
} from '../src/preprocessing/visualModelTypes.ts';

const DEFAULT_DATASET_PATH = 'data/generated/repo-animation-dataset.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-visual-model.json';
const ROOT_FOLDER_LABEL = '(root)';

interface CliOptions {
  datasetPath: string;
  outputPath: string;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const datasetPath = resolveInputFile(options.datasetPath, 'Dataset input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const dataset = await loadDataset(datasetPath);
    const visualModel = buildVisualModel(datasetPath, dataset);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(visualModel, null, 2)}\n`, 'utf8');

    console.log('Repository visual model');
    console.log(`Files: ${visualModel.summary.fileCount}`);
    console.log(`Folders: ${visualModel.summary.folderCount}`);
    console.log(`Timeline units: ${visualModel.summary.unitCount}`);
    console.log(`Warnings: ${visualModel.warnings.length}`);
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
    'Usage: npm run generate:visual-model -- [--dataset data/generated/repo-animation-dataset.json] [--out data/generated/repo-visual-model.json]',
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

async function loadDataset(datasetPath: string): Promise<RepoAnimationDataset> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(datasetPath, 'utf8'));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse dataset JSON: ${error.message}`);
    }

    throw new Error('Failed to read or parse dataset JSON.');
  }

  if (!isRepoAnimationDataset(parsed)) {
    throw new Error(`Dataset input does not match the expected animation dataset schema: ${datasetPath}`);
  }

  return parsed;
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
    Array.isArray(candidate.warnings)
  );
}

function buildVisualModel(
  datasetPath: string,
  dataset: RepoAnimationDataset,
): RepoVisualModel {
  const warnings = [...dataset.warnings];
  const unitOrdersByPath = new Map<string, number[]>();

  for (const unit of dataset.units) {
    const filePath = normalizePath(unit.filePath);
    const orders = unitOrdersByPath.get(filePath) ?? [];
    orders.push(unit.unitOrder);
    unitOrdersByPath.set(filePath, orders);
  }

  const visualScaleReference = calculateVisualScaleReference(dataset.files);
  const files = [...dataset.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => buildVisualFile(file, unitOrdersByPath.get(normalizePath(file.path)) ?? [], visualScaleReference));

  const fileIdByPath = new Map(files.map((file) => [file.path, file.id]));
  const folders = buildVisualFolders(files);
  const timeline = buildTimeline(dataset.units, fileIdByPath, warnings);

  if (files.length === 0) {
    warnings.push('Visual model has zero files.');
  }

  if (timeline.length === 0) {
    warnings.push('Visual model has zero timeline units.');
  }

  const maxFileLines = files.reduce((max, file) => Math.max(max, file.maxLineCount), 0);
  const totalFinalLines = files.reduce((sum, file) => sum + file.finalLineCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    sourceDatasetPath: datasetPath,
    files,
    folders,
    timeline,
    summary: {
      fileCount: files.length,
      folderCount: folders.length,
      unitCount: timeline.length,
      maxFileLines,
      totalFinalLines,
    },
    warnings,
  };
}

function calculateVisualScaleReference(files: AnimationFile[]): number {
  const sortedMaxLines = files
    .map((file) => file.maxLineCount)
    .sort((left, right) => left - right);

  if (sortedMaxLines.length === 0) {
    return 1;
  }

  const percentileIndex = Math.max(0, Math.ceil(sortedMaxLines.length * 0.9) - 1);
  const percentileValue = sortedMaxLines[percentileIndex] ?? sortedMaxLines.at(-1) ?? 1;
  return Math.max(1, percentileValue);
}

function buildVisualFile(
  file: AnimationFile,
  unitOrders: number[],
  visualScaleReference: number,
): VisualFile {
  const normalizedPath = normalizePath(file.path);
  const cappedLineCount = Math.min(file.maxLineCount, visualScaleReference);
  const rawWeight = Math.sqrt(cappedLineCount / visualScaleReference);
  const visualWeight = clampNumber(rawWeight, 0, 1);

  return {
    id: createFileId(normalizedPath),
    path: normalizedPath,
    name: file.name,
    folderPath: normalizePath(file.folder),
    extension: file.extension.length > 0 ? file.extension : null,
    category: file.category,
    language: file.language ?? null,
    finalLineCount: file.finalLineCount,
    maxLineCount: file.maxLineCount,
    visualSize: mapVisualSize(visualWeight),
    visualWeight,
    firstUnitOrder: unitOrders.length > 0 ? unitOrders[0] ?? null : null,
    lastUnitOrder: unitOrders.length > 0 ? unitOrders[unitOrders.length - 1] ?? null : null,
  };
}

function mapVisualSize(weight: number): VisualFileSize {
  if (weight < 0.2) {
    return 'xs';
  }

  if (weight < 0.4) {
    return 'sm';
  }

  if (weight < 0.6) {
    return 'md';
  }

  if (weight < 0.8) {
    return 'lg';
  }

  return 'xl';
}

function buildVisualFolders(files: VisualFile[]): VisualFolder[] {
  interface MutableFolder {
    path: string;
    name: string;
    depth: number;
    parentPath: string | null;
    fileCount: number;
    totalFinalLines: number;
    categories: Set<string>;
  }

  const folderMap = new Map<string, MutableFolder>();

  ensureFolder(folderMap, '');

  for (const file of files) {
    for (const folderPath of expandFolderAncestors(file.folderPath)) {
      const folder = ensureFolder(folderMap, folderPath);
      folder.fileCount += 1;
      folder.totalFinalLines += file.finalLineCount;
      folder.categories.add(file.category);
    }
  }

  return Array.from(folderMap.values())
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((folder) => ({
      id: createFolderId(folder.path),
      path: folder.path,
      name: folder.name,
      depth: folder.depth,
      parentPath: folder.parentPath,
      fileCount: folder.fileCount,
      totalFinalLines: folder.totalFinalLines,
      categories: [...folder.categories].sort((left, right) => left.localeCompare(right)),
    }));
}

function expandFolderAncestors(folderPath: string): string[] {
  const normalizedPath = normalizePath(folderPath);

  if (normalizedPath === '') {
    return [''];
  }

  const segments = normalizedPath.split('/');
  const ancestors = [''];

  for (let index = 1; index <= segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join('/'));
  }

  return ancestors;
}

function ensureFolder(
  folderMap: Map<string, {
    path: string;
    name: string;
    depth: number;
    parentPath: string | null;
    fileCount: number;
    totalFinalLines: number;
    categories: Set<string>;
  }>,
  folderPath: string,
) {
  const normalizedPath = normalizePath(folderPath);
  const existing = folderMap.get(normalizedPath);

  if (existing) {
    return existing;
  }

  const segments = normalizedPath === '' ? [] : normalizedPath.split('/');
  const name = segments.length > 0 ? (segments.at(-1) ?? ROOT_FOLDER_LABEL) : ROOT_FOLDER_LABEL;
  const parentPath =
    segments.length > 1 ? segments.slice(0, -1).join('/') : segments.length === 1 ? '' : null;

  const folder = {
    path: normalizedPath,
    name,
    depth: segments.length,
    parentPath,
    fileCount: 0,
    totalFinalLines: 0,
    categories: new Set<string>(),
  };

  folderMap.set(normalizedPath, folder);
  return folder;
}

function buildTimeline(
  units: AnimationUnit[],
  fileIdByPath: Map<string, string>,
  warnings: string[],
): VisualTimelineUnit[] {
  return [...units]
    .sort((left, right) => left.unitOrder - right.unitOrder)
    .flatMap((unit) => {
      const filePath = normalizePath(unit.filePath);
      const fileId = fileIdByPath.get(filePath);

      if (!fileId) {
        warnings.push(
          `Timeline unit ${unit.unitOrder} references a file missing from the visual file list: ${filePath}`,
        );
        return [];
      }

      return [
        {
          unitOrder: unit.unitOrder,
          fileId,
          filePath,
          folderPath: normalizePath(unit.folder),
          type: unit.type,
          lineDelta: unit.lineDelta ?? 0,
          activityWeight: calculateActivityWeight(unit),
          beforeLineCount: unit.beforeLineCount,
          afterLineCount: unit.afterLineCount,
        },
      ];
    });
}

function calculateActivityWeight(unit: AnimationUnit): number {
  const structuralBaseline =
    unit.type === 'modify'
      ? 0.3
      : unit.type === 'rename' || unit.type === 'copy'
        ? 0.35
        : unit.type === 'create' || unit.type === 'delete'
          ? 0.4
          : 0.25;

  const lineAmount = Math.abs(unit.unitLineAmount ?? 0);

  if (lineAmount === 0) {
    return structuralBaseline;
  }

  return clampNumber(Math.max(structuralBaseline, Math.sqrt(lineAmount / 10)), 0, 1);
}

function createFileId(filePath: string): string {
  return `file:${filePath}`;
}

function createFolderId(folderPath: string): string {
  return `folder:${folderPath === '' ? ROOT_FOLDER_LABEL : folderPath}`;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
