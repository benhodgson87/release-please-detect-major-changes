import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { detectMajorBumps } from './utils/manifest';

const INPUT_GITHUB_TOKEN = 'github_token';
const INPUT_MANIFEST_FILE = 'manifest_file';
const OUTPUT_HAS_MAJOR_BUMP = 'has_major_bump';
const OUTPUT_UPDATED_PATHS = 'updated_paths';

export async function run(): Promise<void> {
  try {
    if (!context.payload.pull_request) {
      throw new Error('⛔️ This action can only be run on pull_request events');
    }

    const token = core.getInput(INPUT_GITHUB_TOKEN, { required: true });
    const manifestFile =
      core.getInput(INPUT_MANIFEST_FILE) || '.release-please-manifest.json';
    const octokit = getOctokit(token);

    const pr = context.payload.pull_request;
    const baseSha = pr.base.sha;
    const headSha = pr.head.sha;

    core.info(
      `Analyzing ${manifestFile} changes between ${baseSha} and ${headSha}`
    );

    const analysis = await detectMajorBumps(
      octokit,
      manifestFile,
      baseSha,
      headSha
    );

    if (analysis.hasMajorBump) {
      core.info('🚨 Major version bump(s) detected!');

      for (const [path, [oldVersion, newVersion]] of Object.entries(
        analysis.majorBumps
      )) {
        core.info(`📈 ${path}: ${oldVersion} → ${newVersion}`);
      }
    } else {
      core.info('✅ No major version bumps detected');
    }

    core.setOutput(OUTPUT_HAS_MAJOR_BUMP, analysis.hasMajorBump);
    core.setOutput(OUTPUT_UPDATED_PATHS, JSON.stringify(analysis.majorBumps));
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.setFailed('Action failed with unknown error');
    }
  }
}
