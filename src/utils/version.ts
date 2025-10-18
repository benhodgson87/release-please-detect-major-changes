import semver from 'semver';

export type SemVer = {
  version: string;
  major: number;
  minor: number;
  patch: number;
};

/**
 * Parse a version string into SemVer components
 * @param version - Version string (e.g., "1.2.3" or "v1.2.3")
 * @returns Parsed SemVer object
 * @throws Error if version is invalid
 */
export function parseVersion(version: string): SemVer {
  const parsed = semver.parse(version);

  if (!parsed) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    version: parsed.version,
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch
  };
}

/**
 * Check if a version change represents a major bump
 * @param oldVersion - Previous version string
 * @param newVersion - New version string
 * @returns true if the major version increased
 */
export function isMajorBump(oldVersion: string, newVersion: string): boolean {
  const oldVer = parseVersion(oldVersion);
  const newVer = parseVersion(newVersion);

  return newVer.major > oldVer.major;
}
