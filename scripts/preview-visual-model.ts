import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  RepoVisualModel,
  VisualFile,
  VisualFolder,
  VisualTimelineUnit,
} from '../src/preprocessing/visualModelTypes.ts';

const DEFAULT_MODEL_PATH = 'data/generated/repo-visual-model.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-visual-model-preview.md';
const ROOT_FOLDER_LABEL = '(root)';
const PREVIEW_TOP_LIMIT = 10;
const PRODUCT_CATEGORIES = new Set(['source', 'ui', 'backend', 'test']);

interface CliOptions {
  modelPath: string;
  outputPath: string;
}

interface FileActivityEntry {
  file: VisualFile;
  unitCount: number;
  totalActivityWeight: number;
  averageActivityWeight: number;
}

interface FolderWeightEntry {
  folder: VisualFolder;
  totalVisualWeight: number;
  visualWeightShare: number;
}

interface TimelineChunkSummary {
  label: 'first' | 'middle' | 'last';
  unitCount: number;
  startUnitOrder: number | null;
  endUnitOrder: number | null;
  distinctFileCount: number;
  averageActivityWeight: number;
  topCategories: Array<{ category: string; count: number }>;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const modelPath = resolveInputFile(options.modelPath, 'Visual model input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const model = await loadVisualModel(modelPath);
    const report = buildPreviewReport(modelPath, model);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, 'utf8');

    console.log('Visual model preview report');
    console.log(`Files: ${model.summary.fileCount}`);
    console.log(`Folders: ${model.summary.folderCount}`);
    console.log(`Timeline units: ${model.summary.unitCount}`);
    console.log(`Warnings: ${buildPreviewWarnings(model).length + model.warnings.length}`);
    console.log(`Wrote ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let modelPath = DEFAULT_MODEL_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--model') {
      modelPath = getFlagValue(argv, index, '--model');
      index += 1;
      continue;
    }

    if (argument.startsWith('--model=')) {
      modelPath = argument.slice('--model='.length);
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
    modelPath,
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
    'Usage: npm run preview:visual-model -- [--model data/generated/repo-visual-model.json] [--out data/generated/repo-visual-model-preview.md]',
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

async function loadVisualModel(modelPath: string): Promise<RepoVisualModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(modelPath, 'utf8'));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse visual model JSON: ${error.message}`);
    }

    throw new Error('Failed to read or parse visual model JSON.');
  }

  if (!isRepoVisualModel(parsed)) {
    throw new Error(`Visual model input does not match the expected schema: ${modelPath}`);
  }

  return parsed;
}

function isRepoVisualModel(value: unknown): value is RepoVisualModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RepoVisualModel>;
  return (
    Array.isArray(candidate.files) &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.timeline) &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null &&
    Array.isArray(candidate.warnings)
  );
}

