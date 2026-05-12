import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { LoadedAnimationDisplayConfig } from '../src/preprocessing/animationFilterConfigTypes.ts';
import { normalizeHistoryTrimMetadata } from '../src/preprocessing/historyTrim.ts';
import type {
  RepoDisplayModel,
  RepoDisplayNode,
  RepoDisplayTimelineUnit,
  RepoDisplayVisibilityFrame,
} from '../src/preprocessing/displayModelTypes.ts';
import {
  createEmptyAnimationFilterConfig,
  parseAnimationFilterConfig,
} from '../src/preprocessing/loadAnimationFilterConfig.ts';
import {
  comparePatternSpecificity,
  matchesPathPattern,
  normalizePathValue,
} from '../src/preprocessing/pathPattern.ts';
import type {
  RepoVisualModel,
  VisualFile,
  VisualFolder,
  VisualTimelineUnit,
} from '../src/preprocessing/visualModelTypes.ts';

const DEFAULT_MODEL_PATH = 'data/generated/repo-visual-model.json';
const DEFAULT_OUTPUT_PATH = 'data/generated/repo-display-model.json';
const DEFAULT_PUBLIC_OUTPUT_PATH = 'public/data/repo-display-model.json';
const DEFAULT_CONFIG_PATH = 'repo-animation.config.json';

interface CliOptions {
  modelPath: string;
  outputPath: string;
  configPath?: string;
}

interface FolderAggregate {
  fileIds: string[];
  folderIds: string[];
  finalLineCount: number;
  maxLineCount: number;
  visualWeight: number;
  totalActivityWeight: number;
}

interface DisplayCandidate {
  key: string;
  label: string;
  path: string;
  type: 'folder' | 'file' | 'collapsedFolder';
  fileIds: string[];
  folderIds: string[];
  finalLineCount: number;
  maxLineCount: number;
  visualWeight: number;
  totalActivityWeight: number;
  directChildCount: number;
  file?: VisualFile;
  folder?: VisualFolder;
}

interface ChildStats {
  directChildCount: number;
  hiddenDirectChildCount: number;
}

interface BuildDisplayModelResult {
  model: RepoDisplayModel;
  budgetDebugExamples: string[];
}

interface SourceFileReplayState {
  exists: boolean;
  currentLineCount: number;
}

interface DisplayNodeRuntimeState {
  currentLineCount: number;
  existingFileCount: number;
  lastTouchedUnitIndex: number;
  lastTouchedUnitOrder: number;
}

interface InternalVisibilitySnapshot {
  unitIndex: number;
  unitOrder: number;
  visibleNodeIds: string[];
  visibleNodeIdSet: Set<string>;
  budgetHiddenNodeIds: string[];
  reducedFolderIds: string[];
  reductionSummaries: string[];
  effectiveChildCountByFolderId: Record<string, number>;
  effectiveVisibleChildCountByFolderId: Record<string, number>;
  effectiveHiddenChildCountByFolderId: Record<string, number>;
  effectiveHiddenDescendantCountByFolderId: Record<string, number>;
  rowCountBeforeBudget: number;
  rowCountAfterBudget: number;
  budgetApplied: boolean;
}

interface SizeTrackingResolution {
  sizeTrackedNodeCount: number;
  normalizationMaxLines: number | null;
  sizeTrackedWarnings: string[];
}

void main();

async function main(): Promise<void> {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    const modelPath = resolveInputFile(options.modelPath, 'Visual model input');
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    const publicOutputPath = path.resolve(process.cwd(), DEFAULT_PUBLIC_OUTPUT_PATH);
    const configPath = resolveEffectiveConfigPath(options.configPath);
    const model = await loadVisualModel(modelPath);
    const displayConfig = configPath
      ? parseAnimationFilterConfig(configPath, await readFile(configPath, 'utf8')).display
      : createEmptyAnimationFilterConfig().display;
    const displayModelResult = buildDisplayModel(
      modelPath,
      configPath,
      model,
      displayConfig,
    );
    const serializedModel = `${JSON.stringify(displayModelResult.model, null, 2)}\n`;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializedModel, 'utf8');
    await mkdir(path.dirname(publicOutputPath), { recursive: true });
    await writeFile(publicOutputPath, serializedModel, 'utf8');

    console.log('Display model generated');
    console.log(
      `History trim: kept ${formatNumber(displayModelResult.model.historyTrim?.keptUnitCount ?? displayModelResult.model.summary.timelineUnitCount)} / ${formatNumber(displayModelResult.model.historyTrim?.sourceUnitCount ?? displayModelResult.model.summary.timelineUnitCount)} units, dropped ${formatPercent(calculateDroppedPercent(displayModelResult.model.historyTrim))}`,
    );
    console.log(`Max visible rows: ${displayModelResult.model.summary.maxVisibleRows ?? 'none'}`);
    console.log(
      `Visible rows before budget: ${displayModelResult.model.summary.visibleRowsBeforeBudget}`,
    );
    console.log(
      `Visible rows after budget: ${displayModelResult.model.summary.visibleRowsAfterBudget}`,
    );
    console.log(
      `Peak rows before budget: ${displayModelResult.model.summary.peakRowsBeforeBudget}`,
    );
    console.log(
      `Peak rows after budget: ${displayModelResult.model.summary.peakRowsAfterBudget}`,
    );
    console.log(
      `Frames with budget applied: ${displayModelResult.model.summary.framesWithBudgetApplied}`,
    );
    console.log(
      `Total dynamic hidden events: ${displayModelResult.model.summary.totalDynamicHiddenEvents}`,
    );
    console.log(
      `Folders reduced by budget: ${displayModelResult.model.summary.foldersReducedByBudget}`,
    );
    console.log(
      `Timeline units remapped because hidden: ${displayModelResult.model.summary.timelineUnitsRemappedBecauseHidden}`,
    );
    console.log(`Visible nodes: ${displayModelResult.model.summary.visibleNodeCount}`);
    console.log(
      `Hidden-but-counted files: ${displayModelResult.model.summary.hiddenButCountedFileCount}`,
    );
    console.log(
      `Collapsed folders: ${displayModelResult.model.summary.collapsedFolderCount}`,
    );
    console.log(
      `Size-tracked nodes: ${displayModelResult.model.summary.sizeTrackedNodeCount ?? 0}`,
    );
    console.log(
      `Size tracking normalization max lines: ${displayModelResult.model.summary.sizeTrackingNormalizationMaxLines ?? 'none'}`,
    );
    console.log(`Timeline units mapped: ${displayModelResult.model.summary.timelineUnitsMapped}`);

    for (const example of displayModelResult.budgetDebugExamples) {
      console.log(example);
    }

    console.log(`Warnings: ${displayModelResult.model.warnings.length}`);
    console.log(`Wrote ${outputPath}`);
    console.log(`Mirrored ${publicOutputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliOptions {
  let modelPath = DEFAULT_MODEL_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;
  let configPath: string | undefined;

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

    if (argument === '--config') {
      configPath = getFlagValue(argv, index, '--config');
      index += 1;
      continue;
    }

    if (argument.startsWith('--config=')) {
      configPath = argument.slice('--config='.length);
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
    'Usage: npm run generate:display-model -- [--model data/generated/repo-visual-model.json] [--config repo-animation.config.json] [--out data/generated/repo-display-model.json]',
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

function resolveEffectiveConfigPath(configPath: string | undefined): string | undefined {
  if (configPath) {
    return resolveInputFile(configPath, 'Display config');
  }

  const defaultConfigPath = path.resolve(process.cwd(), DEFAULT_CONFIG_PATH);
  return existsSync(defaultConfigPath) ? defaultConfigPath : undefined;
}

async function loadVisualModel(modelPath: string): Promise<RepoVisualModel> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(modelPath, 'utf8'));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read or parse visual model JSON: ${error.message}`, {
        cause: error,
      });
    }

    throw new Error('Failed to read or parse visual model JSON.', { cause: error });
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

