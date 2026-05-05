import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  RepoChangeUnit,
  RepoChangeUnitType,
  RepoChangeUnitsOutput,
} from '../src/preprocessing/changeUnitTypes.ts';
import type {
  FileStateStep,
  ReconstructedRepoFileStates,
  RepoFileState,
} from '../src/preprocessing/fileStateTypes.ts';
import type {
  GitHistoryCommit,
  GitHistoryFileChange,
  RawGitHistory,
} from '../src/preprocessing/gitHistoryTypes.ts';

const DEFAULT_HISTORY_PATH = 'data/generated/raw-git-history.json';
const DEFAULT_STATES_PATH = 'data/generated/repo-file-states.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-change-units.json';
const DEFAULT_LINE_QUANTUM = 10;

interface CliOptions {
  historyPath: string;
  statesPath: string;
  outputPath: string;
  lineQuantum: number;
}

interface MutableFileState {
  path: string;
  folder: string;
  extension: string;
  lineCount: number | null;
  lineCountUnknown: boolean;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const historyPath = resolveInputFile(options.historyPath, 'History input');
    const statesPath = resolveInputFile(options.statesPath, 'State input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const history = await loadRawHistory(historyPath);
    const fileStates = await loadReconstructedStates(statesPath);
    const warnings: string[] = [];
    const units = generateUnits(history, fileStates, options.lineQuantum, warnings);

    const output: RepoChangeUnitsOutput = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: {
        historyPath,
        statesPath,
        lineQuantum: options.lineQuantum,
      },
      summary: {
        commitCount: history.commits.length,
        fileChangeCount: history.commits.reduce(
          (sum, commit) => sum + commit.changedFiles.length,
          0,
        ),
        unitCount: units.length,
        totalAddedLines: history.commits.reduce(
          (sum, commit) =>
            sum +
            commit.changedFiles.reduce(
              (fileSum, file) => fileSum + (file.addedLines ?? 0),
              0,
            ),
          0,
        ),
        totalDeletedLines: history.commits.reduce(
          (sum, commit) =>
            sum +
            commit.changedFiles.reduce(
              (fileSum, file) => fileSum + (file.deletedLines ?? 0),
              0,
            ),
          0,
        ),
        structuralUnitCount: units.filter((unit) => isStructuralUnit(unit.type)).length,
        growthUnitCount: units.filter((unit) => unit.type === 'grow').length,
        shrinkUnitCount: units.filter((unit) => unit.type === 'shrink').length,
        warnings,
      },
      units,
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    console.log(`Generated ${units.length} change units from ${history.commits.length} commits.`);
    console.log(
      `Structural: ${output.summary.structuralUnitCount}, growth: ${output.summary.growthUnitCount}, shrink: ${output.summary.shrinkUnitCount}`,
    );
    console.log(`Warnings: ${warnings.length}`);
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
  let outputPath = DEFAULT_OUTPUT_PATH;
  let lineQuantum = DEFAULT_LINE_QUANTUM;

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

    if (argument === '--out') {
      outputPath = getFlagValue(argv, index, '--out');
      index += 1;
      continue;
    }

    if (argument.startsWith('--out=')) {
      outputPath = argument.slice('--out='.length);
      continue;
    }

    if (argument === '--line-quantum') {
      lineQuantum = parseLineQuantum(getFlagValue(argv, index, '--line-quantum'));
      index += 1;
      continue;
    }

    if (argument.startsWith('--line-quantum=')) {
      lineQuantum = parseLineQuantum(argument.slice('--line-quantum='.length));
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
    outputPath,
    lineQuantum,
  };
}

function getFlagValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

function parseLineQuantum(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--line-quantum must be a positive integer. Received: ${value}`);
  }

  return parsed;
}

function printUsageAndExit(): never {
  console.log(
    'Usage: npm run generate:units -- [--history data/generated/raw-git-history.json] [--states data/generated/repo-file-states.json] [--out data/generated/repo-change-units.json] [--line-quantum 10]',
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
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RawGitHistory>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.commits);
}

function isReconstructedRepoFileStates(
  value: unknown,
): value is ReconstructedRepoFileStates {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReconstructedRepoFileStates>;
  return Array.isArray(candidate.steps) && Array.isArray(candidate.warnings);
}

function generateUnits(
  history: RawGitHistory,
  fileStates: ReconstructedRepoFileStates,
  lineQuantum: number,
  warnings: string[],
): RepoChangeUnit[] {
  const units: RepoChangeUnit[] = [];
  let unitOrder = 0;
  let currentFiles = new Map<string, MutableFileState>();
  const stepsByCommitOrder = new Map(
    fileStates.steps.map((step) => [step.commitOrder, step]),
  );

  if (fileStates.steps.length !== history.commits.length) {
    warnings.push(
      `History/state commit count mismatch: history=${history.commits.length}, states=${fileStates.steps.length}.`,
    );
  }

  for (let commitIndex = 0; commitIndex < history.commits.length; commitIndex += 1) {
    const commit = history.commits[commitIndex];
    const beforeStep = commitIndex > 0 ? fileStates.steps[commitIndex - 1] : undefined;
    const afterStep = stepsByCommitOrder.get(commit.order);

    currentFiles = createMutableStateMap(beforeStep?.files ?? []);

    if (
      afterStep &&
      (afterStep.commitHash !== commit.hash || afterStep.commitOrder !== commit.order)
    ) {
      warnings.push(
        `[commit ${commit.order} ${commit.hash.slice(0, 7)}] State step ordering does not align with raw history.`,
      );
    }

    const afterFilesByPath = new Map(
      (afterStep?.files ?? []).map((file) => [normalizePath(file.path), file]),
    );

    for (const fileChange of commit.changedFiles) {
      const context = createChangeContext(
        commit,
        fileChange,
        currentFiles,
        afterFilesByPath,
        warnings,
      );

      unitOrder = appendUnitsForFileChange(
        units,
        unitOrder,
        context,
        lineQuantum,
      );

      applyChangeToMutableState(currentFiles, context, warnings);
    }

    if (afterStep) {
      compareStepState(commit, currentFiles, afterStep, warnings);
    }
  }

  return units;
}

function createChangeContext(
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  currentFiles: Map<string, MutableFileState>,
  afterFilesByPath: Map<string, RepoFileState>,
  warnings: string[],
): ChangeContext {
  const filePath = normalizePath(fileChange.path);
  const previousPath = fileChange.oldPath ? normalizePath(fileChange.oldPath) : undefined;
  const sourcePath =
    fileChange.status === 'renamed' || fileChange.status === 'copied'
      ? previousPath
      : filePath;
  const beforeState = sourcePath ? currentFiles.get(sourcePath) : undefined;
  const afterState = afterFilesByPath.get(filePath);

  if (!afterState && fileChange.status !== 'deleted') {
    warnings.push(
      `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: missing after-state snapshot; using simulated values.`,
    );
  }

  const beforeLineCount =
    fileChange.status === 'added' && !beforeState
      ? 0
      : beforeState?.lineCount ?? null;
  const lineDelta = calculateLineDelta(fileChange);
  const approxAfterLineCount = deriveApproxAfterLineCount(fileChange, beforeState, lineDelta);
  const afterLineCount =
    fileChange.status === 'deleted'
      ? 0
      : afterState?.lineCount ?? approxAfterLineCount;
  const extension = afterState?.extension ?? beforeState?.extension ?? getPathMetadata(filePath).extension;
  const folder = afterState?.folder ?? beforeState?.folder ?? getPathMetadata(filePath).folder;

  return {
    commit,
    fileChange,
    filePath,
    previousPath,
    beforeState,
    beforeLineCount,
    afterLineCount,
    lineDelta,
    extension,
    folder,
  };
}

interface ChangeContext {
  commit: GitHistoryCommit;
  fileChange: GitHistoryFileChange;
  filePath: string;
  previousPath?: string;
  beforeState?: MutableFileState;
  beforeLineCount: number | null;
  afterLineCount: number | null;
  lineDelta: number | null;
  extension: string;
  folder: string;
}

function appendUnitsForFileChange(
  units: RepoChangeUnit[],
  unitOrder: number,
  context: ChangeContext,
  lineQuantum: number,
): number {
  const { fileChange } = context;
  const unitSpecs: Array<{
    type: RepoChangeUnitType;
    unitLineAmount: number | null;
    visualMass: number;
  }> = [];

  if (fileChange.status === 'added') {
    unitSpecs.push({
      type: 'create',
      unitLineAmount: null,
      visualMass: 1,
    });
  }

  if (fileChange.status === 'deleted') {
    unitSpecs.push({
      type: 'delete',
      unitLineAmount: null,
      visualMass: 1,
    });
  }

  if (fileChange.status === 'renamed') {
    unitSpecs.push({
      type: 'rename',
      unitLineAmount: null,
      visualMass: 0.9,
    });
  }

  if (fileChange.status === 'copied') {
    unitSpecs.push({
      type: 'copy',
      unitLineAmount: null,
      visualMass: 0.9,
    });
  }

  const growLineUnits = chunkLineUnits(fileChange.addedLines ?? 0, lineQuantum);
  const shrinkLineUnits = chunkLineUnits(fileChange.deletedLines ?? 0, lineQuantum);

  for (const amount of growLineUnits) {
    unitSpecs.push({
      type: 'grow',
      unitLineAmount: amount,
      visualMass: visualMassFromLines(amount, lineQuantum),
    });
  }

  for (const amount of shrinkLineUnits) {
    unitSpecs.push({
      type: 'shrink',
      unitLineAmount: amount,
      visualMass: visualMassFromLines(amount, lineQuantum),
    });
  }

  if (unitSpecs.length === 0) {
    unitSpecs.push({
      type: 'modify',
      unitLineAmount: null,
      visualMass: fileChange.isBinary ? 0.35 : 0.6,
    });
  }

  for (const unitSpec of unitSpecs) {
    units.push({
      unitOrder,
      commitOrder: context.commit.order,
      commitHash: context.commit.hash,
      filePath: context.filePath,
      previousPath: context.previousPath,
      type: unitSpec.type,
      statusFromGit: fileChange.status,
      lineDelta: context.lineDelta,
      unitLineAmount: unitSpec.unitLineAmount,
      beforeLineCount: context.beforeLineCount,
      afterLineCount: context.afterLineCount,
      extension: context.extension,
      folder: context.folder,
      visualMass: unitSpec.visualMass,
    });
    unitOrder += 1;
  }

  return unitOrder;
}

function chunkLineUnits(totalLines: number, lineQuantum: number): number[] {
  if (totalLines <= 0) {
    return [];
  }

  const chunks: number[] = [];
  let remaining = totalLines;

  while (remaining > 0) {
    const nextChunk = Math.min(remaining, lineQuantum);
    chunks.push(nextChunk);
    remaining -= nextChunk;
  }

  return chunks;
}

function visualMassFromLines(unitLineAmount: number, lineQuantum: number): number {
  return Math.max(0.4, unitLineAmount / lineQuantum);
}

function calculateLineDelta(fileChange: GitHistoryFileChange): number | null {
  if (fileChange.addedLines === null || fileChange.deletedLines === null) {
    return null;
  }

  return fileChange.addedLines - fileChange.deletedLines;
}

function deriveApproxAfterLineCount(
  fileChange: GitHistoryFileChange,
  beforeState: MutableFileState | undefined,
  lineDelta: number | null,
): number | null {
  switch (fileChange.status) {
    case 'added':
      return fileChange.addedLines;
    case 'deleted':
      return 0;
    case 'copied':
      return beforeState?.lineCount ?? fileChange.addedLines;
    case 'renamed':
    case 'modified':
    case 'unknown':
      if (beforeState?.lineCount !== null && beforeState?.lineCount !== undefined && lineDelta !== null) {
        return Math.max(0, beforeState.lineCount + lineDelta);
      }

      return beforeState?.lineCount ?? null;
    default:
      return assertNever(fileChange.status);
  }
}

function applyChangeToMutableState(
  currentFiles: Map<string, MutableFileState>,
  context: ChangeContext,
  warnings: string[],
): void {
  const { commit, fileChange, filePath, previousPath, beforeState, extension, folder } = context;
  const lineCountsKnown = areLineCountsKnown(fileChange);
  const addedLines = fileChange.addedLines ?? 0;
  const deletedLines = fileChange.deletedLines ?? 0;

  switch (fileChange.status) {
    case 'added':
      currentFiles.set(filePath, {
        path: filePath,
        folder,
        extension,
        lineCount: lineCountsKnown ? addedLines : null,
        lineCountUnknown: !lineCountsKnown,
      });
      return;
    case 'modified':
    case 'unknown': {
      const baseState =
        beforeState ??
        createMutablePlaceholder(filePath, warnings, commit, 'Missing existing file for modification.');
      currentFiles.set(
        filePath,
        applyDeltaToMutableState(baseState, filePath, folder, extension, addedLines, deletedLines, lineCountsKnown),
      );
      return;
    }
    case 'deleted':
      if (!beforeState) {
        warnings.push(
          `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: deleted file was not present in current state.`,
        );
      }
      currentFiles.delete(filePath);
      return;
    case 'renamed': {
      if (previousPath) {
        currentFiles.delete(previousPath);
      }

      const baseState =
        beforeState ??
        createMutablePlaceholder(
          filePath,
          warnings,
          commit,
          `Missing source file for rename from ${previousPath ?? '<missing>'}.`,
        );

      currentFiles.set(
        filePath,
        applyDeltaToMutableState(baseState, filePath, folder, extension, addedLines, deletedLines, lineCountsKnown),
      );
      return;
    }
    case 'copied': {
      if (!beforeState) {
        warnings.push(
          `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: copied file source ${previousPath ?? '<missing>'} was not present in current state.`,
        );
        currentFiles.set(filePath, {
          path: filePath,
          folder,
          extension,
          lineCount: lineCountsKnown ? addedLines : null,
          lineCountUnknown: !lineCountsKnown,
        });
        return;
      }

      currentFiles.set(filePath, {
        path: filePath,
        folder,
        extension,
        lineCount: beforeState.lineCount,
        lineCountUnknown: beforeState.lineCountUnknown || !lineCountsKnown,
      });
      return;
    }
    default:
      return assertNever(fileChange.status);
  }
}

function createMutablePlaceholder(
  filePath: string,
  warnings: string[],
  commit: GitHistoryCommit,
  reason: string,
): MutableFileState {
  warnings.push(
    `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: ${reason}`,
  );

  const metadata = getPathMetadata(filePath);
  return {
    path: filePath,
    folder: metadata.folder,
    extension: metadata.extension,
    lineCount: null,
    lineCountUnknown: true,
  };
}

function applyDeltaToMutableState(
  state: MutableFileState,
  filePath: string,
  folder: string,
  extension: string,
  addedLines: number,
  deletedLines: number,
  lineCountsKnown: boolean,
): MutableFileState {
  const nextLineCountUnknown = state.lineCountUnknown || !lineCountsKnown;
  const nextLineCount =
    !nextLineCountUnknown && state.lineCount !== null
      ? Math.max(0, state.lineCount + addedLines - deletedLines)
      : null;

  return {
    path: filePath,
    folder,
    extension,
    lineCount: nextLineCount,
    lineCountUnknown: nextLineCountUnknown,
  };
}

function compareStepState(
  commit: GitHistoryCommit,
  currentFiles: Map<string, MutableFileState>,
  afterStep: FileStateStep,
  warnings: string[],
): void {
  const expectedFiles = createMutableStateMap(afterStep.files);

  if (currentFiles.size !== expectedFiles.size) {
    warnings.push(
      `[commit ${commit.order} ${commit.hash.slice(0, 7)}] simulated file count ${currentFiles.size} does not match reconstructed step count ${expectedFiles.size}.`,
    );
    return;
  }

  for (const [filePath, expectedState] of expectedFiles) {
    const simulatedState = currentFiles.get(filePath);

    if (!simulatedState) {
      warnings.push(
        `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: simulated state is missing from the reconstructed step comparison.`,
      );
      return;
    }

    if (
      simulatedState.lineCount !== expectedState.lineCount ||
      simulatedState.lineCountUnknown !== expectedState.lineCountUnknown
    ) {
      warnings.push(
        `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: simulated line state does not match reconstructed step output.`,
      );
      return;
    }
  }
}

function createMutableStateMap(files: RepoFileState[]): Map<string, MutableFileState> {
  return new Map(
    files.map((file) => [
      normalizePath(file.path),
      {
        path: normalizePath(file.path),
        folder: file.folder,
        extension: file.extension,
        lineCount: file.lineCount,
        lineCountUnknown: file.lineCountUnknown,
      },
    ]),
  );
}

function areLineCountsKnown(fileChange: GitHistoryFileChange): boolean {
  return !fileChange.isBinary && fileChange.addedLines !== null && fileChange.deletedLines !== null;
}

function getPathMetadata(filePath: string): { folder: string; extension: string } {
  const parsedPath = path.posix.parse(normalizePath(filePath));
  return {
    folder: parsedPath.dir,
    extension: parsedPath.ext.startsWith('.') ? parsedPath.ext.slice(1) : parsedPath.ext,
  };
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isStructuralUnit(type: RepoChangeUnitType): boolean {
  return type === 'create' || type === 'delete' || type === 'rename' || type === 'copy' || type === 'modify';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
