import type { GitHub } from '@actions/github/lib/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeManifestChanges,
  detectMajorBumps,
  getManifestAtRef
} from './manifest';

const mocks = vi.hoisted(() => {
  return {
    getOctokit: vi.fn()
  };
});

vi.mock('@actions/github', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@actions/github')>();

  const context = {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    }
  };

  return {
    ...mod,
    context,
    getOctokit: mocks.getOctokit
  };
});

describe('analyzeManifestChanges', () => {
  it('should return no major bumps when new manifest is null', () => {
    const result = analyzeManifestChanges({ '.': '1.0.0' }, null);

    expect(result).toEqual({
      hasMajorBump: false,
      majorBumps: {}
    });
  });

  it('should return no major bumps when old manifest is null', () => {
    const result = analyzeManifestChanges(null, { '.': '1.0.0' });

    expect(result).toEqual({
      hasMajorBump: false,
      majorBumps: {}
    });
  });

  it('should detect single major bump in root package', () => {
    const oldManifest = { '.': '1.2.3' };
    const newManifest = { '.': '2.0.0' };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      '.': ['1.2.3', '2.0.0']
    });
  });

  it('should detect major bump from 0.x to 1.x', () => {
    const oldManifest = { '.': '0.5.0' };
    const newManifest = { '.': '1.0.0' };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      '.': ['0.5.0', '1.0.0']
    });
  });

  it('should not detect minor version bumps as major', () => {
    const oldManifest = { '.': '1.2.3' };
    const newManifest = { '.': '1.3.0' };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });

  it('should not detect patch version bumps as major', () => {
    const oldManifest = { '.': '1.2.3' };
    const newManifest = { '.': '1.2.4' };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });

  it('should detect multiple major bumps in monorepo', () => {
    const oldManifest = {
      'packages/foo': '1.2.3',
      'packages/bar': '2.5.0',
      'packages/baz': '0.1.0'
    };
    const newManifest = {
      'packages/foo': '2.0.0',
      'packages/bar': '3.0.0',
      'packages/baz': '0.1.1'
    };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      'packages/foo': ['1.2.3', '2.0.0'],
      'packages/bar': ['2.5.0', '3.0.0']
    });
  });

  it('should only include major bumps, not minor or patch', () => {
    const oldManifest = {
      'packages/major': '1.0.0',
      'packages/minor': '1.0.0',
      'packages/patch': '1.0.0'
    };
    const newManifest = {
      'packages/major': '2.0.0',
      'packages/minor': '1.1.0',
      'packages/patch': '1.0.1'
    };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      'packages/major': ['1.0.0', '2.0.0']
    });
  });

  it('should ignore new packages that did not exist before', () => {
    const oldManifest = {
      'packages/existing': '1.0.0'
    };
    const newManifest = {
      'packages/existing': '1.0.0',
      'packages/new': '2.0.0'
    };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });

  it('should handle unchanged versions', () => {
    const oldManifest = { '.': '1.2.3' };
    const newManifest = { '.': '1.2.3' };

    const result = analyzeManifestChanges(oldManifest, newManifest);

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });
});

describe('getManifestAtRef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should fetch and parse manifest file from a specific ref', async () => {
    const mockManifest = { '.': '1.2.3', 'packages/foo': '2.0.0' };
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              content: Buffer.from(JSON.stringify(mockManifest)).toString(
                'base64'
              )
            }
          })
        }
      }
    };

    const result = await getManifestAtRef(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'abc123'
    );

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: '.release-please-manifest.json',
      ref: 'abc123'
    });
    expect(result).toEqual(mockManifest);
  });

  it('should return null when file returns 404', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockRejectedValue({ status: 404 })
        }
      }
    };

    const result = await getManifestAtRef(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'abc123'
    );

    expect(result).toBeNull();
  });

  it('should return null when data does not contain content', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              type: 'dir'
            }
          })
        }
      }
    };

    const result = await getManifestAtRef(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'abc123'
    );

    expect(result).toBeNull();
  });

  it('should throw error for non-404 errors', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockRejectedValue({
            status: 500,
            message: 'Internal server error'
          })
        }
      }
    };

    await expect(
      getManifestAtRef(
        mockOctokit as unknown as InstanceType<typeof GitHub>,
        '.release-please-manifest.json',
        'abc123'
      )
    ).rejects.toEqual({ status: 500, message: 'Internal server error' });
  });

  it('should use custom manifest path', async () => {
    const mockManifest = { '.': '1.0.0' };
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              content: Buffer.from(JSON.stringify(mockManifest)).toString(
                'base64'
              )
            }
          })
        }
      }
    };

    await getManifestAtRef(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      'custom/path/to/manifest.json',
      'def456'
    );

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: 'custom/path/to/manifest.json',
      ref: 'def456'
    });
  });

  it('should correctly decode base64 content', async () => {
    const mockManifest = {
      '.': '1.2.3',
      'packages/foo': '2.0.0',
      'packages/bar': '3.5.1'
    };
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              content: Buffer.from(JSON.stringify(mockManifest)).toString(
                'base64'
              )
            }
          })
        }
      }
    };

    const result = await getManifestAtRef(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'abc123'
    );

    expect(result).toEqual(mockManifest);
  });
});