function buildDisplayModel(
  sourceVisualModelPath: string,
  configPath: string | undefined,
  model: RepoVisualModel,
  displayConfig: LoadedAnimationDisplayConfig,
): BuildDisplayModelResult {
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const historyTrim = normalizeHistoryTrimMetadata(model.historyTrim, model.timeline.length);
  const pushWarning = (message: string) => {
    if (warningSet.has(message)) {
      return;
    }

    warningSet.add(message);
    warnings.push(message);
  };

  for (const warning of model.warnings) {
    pushWarning(`visual-model: ${warning}`);
  }

  const files = [...model.files].sort((left, right) => left.path.localeCompare(right.path));
  const folders = [...model.folders].sort((left, right) => left.path.localeCompare(right.path));
  const fileById = new Map(files.map((file) => [file.id, file]));
  const folderByPath = new Map(folders.map((folder) => [folder.path, folder]));
  const childFoldersByParent = new Map<string, string[]>();
  const childFilesByFolder = new Map<string, string[]>();
  const activityWeightByFileId = buildFileActivityMap(model.timeline);
  const folderAggregateMemo = new Map<string, FolderAggregate>();
  const hiddenButCountedFileIds = new Set<string>();
  const displayNodeIdByFileId = new Map<string, string>();
  const nodes: RepoDisplayNode[] = [];
  const nodeById = new Map<string, RepoDisplayNode>();
  const rootNodeIds: string[] = [];
  const hideButCountPatternMatches = new Map(
    displayConfig.hideButCount.map((pattern) => [pattern, false]),
  );
  const maxChildrenRuleUsages = new Map(
    Object.keys(displayConfig.maxChildrenByFolder).map((pattern) => [pattern, false]),
  );
  const maxChildrenRules = Object.entries(displayConfig.maxChildrenByFolder).sort(
    ([leftPattern], [rightPattern]) => comparePatternSpecificity(leftPattern, rightPattern),
  );
  const revealChildrenMemo = new Map<string, boolean>();

  for (const folder of folders) {
    if (folder.path === '') {
      continue;
    }

    const parentPath = folder.parentPath ?? '';
    const existingChildren = childFoldersByParent.get(parentPath) ?? [];
    existingChildren.push(folder.path);
    childFoldersByParent.set(parentPath, existingChildren);
  }

  for (const file of files) {
    const existingChildren = childFilesByFolder.get(file.folderPath) ?? [];
    existingChildren.push(file.id);
    childFilesByFolder.set(file.folderPath, existingChildren);
  }

  for (const childFolderPaths of childFoldersByParent.values()) {
    childFolderPaths.sort((left, right) => left.localeCompare(right));
  }

  for (const childFileIds of childFilesByFolder.values()) {
    childFileIds.sort((leftId, rightId) => {
      const leftFile = fileById.get(leftId);
      const rightFile = fileById.get(rightId);

      if (!leftFile || !rightFile) {
        return leftId.localeCompare(rightId);
      }

      return leftFile.path.localeCompare(rightFile.path);
    });
  }

  appendFolderContext('', null, 0);

  for (const [pattern, matched] of hideButCountPatternMatches.entries()) {
    if (!matched) {
      pushWarning(`hide-but-count rule matches nothing: ${pattern}`);
    }
  }

  for (const [pattern, matched] of maxChildrenRuleUsages.entries()) {
    if (!matched) {
      pushWarning(`maxChildren rule matches nothing: ${pattern}`);
    }
  }

  const finalNodes = flattenVisibleNodes();
  finalizeVisibleNodeStats();
  const sizeTrackingResolution = applySizeTrackingMetadata(
    finalNodes,
    displayConfig,
    pushWarning,
  );
  const sourceFolderDescendantFileIdsByPath = new Map<string, string[]>();

  for (const folder of folders) {
    sourceFolderDescendantFileIdsByPath.set(folder.path, getFolderAggregate(folder.path).fileIds);
  }

  const baseTimeline = buildDisplayTimeline(
    model.timeline,
    displayNodeIdByFileId,
    nodeById,
    pushWarning,
  );
  const dynamicVisibilityResult = applyDynamicVisibilityPlan({
    nodes: finalNodes,
    timeline: baseTimeline,
    displayNodeIdByFileId,
    allSourceFileIds: files.map((file) => file.id),
    nodeById,
    maxVisibleRows: displayConfig.maxVisibleRows,
    childFoldersByParent,
    childFilesByFolder,
    sourceFolderDescendantFileIdsByPath,
    pushWarning,
  });
  const collapsedFolderCount = finalNodes.filter((node) => node.type === 'collapsedFolder').length;
  const fileNodeCount = finalNodes.filter((node) => node.type === 'file').length;
  const folderNodeCount = finalNodes.filter(
    (node) => node.type === 'folder' || node.type === 'collapsedFolder',
  ).length;

  if (baseTimeline.length !== model.timeline.length) {
    pushWarning(
      `display timeline mapped ${baseTimeline.length} of ${model.timeline.length} source timeline units.`,
    );
  }

  if (
    displayConfig.maxVisibleRows !== null &&
    dynamicVisibilityResult.peakRowsAfterBudget > displayConfig.maxVisibleRows
  ) {
    pushWarning(
      `visibility frame has more rows than maxVisibleRows: peak ${dynamicVisibilityResult.peakRowsAfterBudget} rows exceeds the configured budget of ${displayConfig.maxVisibleRows}.`,
    );
  }

  return {
    budgetDebugExamples: dynamicVisibilityResult.budgetDebugExamples,
    model: {
      generatedAt: new Date().toISOString(),
      historyTrim,
      sourceVisualModelPath,
      config: {
        path: configPath,
        maxDepth: displayConfig.maxDepth,
        maxVisibleRows: displayConfig.maxVisibleRows,
        hideButCount: [...displayConfig.hideButCount],
        maxChildrenByFolder: { ...displayConfig.maxChildrenByFolder },
        sizeTrackedNodes: { ...displayConfig.sizeTrackedNodes },
        sizeTrackingStyle: { ...displayConfig.sizeTrackingStyle },
        sizeNormalization: displayConfig.sizeNormalization,
      },
      nodes: finalNodes,
      timeline: dynamicVisibilityResult.timeline,
      visibilityFrames: dynamicVisibilityResult.visibilityFrames,
      summary: {
        visibleNodeCount: finalNodes.length,
        maxVisibleRows: displayConfig.maxVisibleRows,
        visibleRowsBeforeBudget: dynamicVisibilityResult.visibleRowsBeforeBudget,
        visibleRowsAfterBudget: dynamicVisibilityResult.visibleRowsAfterBudget,
        peakRowsBeforeBudget: dynamicVisibilityResult.peakRowsBeforeBudget,
        peakRowsAfterBudget: dynamicVisibilityResult.peakRowsAfterBudget,
        framesWithBudgetApplied: dynamicVisibilityResult.framesWithBudgetApplied,
        totalDynamicHiddenEvents: dynamicVisibilityResult.totalDynamicHiddenEvents,
        foldersReducedByBudget: dynamicVisibilityResult.foldersReducedByBudget,
        timelineUnitsRemappedBecauseHidden:
          dynamicVisibilityResult.timelineUnitsRemappedBecauseHidden,
        fileNodeCount,
        folderNodeCount,
        collapsedFolderCount,
        hiddenButCountedFileCount: hiddenButCountedFileIds.size,
        autoHiddenFiles: 0,
        autoCollapsedFolders: 0,
        autoMoreGroups: 0,
        timelineUnitCount: dynamicVisibilityResult.timeline.length,
        timelineUnitsMapped: dynamicVisibilityResult.timeline.length,
        sourceFileCount: model.files.length,
        sourceFolderCount: model.folders.length,
        sourceTimelineUnitCount: model.timeline.length,
        sizeTrackedNodeCount: sizeTrackingResolution.sizeTrackedNodeCount,
        sizeTrackingNormalizationMaxLines: sizeTrackingResolution.normalizationMaxLines,
        sizeTrackedWarnings: [...sizeTrackingResolution.sizeTrackedWarnings],
      },
      warnings,
    },
  };

  function appendFolderContext(
    currentFolderPath: string,
    parentNodeId: string | null,
    nextDepth: number,
  ): ChildStats {
    const directChildFolderPaths = childFoldersByParent.get(currentFolderPath) ?? [];
    const directChildFileIds = childFilesByFolder.get(currentFolderPath) ?? [];
    const directChildCount = directChildFolderPaths.length + directChildFileIds.length;
    let hiddenDirectChildCount = 0;
    const candidates: DisplayCandidate[] = [];

    for (const childFolderPath of directChildFolderPaths) {
      const childFolder = folderByPath.get(childFolderPath);

      if (!childFolder) {
        pushWarning(`Display model is missing a folder referenced in the tree: ${childFolderPath}`);
        continue;
      }

      const aggregate = getFolderAggregate(childFolderPath);

      if (nextDepth > displayConfig.maxDepth) {
        if (parentNodeId) {
          assignFilesToNode(aggregate.fileIds, parentNodeId);
          hiddenDirectChildCount += 1;
        } else {
          pushWarning(`node deeper than maxDepth has no visible ancestor: ${childFolderPath}`);
        }
        continue;
      }

      candidates.push({
        key: `${shouldRevealFolderChildren(childFolder.path) ? 'folder' : 'collapsed'}:${childFolder.path}`,
        label: childFolder.name,
        path: childFolder.path,
        type: shouldRevealFolderChildren(childFolder.path) ? 'folder' : 'collapsedFolder',
        fileIds: aggregate.fileIds,
        folderIds: aggregate.folderIds,
        finalLineCount: aggregate.finalLineCount,
        maxLineCount: aggregate.maxLineCount,
        visualWeight: aggregate.visualWeight,
        totalActivityWeight: aggregate.totalActivityWeight,
        directChildCount:
          (childFoldersByParent.get(childFolder.path)?.length ?? 0) +
          (childFilesByFolder.get(childFolder.path)?.length ?? 0),
        folder: childFolder,
      });
    }

    for (const childFileId of directChildFileIds) {
      const childFile = fileById.get(childFileId);

      if (!childFile) {
        pushWarning(`Display model is missing a file referenced in the tree: ${childFileId}`);
        continue;
      }

      const matchedHideButCountPatterns = displayConfig.hideButCount.filter((pattern) =>
        matchesPathPattern(childFile.path, pattern),
      );
      const shouldHideButCount = matchedHideButCountPatterns.length > 0;

      for (const matchedPattern of matchedHideButCountPatterns) {
        hideButCountPatternMatches.set(matchedPattern, true);
      }

      if (shouldHideButCount && parentNodeId) {
        hiddenButCountedFileIds.add(childFile.id);
        assignFilesToNode([childFile.id], parentNodeId);
        hiddenDirectChildCount += 1;
        continue;
      }

      if (shouldHideButCount && !parentNodeId) {
        pushWarning(
          `hide-but-count pattern matched a root-level file with no visible parent, so it stayed visible: ${childFile.path}`,
        );
      }

      if (nextDepth > displayConfig.maxDepth) {
        if (parentNodeId) {
          assignFilesToNode([childFile.id], parentNodeId);
          hiddenDirectChildCount += 1;
        } else {
          pushWarning(`node deeper than maxDepth has no visible ancestor: ${childFile.path}`);
        }
        continue;
      }

      candidates.push({
        key: `file:${childFile.path}`,
        label: childFile.name,
        path: childFile.path,
        type: 'file',
        fileIds: [childFile.id],
        folderIds: [],
        finalLineCount: childFile.finalLineCount,
        maxLineCount: childFile.maxLineCount,
        visualWeight: childFile.visualWeight,
        totalActivityWeight: activityWeightByFileId.get(childFile.id) ?? 0,
        directChildCount: 0,
        file: childFile,
      });
    }

    const selectedCandidates = selectVisibleCandidates(currentFolderPath, candidates);
    const selectedKeys = new Set(selectedCandidates.map((candidate) => candidate.key));
    const hiddenCandidates = candidates.filter((candidate) => !selectedKeys.has(candidate.key));
    hiddenDirectChildCount += hiddenCandidates.length;

    if (parentNodeId) {
      for (const hiddenCandidate of hiddenCandidates) {
        assignFilesToNode(hiddenCandidate.fileIds, parentNodeId);
      }
    } else if (hiddenCandidates.length > 0) {
      for (const hiddenCandidate of hiddenCandidates) {
        pushWarning(
          `Hidden root-level display candidate had no visible parent, so its activity could not be remapped: ${hiddenCandidate.path}`,
        );
      }
    }

    selectedCandidates.sort(compareCandidateDisplayOrder);

    for (const candidate of selectedCandidates) {
      if (candidate.type === 'file' && candidate.file) {
        const node = createNode({
          id: `display:file:${candidate.file.path}`,
          label: candidate.file.name,
          path: candidate.file.path,
          type: 'file',
          depth: nextDepth,
          parentNodeId,
          sourceFileIds: candidate.fileIds,
          sourceFolderIds:
            candidate.file.folderPath !== '' && folderByPath.has(candidate.file.folderPath)
              ? [folderByPath.get(candidate.file.folderPath)?.id ?? '']
              : [],
          finalLineCount: candidate.finalLineCount,
          maxLineCount: candidate.maxLineCount,
          visualWeight: candidate.visualWeight,
          childCount: 0,
          visibleChildCount: 0,
          hiddenChildCount: 0,
          hiddenDescendantCount: 0,
        });

        node.sourceFolderIds = node.sourceFolderIds.filter((folderId) => folderId.length > 0);
        assignFilesToNode([candidate.file.id], node.id);
        continue;
      }

      if (candidate.type === 'collapsedFolder' && candidate.folder) {
        const collapsedNode = createNode({
          id: `display:collapsed:${candidate.folder.path}`,
          label: candidate.folder.name,
          path: candidate.folder.path,
          type: 'collapsedFolder',
          depth: nextDepth,
          parentNodeId,
          sourceFileIds: candidate.fileIds,
          sourceFolderIds: candidate.folderIds,
          finalLineCount: candidate.finalLineCount,
          maxLineCount: candidate.maxLineCount,
          visualWeight: candidate.visualWeight,
          childCount: candidate.directChildCount,
          visibleChildCount: 0,
          hiddenChildCount: candidate.directChildCount,
          hiddenDescendantCount: candidate.fileIds.length,
        });

        assignFilesToNode(candidate.fileIds, collapsedNode.id);
        continue;
      }

      if (candidate.type === 'folder' && candidate.folder) {
        const folderNode = createNode({
          id: `display:folder:${candidate.folder.path}`,
          label: candidate.folder.name,
          path: candidate.folder.path,
          type: 'folder',
          depth: nextDepth,
          parentNodeId,
          sourceFileIds: candidate.fileIds,
          sourceFolderIds: candidate.folderIds,
          finalLineCount: candidate.finalLineCount,
          maxLineCount: candidate.maxLineCount,
          visualWeight: candidate.visualWeight,
          childCount: 0,
          visibleChildCount: 0,
          hiddenChildCount: 0,
          hiddenDescendantCount: 0,
        });

        const childStats = appendFolderContext(candidate.folder.path, folderNode.id, nextDepth + 1);
        folderNode.childCount = childStats.directChildCount;
        folderNode.visibleChildCount = folderNode.childNodeIds.length;
        folderNode.hiddenChildCount = childStats.hiddenDirectChildCount;
      }
    }

    return {
      directChildCount,
      hiddenDirectChildCount,
    };
  }

  function shouldRevealFolderChildren(folderPath: string): boolean {
    const normalizedFolderPath = normalizePathValue(folderPath);
    const existingDecision = revealChildrenMemo.get(normalizedFolderPath);

    if (existingDecision !== undefined) {
      return existingDecision;
    }

    const isExplicitlyOpen = getVisibleChildLimit(normalizedFolderPath) !== null;

    if (isExplicitlyOpen) {
      revealChildrenMemo.set(normalizedFolderPath, true);
      return true;
    }

    for (const childFolderPath of childFoldersByParent.get(normalizedFolderPath) ?? []) {
      if (shouldRevealFolderChildren(childFolderPath)) {
        revealChildrenMemo.set(normalizedFolderPath, true);
        return true;
      }
    }

    revealChildrenMemo.set(normalizedFolderPath, false);
    return false;
  }

  function selectVisibleCandidates(
    currentFolderPath: string,
    candidates: DisplayCandidate[],
  ): DisplayCandidate[] {
    if (currentFolderPath === '') {
      return [...candidates];
    }

    const limit = getVisibleChildLimit(currentFolderPath);

    if (limit !== null) {
      if (candidates.length <= limit) {
        return [...candidates];
      }

      const rankedCandidates = [...candidates].sort(compareCandidatePriority);
      const selectedKeys = new Set(rankedCandidates.slice(0, limit).map((candidate) => candidate.key));

      return candidates.filter((candidate) => selectedKeys.has(candidate.key));
    }

    return candidates.filter(
      (candidate) =>
        candidate.folder !== undefined && shouldRevealFolderChildren(candidate.folder.path),
    );
  }

  function createNode(input: Omit<RepoDisplayNode, 'childNodeIds'>): RepoDisplayNode {
    const node: RepoDisplayNode = {
      ...input,
      sourceFileIds: uniqueSortedStrings(input.sourceFileIds),
      sourceFolderIds: uniqueSortedStrings(input.sourceFolderIds),
      childNodeIds: [],
    };

    nodes.push(node);
    nodeById.set(node.id, node);

    if (node.parentNodeId) {
      const parentNode = nodeById.get(node.parentNodeId);

      if (parentNode) {
        parentNode.childNodeIds.push(node.id);
      }
    } else {
      rootNodeIds.push(node.id);
    }

    return node;
  }

  function assignFilesToNode(fileIds: string[], nodeId: string): void {
    for (const fileId of fileIds) {
      const existingNodeId = displayNodeIdByFileId.get(fileId);

      if (existingNodeId && existingNodeId !== nodeId) {
        pushWarning(
          `Source file ${fileId} was mapped to multiple display nodes (${existingNodeId}, ${nodeId}); keeping the first mapping.`,
        );
        continue;
      }

      displayNodeIdByFileId.set(fileId, nodeId);
    }
  }

  function getFolderAggregate(folderPath: string): FolderAggregate {
    const normalizedFolderPath = normalizePathValue(folderPath);
    const existingAggregate = folderAggregateMemo.get(normalizedFolderPath);

    if (existingAggregate) {
      return existingAggregate;
    }

    const folder = folderByPath.get(normalizedFolderPath);

    if (!folder) {
      const emptyAggregate: FolderAggregate = {
        fileIds: [],
        folderIds: [],
        finalLineCount: 0,
        maxLineCount: 0,
        visualWeight: 0,
        totalActivityWeight: 0,
      };
      folderAggregateMemo.set(normalizedFolderPath, emptyAggregate);
      return emptyAggregate;
    }

    const fileIds: string[] = [];
    const folderIds = [folder.id];
    let finalLineCount = 0;
    let maxLineCount = 0;
    let visualWeight = 0;
    let totalActivityWeight = 0;

    for (const fileId of childFilesByFolder.get(normalizedFolderPath) ?? []) {
      const file = fileById.get(fileId);

      if (!file) {
        continue;
      }

      fileIds.push(file.id);
      finalLineCount += file.finalLineCount;
      maxLineCount += file.maxLineCount;
      visualWeight += file.visualWeight;
      totalActivityWeight += activityWeightByFileId.get(file.id) ?? 0;
    }

    for (const childFolderPath of childFoldersByParent.get(normalizedFolderPath) ?? []) {
      const childAggregate = getFolderAggregate(childFolderPath);
      fileIds.push(...childAggregate.fileIds);
      folderIds.push(...childAggregate.folderIds);
      finalLineCount += childAggregate.finalLineCount;
      maxLineCount += childAggregate.maxLineCount;
      visualWeight += childAggregate.visualWeight;
      totalActivityWeight += childAggregate.totalActivityWeight;
    }

    const aggregate: FolderAggregate = {
      fileIds: uniqueSortedStrings(fileIds),
      folderIds: uniqueSortedStrings(folderIds),
      finalLineCount,
      maxLineCount,
      visualWeight,
      totalActivityWeight,
    };

    folderAggregateMemo.set(normalizedFolderPath, aggregate);
    return aggregate;
  }

  function getVisibleChildLimit(folderPath: string): number | null {
    for (const [pattern, limit] of maxChildrenRules) {
      if (matchesPathPattern(folderPath, pattern)) {
        maxChildrenRuleUsages.set(pattern, true);
        return limit;
      }
    }

    return null;
  }

  function flattenVisibleNodes(): RepoDisplayNode[] {
    const flattened: RepoDisplayNode[] = [];

    for (const rootNodeId of rootNodeIds) {
      appendVisibleNode(rootNodeId, flattened);
    }

    return flattened;
  }

  function appendVisibleNode(nodeId: string, destination: RepoDisplayNode[]): void {
    const node = nodeById.get(nodeId);

    if (!node) {
      return;
    }

    destination.push(node);

    for (const childNodeId of node.childNodeIds) {
      appendVisibleNode(childNodeId, destination);
    }
  }

  function finalizeVisibleNodeStats(): void {
    for (const rootNodeId of rootNodeIds) {
      countVisibleFileNodes(rootNodeId);
    }
  }

  function countVisibleFileNodes(nodeId: string): number {
    const node = nodeById.get(nodeId);

    if (!node) {
      return 0;
    }

    if (node.type === 'file') {
      node.visibleChildCount = 0;
      node.hiddenDescendantCount = 0;
      return 1;
    }

    let visibleFileCount = 0;

    for (const childNodeId of node.childNodeIds) {
      visibleFileCount += countVisibleFileNodes(childNodeId);
    }

    node.visibleChildCount = node.childNodeIds.length;
    node.hiddenChildCount = Math.max(0, node.childCount - node.visibleChildCount);
    node.hiddenDescendantCount = Math.max(0, node.sourceFileIds.length - visibleFileCount);

    return visibleFileCount;
  }
}

