# Contributing

## HARD RULE: user data stays offline

Read the binding [offline boundary in AGENTS.md](AGENTS.md#hard-rule--all-user-data-stays-offline-on-the-users-device)
and the [README](README.md) before working on this project. Never use real files,
people, projects, exports, or archives in development, logs, screenshots, issues,
pull requests, or CI. Create wholly fictional fixtures. No backend, telemetry,
remote logging, or runtime CDN may be added. A locally exported HTML file with
embedded project data is private and must never become a public release.

## Local development

Use Node.js 24.15 or newer within the Node 24 line, npm, and Python 3.13 for the
PISA oracle checks. Dependency installation needs a network connection but must
never include user files. Application use and production exports stay offline.

```sh
npm ci
npm run dev
```

Vite's development server is bound to loopback. Its local hot-reload connection
is development tooling only; production has no network connection and uses a
restrictive Content Security Policy. Use fictional data even in development.

## Before a pull request

```sh
npm run format
npm run check
npm run test:oracle
npm run build
npm run check:release
npm run preview
```

Test real user outcomes: assignment consistency, legacy migration, derived PISA
orders, local file round trips, and immutable archives. Keep domain tests
independent of React. UI tests use Testing Library and fictional data. Verify
the built application and a locally exported HTML file with networking disabled;
check that import, planning, searching, archiving, and export still work.

The build creates `dist/index.html` and `dist/offline.html` from source. Both
contain bundled JavaScript and CSS, an empty app root, and no project payload.
Never edit or commit build output. The build verifies the release file allowlist,
empty root, no embedded project script, no external assets, and offline CSP.
Only this verified `dist` directory may be published. Never publish an export
created by the application's "with data" feature.

## Maintenance

Dependencies are pinned in `package.json` and `package-lock.json`. Dependabot
opens monthly update pull requests; updates must pass the same checks and an
offline smoke test before merge. SheetJS is pinned to its official distribution
tarball because the public npm `xlsx` package is not the current distribution.
Review changes to the lockfile, dependency licences, network APIs, and the release
build carefully. Do not bypass privacy tests to make a feature pass.

This project is licensed under [MIT](LICENSE). The licence covers application
code, not permission to publish private user data or source documents.
