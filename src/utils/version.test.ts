import { describe, expect, it } from 'vitest';
import { isMajorBump, parseVersion } from './version';

describe('parseVersion', () => {
  it.each([
    ['1.2.3', { version: '1.2.3', major: 1, minor: 2, patch: 3 }],
    ['0.0.1', { version: '0.0.1', major: 0, minor: 0, patch: 1 }],
    ['10.20.30', { version: '10.20.30', major: 10, minor: 20, patch: 30 }],
    ['v1.2.3', { version: '1.2.3', major: 1, minor: 2, patch: 3 }],
    ['v0.0.1', { version: '0.0.1', major: 0, minor: 0, patch: 1 }],
    ['v10.20.30', { version: '10.20.30', major: 10, minor: 20, patch: 30 }]
  ])('should parse valid semantic version %s', (version, expected) => {
    expect(parseVersion(version)).toEqual(expected);
  });

  it.each([
    ['1.2', 'Invalid version format: 1.2'],
    ['1.2.3.4', 'Invalid version format: 1.2.3.4'],
    ['1.2.x', 'Invalid version format: 1.2.x'],
    ['', 'Invalid version format: '],
    ['vv1.2.3', 'Invalid version format: vv1.2.3'],
    ['v1.2', 'Invalid version format: v1.2']
  ])('should throw error for invalid version format %s', (version, error) => {
    expect(() => parseVersion(version)).toThrow(error);
  });
});

describe('isMajorBump', () => {
  it.each([
    ['1.2.3', '2.0.0'],
    ['0.5.0', '1.0.0'],
    ['2.9.9', '3.0.0'],
    ['10.0.0', '11.0.0'],
    ['9.99.99', '10.0.0'],
    ['10.5.3', '11.0.0'],
    ['99.0.0', '100.0.0']
  ])(
    'should detect major version bump from %s to %s',
    (oldVersion, newVersion) => {
      expect(isMajorBump(oldVersion, newVersion)).toBe(true);
    }
  );

  it.each([
    ['1.2.3', '1.3.0', 'minor'],
    ['0.1.0', '0.2.0', 'minor'],
    ['2.0.0', '2.1.0', 'minor'],
    ['1.2.3', '1.2.4', 'patch'],
    ['0.1.0', '0.1.1', 'patch'],
    ['2.0.0', '2.0.1', 'patch'],
    ['1.2.3', '1.2.3', 'same'],
    ['0.0.1', '0.0.1', 'same']
  ])(
    'should not detect major bump from %s to %s (%s)',
    (oldVersion, newVersion) => {
      expect(isMajorBump(oldVersion, newVersion)).toBe(false);
    }
  );
});
