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

interface CompressionStats {
  maxVisibleRows: number | null;
  visibleRowsBeforeBudget: number;
  visibleRowsAfterBudget: number;
  autoHiddenFiles: number;
  autoCollapsedFolders: number;
  autoMoreGroups: number;
}

interface FileHideCandidate {
  nodeId: string;
  path: string;
  depth: number;
  parentNodeId: string | null;
  activityWeight: number;
  lineScale: number;
}

interface FolderCollapseCandidate {
  nodeId: string;
  path: string;
  depth: number;
  rowsSaved: number;
  activityWeight: number;
  visualWeight: number;
  isImportantTopLevelFolder: boolean;
}

const IMPORTANT_TOP_LEVEL_FOLDERS = new Set([
  'ingestion_pipeline',
  'assistant_runtime',
  'tools',
  'tests',
  'src',
]);

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
    console.log(`More groups: ${displayModel.summary.moreGroupCount}`);
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
  const collapsedPatternMatches = new Map(
    displayConfig.collapseFolders.map((pattern) => [pattern, false]),
  );
  const maxChildrenRuleUsages = new Map(
    Object.keys(displayConfig.maxChildrenByFolder).map((pattern) => [pattern, false]),
  );
  const collapsedFolderPaths = resolveCollapsedFolderPaths();
  const maxChildrenRules = Object.entries(displayConfig.maxChildrenByFolder).sort(
    ([leftPattern], [rightPattern]) =>
      comparePatternSpecificity(leftPattern, rightPattern),
  );

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

  for (const [pattern, matched] of collapsedPatternMatches.entries()) {
    if (!matched) {
      warnings.push(`collapse rule matches nothing: ${pattern}`);
    }
  }

  for (const [pattern, matched] of maxChildrenRuleUsages.entries()) {
    if (!matched) {
      warnings.push(`maxChildren rule matches nothing: ${pattern}`);
    }
  }

  const compressionStats = applyRowBudgetCompression(displayConfig.maxVisibleRows);
  const finalNodes = flattenVisibleNodes();
  const timeline = buildDisplayTimeline(model.timeline, displayNodeIdByFileId, nodeById, warnings);
  const collapsedFolderCount = finalNodes.filter((node) => node.type === 'collapsedFolder').length;
  const moreGroupCount = finalNodes.filter((node) => node.type === 'moreGroup').length;
  const fileNodeCount = finalNodes.filter((node) => node.type === 'file').length;
  const folderNodeCount = finalNodes.filter(
    (node) => node.type === 'folder' || node.type === 'collapsedFolder',
  ).length;

  if (timeline.length !== model.timeline.length) {
    warnings.push(
      `display timeline mapped ${timeline.length} of ${model.timeline.length} source timeline units.`,
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
      collapseFolders: [...displayConfig.collapseFolders],
      maxChildrenByFolder: { ...displayConfig.maxChildrenByFolder },
    },
    nodes: finalNodes,
    timeline,
    summary: {
      visibleNodeCount: finalNodes.length,
      maxVisibleRows: compressionStats.maxVisibleRows,
      visibleRowsBeforeBudget: compressionStats.visibleRowsBeforeBudget,
      visibleRowsAfterBudget: compressionStats.visibleRowsAfterBudget,
      fileNodeCount,
      folderNodeCount,
      collapsedFolderCount,
      moreGroupCount,
      hiddenButCountedFileCount: hiddenButCountedFileIds.size,
      autoHiddenFiles: compressionStats.autoHiddenFiles,
      autoCollapsedFolders: compressionStats.autoCollapsedFolders,
      autoMoreGroups: compressionStats.autoMoreGroups,
      timelineUnitCount: timeline.length,
      timelineUnitsMapped: timeline.length,
      sourceFileCount: model.files.length,
      sourceFolderCount: model.folders.length,
      sourceTimelineUnitCount: model.timeline.length,
    },
    warnings,
  };

  function resolveCollapsedFolderPaths(): Set<string> {
    const candidateFolders = folders
      .filter((folder) => folder.path !== '')
      .filter((folder) => {
        let matchesAnyPattern = false;

        for (const pattern of displayConfig.collapseFolders) {
          if (matchesPathPattern(folder.path, pattern)) {
            collapsedPatternMatches.set(pattern, true);
            matchesAnyPattern = true;
          }
        }

        return matchesAnyPattern;
      })
      .sort((left, right) => {
        const leftDepth = left.path.split('/').length;
        const rightDepth = right.path.split('/').length;
        return leftDepth - rightDepth || left.path.localeCompare(right.path);
      });

    const collapsedPaths = new Set<string>();

    for (const folder of candidateFolders) {
      if (!hasCollapsedAncestor(folder.path, collapsedPaths)) {
        collapsedPaths.add(folder.path);
      }
    }

    return collapsedPaths;
  }

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

      if (collapsedFolderPaths.has(childFolderPath)) {
        candidates.push({
          key: `collapsed:${childFolder.path}`,
          label: childFolder.name,
          path: childFolder.path,
          type: 'collapsedFolder',
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
        continue;
      }

      candidates.push({
        key: `folder:${childFolder.path}`,
        label: childFolder.name,
        path: childFolder.path,
        type: 'folder',
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

    const limit = getVisibleChildLimit(currentFolderPath);
    let selectedCandidates = [...candidates];
    let overflowCandidates: DisplayCandidate[] = [];

    if (limit !== null && candidates.length > limit) {
      const rankedCandidates = [...candidates].sort(compareCandidatePriority);
      const selectedKeys = new Set(
        rankedCandidates
          .slice(0, limit)
          .map((candidate) => candidate.key),
      );

      selectedCandidates = candidates.filter((candidate) => selectedKeys.has(candidate.key));
      overflowCandidates = candidates.filter((candidate) => !selectedKeys.has(candidate.key));
      hiddenDirectChildCount += overflowCandidates.length;
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
          hiddenChildCount: 0,
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
          hiddenChildCount: candidate.directChildCount,
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
          hiddenChildCount: 0,
        });

        const childStats = appendFolderContext(
          candidate.folder.path,
          folderNode.id,
          nextDepth + 1,
        );
        folderNode.childCount = childStats.directChildCount;
        folderNode.hiddenChildCount = childStats.hiddenDirectChildCount;
      }
    }

    if (overflowCandidates.length > 0) {
      const overflowNode = createNode({
        id: `display:more:${currentFolderPath === '' ? '(root)' : currentFolderPath}`,
        label: `+ ${overflowCandidates.length} more`,
        path:
          currentFolderPath === ''
            ? '__more__'
            : `${normalizePathValue(currentFolderPath)}/__more__`,
        type: 'moreGroup',
        depth: nextDepth,
        parentNodeId,
        sourceFileIds: uniqueSortedStrings(
          overflowCandidates.flatMap((candidate) => candidate.fileIds),
        ),
        sourceFolderIds: uniqueSortedStrings(
          overflowCandidates.flatMap((candidate) => candidate.folderIds),
        ),
        finalLineCount: overflowCandidates.reduce(
          (sum, candidate) => sum + candidate.finalLineCount,
          0,
        ),
        maxLineCount: overflowCandidates.reduce(
          (sum, candidate) => sum + candidate.maxLineCount,
          0,
        ),
        visualWeight: overflowCandidates.reduce(
          (sum, candidate) => sum + candidate.visualWeight,
          0,
        ),
        childCount: overflowCandidates.length,
        hiddenChildCount: overflowCandidates.length,
      });

      assignFilesToNode(overflowNode.sourceFileIds, overflowNode.id);
    }

    return {
      directChildCount,
      hiddenDirectChildCount,
    };
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

  function remapFilesToNode(fileIds: string[], nodeId: string): void {
    for (const fileId of fileIds) {
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

  function applyRowBudgetCompression(maxVisibleRows: number | null): CompressionStats {
    const stats: CompressionStats = {
      maxVisibleRows,
      visibleRowsBeforeBudget: getVisibleRowCount(),
      visibleRowsAfterBudget: getVisibleRowCount(),
      autoHiddenFiles: 0,
      autoCollapsedFolders: 0,
      autoMoreGroups: 0,
    };

    if (maxVisibleRows === null || stats.visibleRowsBeforeBudget <= maxVisibleRows) {
      return stats;
    }

    const boringHideCandidates = collectBoringFileHideCandidates();
    const boringCandidateCountByParent = countCandidatesByParent(boringHideCandidates);

    for (const candidate of boringHideCandidates) {
      if (getVisibleRowCount() <= maxVisibleRows) {
        break;
      }

      const parentKey = getParentKey(candidate.parentNodeId);
      const remainingCandidatesForParent = boringCandidateCountByParent.get(parentKey) ?? 0;
      const shouldUseMoreGroup =
        candidate.parentNodeId === null ||
        parentHasMoreGroup(candidate.parentNodeId) ||
        remainingCandidatesForParent >= 2;

      if (hideFileNode(candidate.nodeId, shouldUseMoreGroup, stats)) {
        stats.autoHiddenFiles += 1;
      }

      if (remainingCandidatesForParent > 0) {
        boringCandidateCountByParent.set(parentKey, remainingCandidatesForParent - 1);
      }
    }

    while (getVisibleRowCount() > maxVisibleRows) {
      const collapseCandidates = collectFolderCollapseCandidates();

      if (collapseCandidates.length === 0) {
        break;
      }

      const overflow = getVisibleRowCount() - maxVisibleRows;
      const nextCandidate = selectNextCollapseCandidate(collapseCandidates, overflow);

      if (!nextCandidate) {
        break;
      }

      if (!collapseFolderNode(nextCandidate.nodeId)) {
        break;
      }

      stats.autoCollapsedFolders += 1;
    }

    stats.visibleRowsAfterBudget = getVisibleRowCount();

    if (maxVisibleRows !== null && stats.visibleRowsAfterBudget > maxVisibleRows) {
      warnings.push(
        `row budget could not be reached: ${stats.visibleRowsAfterBudget} visible rows remain for a budget of ${maxVisibleRows}.`,
      );
    }

    return stats;
  }

  function collectBoringFileHideCandidates(): FileHideCandidate[] {
    const candidates: FileHideCandidate[] = [];

    for (const node of flattenVisibleNodes()) {
      if (!isBoringLeafFileNode(node)) {
        continue;
      }

      candidates.push({
        nodeId: node.id,
        path: node.path,
        depth: node.depth,
        parentNodeId: node.parentNodeId,
        activityWeight: getNodeActivityWeight(node),
        lineScale: Math.max(node.finalLineCount, node.maxLineCount),
      });
    }

    return candidates.sort((left, right) => (
      compareNumbersDescending(left.depth, right.depth) ||
      compareNumbersAscending(getBoringNamePriority(left.path), getBoringNamePriority(right.path)) ||
      compareNumbersAscending(left.lineScale, right.lineScale) ||
      compareNumbersAscending(left.activityWeight, right.activityWeight) ||
      left.path.localeCompare(right.path)
    ));
  }

  function countCandidatesByParent(candidates: FileHideCandidate[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const candidate of candidates) {
      const parentKey = getParentKey(candidate.parentNodeId);
      counts.set(parentKey, (counts.get(parentKey) ?? 0) + 1);
    }

    return counts;
  }

  function hideFileNode(
    nodeId: string,
    useMoreGroup: boolean,
    stats: CompressionStats,
  ): boolean {
    const fileNode = nodeById.get(nodeId);

    if (!fileNode || fileNode.type !== 'file') {
      return false;
    }

    const parentNode = fileNode.parentNodeId
      ? nodeById.get(fileNode.parentNodeId) ?? null
      : null;

    if (fileNode.parentNodeId && !parentNode) {
      warnings.push(`auto-hidden file has no visible parent: ${fileNode.path}`);
      return false;
    }

    let targetNode: RepoDisplayNode | null = null;

    if (useMoreGroup) {
      targetNode = getOrCreateBudgetMoreGroup(fileNode.parentNodeId, stats);
    } else if (parentNode) {
      targetNode = parentNode;
    } else {
      targetNode = getOrCreateBudgetMoreGroup(null, stats);
    }

    if (!targetNode) {
      warnings.push(`auto-hidden file could not be mapped to a visible target: ${fileNode.path}`);
      return false;
    }

    if (parentNode) {
      parentNode.hiddenChildCount += 1;
    }

    if (targetNode.type === 'moreGroup') {
      absorbNodeIntoMoreGroup(targetNode, fileNode);
    }

    remapFilesToNode(fileNode.sourceFileIds, targetNode.id);
    detachNode(nodeId);
    return true;
  }

  function getOrCreateBudgetMoreGroup(
    parentNodeId: string | null,
    stats: CompressionStats,
  ): RepoDisplayNode {
    const existingMoreGroup = getExistingMoreGroup(parentNodeId);

    if (existingMoreGroup) {
      return existingMoreGroup;
    }

    const parentNode = parentNodeId ? nodeById.get(parentNodeId) ?? null : null;
    const folderPath = parentNode ? normalizePathValue(parentNode.path) : '';
    const syntheticPath =
      folderPath.length === 0
        ? '__budget_more__'
        : `${folderPath}/__budget_more__`;
    const syntheticId =
      parentNodeId === null
        ? 'display:budget-more:(root)'
        : `display:budget-more:${parentNode?.path ?? parentNodeId}`;
    const moreGroup = createNode({
      id: syntheticId,
      label: '+ 0 more',
      path: syntheticPath,
      type: 'moreGroup',
      depth: parentNode ? parentNode.depth + 1 : 0,
      parentNodeId,
      sourceFileIds: [],
      sourceFolderIds: [],
      finalLineCount: 0,
      maxLineCount: 0,
      visualWeight: 0,
      childCount: 0,
      hiddenChildCount: 0,
    });

    stats.autoMoreGroups += 1;
    return moreGroup;
  }

  function getExistingMoreGroup(parentNodeId: string | null): RepoDisplayNode | null {
    const siblingIds = parentNodeId
      ? nodeById.get(parentNodeId)?.childNodeIds ?? []
      : rootNodeIds;

    for (const siblingId of siblingIds) {
      const siblingNode = nodeById.get(siblingId);

      if (siblingNode?.type === 'moreGroup') {
        return siblingNode;
      }
    }

    return null;
  }

  function parentHasMoreGroup(parentNodeId: string | null): boolean {
    return getExistingMoreGroup(parentNodeId) !== null;
  }

  function absorbNodeIntoMoreGroup(targetNode: RepoDisplayNode, sourceNode: RepoDisplayNode): void {
    targetNode.sourceFileIds = uniqueSortedStrings([
      ...targetNode.sourceFileIds,
      ...sourceNode.sourceFileIds,
    ]);
    targetNode.sourceFolderIds = uniqueSortedStrings([
      ...targetNode.sourceFolderIds,
      ...sourceNode.sourceFolderIds,
    ]);
    targetNode.finalLineCount += sourceNode.finalLineCount;
    targetNode.maxLineCount += sourceNode.maxLineCount;
    targetNode.visualWeight += sourceNode.visualWeight;
    targetNode.childCount += 1;
    targetNode.hiddenChildCount += 1;
    targetNode.label = `+ ${targetNode.childCount} more`;
  }

  function collectFolderCollapseCandidates(): FolderCollapseCandidate[] {
    const candidates: FolderCollapseCandidate[] = [];

    for (const node of flattenVisibleNodes()) {
      if (node.type !== 'folder') {
        continue;
      }

      if (node.parentNodeId && !nodeById.has(node.parentNodeId)) {
        warnings.push(`auto-collapse candidate has no visible parent: ${node.path}`);
        continue;
      }

      const rowsSaved = countVisibleDescendants(node.id);

      if (rowsSaved <= 0) {
        continue;
      }

      candidates.push({
        nodeId: node.id,
        path: node.path,
        depth: node.depth,
        rowsSaved,
        activityWeight: getNodeActivityWeight(node),
        visualWeight: node.visualWeight,
        isImportantTopLevelFolder:
          node.depth === 0 && IMPORTANT_TOP_LEVEL_FOLDERS.has(node.path),
      });
    }

    return candidates.sort((left, right) => (
      compareBooleans(left.isImportantTopLevelFolder, right.isImportantTopLevelFolder) ||
      compareNumbersDescending(left.depth, right.depth) ||
      left.path.localeCompare(right.path)
    ));
  }

  function selectNextCollapseCandidate(
    candidates: FolderCollapseCandidate[],
    overflow: number,
  ): FolderCollapseCandidate | null {
    if (candidates.length === 0) {
      return null;
    }

    return [...candidates].sort((left, right) => {
      const baseOrder =
        compareBooleans(left.isImportantTopLevelFolder, right.isImportantTopLevelFolder) ||
        compareNumbersDescending(left.depth, right.depth);

      if (baseOrder !== 0) {
        return baseOrder;
      }

      const leftCoversOverflow = left.rowsSaved >= overflow;
      const rightCoversOverflow = right.rowsSaved >= overflow;

      if (leftCoversOverflow !== rightCoversOverflow) {
        return leftCoversOverflow ? -1 : 1;
      }

      if (leftCoversOverflow && rightCoversOverflow) {
        return (
          compareNumbersAscending(left.rowsSaved, right.rowsSaved) ||
          compareNumbersAscending(left.activityWeight, right.activityWeight) ||
          compareNumbersAscending(left.visualWeight, right.visualWeight) ||
          left.path.localeCompare(right.path)
        );
      }

      return (
        compareNumbersDescending(left.rowsSaved, right.rowsSaved) ||
        compareNumbersAscending(left.activityWeight, right.activityWeight) ||
        compareNumbersAscending(left.visualWeight, right.visualWeight) ||
        left.path.localeCompare(right.path)
      );
    })[0];
  }

  function collapseFolderNode(nodeId: string): boolean {
    const folderNode = nodeById.get(nodeId);

    if (!folderNode || folderNode.type !== 'folder') {
      return false;
    }

    const visibleChildNodeIds = [...folderNode.childNodeIds];

    if (visibleChildNodeIds.length === 0) {
      warnings.push(`auto-collapse candidate has no visible descendants: ${folderNode.path}`);
      return false;
    }

    for (const childNodeId of visibleChildNodeIds) {
      deleteSubtree(childNodeId);
    }

    folderNode.type = 'collapsedFolder';
    folderNode.hiddenChildCount = folderNode.childCount;
    folderNode.childNodeIds = [];
    remapFilesToNode(folderNode.sourceFileIds, folderNode.id);
    return true;
  }

  function deleteSubtree(nodeId: string): void {
    const node = nodeById.get(nodeId);

    if (!node) {
      return;
    }

    for (const childNodeId of [...node.childNodeIds]) {
      deleteSubtree(childNodeId);
    }

    detachNode(nodeId);
  }

  function detachNode(nodeId: string): void {
    const node = nodeById.get(nodeId);

    if (!node) {
      return;
    }

    if (node.parentNodeId) {
      const parentNode = nodeById.get(node.parentNodeId);

      if (parentNode) {
        parentNode.childNodeIds = parentNode.childNodeIds.filter(
          (childNodeId) => childNodeId !== nodeId,
        );
      }
    } else {
      removeFromArray(rootNodeIds, nodeId);
    }

    nodeById.delete(nodeId);
  }

  function countVisibleDescendants(nodeId: string): number {
    const node = nodeById.get(nodeId);

    if (!node) {
      return 0;
    }

    let count = 0;

    for (const childNodeId of node.childNodeIds) {
      count += 1;
      count += countVisibleDescendants(childNodeId);
    }

    return count;
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

  function getVisibleRowCount(): number {
    return nodeById.size;
  }

  function getNodeActivityWeight(node: RepoDisplayNode): number {
    return node.sourceFileIds.reduce(
      (sum, fileId) => sum + (activityWeightByFileId.get(fileId) ?? 0),
      0,
    );
  }

  function isBoringLeafFileNode(node: RepoDisplayNode): boolean {
    if (node.type !== 'file') {
      return false;
    }

    const normalizedName = node.label.toLowerCase();

    if (
      normalizedName === '__init__.py' ||
      normalizedName === 'index.ts' ||
      normalizedName === 'index.tsx' ||
      normalizedName === 'index.js' ||
      normalizedName === 'index.jsx'
    ) {
      return true;
    }

    return (
      node.depth >= 2 &&
      Math.max(node.finalLineCount, node.maxLineCount) <= 12 &&
      node.visualWeight <= 0.2 &&
      getNodeActivityWeight(node) <= 2
    );
  }

  function getBoringNamePriority(nodePath: string): number {
    const name = path.posix.basename(normalizePathValue(nodePath)).toLowerCase();

    if (name === '__init__.py') {
      return 0;
    }

    if (
      name === 'index.ts' ||
      name === 'index.tsx' ||
      name === 'index.js' ||
      name === 'index.jsx'
    ) {
      return 1;
    }

    return 2;
  }

  function getParentKey(parentNodeId: string | null): string {
    return parentNodeId ?? '__root__';
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

function hasCollapsedAncestor(folderPath: string, collapsedFolderPaths: Set<string>): boolean {
  const segments = normalizePathValue(folderPath).split('/');

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const ancestorPath = segments.slice(0, index).join('/');

    if (collapsedFolderPaths.has(ancestorPath)) {
      return true;
    }
  }

  return false;
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareNumbersAscending(left: number, right: number): number {
  return left - right;
}

function compareNumbersDescending(left: number, right: number): number {
  return right - left;
}

function compareBooleans(left: boolean, right: boolean): number {
  return Number(left) - Number(right);
}

function removeFromArray(values: string[], value: string): void {
  const index = values.indexOf(value);

  if (index >= 0) {
    values.splice(index, 1);
  }
}