function buildFileActivityMap(timeline: VisualTimelineUnit[]): Map<string, number> {
  const activityWeightByFileId = new Map<string, number>();

  for (const unit of timeline) {
    activityWeightByFileId.set(
      unit.fileId,
      (activityWeightByFileId.get(unit.fileId) ?? 0) + unit.activityWeight,
    );
  }

  return activityWeightByFileId;
}

function applySizeTrackingMetadata(
  nodes: RepoDisplayNode[],
  displayConfig: LoadedAnimationDisplayConfig,
  pushWarning: (message: string) => void,
): SizeTrackingResolution {
  const nodeByPath = new Map(
    nodes.map((node) => [normalizePathValue(node.path), node] as const),
  );
  const sizeTrackedWarnings: string[] = [];
  const matchedNodes: Array<{
    node: RepoDisplayNode;
    maxVisualPercent: number;
  }> = [];

  for (const [configuredPath, trackedConfig] of Object.entries(displayConfig.sizeTrackedNodes)) {
    const normalizedPath = normalizePathValue(configuredPath);
    const matchedNode = nodeByPath.get(normalizedPath);

    if (!matchedNode) {
      const warning = `size-tracked path matches no display node: ${configuredPath}`;
      sizeTrackedWarnings.push(warning);
      pushWarning(`size-tracking: ${warning}`);
      continue;
    }

    matchedNodes.push({
      node: matchedNode,
      maxVisualPercent: trackedConfig.maxVisualPercent,
    });
  }

  const normalizationMaxLines =
    displayConfig.sizeNormalization === 'trackedMax' && matchedNodes.length > 0
      ? Math.max(...matchedNodes.map(({ node }) => node.maxLineCount))
      : null;

  if (matchedNodes.length > 0 && normalizationMaxLines === null) {
    const warning = 'size tracking requested but no normalization max could be resolved.';
    sizeTrackedWarnings.push(warning);
    pushWarning(`size-tracking: ${warning}`);
  }

  for (const { node, maxVisualPercent } of matchedNodes) {
    node.sizeTracking = {
      enabled: true,
      maxVisualPercent,
      normalizationMaxLines: normalizationMaxLines ?? 0,
    };
  }

  return {
    sizeTrackedNodeCount: matchedNodes.length,
    normalizationMaxLines,
    sizeTrackedWarnings,
  };
}

