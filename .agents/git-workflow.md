# Git Workflow Guidelines

## Overview
Conventional Commits based workflow with feature branches and GitHub PRs.

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring (no behavior change) |
| `docs:` | Documentation changes |
| `test:` | Test additions or changes |
| `chore:` | Maintenance tasks |
| `ci:` | CI/CD configuration |
| `style:` | Code style changes (formatting, etc.) |
| `perf:` | Performance improvements |

### Scope Examples
- `engine` - Core game engine
- `ui` or `react` - UI components
- `ai` - AI behavior
- `tcg` - TCG format/cards
- `security` - Security features
- `ci` - CI/CD pipeline

### Examples

```bash
feat(ai): add threat assessment scoring
fix(engine): prevent null pointer in battle resolution
refactor(ui): extract modal logic to custom hook
docs: update API documentation
test(engine): add edge case tests for fusion summon
ci: remove agnix agent config validation
chore: update dependencies to latest versions
fix(ui): equalize OK and Cancel button sizes
```

## Branch Naming

| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Main branch | `main` | - |
| Features | `feature/*` | `feature/fusion-summon` |
| Bug fixes | `fix/*` | `fix/battle-crash` |
| AI work | `ai/issue-{number}-*` | `ai/issue-42-threat-assessment` |
| Security | `security/*` | `security/xss-prevention` |
| Maintenance | `chore/*` | `chore/update-deps` |

## Workflow Steps

1. **Create branch from main**
   ```bash
   git checkout main
   git pull
   git checkout -b feature/my-feature
   ```

2. **Make commits** following Conventional Commits format

3. **Push and open PR**
   ```bash
   git push -u origin feature/my-feature
   ```

4. **PR Requirements**
   - Descriptive title
   - Summary of changes
   - Tests passing
   - Code reviewed

5. **Merge to main** (via PR - no direct pushes to main)

## Release Commands

Use npm scripts for versioning:

```bash
npm run release:patch   # 1.0.0 → 1.0.1
npm run release:minor   # 1.0.0 → 1.1.0
npm run release:major   # 1.0.0 → 2.0.0
```

These bump version in package.json, commit, and push tag.

## Rules

### Commit Best Practices
- Keep commits atomic (one logical change per commit)
- Write clear, concise commit messages
- Reference issues/PRs in body when applicable
- Don't commit generated files (e.g., `dist/`, `coverage/`)

### Branch Management
- Branch off from up-to-date main
- Delete branches after merge
- Rebase feature branches before merge if needed
- Never force-push to main

### PR Guidelines
- Keep PRs focused and small
- Include test coverage for changes
- Follow existing code patterns
- Document API changes

## Examples

### Good Commit
```bash
feat(ai): add threat assessment scoring

Implement threat scoring algorithm for AI opponent decision-making.
Evaluates cards based on attack/defense stats and field position.

Closes #42
```

### Avoid
```bash
# Too vague
fix stuff

# Multiple unrelated changes
update everything

# Missing context
change AI logic
```