function buildPreviewReport(modelPath: string, model: RepoVisualModel): string {
  const fileById = new Map(model.files.map((file) => [file.id, file]));
  const fileActivities = buildFileActivities(model.timeline, fileById);
  const folderWeights = buildFolderWeights(model.files, model.folders);
  const timelineChunks = buildTimelineChunkSummaries(model.timeline, fileById);
  const previewWarnings = buildPreviewWarnings(model);
  const allWarnings = [
    ...model.warnings.map((warning) => `[model] ${warning}`),
    ...previewWarnings.map((warning) => `[preview] ${warning}`),
  ];
  const visualWeights = model.files.map((file) => file.visualWeight).sort((left, right) => left - right);
  const totalVisualWeight = visualWeights.reduce((sum, weight) => sum + weight, 0);
  const minVisualWeight = visualWeights[0] ?? 0;
  const maxVisualWeight = visualWeights.at(-1) ?? 0;
  const averageVisualWeight =
    visualWeights.length > 0 ? totalVisualWeight / visualWeights.length : 0;
  const medianVisualWeight =
    visualWeights.length > 0 ? visualWeights[Math.floor(visualWeights.length / 2)] ?? 0 : 0;
  const largestVisualFiles = [...model.files]
    .sort((left, right) =>
      compareNumbersDescending(left.visualWeight, right.visualWeight) ||
      compareNumbersDescending(left.maxLineCount, right.maxLineCount) ||
      left.path.localeCompare(right.path),
    )
    .slice(0, PREVIEW_TOP_LIMIT);
  const mostActiveFiles = fileActivities.slice(0, PREVIEW_TOP_LIMIT);
  const topFoldersByFileCount = [...model.folders]
    .filter((folder) => folder.path !== '')
    .sort((left, right) =>
      compareNumbersDescending(left.fileCount, right.fileCount) ||
      compareNumbersDescending(left.totalFinalLines, right.totalFinalLines) ||
      left.path.localeCompare(right.path),
    )
    .slice(0, PREVIEW_TOP_LIMIT);
  const topFoldersByVisualWeight = folderWeights.slice(0, PREVIEW_TOP_LIMIT);

  return [
    '# Repository Visual Model Preview',
    '',
    `- Generated: ${model.generatedAt}`,
    `- Model: ${modelPath}`,
    `- Source dataset: ${model.sourceDatasetPath}`,
    '',
    '## Snapshot',
    '',
    `- Total files: ${formatInteger(model.summary.fileCount)}`,
    `- Total folders: ${formatInteger(model.summary.folderCount)}`,
    `- Total timeline units: ${formatInteger(model.summary.unitCount)}`,
    `- Visual weight range: ${formatDecimal(minVisualWeight)} to ${formatDecimal(maxVisualWeight)} (median ${formatDecimal(medianVisualWeight)}, average ${formatDecimal(averageVisualWeight)})`,
    `- Total visual weight: ${formatDecimal(totalVisualWeight)}`,
    '',
    '## Largest Visual Files',
    '',
    renderTable(
      ['File', 'Category', 'Weight', 'Size', 'Max lines', 'Final lines'],
      largestVisualFiles.map((file) => [
        file.path,
        file.category,
        formatDecimal(file.visualWeight),
        file.visualSize,
        formatInteger(file.maxLineCount),
        formatInteger(file.finalLineCount),
      ]),
    ),
    '',
    '## Most Active Files',
    '',
    renderTable(
      ['File', 'Category', 'Units', 'Total activity', 'Avg activity'],
      mostActiveFiles.map((entry) => [
        entry.file.path,
        entry.file.category,
        formatInteger(entry.unitCount),
        formatDecimal(entry.totalActivityWeight),
        formatDecimal(entry.averageActivityWeight),
      ]),
    ),
    '',
    '## Top Folders By File Count',
    '',
    renderTable(
      ['Folder', 'Files', 'Final lines', 'Categories'],
      topFoldersByFileCount.map((folder) => [
        formatFolderPath(folder.path),
        formatInteger(folder.fileCount),
        formatInteger(folder.totalFinalLines),
        folder.categories.join(', '),
      ]),
    ),
    '',
    '## Top Folders By Total Visual Weight',
    '',
    renderTable(
      ['Folder', 'Weight', 'Share', 'Files'],
      topFoldersByVisualWeight.map((entry) => [
        formatFolderPath(entry.folder.path),
        formatDecimal(entry.totalVisualWeight),
        formatPercent(entry.visualWeightShare),
        formatInteger(entry.folder.fileCount),
      ]),
    ),
    '',
    '## Timeline Density Summary',
    '',
    renderTable(
      ['Segment', 'Unit range', 'Units', 'Distinct files', 'Avg activity', 'Top categories'],
      timelineChunks.map((chunk) => [
        chunk.label,
        formatUnitRange(chunk.startUnitOrder, chunk.endUnitOrder),
        formatInteger(chunk.unitCount),
        formatInteger(chunk.distinctFileCount),
        formatDecimal(chunk.averageActivityWeight),
        chunk.topCategories.length > 0
          ? chunk.topCategories
              .map((entry) => `${entry.category}=${formatInteger(entry.count)}`)
              .join(', ')
          : 'none',
      ]),
    ),
    '',
    '## Warnings',
    '',
    allWarnings.length > 0
      ? allWarnings.map((warning) => `- ${warning}`).join('\n')
      : '- None.',
    '',
  ].join('\n');
}