function buildDisplayTimeline(
  timeline: VisualTimelineUnit[],
  displayNodeIdByFileId: Map<string, string>,
  nodeById: Map<string, RepoDisplayNode>,
  pushWarning: (message: string) => void,
): RepoDisplayTimelineUnit[] {
  return [...timeline]
    .sort((left, right) => left.unitOrder - right.unitOrder)
    .flatMap((unit) => {
      const displayNodeId = displayNodeIdByFileId.get(unit.fileId);

      if (!displayNodeId) {
        pushWarning(
          `timeline unit could not be mapped to a display node: unit ${unit.unitOrder} file ${unit.filePath}`,
        );
        return [];
      }

      const displayNode = nodeById.get(displayNodeId);

      if (!displayNode) {
        pushWarning(
          `timeline unit ${unit.unitOrder} resolved to a missing display node: ${displayNodeId}`,
        );
        return [];
      }

      return [
        {
          unitOrder: unit.unitOrder,
          sourceFileId: unit.fileId,
          sourceFilePath: unit.filePath,
          displayNodeId,
          displayNodePath: displayNode.path,
          effectiveDisplayNodeId: displayNodeId,
          effectiveDisplayNodePath: displayNode.path,
          remappedBecauseHidden: false,
          type: unit.type,
          lineDelta: unit.lineDelta,
          unitLineAmount: unit.unitLineAmount,
          activityWeight: unit.activityWeight,
          beforeLineCount: unit.beforeLineCount,
          afterLineCount: unit.afterLineCount,
        },
      ];
    });
}