describe('detectMajorBumps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should detect major bumps by fetching manifests from base and head refs', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '1.2.3' })).toString(
                  'base64'
                )
              }
            })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '2.0.0' })).toString(
                  'base64'
                )
              }
            })
        }
      }
    };

    const result = await detectMajorBumps(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'base-sha',
      'head-sha'
    );

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledTimes(2);
    expect(mockOctokit.rest.repos.getContent).toHaveBeenNthCalledWith(1, {
      owner: 'test-owner',
      repo: 'test-repo',
      path: '.release-please-manifest.json',
      ref: 'base-sha'
    });
    expect(mockOctokit.rest.repos.getContent).toHaveBeenNthCalledWith(2, {
      owner: 'test-owner',
      repo: 'test-repo',
      path: '.release-please-manifest.json',
      ref: 'head-sha'
    });

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      '.': ['1.2.3', '2.0.0']
    });
  });

  it('should handle multiple packages in monorepo', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(
                  JSON.stringify({
                    'packages/foo': '1.0.0',
                    'packages/bar': '2.0.0',
                    'packages/baz': '3.0.0'
                  })
                ).toString('base64')
              }
            })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(
                  JSON.stringify({
                    'packages/foo': '2.0.0',
                    'packages/bar': '2.1.0',
                    'packages/baz': '4.0.0'
                  })
                ).toString('base64')
              }
            })
        }
      }
    };

    const result = await detectMajorBumps(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'base-sha',
      'head-sha'
    );

    expect(result.hasMajorBump).toBe(true);
    expect(result.majorBumps).toEqual({
      'packages/foo': ['1.0.0', '2.0.0'],
      'packages/baz': ['3.0.0', '4.0.0']
    });
  });

  it('should return no major bumps when only minor/patch changes', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '1.2.3' })).toString(
                  'base64'
                )
              }
            })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '1.3.0' })).toString(
                  'base64'
                )
              }
            })
        }
      }
    };

    const result = await detectMajorBumps(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'base-sha',
      'head-sha'
    );

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });

  it('should handle 404 error when manifest does not exist at base ref', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockRejectedValueOnce({ status: 404 })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '1.0.0' })).toString(
                  'base64'
                )
              }
            })
        }
      }
    };

    const result = await detectMajorBumps(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      '.release-please-manifest.json',
      'base-sha',
      'head-sha'
    );

    expect(result.hasMajorBump).toBe(false);
    expect(result.majorBumps).toEqual({});
  });

  it('should use custom manifest path', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '1.0.0' })).toString(
                  'base64'
                )
              }
            })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(JSON.stringify({ '.': '2.0.0' })).toString(
                  'base64'
                )
              }
            })
        }
      }
    };

    await detectMajorBumps(
      mockOctokit as unknown as InstanceType<typeof GitHub>,
      'custom/path/manifest.json',
      'base-sha',
      'head-sha'
    );

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'custom/path/manifest.json'
      })
    );
  });

  it('should throw error for non-404 errors', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockRejectedValue({ status: 500, message: 'Server error' })
        }
      }
    };

    await expect(
      detectMajorBumps(
        mockOctokit as unknown as InstanceType<typeof GitHub>,
        '.release-please-manifest.json',
        'base-sha',
        'head-sha'
      )
    ).rejects.toEqual({ status: 500, message: 'Server error' });
  });
});
