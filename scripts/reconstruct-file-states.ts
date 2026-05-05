import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

const DEFAULT_INPUT_PATH = 'data/generated/raw-git-history.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-file-states.json';

interface CliOptions {
  inputPath: string;
  outputPath: string;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const inputPath = resolveInputPath(options.inputPath);
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const rawHistory = await loadRawHistory(inputPath);
    const warnings: string[] = [];
    const currentFiles = new Map<string, RepoFileState>();
    const steps = rawHistory.commits.map((commit, stepIndex) =>
      applyCommitToState(currentFiles, commit, stepIndex, warnings),
    );

    const output: ReconstructedRepoFileStates = {
      metadata: {
        generatedAt: new Date().toISOString(),
        inputPath,
        commitCount: rawHistory.commits.length,
        stepCount: steps.length,
        warningCount: warnings.length,
      },
      steps,
      warnings,
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    const lastStep = steps.at(-1);

    console.log(`Reconstructed ${steps.length} commit states.`);
    console.log(`Current files: ${lastStep?.totals.existingFiles ?? 0}`);
    console.log(`Known lines: ${lastStep?.totals.totalKnownLines ?? 0}`);
    console.log(`Unknown-line files: ${lastStep?.totals.unknownLineFiles ?? 0}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Wrote ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let inputPath = DEFAULT_INPUT_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--in') {
      inputPath = getFlagValue(argv, index, '--in');
      index += 1;
      continue;
    }

    if (argument.startsWith('--in=')) {
      inputPath = argument.slice('--in='.length);
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
    inputPath,
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
    'Usage: npm run reconstruct:states -- [--in data/generated/raw-git-history.json] [--out data/generated/repo-file-states.json]',
  );
  process.exit(0);
}

function resolveInputPath(inputPath: string): string {
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Input file does not exist: ${resolvedPath}`);
  }

  if (!statSync(resolvedPath).isFile()) {
    throw new Error(`Input path is not a file: ${resolvedPath}`);
  }

  return resolvedPath;
}