function applyDynamicVisibilityPlan({
  nodes,
  timeline,
  displayNodeIdByFileId,
  allSourceFileIds,
  nodeById,
  maxVisibleRows,
  childFoldersByParent,
  childFilesByFolder,
  sourceFolderDescendantFileIdsByPath,
  pushWarning,
}: {
  nodes: RepoDisplayNode[];
  timeline: RepoDisplayTimelineUnit[];
  displayNodeIdByFileId: Map<string, string>;
  allSourceFileIds: string[];
  nodeById: Map<string, RepoDisplayNode>;
  maxVisibleRows: number | null;
  childFoldersByParent: Map<string, string[]>;
  childFilesByFolder: Map<string, string[]>;
  sourceFolderDescendantFileIdsByPath: Map<string, string[]>;
  pushWarning: (message: string) => void;
}): {
  timeline: RepoDisplayTimelineUnit[];
  visibilityFrames: RepoDisplayVisibilityFrame[];
  visibleRowsBeforeBudget: number;
  visibleRowsAfterBudget: number;
  peakRowsBeforeBudget: number;
  peakRowsAfterBudget: number;
  framesWithBudgetApplied: number;
  totalDynamicHiddenEvents: number;
  foldersReducedByBudget: number;
  timelineUnitsRemappedBecauseHidden: number;
  budgetDebugExamples: string[];
} {
  if (timeline.length === 0) {
    const staticRowCount = nodes.length;

    return {
      timeline,
      visibilityFrames: [],
      visibleRowsBeforeBudget: staticRowCount,
      visibleRowsAfterBudget: staticRowCount,
      peakRowsBeforeBudget: staticRowCount,
      peakRowsAfterBudget: staticRowCount,
      framesWithBudgetApplied: 0,
      totalDynamicHiddenEvents: 0,
      foldersReducedByBudget: 0,
      timelineUnitsRemappedBecauseHidden: 0,
      budgetDebugExamples: [],
    };
  }

  const sourceFileStateById = new Map<string, SourceFileReplayState>(
    allSourceFileIds.map((fileId) => [fileId, { exists: false, currentLineCount: 0 }]),
  );
  const nodeRuntimeById = new Map<string, DisplayNodeRuntimeState>(
    nodes.map((node) => [
      node.id,
      {
        currentLineCount: 0,
        existingFileCount: 0,
        lastTouchedUnitIndex: -1,
        lastTouchedUnitOrder: -1,
      },
    ]),
  );
  const ancestorNodeIdsByFileId = buildAncestorNodeIdsByFileId(displayNodeIdByFileId, nodeById);
  const budgetDebugExamples: string[] = [];
  const frameSnapshots: InternalVisibilitySnapshot[] = [];
  const reducedFolderIds = new Set<string>();
  let peakRowsBeforeBudget = 0;
  let peakRowsAfterBudget = 0;
  let totalDynamicHiddenEvents = 0;
  let timelineUnitsRemappedBecauseHidden = 0;

  for (const [unitIndex, unit] of timeline.entries()) {
    applyTimelineUnitToReplayState(
      unit,
      unitIndex,
      sourceFileStateById,
      nodeRuntimeById,
      ancestorNodeIdsByFileId,
    );

    const snapshot = createVisibilitySnapshot({
      unitIndex,
      unitOrder: unit.unitOrder,
      nodes,
      nodeById,
      nodeRuntimeById,
      maxVisibleRows,
      childFoldersByParent,
      childFilesByFolder,
      sourceFolderDescendantFileIdsByPath,
      sourceFileStateById,
      pushWarning,
    });

    frameSnapshots.push(snapshot);
    peakRowsBeforeBudget = Math.max(peakRowsBeforeBudget, snapshot.rowCountBeforeBudget);
    peakRowsAfterBudget = Math.max(peakRowsAfterBudget, snapshot.rowCountAfterBudget);
    totalDynamicHiddenEvents += snapshot.budgetHiddenNodeIds.length;

    for (const folderId of snapshot.reducedFolderIds) {
      reducedFolderIds.add(folderId);
    }

    if (snapshot.budgetApplied && budgetDebugExamples.length < 6) {
      budgetDebugExamples.push(
        `Budget applied at unit ${unit.unitOrder}: ${snapshot.rowCountBeforeBudget} -> ${snapshot.rowCountAfterBudget} rows`,
      );

      for (const reductionSummary of snapshot.reductionSummaries) {
        if (budgetDebugExamples.length >= 10) {
          break;
        }

        budgetDebugExamples.push(reductionSummary);
      }
    }

    const effectiveNode = resolveEffectiveVisibleNode(
      unit.displayNodeId,
      snapshot.visibleNodeIdSet,
      nodeById,
    );

    if (!effectiveNode) {
      pushWarning(
        `timeline unit could not be mapped to visible parent: unit ${unit.unitOrder} node ${unit.displayNodeId}`,
      );
      continue;
    }

    const remappedBecauseHidden = effectiveNode.id !== unit.displayNodeId;

    if (remappedBecauseHidden) {
      timelineUnitsRemappedBecauseHidden += 1;
    }

    timeline[unitIndex] = {
      ...unit,
      effectiveDisplayNodeId: effectiveNode.id,
      effectiveDisplayNodePath: effectiveNode.path,
      remappedBecauseHidden,
    };
  }

  const visibilityFrames = compactVisibilitySnapshots(frameSnapshots);

  for (const frame of visibilityFrames) {
    if (maxVisibleRows !== null && frame.rowCountAfterBudget > maxVisibleRows) {
      pushWarning(
        `visibility frame has more rows than maxVisibleRows: units ${frame.startUnitOrder}-${frame.endUnitOrder} contain ${frame.rowCountAfterBudget} rows against budget ${maxVisibleRows}.`,
      );
    }

    for (const nodeId of frame.visibleNodeIds) {
      if (!nodeById.has(nodeId)) {
        pushWarning(`visibility frame references unknown node id: ${nodeId}`);
      }
    }
  }

  return {
    timeline,
    visibilityFrames,
    visibleRowsBeforeBudget: frameSnapshots.at(-1)?.rowCountBeforeBudget ?? 0,
    visibleRowsAfterBudget: frameSnapshots.at(-1)?.rowCountAfterBudget ?? 0,
    peakRowsBeforeBudget,
    peakRowsAfterBudget,
    framesWithBudgetApplied: visibilityFrames.filter((frame) => frame.budgetApplied).length,
    totalDynamicHiddenEvents,
    foldersReducedByBudget: reducedFolderIds.size,
    timelineUnitsRemappedBecauseHidden,
    budgetDebugExamples,
  };
}

