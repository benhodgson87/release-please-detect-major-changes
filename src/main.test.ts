import type { GitHub } from '@actions/github/lib/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    getInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
    getOctokit: vi.fn(),
    context: {
      payload: {
        pull_request: {
          base: { sha: 'base-sha-123' },
          head: { sha: 'head-sha-456' }
        }
      },
      repo: {
        owner: 'test-owner',
        repo: 'test-repo'
      }
    }
  };
});

vi.mock('@actions/core', () => ({
  default: {
    getInput: mocks.getInput,
    setOutput: mocks.setOutput,
    setFailed: mocks.setFailed,
    info: mocks.info
  }
}));

vi.mock('@actions/github', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@actions/github')>();
  return {
    ...mod,
    context: mocks.context,
    getOctokit: mocks.getOctokit
  };
});

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset context to default
    mocks.context.payload = {
      pull_request: {
        base: { sha: 'base-sha-123' },
        head: { sha: 'head-sha-456' }
      }
    };

    // Default mock implementations
    mocks.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'test-token';
      if (name === 'manifest_file') return '';
      return '';
    });
  });

  it('should detect major bumps and set outputs correctly', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(
                  JSON.stringify({
                    '.': '1.2.3',
                    'packages/foo': '3.5.0'
                  })
                ).toString('base64')
              }
            })
            .mockResolvedValueOnce({
              data: {
                content: Buffer.from(
                  JSON.stringify({
                    '.': '2.0.0',
                    'packages/foo': '4.0.0'
                  })
                ).toString('base64')
              }
            })
        }
      }
    };

    mocks.getOctokit.mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    );

    const { run } = await import('./main');
    await run();

    expect(mocks.getInput).toHaveBeenCalledWith('github_token', {
      required: true
    });
    expect(mocks.getInput).toHaveBeenCalledWith('manifest_file');
    expect(mocks.getOctokit).toHaveBeenCalledWith('test-token');

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: '.release-please-manifest.json',
      ref: 'base-sha-123'
    });
    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: '.release-please-manifest.json',
      ref: 'head-sha-456'
    });

    expect(mocks.info).toHaveBeenCalledWith(
      'Analyzing .release-please-manifest.json changes between base-sha-123 and head-sha-456'
    );
    expect(mocks.info).toHaveBeenCalledWith(
      '🚨 Major version bump(s) detected!'
    );
    expect(mocks.info).toHaveBeenCalledWith('📈 .: 1.2.3 → 2.0.0');
    expect(mocks.info).toHaveBeenCalledWith('📈 packages/foo: 3.5.0 → 4.0.0');

    expect(mocks.setOutput).toHaveBeenCalledWith('has_major_bump', true);
    expect(mocks.setOutput).toHaveBeenCalledWith(
      'major_bumps',
      JSON.stringify({
        '.': ['1.2.3', '2.0.0'],
        'packages/foo': ['3.5.0', '4.0.0']
      })
    );
  });

  it('should handle no major bumps', async () => {
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

    mocks.getOctokit.mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    );

    const { run } = await import('./main');
    await run();

    expect(mocks.info).toHaveBeenCalledWith(
      '✅ No major version bumps detected'
    );
    expect(mocks.setOutput).toHaveBeenCalledWith('has_major_bump', false);
    expect(mocks.setOutput).toHaveBeenCalledWith(
      'major_bumps',
      JSON.stringify({})
    );
  });

  it('should use custom manifest file path', async () => {
    mocks.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'test-token';
      if (name === 'manifest_file') return 'custom/path/manifest.json';
      return '';
    });

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
                content: Buffer.from(JSON.stringify({ '.': '1.1.0' })).toString(
                  'base64'
                )
              }
            })
        }
      }
    };

    mocks.getOctokit.mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    );

    const { run } = await import('./main');
    await run();

    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: 'custom/path/manifest.json',
      ref: 'base-sha-123'
    });
    expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      path: 'custom/path/manifest.json',
      ref: 'head-sha-456'
    });

    expect(mocks.info).toHaveBeenCalledWith(
      'Analyzing custom/path/manifest.json changes between base-sha-123 and head-sha-456'
    );
  });

  it('should handle errors and set failed status', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi
            .fn()
            .mockRejectedValue(new Error('Failed to fetch manifest'))
        }
      }
    };

    mocks.getOctokit.mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    );

    const { run } = await import('./main');
    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      'Action failed: Failed to fetch manifest'
    );
  });

  it('should handle non-Error exceptions', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn().mockRejectedValue('String error')
        }
      }
    };

    mocks.getOctokit.mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    );

    const { run } = await import('./main');
    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      'Action failed with unknown error'
    );
  });

  it('should throw error when not run on pull_request event', async () => {
    // Modify the context for this test
    (mocks.context.payload as Record<string, unknown>).pull_request = undefined;

    const { run } = await import('./main');
    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(
      'Action failed: ⛔️ This action can only be run on pull_request events'
    );
  });
});