async function loadRawHistory(inputPath: string): Promise<RawGitHistory> {
  let parsed: unknown;

  try {
    const inputContent = await readFile(inputPath, 'utf8');
    parsed = JSON.parse(inputContent);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse input JSON: ${error.message}`);
    }

    throw new Error('Failed to read or parse input JSON.');
  }

  if (!isRawGitHistory(parsed)) {
    throw new Error(`Input file does not match the expected raw Git history schema: ${inputPath}`);
  }

  return parsed;
}

function isRawGitHistory(value: unknown): value is RawGitHistory {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RawGitHistory>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.commits);
}

function applyCommitToState(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  stepIndex: number,
  warnings: string[],
): FileStateStep {
  for (const fileChange of commit.changedFiles) {
    applyFileChange(currentFiles, commit, fileChange, warnings);
  }

  const files = Array.from(currentFiles.values())
    .map(cloneFileState)
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    stepIndex,
    commitHash: commit.hash,
    commitOrder: commit.order,
    commitMessage: commit.message,
    totals: buildStepTotals(files, commit.changedFiles),
    changedPaths: commit.changedFiles.map((fileChange) => fileChange.path),
    files,
  };
}

function applyFileChange(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  warnings: string[],
): void {
  switch (fileChange.status) {
    case 'added':
      currentFiles.set(fileChange.path, createAddedState(fileChange, commit));
      return;
    case 'modified':
      applyModifiedState(currentFiles, commit, fileChange, warnings);
      return;
    case 'deleted':
      currentFiles.delete(fileChange.path);
      return;
    case 'renamed':
      applyRenamedState(currentFiles, commit, fileChange, warnings);
      return;
    case 'copied':
      applyCopiedState(currentFiles, commit, fileChange, warnings);
      return;
    case 'unknown':
      applyUnknownState(currentFiles, commit, fileChange, warnings);
      return;
    default:
      return assertNever(fileChange.status);
  }
}

function createAddedState(
  fileChange: GitHistoryFileChange,
  commit: GitHistoryCommit,
): RepoFileState {
  const lineCountKnown = areLineCountsKnown(fileChange);
  return {
    ...buildPathMetadata(fileChange.path),
    exists: true,
    lineCount: lineCountKnown ? fileChange.addedLines : null,
    lineCountUnknown: !lineCountKnown,
    createdOrder: commit.order,
    firstSeenCommit: commit.hash,
    lastChangedCommit: commit.hash,
    changeCount: 1,
    accumulatedAddedLines: fileChange.addedLines ?? 0,
    accumulatedDeletedLines: fileChange.deletedLines ?? 0,
  };
}

function applyModifiedState(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  warnings: string[],
): void {
  const existingState = currentFiles.get(fileChange.path);
  const baseState =
    existingState ??
    createPlaceholderState(
      fileChange.path,
      commit,
      `Modified file was missing from current state and was recreated as a placeholder.`,
      warnings,
    );

  const updatedState = updateExistingState(baseState, commit, fileChange.path, fileChange);
  currentFiles.set(fileChange.path, updatedState);
}

function applyRenamedState(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  warnings: string[],
): void {
  const previousPath = fileChange.oldPath;
  const existingState = previousPath ? currentFiles.get(previousPath) : undefined;

  if (previousPath) {
    currentFiles.delete(previousPath);
  }

  const baseState =
    existingState ??
    createPlaceholderState(
      fileChange.path,
      commit,
      `Renamed file source ${previousPath ?? '<missing>'} was not present in current state.`,
      warnings,
    );

  const renamedState = updateExistingState(baseState, commit, fileChange.path, fileChange);
  currentFiles.set(fileChange.path, renamedState);
}

function applyCopiedState(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  warnings: string[],
): void {
  const previousPath = fileChange.oldPath;
  const sourceState = previousPath ? currentFiles.get(previousPath) : undefined;
  const baseState = sourceState
    ? createCopiedStateFromSource(sourceState, fileChange.path, commit, fileChange)
    : createAddedState(fileChange, commit);

  if (!sourceState) {
    addWarning(
      warnings,
      commit,
      fileChange.path,
      `Copied file source ${previousPath ?? '<missing>'} was not present in current state.`,
    );
  }

  currentFiles.set(fileChange.path, baseState);
}

function applyUnknownState(
  currentFiles: Map<string, RepoFileState>,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
  warnings: string[],
): void {
  const existingState = currentFiles.get(fileChange.path);
  const baseState =
    existingState ??
    createPlaceholderState(
      fileChange.path,
      commit,
      `Unknown-status file change was missing from current state and was recreated as a placeholder.`,
      warnings,
    );

  addWarning(
    warnings,
    commit,
    fileChange.path,
    `Encountered unsupported file status "${fileChange.status}". Treated as a generic modification.`,
  );

  const updatedState = updateExistingState(baseState, commit, fileChange.path, fileChange);
  currentFiles.set(fileChange.path, updatedState);
}

function createPlaceholderState(
  nextPath: string,
  commit: GitHistoryCommit,
  reason: string,
  warnings: string[],
): RepoFileState {
  addWarning(warnings, commit, nextPath, reason);
  return {
    ...buildPathMetadata(nextPath),
    exists: true,
    lineCount: null,
    lineCountUnknown: true,
    createdOrder: commit.order,
    firstSeenCommit: commit.hash,
    lastChangedCommit: commit.hash,
    changeCount: 0,
    accumulatedAddedLines: 0,
    accumulatedDeletedLines: 0,
  };
}

function createCopiedStateFromSource(
  sourceState: RepoFileState,
  nextPath: string,
  commit: GitHistoryCommit,
  fileChange: GitHistoryFileChange,
): RepoFileState {
  return {
    ...buildPathMetadata(nextPath),
    exists: true,
    lineCount: sourceState.lineCount,
    lineCountUnknown: sourceState.lineCountUnknown || !areLineCountsKnown(fileChange),
    createdOrder: commit.order,
    firstSeenCommit: commit.hash,
    lastChangedCommit: commit.hash,
    changeCount: 1,
    accumulatedAddedLines: fileChange.addedLines ?? 0,
    accumulatedDeletedLines: fileChange.deletedLines ?? 0,
  };
}

function updateExistingState(
  state: RepoFileState,
  commit: GitHistoryCommit,
  nextPath: string,
  fileChange: GitHistoryFileChange,
): RepoFileState {
  const lineCountKnown = areLineCountsKnown(fileChange);
  const addedLines = fileChange.addedLines ?? 0;
  const deletedLines = fileChange.deletedLines ?? 0;
  const nextLineCountUnknown = state.lineCountUnknown || !lineCountKnown;
  const currentLineCount =
    !nextLineCountUnknown && state.lineCount !== null ? state.lineCount : null;
  const nextLineCount =
    currentLineCount !== null && lineCountKnown
      ? Math.max(0, currentLineCount + addedLines - deletedLines)
      : currentLineCount;

  return {
    ...state,
    ...buildPathMetadata(nextPath),
    path: nextPath,
    lineCount: nextLineCount,
    lineCountUnknown: nextLineCountUnknown,
    lastChangedCommit: commit.hash,
    changeCount: state.changeCount + 1,
    accumulatedAddedLines: state.accumulatedAddedLines + addedLines,
    accumulatedDeletedLines: state.accumulatedDeletedLines + deletedLines,
  };
}

function buildStepTotals(
  files: RepoFileState[],
  changedFiles: GitHistoryFileChange[],
): FileStateStep['totals'] {
  return {
    existingFiles: files.length,
    totalKnownLines: files.reduce(
      (sum, file) => sum + (file.lineCountUnknown ? 0 : (file.lineCount ?? 0)),
      0,
    ),
    unknownLineFiles: files.filter((file) => file.lineCountUnknown).length,
    changedFiles: changedFiles.length,
    addedLines: changedFiles.reduce((sum, file) => sum + (file.addedLines ?? 0), 0),
    deletedLines: changedFiles.reduce((sum, file) => sum + (file.deletedLines ?? 0), 0),
  };
}

function areLineCountsKnown(fileChange: GitHistoryFileChange): boolean {
  return !fileChange.isBinary && fileChange.addedLines !== null && fileChange.deletedLines !== null;
}

function buildPathMetadata(filePath: string): Pick<
  RepoFileState,
  'path' | 'name' | 'folder' | 'extension'
> {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parsedPath = path.posix.parse(normalizedPath);
  const extension = parsedPath.ext.startsWith('.') ? parsedPath.ext.slice(1) : parsedPath.ext;

  return {
    path: normalizedPath,
    name: parsedPath.base,
    folder: parsedPath.dir,
    extension,
  };
}

function addWarning(
  warnings: string[],
  commit: GitHistoryCommit,
  filePath: string,
  message: string,
): void {
  warnings.push(
    `[commit ${commit.order} ${commit.hash.slice(0, 7)}] ${filePath}: ${message}`,
  );
}

function cloneFileState(file: RepoFileState): RepoFileState {
  return { ...file };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled file status: ${String(value)}`);
}
