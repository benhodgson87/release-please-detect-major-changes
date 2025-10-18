# release-please-detect-major-action

A GitHub Action to detect major version bumps (breaking changes) in [release-please](https://github.com/googleapis/release-please) PRs by analyzing changes to the `.release-please-manifest.json` file.

This action is designed to run on release-please PRs and identify when packages are being bumped to a new major version, allowing you to trigger additional workflows, notifications, or checks when breaking changes are being released.

The existing release-please action does not currently output version information on PRs. There is an [open issue](https://github.com/googleapis/release-please-action/issues/684) to implement this functionality to `googleapis/release-please-action`.

## Usage

```yaml
name: Detect Major Version Bumps

on:
  pull_request:
    branches:
      - main
    types:
      - opened
      - edited
      - synchronize

jobs:
  detect-major:
    runs-on: ubuntu-latest
    steps:
      - name: Detect Major Bumps
        id: detect
        uses: benhodgson87/release-please-detect-major-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Arguments

| Argument        | Optional | Default                         | Purpose                                                                 |
| --------------- | -------- | ------------------------------- | ----------------------------------------------------------------------- |
| `github_token`  | No      | -                               | GitHub token for API access (use `${{ secrets.GITHUB_TOKEN }}`)         |
| `manifest_file` | Yes       | `.release-please-manifest.json` | Path to the release-please manifest file relative to the repository root |

## Outputs

| Output          | Type    | Example                                                  | Description                                                                                                                                  |
| --------------- | ------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `has_major_bump` | Boolean | `true`                                                   | Whether the PR contains any major version bump                                                                                               |
| `updated_paths`    | JSON    | `{".": ["1.2.3", "2.0.0"], "packages/foo": ["3.5.6", "4.0.0"]}` | JSON object mapping package paths to `[oldVersion, newVersion]` tuples. Only includes packages with major version changes. |

## Usage

### How it works

The action compares the `.release-please-manifest.json` file between the PR's base and head commits to detect version changes.

For example:
- `1.2.3` → `2.0.0` ✅ Major bump detected
- `1.2.3` → `1.3.0` ❌ Minor bump (not detected)
- `1.2.3` → `1.2.4` ❌ Patch bump (not detected)

### Using with monorepos

The action works with release-please's monorepo support. When multiple packages are being released, the `updated_paths` output will contain entries for each package that has a major version bump.

```yaml
- name: Detect Major Bumps
  id: detect
  uses: benhodgson87/release-please-detect-major-action@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Process major bumps
  if: steps.detect.outputs.has_major_bump == 'true'
  run: |
    echo "Major bumps detected:"
    echo '${{ steps.detect.outputs.updated_paths }}' | jq .

    # Example output:
    # {
    #   ".": ["1.2.3", "2.0.0"],
    #   "packages/api": ["3.5.6", "4.0.0"],
    #   "packages/ui": ["0.9.1", "1.0.0"]
    # }
```

### Custom manifest file path

If your release-please manifest is not in the default location, you can specify a custom path:

```yaml
- name: Detect Major Bumps
  uses: benhodgson87/release-please-detect-major-action@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    manifest_file: '.github/release-please-manifest.json'
```

## Usage Examples

### Blocking merges on major bumps

You can use this action to require additional approval or checks when major version bumps are detected:

```yaml
name: Require Approval for Major Bumps

on:
  pull_request:
    branches:
      - main

jobs:
  check-major-bumps:
    runs-on: ubuntu-latest
    steps:
      - name: Detect Major Bumps
        id: detect
        uses: benhodgson87/release-please-detect-major-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: Fail if major bump without approval label
        if: |
          steps.detect.outputs.has_major_bump == 'true' &&
          !contains(github.event.pull_request.labels.*.name, 'breaking-change-approved')
        run: |
          echo "::error::Major version bump detected but not approved. Please add the 'breaking-change-approved' label."
          exit 1
```

### Triggering notifications

Send notifications to Slack, Teams, or other channels when breaking changes are being released:

```yaml
- name: Detect Major Bumps
  id: detect
  uses: benhodgson87/release-please-detect-major-action@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Notify Slack
  if: steps.detect.outputs.has_major_bump == 'true'
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚨 Breaking changes detected in ${{ github.event.pull_request.html_url }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Running only on release-please PRs

To avoid running this action on non-release-please PRs, use the `paths` filter to only trigger when the manifest file changes:

```yaml
name: Detect Major Version Bumps

on:
  pull_request:
    branches:
      - main
    paths:
      - '.release-please-manifest.json'

jobs:
  detect-major:
    runs-on: ubuntu-latest
    steps:
      - name: Detect Major Bumps
        uses: benhodgson87/release-please-detect-major-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

If you're using a custom manifest file path, update the `paths` filter accordingly:

```yaml
on:
  pull_request:
    paths:
      - '.github/release-please-manifest.json'
```
