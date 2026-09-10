import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

interface PackageManifest {
  readonly devDependencies: Readonly<Record<string, string>>;
}

interface InstalledManifest {
  readonly version: string;
}

type JsonScalar = boolean | null | number | string;

type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

type RuleMap = Record<string, JsonValue>;

interface OxlintConfiguration {
  readonly rules: RuleMap;
}

interface BiomePolicy {
  readonly linter: {
    readonly rules: {
      recommended?: boolean;
      [group: string]: boolean | RuleMap | undefined;
    };
  };
}

interface SchemaProperty {
  readonly description?: string;
}

interface SchemaDefinition {
  readonly properties?: Readonly<Record<string, SchemaProperty>>;
}

interface BiomeConfigurationSchema {
  readonly $defs: Readonly<Record<string, SchemaDefinition>> & {
    readonly Rules: {
      readonly properties: Readonly<Record<string, SchemaProperty>>;
    };
  };
}

interface RuleCandidate {
  readonly group: string;
  readonly name: string;
}

const exec = promisify(execFile);

const root = fileURLToPath(new URL("../", import.meta.url));

async function readJson<Value>(path: string): Promise<Value> {
  const content = await readFile(new URL(path, new URL("../", import.meta.url)), "utf8");

  // SAFETY: Each caller supplies the checked-in or installed manifest/schema contract for this exact repository-owned path. Subsequent property access and tool execution fail closed if that dependency changes shape.
  return JSON.parse(content) as Value;
}

const manifest = await readJson<PackageManifest>("package.json");

for (const tool of ["oxlint", "@biomejs/biome"]) {
  const installed = await readJson<InstalledManifest>(`node_modules/${tool}/package.json`);

  if (installed.version !== manifest.devDependencies[tool]) {
    throw new Error(`Install the pinned ${tool} version before synchronizing rules.`);
  }
}

const run = async (command: string, args: string[]): Promise<string> =>
  (
    await exec(command, args, {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout;

const isWarning = (setting: JsonValue): boolean => {
  const severity = Array.isArray(setting) ? setting[0] : setting;

  return severity === "warn" || severity === 1;
};

const asError = (setting: JsonValue): JsonValue =>
  Array.isArray(setting) ? ["error", ...setting.slice(1)] : "error";

const parseOxlintConfiguration = (content: string): OxlintConfiguration => {
  // SAFETY: Oxlint's JSON printer owns this stable configuration envelope; missing rules fail the synchronization operation rather than producing a valid overlay.
  return JSON.parse(content) as OxlintConfiguration;
};

// Inspect the unmodified selection policy, never the generated severity overlay.
const oxlint = parseOxlintConfiguration(
  await run(process.execPath, [
    "node_modules/oxlint/bin/oxlint",
    "--config",
    "oxlint/policy.mjs",
    "--print-config",
  ]),
);

const inheritedErrors = Object.fromEntries(
  Object.entries(oxlint.rules)
    .filter(([, setting]) => isWarning(setting))
    .map(([name, setting]) => [name, asError(setting)]),
);

const biome = await readJson<BiomePolicy>("biome/policy.json");

const schema = await readJson<BiomeConfigurationSchema>(
  "node_modules/@biomejs/biome/configuration_schema.json",
);

const candidates: RuleCandidate[] = [];

for (const group of Object.keys(
  biome.linter.rules.recommended === true ? schema.$defs.Rules.properties : {},
)) {
  const first = group[0];

  if (first === undefined) throw new Error("Biome returned an empty rule-group name.");

  const definition = schema.$defs[first.toUpperCase() + group.slice(1)];

  for (const [name, property] of Object.entries(definition?.properties ?? {})) {
    if (property.description?.includes("https://biomejs.dev/linter/rules/") === true) {
      candidates.push({ group, name });
    }
  }
}

// Bound native process concurrency; documentation output can be substantial.
let index = 0;

const recommendedWarnings: RuleCandidate[] = [];

await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (index < candidates.length) {
      const candidate = candidates[index];
      index += 1;

      if (candidate === undefined) break;

      const documentation = await run("node_modules/.bin/biome", ["explain", candidate.name]);
      const summary = documentation.split("Description")[0] ?? "";

      if (/^- This rule is recommended$/m.test(summary) && /Default severity: warn/.test(summary)) {
        recommendedWarnings.push(candidate);
      }
    }
  }),
);

recommendedWarnings.sort((left, right) =>
  `${left.group}/${left.name}`.localeCompare(`${right.group}/${right.name}`, "en"),
);

let biomePromotions = 0;

for (const { group, name } of recommendedWarnings) {
  const configured = biome.linter.rules[group];
  let rules: RuleMap;

  if (configured === undefined) {
    rules = {};
    biome.linter.rules[group] = rules;
  } else if (configured === true || configured === false) {
    throw new Error(`Biome rule group ${group} unexpectedly resolves to a boolean.`);
  } else {
    rules = configured;
  }

  // Preserve explicit policy, including disabled rules and configured options.
  if (!(name in rules)) {
    rules[name] = "error";
    biomePromotions += 1;
  }
}

const outputs = {
  "oxlint/inherited-errors.mjs": `// Generated by scripts/sync-rule-severities.ts; do not edit.\nexport default ${JSON.stringify(inheritedErrors, null, 2)};\n`,
  "biome/base.json": `${JSON.stringify(biome, null, 2)}\n`,
};

for (const [path, content] of Object.entries(outputs)) {
  const url = new URL(`../${path}`, import.meta.url);

  if (process.argv.includes("--check")) {
    const current = await readFile(url, "utf8").catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return "";
      throw cause;
    });

    if (current !== content) throw new Error(`${path} is stale; run pnpm sync:rules.`);
  } else {
    await writeFile(url, content);
  }
}

console.log(
  `Severity overlays: ${Object.keys(inheritedErrors).length} Oxlint warnings, ${biomePromotions} recommended Biome warnings.`,
);
