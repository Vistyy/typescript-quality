# Candidate-rule trial on Pi Workgraph

This is a decision record for a bounded trial, not a required check for consuming projects.
No candidate from this trial was added to the shared defaults.

## Scope and method

The inspected Pi Workgraph revision was `122d1cc5bcba6831e11574c1263a3ad9aa3e799c`.
The trial covered 35 files under `src`, `extensions`, `test`, and `scripts` using Oxlint 1.81.0, oxlint-tsgolint 7.0.2001, and Biome 2.5.12.
Temporary configurations selected only the three candidate TypeScript rules and Biome's `noImportCycles` rule, all at error severity.
Oxlint used type-aware analysis and the project's discovered tsconfig; it did not run the shared anti-slop or Effect presets.
Biome's project analysis was explicitly enabled.
The TypeScript helper executable was supplied through `OXLINT_TSGOLINT_PATH` because Workgraph does not install that helper itself.
The repository revision and working-tree status were unchanged after the trial.

Small disposable controls triggered each of the three TypeScript rules and both edges of a deliberate two-file import cycle.
This distinguishes a clean result from a rule that was never active.

## Results

| Candidate | Source | Tests | Scripts | Total |
| --- | ---: | ---: | ---: | ---: |
| `typescript/no-unsafe-type-assertion` | 8 | 20 | 1 | 29 |
| `typescript/no-unnecessary-condition` | 2 | 23 | 1 | 26 |
| `typescript/no-deprecated` | 11 | 17 | 0 | 28 |
| Biome `noImportCycles` | 0 | 0 | 0 | 0 |

These are diagnostics, not a count of confirmed defects.
Representative findings were inspected, not every reported location.

- Unsafe assertions included narrowing `parsed.version` before an `includes` check in `src/model-policy.ts:106` and object casts around external Herdr responses in `src/herdr.ts`.
  The rule can identify useful validation work, but tests and justified boundary assertions account for much of the adoption cost.
- Unnecessary conditions included already-narrowed guards in `src/workstream.ts:752` and `src/workstream.ts:1324`.
  Most remaining diagnostics were test optional chains after assertions had established that the values exist.
- Deprecated uses included compatibility fields such as `worktreePath` and `branch`, and the intentionally retained `herdrAgentName` fallback.
  Compatibility code must sometimes exercise deprecated APIs, so blanket enforcement would require deliberate exceptions.
- No import cycles were reported in the inspected files, while the cycle control failed as expected.
  This supports considering the rule for Workgraph, but does not establish compatibility with every consuming project's module graph.

## Recommendation

Consider import-cycle detection first as a project-level addition.
Evaluate unsafe assertions and unnecessary conditions with explicit source/test boundaries rather than applying automatic rewrites to all findings.
Keep deprecated-use enforcement project-specific where legacy compatibility is intentional.
The trial does not authorize edits to Workgraph or establish any of these candidates as a universal requirement.