function buildFileActivities(
  timeline: VisualTimelineUnit[],
  fileById: Map<string, VisualFile>,
): FileActivityEntry[] {
  const activityMap = new Map<string, FileActivityEntry>();

  for (const unit of timeline) {
    const file = fileById.get(unit.fileId);

    if (!file) {
      continue;
    }

    const existing = activityMap.get(unit.fileId) ?? {
      file,
      unitCount: 0,
      totalActivityWeight: 0,
      averageActivityWeight: 0,
    };

    existing.unitCount += 1;
    existing.totalActivityWeight += unit.activityWeight;
    activityMap.set(unit.fileId, existing);
  }

  return Array.from(activityMap.values())
    .map((entry) => ({
      ...entry,
      averageActivityWeight:
        entry.unitCount > 0 ? entry.totalActivityWeight / entry.unitCount : 0,
    }))
    .sort((left, right) =>
      compareNumbersDescending(left.totalActivityWeight, right.totalActivityWeight) ||
      compareNumbersDescending(left.unitCount, right.unitCount) ||
      left.file.path.localeCompare(right.file.path),
    );
}

function buildFolderWeights(
  files: VisualFile[],
  folders: VisualFolder[],
): FolderWeightEntry[] {
  const folderWeightMap = new Map<string, number>();

  for (const folder of folders) {
    folderWeightMap.set(folder.path, 0);
  }

  for (const file of files) {
    for (const folderPath of expandFolderAncestors(file.folderPath)) {
      folderWeightMap.set(folderPath, (folderWeightMap.get(folderPath) ?? 0) + file.visualWeight);
    }
  }

  const totalVisualWeight = files.reduce((sum, file) => sum + file.visualWeight, 0);

  return folders
    .filter((folder) => folder.path !== '')
    .map((folder) => {
      const totalFolderWeight = folderWeightMap.get(folder.path) ?? 0;
      return {
        folder,
        totalVisualWeight: totalFolderWeight,
        visualWeightShare: totalVisualWeight > 0 ? totalFolderWeight / totalVisualWeight : 0,
      };
    })
    .sort((left, right) =>
      compareNumbersDescending(left.totalVisualWeight, right.totalVisualWeight) ||
      compareNumbersDescending(left.folder.fileCount, right.folder.fileCount) ||
      left.folder.path.localeCompare(right.folder.path),
    );
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

function buildTimelineChunkSummaries(
  timeline: VisualTimelineUnit[],
  fileById: Map<string, VisualFile>,
): TimelineChunkSummary[] {
  const chunkRanges = [
    { label: 'first' as const, start: 0, end: Math.floor(timeline.length / 3) },
    {
      label: 'middle' as const,
      start: Math.floor(timeline.length / 3),
      end: Math.floor((timeline.length * 2) / 3),
    },
    { label: 'last' as const, start: Math.floor((timeline.length * 2) / 3), end: timeline.length },
  ];

  return chunkRanges.map(({ label, start, end }) =>
    summarizeTimelineChunk(label, timeline.slice(start, end), fileById),
  );
}

function summarizeTimelineChunk(
  label: 'first' | 'middle' | 'last',
  units: VisualTimelineUnit[],
  fileById: Map<string, VisualFile>,
): TimelineChunkSummary {
  const categoryCounts = new Map<string, number>();
  const distinctFiles = new Set<string>();
  let totalActivityWeight = 0;

  for (const unit of units) {
    distinctFiles.add(unit.fileId);
    totalActivityWeight += unit.activityWeight;

    const category = fileById.get(unit.fileId)?.category ?? 'missing-file';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  return {
    label,
    unitCount: units.length,
    startUnitOrder: units[0]?.unitOrder ?? null,
    endUnitOrder: units.at(-1)?.unitOrder ?? null,
    distinctFileCount: distinctFiles.size,
    averageActivityWeight: units.length > 0 ? totalActivityWeight / units.length : 0,
    topCategories: Array.from(categoryCounts.entries())
      .sort(([leftCategory, leftCount], [rightCategory, rightCount]) =>
        compareNumbersDescending(leftCount, rightCount) || leftCategory.localeCompare(rightCategory),
      )
      .slice(0, 3)
      .map(([category, count]) => ({ category, count })),
  };
}

function buildPreviewWarnings(model: RepoVisualModel): string[] {
  const warnings: string[] = [];
  const fileById = new Map(model.files.map((file) => [file.id, file]));
  const totalVisualWeight = model.files.reduce((sum, file) => sum + file.visualWeight, 0);
  const sortedFiles = [...model.files].sort((left, right) =>
    compareNumbersDescending(left.visualWeight, right.visualWeight) ||
    compareNumbersDescending(left.maxLineCount, right.maxLineCount) ||
    left.path.localeCompare(right.path),
  );
  const topFile = sortedFiles[0];
  const secondFile = sortedFiles[1];
  const folderWeights = buildFolderWeights(model.files, model.folders);
  const dominantFolder = folderWeights[0];
  const supportTimelineUnits = model.timeline.filter((unit) => {
    const category = fileById.get(unit.fileId)?.category;
    return category ? !PRODUCT_CATEGORIES.has(category) : true;
  }).length;
  const supportShare =
    model.timeline.length > 0 ? supportTimelineUnits / model.timeline.length : 0;
  const folderPaths = new Set(model.folders.map((folder) => folder.path));
  const missingFileFolderCount = model.files.filter((file) => !folderPaths.has(file.folderPath)).length;
  const missingTimelineFiles = model.timeline.filter((unit) => !fileById.has(unit.fileId));
  const hasRootFolder = folderPaths.has('');
  const nonMonotonicPair = findNonMonotonicTimelinePair(model.timeline);
  const visualWeights = model.files.map((file) => file.visualWeight).sort((left, right) => left - right);
  const medianVisualWeight =
    visualWeights.length > 0 ? visualWeights[Math.floor(visualWeights.length / 2)] ?? 0 : 0;

  if (model.files.length === 0) {
    warnings.push('Visual model has no files.');
  }

  if (model.folders.length === 0) {
    warnings.push('Visual model has no folders.');
  }

  if (model.timeline.length === 0) {
    warnings.push('Visual model has no timeline units.');
  }

  if (!hasRootFolder) {
    warnings.push('Visual model is missing the root folder entry.');
  }

  if (missingFileFolderCount > 0) {
    warnings.push(
      `${formatInteger(missingFileFolderCount)} files reference folder paths that do not exist in the folder list.`,
    );
  }

  if (missingTimelineFiles.length > 0) {
    warnings.push(
      `${formatInteger(missingTimelineFiles.length)} timeline units reference file ids missing from the file list.`,
    );
  }

  if (nonMonotonicPair) {
    warnings.push(
      `Timeline ordering is not strictly increasing around unit orders ${nonMonotonicPair.previous} and ${nonMonotonicPair.current}.`,
    );
  }

  if (
    topFile &&
    totalVisualWeight > 0 &&
    topFile.visualWeight / totalVisualWeight >= 0.08 &&
    topFile.visualWeight >= medianVisualWeight * 3 &&
    (!secondFile || topFile.visualWeight - secondFile.visualWeight >= 0.2)
  ) {
    warnings.push(
      `File ${topFile.path} carries ${formatPercent(topFile.visualWeight / totalVisualWeight)} of total visual weight and is much larger than the median file.`,
    );
  }

  if (dominantFolder && dominantFolder.visualWeightShare >= 0.45) {
    warnings.push(
      `Folder ${formatFolderPath(dominantFolder.folder.path)} carries ${formatPercent(dominantFolder.visualWeightShare)} of total visual weight.`,
    );
  }

  if (supportShare >= 0.35) {
    warnings.push(
      `${formatPercent(supportShare)} of timeline units target docs/config/script/data/unknown files instead of source/ui/backend/test files.`,
    );
  }

  return warnings;
}

function findNonMonotonicTimelinePair(
  timeline: VisualTimelineUnit[],
): { previous: number; current: number } | null {
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];

    if (!previous || !current) {
      continue;
    }

    if (current.unitOrder <= previous.unitOrder) {
      return {
        previous: previous.unitOrder,
        current: current.unitOrder,
      };
    }
  }

  return null;
}

function renderTable(headers: string[], rows: string[][]): string {
  const bodyRows = rows.length > 0 ? rows : [headers.map(() => 'none')];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...bodyRows.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`),
  ].join('\n');
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function formatFolderPath(folderPath: string): string {
  return folderPath === '' ? ROOT_FOLDER_LABEL : folderPath;
}

function formatUnitRange(startUnitOrder: number | null, endUnitOrder: number | null): string {
  if (startUnitOrder === null || endUnitOrder === null) {
    return 'none';
  }

  return `${formatInteger(startUnitOrder)}-${formatInteger(endUnitOrder)}`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number): string {
  return value.toFixed(3);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function compareNumbersDescending(left: number, right: number): number {
  return right - left;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
