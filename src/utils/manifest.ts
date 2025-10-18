import { context } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils';
import { isMajorBump } from './version';

type ReleasePleaseManifest = Record<string, string>;

interface ManifestAnalysis {
  hasMajorBump: boolean;
  majorBumps: Record<string, [string, string]>;
}

/**
 * Analyze changes between two manifest versions
 * @param oldManifest - Previous manifest state
 * @param newManifest - New manifest state
 * @returns Object containing `hasMajorBump` (boolean) and `majorBumps` (record mapping package paths to [oldVersion, newVersion] tuples for packages with major version changes only)
 */
export function analyzeManifestChanges(
  oldManifest: ReleasePleaseManifest | null,
  newManifest: ReleasePleaseManifest | null
): ManifestAnalysis {
  const majorBumps: Record<string, [string, string]> = {};

  if (!oldManifest || !newManifest) {
    return {
      hasMajorBump: false,
      majorBumps: {}
    };
  }

  for (const [path, newVersion] of Object.entries(newManifest)) {
    const oldVersion = oldManifest?.[path];

    if (
      oldVersion &&
      oldVersion !== newVersion &&
      isMajorBump(oldVersion, newVersion)
    ) {
      majorBumps[path] = [oldVersion, newVersion];
    }
  }

  return {
    hasMajorBump: Object.keys(majorBumps).length > 0,
    majorBumps
  };
}

/**
 * Get the content of the manifest file from a specific ref
 * @param octokit - GitHub API client
 * @param manifestPath - Path to the manifest file
 * @param ref - Git ref (commit SHA, branch name, etc.)
 * @returns Parsed manifest object or null if file doesn't exist
 */
export async function getManifestAtRef(
  octokit: InstanceType<typeof GitHub>,
  manifestPath: string,
  ref: string
): Promise<ReleasePleaseManifest | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: manifestPath,
      ref
    });

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(content) as ReleasePleaseManifest;
    }

    return null;
  } catch (error) {
    // File doesn't exist at this ref
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 404) {
        return null;
      }
    }
    throw error;
  }
}

/**
 * Detect major version bumps in a pull request
 * @param octokit - GitHub API client
 * @param manifestPath - Path to the manifest file
 * @param baseSha - Base commit SHA
 * @param headSha - Head commit SHA
 * @returns Analysis of manifest changes
 */
export async function detectMajorBumps(
  octokit: InstanceType<typeof GitHub>,
  manifestPath: string,
  baseSha: string,
  headSha: string
): Promise<ManifestAnalysis> {
  const [oldManifest, newManifest] = await Promise.all([
    getManifestAtRef(octokit, manifestPath, baseSha),
    getManifestAtRef(octokit, manifestPath, headSha)
  ]);

  return analyzeManifestChanges(oldManifest, newManifest);
}
