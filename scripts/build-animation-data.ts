import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_OUT_DIR = 'data/generated';
const DEFAULT_LINE_QUANTUM = 10;
const DEFAULT_CONFIG_PATH = 'repo-animation.config.json';

interface CliOptions {
  repoPath: string;
  outDir: string;
  lineQuantum: number;
  includeLockfiles: boolean;
  configPath?: string;
}

void main();

function main(): void {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const outDir = path.resolve(process.cwd(), options.outDir);
    const rawHistoryPath = path.join(outDir, 'raw-git-history.json');
    const fileStatesPath = path.join(outDir, 'repo-file-states.json');
    const changeUnitsPath = path.join(outDir, 'repo-change-units.json');
    const animationDatasetPath = path.join(outDir, 'repo-animation-dataset.json');
    const animationSummaryPath = path.join(outDir, 'repo-animation-summary.json');
    const visualModelPath = path.join(outDir, 'repo-visual-model.json');
    const configPath = resolveEffectiveConfigPath(options.configPath);

    runNpmScript('extract:git', [
      '--repo',
      options.repoPath,
      '--out',
      rawHistoryPath,
    ]);

    runNpmScript('reconstruct:states', [
      '--in',
      rawHistoryPath,
      '--out',
      fileStatesPath,
    ]);

    runNpmScript('generate:units', [
      '--history',
      rawHistoryPath,
      '--states',
      fileStatesPath,
      '--out',
      changeUnitsPath,
      '--line-quantum',
      String(options.lineQuantum),
    ]);

    const filterArgs = [
      '--history',
      rawHistoryPath,
      '--states',
      fileStatesPath,
      '--units',
      changeUnitsPath,
      '--out',
      animationDatasetPath,
    ];

    if (options.includeLockfiles) {
      filterArgs.push('--include-lockfiles');
    }

    if (configPath) {
      filterArgs.push('--config', configPath);
    }

    runNpmScript('filter:animation-data', filterArgs);

    runNpmScript('summarize:animation-data', [
      '--dataset',
      animationDatasetPath,
      '--out',
      animationSummaryPath,
    ]);

    runNpmScript('generate:visual-model', [
      '--dataset',
      animationDatasetPath,
      '--out',
      visualModelPath,
    ]);

    console.log('Animation data pipeline complete.');
    console.log(`Repository: ${options.repoPath}`);
    console.log(`Output directory: ${outDir}`);
    if (configPath) {
      console.log(`Filter config: ${configPath}`);
    }
    console.log(`Dataset: ${animationDatasetPath}`);
    console.log(`Summary: ${animationSummaryPath}`);
    console.log(`Visual model: ${visualModelPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let repoPath: string | undefined;
  let outDir = DEFAULT_OUT_DIR;
  let lineQuantum = DEFAULT_LINE_QUANTUM;
  let includeLockfiles = false;
  let configPath: string | undefined;

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

    if (argument === '--out-dir') {
      outDir = getFlagValue(argv, index, '--out-dir');
      index += 1;
      continue;
    }

    if (argument.startsWith('--out-dir=')) {
      outDir = argument.slice('--out-dir='.length);
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

  if (!repoPath) {
    throw new Error(
      'Missing required --repo argument.\nUsage: npm run build:animation-data -- --repo <path> [--out-dir data/generated] [--line-quantum 10] [--include-lockfiles]',
    );
  }

  return {
    repoPath,
    outDir,
    lineQuantum,
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

function parseLineQuantum(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--line-quantum must be a positive integer. Received: ${value}`);
  }

  return parsed;
}

function printUsageAndExit(): never {
  console.log(
    'Usage: npm run build:animation-data -- --repo <path> [--out-dir data/generated] [--line-quantum 10] [--include-lockfiles] [--config repo-animation.config.json]',
  );
  process.exit(0);
}

function resolveEffectiveConfigPath(configPath: string | undefined): string | undefined {
  if (configPath) {
    return path.resolve(process.cwd(), configPath);
  }

  const defaultConfigPath = path.resolve(process.cwd(), DEFAULT_CONFIG_PATH);
  return existsSync(defaultConfigPath) ? defaultConfigPath : undefined;
}

function runNpmScript(scriptName: string, scriptArgs: string[]): void {
  if (process.platform === 'win32') {
    execFileSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm', 'run', scriptName, '--', ...scriptArgs],
      {
        cwd: process.cwd(),
        stdio: 'inherit',
      },
    );
    return;
  }

  execFileSync('npm', ['run', scriptName, '--', ...scriptArgs], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}
