import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { LoadedAnimationDisplayConfig } from '../src/preprocessing/animationFilterConfigTypes.ts';
import type {
  RepoDisplayModel,
  RepoDisplayNode,
  RepoDisplayTimelineUnit,
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
    const displayModel = buildDisplayModel(
      modelPath,
      configPath,
      model,
      displayConfig,
    );
    const serializedModel = `${JSON.stringify(displayModel, null, 2)}\n`;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializedModel, 'utf8');
    await mkdir(path.dirname(publicOutputPath), { recursive: true });
    await writeFile(publicOutputPath, serializedModel, 'utf8');

    console.log('Display model generated');
    console.log(`Max visible rows: ${displayModel.summary.maxVisibleRows ?? 'none'}`);
    console.log(`Visible rows before budget: ${displayModel.summary.visibleRowsBeforeBudget}`);
    console.log(`Visible rows after budget: ${displayModel.summary.visibleRowsAfterBudget}`);
    console.log(`Visible nodes: ${displayModel.summary.visibleNodeCount}`);
    console.log(`Hidden-but-counted files: ${displayModel.summary.hiddenButCountedFileCount}`);
    console.log(`Collapsed folders: ${displayModel.summary.collapsedFolderCount}`);
    console.log(`Auto-hidden files: ${displayModel.summary.autoHiddenFiles}`);
    console.log(`Auto-collapsed folders: ${displayModel.summary.autoCollapsedFolders}`);
    console.log(`Auto more groups: ${displayModel.summary.autoMoreGroups}`);
    console.log(`Timeline units mapped: ${displayModel.summary.timelineUnitsMapped}`);
    console.log(`Warnings: ${displayModel.warnings.length}`);
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

