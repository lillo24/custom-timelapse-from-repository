import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  GitHistoryCommit,
  GitHistoryFileChange,
  GitHistoryFileStatus,
  RawGitHistory,
} from '../src/preprocessing/gitHistoryTypes.ts';

const DEFAULT_OUTPUT_PATH = 'data/generated/raw-git-history.json';
const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const FIELD_SEPARATOR = '\u001f';

interface CliOptions {
  repoPath: string;
  outputPath: string;
}

interface ParsedNameStatusEntry {
  path: string;
  oldPath: string | null;
  status: GitHistoryFileStatus;
}

interface ParsedNumstatEntry {
  path: string;
  oldPath: string | null;
  addedLines: number | null;
  deletedLines: number | null;
  isBinary: boolean;
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    ensureGitIsAvailable();

    const repositoryPath = resolveRepositoryPath(options.repoPath);
    const outputPath = path.resolve(process.cwd(), options.outputPath);

    const sourceRepoPath = getGitOutput(
      repositoryPath,
      ['rev-parse', '--show-toplevel'],
      'Failed to resolve the repository root.',
    ).trim();

    const currentHead = getGitOutput(
      sourceRepoPath,
      ['rev-parse', 'HEAD'],
      'Failed to resolve HEAD. The repository may not have any commits yet.',
    ).trim();

    const commitHashes = getGitOutput(
      sourceRepoPath,
      ['rev-list', '--reverse', '--topo-order', 'HEAD'],
      'Failed to read Git history from HEAD.',
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const commits = commitHashes.map((hash, order) =>
      extractCommit(sourceRepoPath, hash, order),
    );

    const history: RawGitHistory = {
      schemaVersion: 1,
      sourceRepo: {
        path: sourceRepoPath,
        currentHead,
      },
      generatedAt: new Date().toISOString(),
      commits,
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');

    console.log(
      `Extracted ${commits.length} commits from ${sourceRepoPath} to ${outputPath}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let repoPath: string | undefined;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--repo') {
      repoPath = getFlagValue(argv, index, '--repo');
      index += 1;
      continue;
    }

    if (argument.startsWith('--repo=')) {
      repoPath = argument.slice('--repo='.length);
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

  if (!repoPath) {
    throw new Error(
      'Missing required --repo argument.\nUsage: npm run extract:git -- --repo <path> [--out <path>]',
    );
  }

  return {
    repoPath,
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
    'Usage: npm run extract:git -- --repo <path-to-git-repo> [--out data/generated/raw-git-history.json]',
  );
  process.exit(0);
}

function resolveRepositoryPath(inputPath: string): string {
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Repository path does not exist: ${resolvedPath}`);
  }

  if (!statSync(resolvedPath).isDirectory()) {
    throw new Error(`Repository path is not a directory: ${resolvedPath}`);
  }

  const isGitRepository = getGitOutput(
    resolvedPath,
    ['rev-parse', '--is-inside-work-tree'],
    `Path is not a Git repository: ${resolvedPath}`,
  ).trim();

  if (isGitRepository !== 'true') {
    throw new Error(`Path is not a Git repository: ${resolvedPath}`);
  }

  return resolvedPath;
}

function ensureGitIsAvailable(): void {
  try {
    execFileSync('git', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (isMissingBinaryError(error)) {
      throw new Error('Git is required but was not found on PATH.');
    }

    throw new Error('Git is installed but `git --version` failed.');
  }
}

function extractCommit(
  repositoryPath: string,
  hash: string,
  order: number,
): GitHistoryCommit {
  const metadata = getGitOutput(
    repositoryPath,
    [
      'show',
      '-s',
      `--format=%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%s`,
      hash,
    ],
    `Failed to read commit metadata for ${hash}.`,
  ).trim();

  const [
    fullHash,
    shortHash,
    authorName,
    authorEmail,
    date,
    rawParents,
    message,
  ] = metadata.split(FIELD_SEPARATOR);

  if (
    !fullHash ||
    !shortHash ||
    !authorName ||
    !authorEmail ||
    !date ||
    message === undefined
  ) {
    throw new Error(`Unexpected commit metadata format for ${hash}.`);
  }

  const parentHashes = rawParents ? rawParents.split(' ').filter(Boolean) : [];
  // Use first-parent diffs for merges so each commit maps to one linear change set.
  const diffBase = parentHashes[0] ?? EMPTY_TREE_HASH;

  const changedFiles = extractChangedFiles(repositoryPath, diffBase, fullHash);

  return {
    order,
    hash: fullHash,
    shortHash,
    authorName,
    authorEmail,
    date,
    message,
    parentHashes,
    changedFiles,
  };
}

function extractChangedFiles(
  repositoryPath: string,
  diffBase: string,
  hash: string,
): GitHistoryFileChange[] {
  const nameStatusOutput = getGitBuffer(
    repositoryPath,
    [
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      '--find-copies',
      diffBase,
      hash,
    ],
    `Failed to read changed files for ${hash}.`,
  );

  const numstatOutput = getGitBuffer(
    repositoryPath,
    [
      'diff',
      '--numstat',
      '-z',
      '--find-renames',
      '--find-copies',
      diffBase,
      hash,
    ],
    `Failed to read numstat data for ${hash}.`,
  );

  const fileEntries = parseNameStatusEntries(nameStatusOutput);
  const numstatEntries = parseNumstatEntries(numstatOutput);
  const numstatByFile = new Map(
    numstatEntries.map((entry) => [createFileKey(entry.oldPath, entry.path), entry]),
  );

  return fileEntries.map((fileEntry) => {
    const matchingNumstat = numstatByFile.get(
      createFileKey(fileEntry.oldPath, fileEntry.path),
    );

    return {
      path: fileEntry.path,
      oldPath: fileEntry.oldPath,
      status: fileEntry.status,
      addedLines: matchingNumstat?.addedLines ?? null,
      deletedLines: matchingNumstat?.deletedLines ?? null,
      isBinary: matchingNumstat?.isBinary ?? false,
    };
  });
}

function parseNameStatusEntries(output: Buffer): ParsedNameStatusEntry[] {
  const fields = splitNullTerminatedBuffer(output);
  const entries: ParsedNameStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const rawStatus = fields[index];

    if (!rawStatus) {
      continue;
    }

    const statusCode = rawStatus[0] ?? '';

    if (statusCode === 'R' || statusCode === 'C') {
      const oldPath = fields[index + 1];
      const nextPath = fields[index + 2];

      if (!oldPath || !nextPath) {
        throw new Error(`Malformed ${rawStatus} entry in git name-status output.`);
      }

      entries.push({
        path: nextPath,
        oldPath,
        status: mapGitStatus(rawStatus),
      });
      index += 2;
      continue;
    }

    const nextPath = fields[index + 1];

    if (!nextPath) {
      throw new Error(`Malformed ${rawStatus} entry in git name-status output.`);
    }

    entries.push({
      path: nextPath,
      oldPath: null,
      status: mapGitStatus(rawStatus),
    });
    index += 1;
  }

  return entries;
}

function parseNumstatEntries(output: Buffer): ParsedNumstatEntry[] {
  const fields = splitNullTerminatedBuffer(output);
  const entries: ParsedNumstatEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];