function buildAncestorNodeIdsByFileId(
  displayNodeIdByFileId: Map<string, string>,
  nodeById: Map<string, RepoDisplayNode>,
): Map<string, string[]> {
  const ancestorNodeIdsByFileId = new Map<string, string[]>();

  for (const [fileId, nodeId] of displayNodeIdByFileId.entries()) {
    const ancestorNodeIds: string[] = [];
    let currentNodeId: string | null = nodeId;

    while (currentNodeId) {
      ancestorNodeIds.push(currentNodeId);
      const currentNode = nodeById.get(currentNodeId);
      currentNodeId = currentNode?.parentNodeId ?? null;
    }

    ancestorNodeIdsByFileId.set(fileId, ancestorNodeIds);
  }

  return ancestorNodeIdsByFileId;
}

function applyTimelineUnitToReplayState(
  unit: RepoDisplayTimelineUnit,
  unitIndex: number,
  sourceFileStateById: Map<string, SourceFileReplayState>,
  nodeRuntimeById: Map<string, DisplayNodeRuntimeState>,
  ancestorNodeIdsByFileId: Map<string, string[]>,
): void {
  const currentFileState = sourceFileStateById.get(unit.sourceFileId) ?? {
    exists: false,
    currentLineCount: 0,
  };
  const nextFileState = applyTimelineUnitToSourceFileState(currentFileState, unit);
  const lineDelta = nextFileState.currentLineCount - currentFileState.currentLineCount;
  const existingFileDelta =
    (nextFileState.exists ? 1 : 0) - (currentFileState.exists ? 1 : 0);

  sourceFileStateById.set(unit.sourceFileId, nextFileState);

  for (const nodeId of ancestorNodeIdsByFileId.get(unit.sourceFileId) ?? []) {
    const currentNodeState = nodeRuntimeById.get(nodeId);

    if (!currentNodeState) {
      continue;
    }

    currentNodeState.currentLineCount = Math.max(
      0,
      currentNodeState.currentLineCount + lineDelta,
    );
    currentNodeState.existingFileCount = Math.max(
      0,
      currentNodeState.existingFileCount + existingFileDelta,
    );
    currentNodeState.lastTouchedUnitIndex = unitIndex;
    currentNodeState.lastTouchedUnitOrder = unit.unitOrder;
  }
}

function applyTimelineUnitToSourceFileState(
  fileState: SourceFileReplayState,
  unit: RepoDisplayTimelineUnit,
): SourceFileReplayState {
  if (unit.type === 'delete') {
    return {
      ...fileState,
      exists: false,
      currentLineCount: 0,
    };
  }

  const nextLineCount =
    unit.afterLineCount !== null
      ? Math.max(0, unit.afterLineCount)
      : unit.beforeLineCount !== null
        ? Math.max(0, unit.beforeLineCount + unit.lineDelta)
        : unit.type === 'create' || unit.type === 'copy'
          ? Math.max(0, unit.lineDelta)
          : Math.max(0, fileState.currentLineCount + unit.lineDelta);

  return {
    ...fileState,
    exists: true,
    currentLineCount: nextLineCount,
  };
}

function createVisibilitySnapshot({
  unitIndex,
  unitOrder,
  nodes,
  nodeById,
  nodeRuntimeById,
  maxVisibleRows,
  childFoldersByParent,
  childFilesByFolder,
  sourceFolderDescendantFileIdsByPath,
  sourceFileStateById,
  pushWarning,
}: {
  unitIndex: number;
  unitOrder: number;
  nodes: RepoDisplayNode[];
  nodeById: Map<string, RepoDisplayNode>;
  nodeRuntimeById: Map<string, DisplayNodeRuntimeState>;
  maxVisibleRows: number | null;
  childFoldersByParent: Map<string, string[]>;
  childFilesByFolder: Map<string, string[]>;
  sourceFolderDescendantFileIdsByPath: Map<string, string[]>;
  sourceFileStateById: Map<string, SourceFileReplayState>;
  pushWarning: (message: string) => void;
}): InternalVisibilitySnapshot {
  const baseVisibleNodeIds = nodes
    .filter((node) => (nodeRuntimeById.get(node.id)?.existingFileCount ?? 0) > 0)
    .map((node) => node.id);
  const rowCountBeforeBudget = baseVisibleNodeIds.length;
  const effectiveVisibleNodeIdSet = new Set(baseVisibleNodeIds);
  const budgetHiddenNodeIds: string[] = [];
  const reducedFolderIds = new Set<string>();
  const reductionSummaries: string[] = [];

  if (maxVisibleRows !== null && rowCountBeforeBudget > maxVisibleRows) {
    while (effectiveVisibleNodeIdSet.size > maxVisibleRows) {
      const visibleImmediateChildrenByFolderId = buildVisibleImmediateChildrenByFolderId(
        nodes,
        nodeById,
        effectiveVisibleNodeIdSet,
      );
      const folderIdToReduce = selectFolderIdToReduce(
        visibleImmediateChildrenByFolderId,
        nodeById,
      );

      if (!folderIdToReduce) {
        pushWarning(
          `budget could not be reached at unit ${unitOrder}: ${effectiveVisibleNodeIdSet.size} rows remain visible against budget ${maxVisibleRows}.`,
        );
        break;
      }

      const folderNode = nodeById.get(folderIdToReduce);
      const visibleChildNodeIds = visibleImmediateChildrenByFolderId.get(folderIdToReduce) ?? [];
      const childNodeIdToHide = selectChildNodeIdToHide(
        visibleChildNodeIds,
        nodeById,
        nodeRuntimeById,
      );

      if (!folderNode || !childNodeIdToHide) {
        pushWarning(
          `budget could not be reached at unit ${unitOrder}: folder ${folderIdToReduce} had no hideable child rows.`,
        );
        break;
      }

      const beforeVisibleChildCount = visibleChildNodeIds.length;
      const subtreeNodeIdsToHide = collectVisibleSubtreeNodeIds(
        childNodeIdToHide,
        nodeById,
        effectiveVisibleNodeIdSet,
      );

      if (subtreeNodeIdsToHide.length === 0) {
        pushWarning(
          `budget could not be reached at unit ${unitOrder}: child ${childNodeIdToHide} produced no visible subtree to hide.`,
        );
        break;
      }

      for (const subtreeNodeId of subtreeNodeIdsToHide) {
        effectiveVisibleNodeIdSet.delete(subtreeNodeId);
        budgetHiddenNodeIds.push(subtreeNodeId);
      }

      const afterVisibleChildCount =
        buildVisibleImmediateChildrenByFolderId(nodes, nodeById, effectiveVisibleNodeIdSet).get(
          folderIdToReduce,
        )?.length ?? 0;
      reducedFolderIds.add(folderIdToReduce);

      if (reductionSummaries.length < 4) {
        reductionSummaries.push(
          `Reduced ${folderNode.path} from ${beforeVisibleChildCount} to ${afterVisibleChildCount} visible children`,
        );
      }
    }
  }

  const visibleNodeIds = baseVisibleNodeIds.filter((nodeId) => effectiveVisibleNodeIdSet.has(nodeId));
  const {
    effectiveChildCountByFolderId,
    effectiveVisibleChildCountByFolderId,
    effectiveHiddenChildCountByFolderId,
    effectiveHiddenDescendantCountByFolderId,
  } = buildEffectiveFolderCountMaps({
    visibleNodeIds,
    visibleNodeIdSet: effectiveVisibleNodeIdSet,
    nodeById,
    nodeRuntimeById,
    childFoldersByParent,
    childFilesByFolder,
    sourceFolderDescendantFileIdsByPath,
    sourceFileStateById,
  });

  return {
    unitIndex,
    unitOrder,
    visibleNodeIds,
    visibleNodeIdSet: effectiveVisibleNodeIdSet,
    budgetHiddenNodeIds,
    reducedFolderIds: [...reducedFolderIds].sort((left, right) => left.localeCompare(right)),
    reductionSummaries,
    effectiveChildCountByFolderId,
    effectiveVisibleChildCountByFolderId,
    effectiveHiddenChildCountByFolderId,
    effectiveHiddenDescendantCountByFolderId,
    rowCountBeforeBudget,
    rowCountAfterBudget: visibleNodeIds.length,
    budgetApplied: visibleNodeIds.length < rowCountBeforeBudget,
  };
}

