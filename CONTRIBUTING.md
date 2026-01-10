# Contributing to StringTune-3D

Thank you for your interest in contributing to StringTune-3D! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind to others and constructive in your feedback.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**

   ```bash
   git clone https://github.com/penev-palemiya/StringTune-3D.git
   cd string-tune-3d
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Workflow

### Build

```bash
# Development build with watch
npm run dev

# Production build
npm run build
```

### Project Structure

```
src/
├── adapters/        # Engine-specific implementations (Three.js)
├── core/            # Core abstractions and base classes
│   ├── abstractions/   # Interfaces
│   ├── filters/        # Post-processing filters
│   ├── materials/      # Material system
│   ├── synchronizer/   # DOM-to-3D synchronization
│   └── text/           # 3D text support
└── modules/         # Main module entry points
```

### Testing Changes

Before submitting, ensure your changes work correctly:

1. Build the project without errors
2. Test with the example projects (if available)
3. Verify TypeScript types are correct

---

## Pull Request Process

1. **Update documentation** if you're changing public APIs or adding features

2. **Follow the PR template** (if available)

3. **Keep PRs focused** — one feature or fix per PR

4. **Write a clear description** explaining:

   - What changes were made
   - Why the changes are needed
   - How to test the changes

5. **Link related issues** using keywords like `Fixes #123` or `Closes #456`

6. **Wait for review** — maintainers will review your PR and may request changes

---

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide explicit types for function parameters and return values
- Avoid `any` type when possible

### Naming Conventions

| Type           | Convention                  | Example              |
| -------------- | --------------------------- | -------------------- |
| Classes        | PascalCase                  | `String3DObject`     |
| Interfaces     | PascalCase with `I` prefix  | `I3DEngine`          |
| Functions      | camelCase                   | `syncObject()`       |
| Constants      | UPPER_SNAKE_CASE            | `DEFAULT_CAMERA_FOV` |
| CSS Properties | kebab-case with `--` prefix | `--material-color`   |

### Code Style

- Use 2 or 4 spaces for indentation (follow existing code)
- Add JSDoc comments for public APIs
- Keep functions small and focused

```typescript
/**
 * Creates a 3D mesh from the given options.
 * @param options - Configuration for the mesh
 * @returns The created mesh object
 */
function createMesh(options: MeshOptions): Mesh {
  // ...
}
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                               |
| ---------- | ----------------------------------------- |
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation changes                     |
| `style`    | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring                          |
| `perf`     | Performance improvements                  |
| `test`     | Adding or updating tests                  |
| `chore`    | Maintenance tasks                         |

### Examples

```
feat(materials): add support for custom shader materials

fix(sync): resolve position drift on rapid DOM updates

docs(readme): update installation instructions
```

---

## Reporting Bugs

When reporting a bug, please include:

1. **Description** — Clear summary of the issue
2. **Steps to Reproduce** — Minimal steps to trigger the bug
3. **Expected Behavior** — What should happen
4. **Actual Behavior** — What actually happens
5. **Environment** — Browser, OS, package versions
6. **Code Sample** — Minimal reproducible example

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**

1. Create element with `string-3d="box"`
2. Set `--rotate-y: 90`
3. Observe incorrect rotation

**Expected**
The box should rotate 90 degrees on Y axis.

**Actual**
The box rotates on X axis instead.

**Environment**

- Browser: Chrome 120
- OS: Windows 11
- string-tune-3d: 1.0.0
- three.js: r160
```

---

## Feature Requests

We welcome feature suggestions! When proposing a feature:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** — Why is this feature needed?
3. **Propose a solution** — How might it work?
4. **Consider alternatives** — Are there other ways to achieve this?

---

## Questions?

If you have questions, feel free to:

- Open a [Discussion](https://github.com/penev-palemiya/StringTune-3D/discussions)
- Check existing [Issues](https://github.com/penev-palemiya/StringTune-3D/issues)

---

Thank you for contributing! 🚀