    if (!field) {
      continue;
    }

    const firstTabIndex = field.indexOf('\t');
    const secondTabIndex = field.indexOf('\t', firstTabIndex + 1);

    if (firstTabIndex < 0 || secondTabIndex < 0) {
      throw new Error('Malformed git numstat output.');
    }

    const addedToken = field.slice(0, firstTabIndex);
    const deletedToken = field.slice(firstTabIndex + 1, secondTabIndex);
    const pathToken = field.slice(secondTabIndex + 1);
    const isBinary = addedToken === '-' || deletedToken === '-';

    if (pathToken !== '') {
      entries.push({
        path: pathToken,
        oldPath: null,
        addedLines: parseNumstatCount(addedToken, isBinary),
        deletedLines: parseNumstatCount(deletedToken, isBinary),
        isBinary,
      });
      continue;
    }

    const oldPath = fields[index + 1];
    const nextPath = fields[index + 2];

    if (!oldPath || !nextPath) {
      throw new Error('Malformed rename/copy entry in git numstat output.');
    }

    entries.push({
      path: nextPath,
      oldPath,
      addedLines: parseNumstatCount(addedToken, isBinary),
      deletedLines: parseNumstatCount(deletedToken, isBinary),
      isBinary,
    });
    index += 2;
  }

  return entries;
}

function parseNumstatCount(value: string, isBinary: boolean): number | null {
  if (isBinary) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Invalid numstat count: ${value}`);
  }

  return parsedValue;
}

function splitNullTerminatedBuffer(buffer: Buffer): string[] {
  return buffer
    .toString('utf8')
    .split('\0')
    .filter((value) => value.length > 0);
}

function mapGitStatus(rawStatus: string): GitHistoryFileStatus {
  const statusCode = rawStatus[0] ?? '';

  switch (statusCode) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    default:
      return 'unknown';
  }
}

function createFileKey(oldPath: string | null, nextPath: string): string {
  return `${oldPath ?? ''}\u0000${nextPath}`;
}

function getGitOutput(
  repositoryPath: string,
  args: string[],
  errorMessage: string,
): string {
  try {
    return execFileSync('git', ['-C', repositoryPath, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (error) {
    throw new Error(formatGitError(errorMessage, error));
  }
}

function getGitBuffer(
  repositoryPath: string,
  args: string[],
  errorMessage: string,
): Buffer {
  try {
    return execFileSync('git', ['-C', repositoryPath, ...args], {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (error) {
    throw new Error(formatGitError(errorMessage, error));
  }
}

function formatGitError(errorMessage: string, error: unknown): string {
  if (isMissingBinaryError(error)) {
    return 'Git is required but was not found on PATH.';
  }

  if (error instanceof Error && 'stderr' in error) {
    const stderr = String(error.stderr ?? '').trim();

    if (stderr) {
      return `${errorMessage} Git said: ${stderr}`;
    }
  }

  if (error instanceof Error && error.message) {
    return `${errorMessage} ${error.message}`;
  }

  return errorMessage;
}

function isMissingBinaryError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  );
}