function buildVisibleImmediateChildrenByFolderId(
  nodes: RepoDisplayNode[],
  nodeById: Map<string, RepoDisplayNode>,
  visibleNodeIdSet: Set<string>,
): Map<string, string[]> {
  const visibleImmediateChildrenByFolderId = new Map<string, string[]>();

  for (const node of nodes) {
    if (!visibleNodeIdSet.has(node.id)) {
      continue;
    }

    if (!node.parentNodeId || !visibleNodeIdSet.has(node.parentNodeId)) {
      continue;
    }

    const parentNode = nodeById.get(node.parentNodeId);

    if (!parentNode || parentNode.type !== 'folder') {
      continue;
    }

    const existingChildren = visibleImmediateChildrenByFolderId.get(parentNode.id) ?? [];
    existingChildren.push(node.id);
    visibleImmediateChildrenByFolderId.set(parentNode.id, existingChildren);
  }

  return visibleImmediateChildrenByFolderId;
}

function selectFolderIdToReduce(
  visibleImmediateChildrenByFolderId: Map<string, string[]>,
  nodeById: Map<string, RepoDisplayNode>,
): string | null {
  const candidates = [...visibleImmediateChildrenByFolderId.entries()]
    .filter(([, childNodeIds]) => childNodeIds.length > 0)
    .map(([folderId, childNodeIds]) => ({
      folderId,
      childCount: childNodeIds.length,
      folderNode: nodeById.get(folderId),
    }))
    .filter(
      (candidate): candidate is { folderId: string; childCount: number; folderNode: RepoDisplayNode } =>
        candidate.folderNode !== undefined,
    )
    .sort((left, right) => {
      return (
        compareNumbersDescending(left.childCount, right.childCount) ||
        stableStringHash(left.folderNode.path) - stableStringHash(right.folderNode.path) ||
        left.folderNode.path.localeCompare(right.folderNode.path)
      );
    });

  return candidates[0]?.folderId ?? null;
}

function selectChildNodeIdToHide(
  visibleChildNodeIds: string[],
  nodeById: Map<string, RepoDisplayNode>,
  nodeRuntimeById: Map<string, DisplayNodeRuntimeState>,
): string | null {
  const candidates = [...visibleChildNodeIds]
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is RepoDisplayNode => node !== undefined)
    .sort((left, right) => compareChildHidePriority(left, right, nodeRuntimeById));

  return candidates[0]?.id ?? null;
}

function compareChildHidePriority(
  left: RepoDisplayNode,
  right: RepoDisplayNode,
  nodeRuntimeById: Map<string, DisplayNodeRuntimeState>,
): number {
  const leftIsFile = left.type === 'file';
  const rightIsFile = right.type === 'file';

  if (leftIsFile !== rightIsFile) {
    return leftIsFile ? -1 : 1;
  }

  const leftRuntime = nodeRuntimeById.get(left.id);
  const rightRuntime = nodeRuntimeById.get(right.id);
  const leftCurrentLineCount = leftRuntime?.currentLineCount ?? 0;
  const rightCurrentLineCount = rightRuntime?.currentLineCount ?? 0;
  const leftLineScale = Math.max(leftCurrentLineCount, left.finalLineCount, left.maxLineCount);
  const rightLineScale = Math.max(rightCurrentLineCount, right.finalLineCount, right.maxLineCount);
  const leftLastTouched = leftRuntime?.lastTouchedUnitIndex ?? -1;
  const rightLastTouched = rightRuntime?.lastTouchedUnitIndex ?? -1;

  return (
    left.visualWeight - right.visualWeight ||
    leftCurrentLineCount - rightCurrentLineCount ||
    leftLineScale - rightLineScale ||
    leftLastTouched - rightLastTouched ||
    stableStringHash(left.path) - stableStringHash(right.path) ||
    left.path.localeCompare(right.path)
  );
}

function collectVisibleSubtreeNodeIds(
  rootNodeId: string,
  nodeById: Map<string, RepoDisplayNode>,
  visibleNodeIdSet: Set<string>,
): string[] {
  const collected: string[] = [];
  const stack = [rootNodeId];

  while (stack.length > 0) {
    const currentNodeId = stack.shift();

    if (!currentNodeId || !visibleNodeIdSet.has(currentNodeId)) {
      continue;
    }

    collected.push(currentNodeId);
    const currentNode = nodeById.get(currentNodeId);

    if (!currentNode) {
      continue;
    }

    stack.unshift(...currentNode.childNodeIds);
  }

  return collected;
}

function buildEffectiveFolderCountMaps({
  visibleNodeIds,
  visibleNodeIdSet,
  nodeById,
  nodeRuntimeById,
  childFoldersByParent,
  childFilesByFolder,
  sourceFolderDescendantFileIdsByPath,
  sourceFileStateById,
}: {
  visibleNodeIds: string[];
  visibleNodeIdSet: Set<string>;
  nodeById: Map<string, RepoDisplayNode>;
  nodeRuntimeById: Map<string, DisplayNodeRuntimeState>;
  childFoldersByParent: Map<string, string[]>;
  childFilesByFolder: Map<string, string[]>;
  sourceFolderDescendantFileIdsByPath: Map<string, string[]>;
  sourceFileStateById: Map<string, SourceFileReplayState>;
}): {
  effectiveChildCountByFolderId: Record<string, number>;
  effectiveVisibleChildCountByFolderId: Record<string, number>;
  effectiveHiddenChildCountByFolderId: Record<string, number>;
  effectiveHiddenDescendantCountByFolderId: Record<string, number>;
} {
  const visibleImmediateChildrenByFolderId = buildVisibleImmediateChildrenByFolderId(
    visibleNodeIds.map((nodeId) => nodeById.get(nodeId)).filter((node): node is RepoDisplayNode => node !== undefined),
    nodeById,
    visibleNodeIdSet,
  );
  const visibleLeafFileCountByNodeId = buildVisibleLeafFileCountByNodeId(
    visibleNodeIds,
    nodeById,
    visibleImmediateChildrenByFolderId,
  );
  const sourceFolderExistsMemo = new Map<string, boolean>();
  const effectiveChildCountByFolderId: Record<string, number> = {};
  const effectiveVisibleChildCountByFolderId: Record<string, number> = {};
  const effectiveHiddenChildCountByFolderId: Record<string, number> = {};
  const effectiveHiddenDescendantCountByFolderId: Record<string, number> = {};

  for (const nodeId of visibleNodeIds) {
    const node = nodeById.get(nodeId);

    if (!node || node.type === 'file') {
      continue;
    }

    const effectiveVisibleChildCount =
      visibleImmediateChildrenByFolderId.get(node.id)?.length ?? 0;
    const effectiveChildCount = Math.max(
      effectiveVisibleChildCount,
      countCurrentDirectChildren(node.path),
    );
    const visibleLeafFileCount = visibleLeafFileCountByNodeId.get(node.id) ?? 0;
    const existingFileCount = nodeRuntimeById.get(node.id)?.existingFileCount ?? 0;
    const effectiveHiddenDescendantCount = Math.max(0, existingFileCount - visibleLeafFileCount);

    effectiveChildCountByFolderId[node.id] = effectiveChildCount;
    effectiveVisibleChildCountByFolderId[node.id] = effectiveVisibleChildCount;
    effectiveHiddenChildCountByFolderId[node.id] = Math.max(
      0,
      effectiveChildCount - effectiveVisibleChildCount,
    );
    effectiveHiddenDescendantCountByFolderId[node.id] = effectiveHiddenDescendantCount;
  }

  return {
    effectiveChildCountByFolderId,
    effectiveVisibleChildCountByFolderId,
    effectiveHiddenChildCountByFolderId,
    effectiveHiddenDescendantCountByFolderId,
  };

  function countCurrentDirectChildren(folderPath: string): number {
    let directChildCount = 0;

    for (const fileId of childFilesByFolder.get(folderPath) ?? []) {
      if (sourceFileStateById.get(fileId)?.exists) {
        directChildCount += 1;
      }
    }

    for (const childFolderPath of childFoldersByParent.get(folderPath) ?? []) {
      if (sourceFolderExistsMemo.has(childFolderPath)) {
        if (sourceFolderExistsMemo.get(childFolderPath)) {
          directChildCount += 1;
        }

        continue;
      }

      const exists = (sourceFolderDescendantFileIdsByPath.get(childFolderPath) ?? []).some(
        (fileId) => sourceFileStateById.get(fileId)?.exists,
      );
      sourceFolderExistsMemo.set(childFolderPath, exists);

      if (exists) {
        directChildCount += 1;
      }
    }

    return directChildCount;
  }
}

