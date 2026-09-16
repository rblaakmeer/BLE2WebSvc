# Dependabot review — 2026-09-16

Reviewed the signed-in [Dependabot alert list](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot), both closed-alert pages, and the full details of alerts #50–#55. GitHub showed 50 alerts: 5 open, 44 fixed, and 1 automatically dismissed. The reviewed default branch was `488b741cde9b234a34939292722f857493cc1cb4`, matching the local checkout before these changes.

## New alerts and fixes

| Alert | GitHub state / severity | Issue | Previous version | Patched version installed |
| --- | --- | --- | --- | --- |
| [#50](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/50) | Open / moderate | qs bracket-key comma parsing bypasses array limits | 6.15.2 | 6.16.0 |
| [#51](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/51) | Auto-dismissed / high | Browserslist unbounded query caches | 4.28.0 | 4.28.7 |
| [#52](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/52) | Open / high | Browserslist untrusted stats cause crashes / prototype writes | 4.28.0 | 4.28.7 |
| [#53](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/53) | Open / moderate | qs serialization calls attacker-controlled isBuffer | 6.15.2 | 6.16.0 |
| [#54](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/54) | Open / moderate | baseline-browser-mapping exits the process on invalid options | 2.8.32 | 2.11.0 |
| [#55](https://github.com/rblaakmeer/BLE2WebSvc/security/dependabot/55) | Open / high | js-yaml empty merge sources bypass the CPU work budget | 4.3.1 | 4.3.2 |

Advisories, respectively: GHSA-x5fp-wj9c-mxmx, GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g, GHSA-4mjr-xmp4-gh2g, GHSA-w5vr-8v7q-w6rv, GHSA-2883-xcg3-v3hh.

All six affected version ranges applied to the old lockfile. #51 was dismissed by GitHub's preset rule for low-impact development dependencies, not because its installed version was patched. The Browserslist update also addresses it; no dismissal settings were changed.

`qs` is a runtime dependency through Express/body-parser, and a test dependency through Supertest. The application currently uses `express.json()` and does not explicitly enable comma parsing or implement the vulnerable qs parse/stringify round-trip. The installed dependency was affected, but this review did not establish a remotely exploitable application path for either qs advisory.

Browserslist and baseline-browser-mapping enter through Babel; js-yaml enters through Jest's coverage configuration loader. These are development dependencies. Their primary exposure here is tooling processing malicious configuration or input, rather than BLE API requests. They have still been patched.

## Previously fixed alerts

The live closed-alert list matches all 44 records in the saved `dependabot-alerts.json`. Every matching package instance in the current lockfile was compared with all vulnerable ranges recorded for each advisory; none match.

| Package | Fixed alert numbers | Current locked versions |
| --- | --- | --- |
| @babel/core | 32 | 7.29.6 |
| @babel/plugin-transform-modules-systemjs | 26 | 7.29.4 |
| body-parser | 34 | 2.3.0 |
| brace-expansion | 22, 27, 39, 41, 45, 46, 47, 48 | 1.1.18, 2.1.4 |
| express-rate-limit | 16 | 8.5.2 |
| form-data | 29 | 4.0.6 |
| glob | 5 | 10.5.0 |
| ip-address | 25, 42, 43, 44 | 10.4.0 |
| js-yaml | 2, 33, 49 | 4.3.2 |
| minimatch | 13, 14 | 3.1.5, 9.0.9 |
| path-to-regexp | 23, 24 | 8.4.0 |
| picomatch | 18, 19, 20, 21 | 2.3.2, 4.0.4 |
| qs | 6, 10, 28 | 6.16.0 |
| tar | 7, 8, 9, 11, 15, 17, 30, 35, 36, 37, 38, 40 | 7.5.21 |

## Implementation and verification

- Updated existing js-yaml and qs overrides; added Browserslist and baseline-browser-mapping overrides to enforce the minimum patched versions across all dependency paths.
- Regenerated `package-lock.json` with `npm install --ignore-scripts --no-audit --no-fund`. Four affected packages and six required transitive packages changed; native BLE install scripts were not rerun.
- Added five small behavioral regression tests covering #50, #52, #53, #54 and #55. The baseline test runs in a bounded subprocess so a regression to process.exit cannot terminate the test runner. #51 is covered by the patched-version check, not a heap stress test.
- `npm test -- --runInBand --silent`: 5 suites, 45 tests passed. The initial sandboxed run blocked subprocess creation (EPERM); the rerun with subprocess access passed.
- Fresh online `npm audit --json`: zero reported vulnerabilities. The earlier zero-result audit did not establish that GitHub's newer alerts were resolved, so the live advisory ranges were checked independently.
- Confirmed all copies of the four upgraded packages, including the lockfile's legacy dependency section, meet their patched-version floors; `npm ls` reports a consistent tree.
- Confirmed all 44 historical advisory ranges remain excluded. `git diff --check` passed.

The changes are local and uncommitted. GitHub's five open alerts remain open until the updated manifest and lockfile reach the default branch and Dependabot processes them. No GitHub alert was manually dismissed or reopened. Hardware BLE testing was not performed; the existing BLE tests use mocks.