function buildDisplayModel(
  sourceVisualModelPath: string,
  configPath: string | undefined,
  model: RepoVisualModel,
  displayConfig: LoadedAnimationDisplayConfig,
): RepoDisplayModel {
  const warnings = model.warnings.map((warning) => `visual-model: ${warning}`);
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
    ([leftPattern], [rightPattern]) =>
      comparePatternSpecificity(leftPattern, rightPattern),
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
      warnings.push(`hide-but-count rule matches nothing: ${pattern}`);
    }
  }

  for (const [pattern, matched] of maxChildrenRuleUsages.entries()) {
    if (!matched) {
      warnings.push(`maxChildren rule matches nothing: ${pattern}`);
    }
  }

  const finalNodes = flattenVisibleNodes();
  finalizeVisibleNodeStats();
  const timeline = buildDisplayTimeline(model.timeline, displayNodeIdByFileId, nodeById, warnings);
  const collapsedFolderCount = finalNodes.filter((node) => node.type === 'collapsedFolder').length;
  const fileNodeCount = finalNodes.filter((node) => node.type === 'file').length;
  const folderNodeCount = finalNodes.filter(
    (node) => node.type === 'folder' || node.type === 'collapsedFolder',
  ).length;
  const visibleRowsBeforeBudget = finalNodes.length;
  const visibleRowsAfterBudget = finalNodes.length;

  if (timeline.length !== model.timeline.length) {
    warnings.push(
      `display timeline mapped ${timeline.length} of ${model.timeline.length} source timeline units.`,
    );
  }

  if (
    displayConfig.maxVisibleRows !== null &&
    visibleRowsAfterBudget > displayConfig.maxVisibleRows
  ) {
    warnings.push(
      `maxVisibleRows is currently advisory only: ${visibleRowsAfterBudget} visible rows exceed the configured budget of ${displayConfig.maxVisibleRows}.`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceVisualModelPath,
    config: {
      path: configPath,
      maxDepth: displayConfig.maxDepth,
      maxVisibleRows: displayConfig.maxVisibleRows,
      hideButCount: [...displayConfig.hideButCount],
      maxChildrenByFolder: { ...displayConfig.maxChildrenByFolder },
    },
    nodes: finalNodes,
    timeline,
    summary: {
      visibleNodeCount: finalNodes.length,
      maxVisibleRows: displayConfig.maxVisibleRows,
      visibleRowsBeforeBudget,
      visibleRowsAfterBudget,
      fileNodeCount,
      folderNodeCount,
      collapsedFolderCount,
      hiddenButCountedFileCount: hiddenButCountedFileIds.size,
      autoHiddenFiles: 0,
      autoCollapsedFolders: 0,
      autoMoreGroups: 0,
      timelineUnitCount: timeline.length,
      timelineUnitsMapped: timeline.length,
      sourceFileCount: model.files.length,
      sourceFolderCount: model.folders.length,
      sourceTimelineUnitCount: model.timeline.length,
    },
    warnings,
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
        warnings.push(`Display model is missing a folder referenced in the tree: ${childFolderPath}`);
        continue;
      }

      const aggregate = getFolderAggregate(childFolderPath);

      if (nextDepth > displayConfig.maxDepth) {
        if (parentNodeId) {
          assignFilesToNode(aggregate.fileIds, parentNodeId);
          hiddenDirectChildCount += 1;
        } else {
          warnings.push(`node deeper than maxDepth has no visible ancestor: ${childFolderPath}`);
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
        warnings.push(`Display model is missing a file referenced in the tree: ${childFileId}`);
        continue;
      }

      const shouldHideButCount = displayConfig.hideButCount.some((pattern) =>
        matchesPathPattern(childFile.path, pattern),
      );

      if (shouldHideButCount) {
        for (const pattern of displayConfig.hideButCount) {
          if (matchesPathPattern(childFile.path, pattern)) {
            hideButCountPatternMatches.set(pattern, true);
          }
        }
      }

      if (shouldHideButCount && parentNodeId) {
        hiddenButCountedFileIds.add(childFile.id);
        assignFilesToNode([childFile.id], parentNodeId);
        hiddenDirectChildCount += 1;
        continue;
      }

      if (shouldHideButCount && !parentNodeId) {
        warnings.push(
          `hide-but-count pattern matched a root-level file with no visible parent, so it stayed visible: ${childFile.path}`,
        );
      }

      if (nextDepth > displayConfig.maxDepth) {
        if (parentNodeId) {
          assignFilesToNode([childFile.id], parentNodeId);
          hiddenDirectChildCount += 1;
        } else {
          warnings.push(`node deeper than maxDepth has no visible ancestor: ${childFile.path}`);
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
        warnings.push(
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

      if (
        candidate.type === 'collapsedFolder' &&
        candidate.folder
      ) {
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

        const childStats = appendFolderContext(
          candidate.folder.path,
          folderNode.id,
          nextDepth + 1,
        );
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
      const selectedKeys = new Set(
        rankedCandidates.slice(0, limit).map((candidate) => candidate.key),
      );

      return candidates.filter((candidate) => selectedKeys.has(candidate.key));
    }

    return candidates.filter(
      (candidate) =>
        candidate.folder !== undefined &&
        shouldRevealFolderChildren(candidate.folder.path),
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
        warnings.push(
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

function buildFileActivityMap(
  timeline: VisualTimelineUnit[],
): Map<string, number> {
  const activityWeightByFileId = new Map<string, number>();

  for (const unit of timeline) {
    activityWeightByFileId.set(
      unit.fileId,
      (activityWeightByFileId.get(unit.fileId) ?? 0) + unit.activityWeight,
    );
  }

  return activityWeightByFileId;
}

function buildDisplayTimeline(
  timeline: VisualTimelineUnit[],
  displayNodeIdByFileId: Map<string, string>,
  nodeById: Map<string, RepoDisplayNode>,
  warnings: string[],
): RepoDisplayTimelineUnit[] {
  return [...timeline]
    .sort((left, right) => left.unitOrder - right.unitOrder)
    .flatMap((unit) => {
      const displayNodeId = displayNodeIdByFileId.get(unit.fileId);

      if (!displayNodeId) {
        warnings.push(
          `timeline unit could not be mapped to a display node: unit ${unit.unitOrder} file ${unit.filePath}`,
        );
        return [];
      }

      const displayNode = nodeById.get(displayNodeId);

      if (!displayNode) {
        warnings.push(
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
          type: unit.type,
          lineDelta: unit.lineDelta,
          activityWeight: unit.activityWeight,
          beforeLineCount: unit.beforeLineCount,
          afterLineCount: unit.afterLineCount,
        },
      ];
    });
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
