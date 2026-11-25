# Contributing

Keep changes focused on an observable photographic operation or a reproducible workflow improvement. Explain the problem, changed behavior and validation in a pull request. Include a screenshot for interface changes and a tiny synthetic pixel fixture for algorithm changes.

Run `npm test`, `python -m pytest -q` and `npm run build`. Set `WORKING_PRINT_PYTHON` so the parity test runs. A new operator must be implemented in both renderers and covered by shared byte fixtures. A change to recipe meaning requires a new version and an explicit compatibility decision.

Do not commit personal photographs, private metadata or generated exports. Use rights-cleared assets and record attribution. Keep external browser requests and dependencies out unless the issue explains why the existing platform APIs are inadequate.

For UI changes, verify open, adjust, compare, recipe round-trip, invalid input and export at desktop and narrow widths using keyboard controls. Do not describe a feature as supported until the complete flow is working.