function buildVisibleLeafFileCountByNodeId(
  visibleNodeIds: string[],
  nodeById: Map<string, RepoDisplayNode>,
  visibleImmediateChildrenByFolderId: Map<string, string[]>,
): Map<string, number> {
  const visibleLeafFileCountByNodeId = new Map<string, number>();

  for (const nodeId of [...visibleNodeIds].reverse()) {
    const node = nodeById.get(nodeId);

    if (!node) {
      continue;
    }

    if (node.type === 'file') {
      visibleLeafFileCountByNodeId.set(node.id, 1);
      continue;
    }

    const visibleLeafFileCount = (visibleImmediateChildrenByFolderId.get(node.id) ?? []).reduce(
      (sum, childNodeId) => sum + (visibleLeafFileCountByNodeId.get(childNodeId) ?? 0),
      0,
    );

    visibleLeafFileCountByNodeId.set(node.id, visibleLeafFileCount);
  }

  return visibleLeafFileCountByNodeId;
}

function resolveEffectiveVisibleNode(
  displayNodeId: string,
  visibleNodeIdSet: Set<string>,
  nodeById: Map<string, RepoDisplayNode>,
): RepoDisplayNode | null {
  let currentNodeId: string | null = displayNodeId;

  while (currentNodeId) {
    if (visibleNodeIdSet.has(currentNodeId)) {
      return nodeById.get(currentNodeId) ?? null;
    }

    const currentNode = nodeById.get(currentNodeId);
    currentNodeId = currentNode?.parentNodeId ?? null;
  }

  return null;
}

function compactVisibilitySnapshots(
  snapshots: InternalVisibilitySnapshot[],
): RepoDisplayVisibilityFrame[] {
  if (snapshots.length === 0) {
    return [];
  }

  const frames: RepoDisplayVisibilityFrame[] = [];
  let currentStartSnapshot = snapshots[0];
  let currentEndSnapshot = snapshots[0];
  let currentKey = buildVisibilitySnapshotKey(snapshots[0]);

  for (let index = 1; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const snapshotKey = buildVisibilitySnapshotKey(snapshot);

    if (snapshotKey === currentKey) {
      currentEndSnapshot = snapshot;
      continue;
    }

    frames.push(createVisibilityFrame(currentStartSnapshot, currentEndSnapshot));
    currentStartSnapshot = snapshot;
    currentEndSnapshot = snapshot;
    currentKey = snapshotKey;
  }

  frames.push(createVisibilityFrame(currentStartSnapshot, currentEndSnapshot));

  return frames;
}

function createVisibilityFrame(
  startSnapshot: InternalVisibilitySnapshot,
  endSnapshot: InternalVisibilitySnapshot,
): RepoDisplayVisibilityFrame {
  return {
    startUnitIndex: startSnapshot.unitIndex,
    endUnitIndex: endSnapshot.unitIndex,
    startUnitOrder: startSnapshot.unitOrder,
    endUnitOrder: endSnapshot.unitOrder,
    visibleNodeIds: [...startSnapshot.visibleNodeIds],
    budgetHiddenNodeIds: [...startSnapshot.budgetHiddenNodeIds],
    effectiveChildCountByFolderId: { ...startSnapshot.effectiveChildCountByFolderId },
    effectiveVisibleChildCountByFolderId: {
      ...startSnapshot.effectiveVisibleChildCountByFolderId,
    },
    effectiveHiddenChildCountByFolderId: {
      ...startSnapshot.effectiveHiddenChildCountByFolderId,
    },
    effectiveHiddenDescendantCountByFolderId: {
      ...startSnapshot.effectiveHiddenDescendantCountByFolderId,
    },
    rowCountBeforeBudget: startSnapshot.rowCountBeforeBudget,
    rowCountAfterBudget: startSnapshot.rowCountAfterBudget,
    budgetApplied: startSnapshot.budgetApplied,
  };
}

function buildVisibilitySnapshotKey(snapshot: InternalVisibilitySnapshot): string {
  return [
    snapshot.visibleNodeIds.join(','),
    snapshot.budgetHiddenNodeIds.join(','),
    serializeNumericRecord(snapshot.effectiveChildCountByFolderId),
    serializeNumericRecord(snapshot.effectiveVisibleChildCountByFolderId),
    serializeNumericRecord(snapshot.effectiveHiddenChildCountByFolderId),
    serializeNumericRecord(snapshot.effectiveHiddenDescendantCountByFolderId),
    String(snapshot.rowCountBeforeBudget),
    String(snapshot.rowCountAfterBudget),
    snapshot.budgetApplied ? '1' : '0',
  ].join('||');
}

function serializeNumericRecord(record: Record<string, number>): string {
  return Object.entries(record)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function compareCandidatePriority(left: DisplayCandidate, right: DisplayCandidate): number {
  const leftIsFolderLike = left.type === 'folder' || left.type === 'collapsedFolder';
  const rightIsFolderLike = right.type === 'folder' || right.type === 'collapsedFolder';

  if (leftIsFolderLike !== rightIsFolderLike) {
    return leftIsFolderLike ? -1 : 1;
  }

  const leftLineScale = Math.max(left.finalLineCount, left.maxLineCount);
  const rightLineScale = Math.max(right.finalLineCount, right.maxLineCount);

  return (
    compareNumbersDescending(leftLineScale, rightLineScale) ||
    compareNumbersDescending(left.totalActivityWeight, right.totalActivityWeight) ||
    compareNumbersDescending(left.visualWeight, right.visualWeight) ||
    left.path.localeCompare(right.path)
  );
}

function compareCandidateDisplayOrder(left: DisplayCandidate, right: DisplayCandidate): number {
  const leftIsFolderLike = left.type === 'folder' || left.type === 'collapsedFolder';
  const rightIsFolderLike = right.type === 'folder' || right.type === 'collapsedFolder';

  if (leftIsFolderLike !== rightIsFolderLike) {
    return leftIsFolderLike ? -1 : 1;
  }

  return left.path.localeCompare(right.path);
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareNumbersDescending(left: number, right: number): number {
  return right - left;
}

function stableStringHash(value: string): number {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function calculateDroppedPercent(
  historyTrim: RepoDisplayModel['historyTrim'],
): number {
  if (!historyTrim || historyTrim.sourceUnitCount === 0) {
    return 0;
  }

  return (historyTrim.droppedUnitCount / historyTrim.sourceUnitCount) * 100;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
