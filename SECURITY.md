# Security Policy

## Reporting A Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Email security and privacy-sensitive reports to:

```text
Bugs4Werbl@gmail.com
```

Include:

- Werbl version.
- Chrome version.
- Operating system.
- Steps to reproduce.
- Any proof-of-concept files or URLs needed to reproduce the issue.
- Whether the issue exposes user image data, selected files, browser URLs, or
  local extension storage.

I will prioritize reports that include clear reproduction steps and a concrete
impact.

## Scope

In scope:

- The Chrome extension in `extension/`.
- The local web workspace in `src/`.
- Packaging and release scripts in `scripts/`.

Out of scope:

- Bugs in Chrome itself.
- Issues caused by a website intentionally blocking browser image access.
- Social engineering or attacks that require unrelated account compromise.
