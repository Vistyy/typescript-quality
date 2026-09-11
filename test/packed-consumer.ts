import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

interface CommandResult {
  readonly output: string;
  readonly status: number;
  readonly stdout: string;
}

interface Diagnostic {
  readonly category?: string;
  readonly code?: string;
  readonly message?: string;
  readonly severity?: string;
}

interface DiagnosticOutput {
  readonly diagnostics: Diagnostic[];
}

interface PackageManifest {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
}

type JsonScalar = boolean | null | number | string;

type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

const repository = fileURLToPath(new URL("..", import.meta.url));

// SAFETY: This repository-owned manifest is validated below for every required exact, coherent tool pin.
const manifest = JSON.parse(
  readFileSync(join(repository, "package.json"), "utf8"),
) as PackageManifest;

const toolPackages = [
  "@biomejs/biome",
  "@effect/tsgo",
  "effect",
  "oxlint",
  "oxlint-tsgolint",
  "typescript",
] as const;

const toolVersions = Object.fromEntries(
  toolPackages.map((name) => {
    const peerVersion = manifest.peerDependencies[name];
    const developmentVersion = manifest.devDependencies[name];

    if (
      peerVersion === undefined ||
      developmentVersion === undefined ||
      peerVersion !== developmentVersion
    ) {
      throw new Error(
        `${name} must have identical exact peer/dev pins; found peer=${peerVersion ?? "missing"}, dev=${developmentVersion ?? "missing"}.`,
      );
    }

    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(peerVersion)) {
      throw new Error(`${name} must use an exact version, found ${peerVersion}.`);
    }

    return [name, peerVersion];
  }),
);

const pluginApiVersion = manifest.dependencies["@oxlint/plugins"];

if (
  pluginApiVersion === undefined ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pluginApiVersion)
) {
  throw new Error(
    `@oxlint/plugins must use an exact dependency version, found ${pluginApiVersion ?? "missing"}.`,
  );
}

const { oxlint: oxlintVersion } = manifest.peerDependencies;

if (pluginApiVersion !== oxlintVersion) {
  throw new Error(
    `@oxlint/plugins ${pluginApiVersion} must match the pinned Oxlint ${oxlintVersion ?? "missing"}.`,
  );
}

const consumer = mkdtempSync(join(tmpdir(), "syzom-typescript-quality-"));

const tarballPath = join(consumer, "typescript-quality.tgz");

const run = (command: string, args: string[]): CommandResult => {
  const result = spawnSync(command, args, {
    cwd: consumer,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    stdout: result.stdout ?? "",
    status: result.status ?? 1,
  };
};

const expectSuccess = (label: string, result: CommandResult): void => {
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}\n${result.output}`);
  }
};

const expectFailure = (label: string, result: CommandResult, expectedText: string): void => {
  if (result.status === 0 || !result.output.includes(expectedText)) {
    throw new Error(`${label}: expected failure containing ${expectedText}\n${result.output}`);
  }
};

const expectErrorDiagnostic = (label: string, result: CommandResult, rule: string): void => {
  expectFailure(label, result, rule);

  // SAFETY: Oxlint's JSON reporter owns this stable diagnostic envelope; malformed output fails the assertions below rather than being accepted as a passing check.
  const report = JSON.parse(result.stdout) as DiagnosticOutput;

  const diagnostic = report.diagnostics.find((item) =>
    [item.code, item.category, item.message].some((text) => text?.includes(rule) === true),
  );

  if (diagnostic?.severity !== "error") {
    throw new Error(`${label}: expected an error-level diagnostic\n${result.output}`);
  }
};

const write = (path: string, content: string): void => writeFileSync(join(consumer, path), content);

const collectFiles = (directory: string, extension: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) files.push(...collectFiles(path, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(path);
  }

  return files;
};

const json = (path: string, value: JsonValue): void =>
  write(path, `${JSON.stringify(value, null, 2)}\n`);

// Deliberately no type-check/type-aware/deny-warnings flags: adopted config owns them.
const lint = (path: string): CommandResult =>
  run("node_modules/.bin/oxlint", ["--config", "oxlint.config.ts", path]);

const lintJson = (path: string): CommandResult =>
  run("node_modules/.bin/oxlint", ["--config", "oxlint.config.ts", "--format", "json", path]);

const configure = (preset: "" | "/effect"): void =>
  write(
    "oxlint.config.ts",
    `import { defineConfig } from "oxlint";
import config from "@syzom/typescript-quality/oxlint${preset}";
export default defineConfig({ ...config });
`,
  );

const negative = (path: string, content: string, expectedText: string): void => {
  write(path, content);
  expectErrorDiagnostic(path, lintJson(path), expectedText);
  // Full type-checking can inspect all files in the tsconfig, not just the lint target.
  rmSync(join(consumer, path));
};

try {
  execFileSync("pnpm", ["pack", "--out", tarballPath], {
    cwd: repository,
    stdio: "pipe",
  });

  const packageFiles = new Set(
    execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" })
      .split("\n")
      .filter((path) => path !== ""),
  );

  // SAFETY: The checked-in snapshot was validated by check:vendor before this packed boundary.
  const snapshot = JSON.parse(
    readFileSync(join(repository, "vendor/anti-slop/upstream.snapshot.json"), "utf8"),
  ) as { readonly files: Readonly<Record<string, string>> };

  const requiredVendorFiles = [
    "package/vendor/anti-slop/LICENSE",
    ...Object.keys(snapshot.files).map((path) => `package/vendor/anti-slop/upstream/${path}`),
  ];

  const omittedVendorFiles = requiredVendorFiles.filter((path) => !packageFiles.has(path));

  if (omittedVendorFiles.length > 0) {
    throw new Error(`Packed package omitted vendored files: ${omittedVendorFiles.join(", ")}`);
  }

  json("package.json", {
    name: "packed-consumer",
    private: true,
    type: "module",
    dependencies: {
      "@syzom/typescript-quality": `file:${tarballPath}`,
      ...toolVersions,
    },
  });
  expectSuccess(
    "consumer install",
    run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"]),
  );
  const installedPackage = realpathSync(join(consumer, "node_modules/@syzom/typescript-quality"));

  const declarationFiles = collectFiles(join(installedPackage, "dist"), ".d.ts");

  expectSuccess(
    "Published declaration graph",
    run("node_modules/.bin/tsc", [
      "--noEmit",
      "--pretty",
      "false",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--skipLibCheck",
      "false",
      ...declarationFiles,
    ]),
  );
  json("tsconfig-base-alias.json", {
    extends: "@syzom/typescript-quality/tsconfig",
    files: [],
  });
  expectSuccess(
    "Short tsconfig alias",
    run("node_modules/.bin/tsc", ["--showConfig", "--project", "tsconfig-base-alias.json"]),
  );
  json("tsconfig-effect-alias.json", {
    extends: "@syzom/typescript-quality/tsconfig/effect",
    files: [],
  });
  expectSuccess(
    "Short Effect tsconfig alias",
    run("node_modules/.bin/tsc", ["--showConfig", "--project", "tsconfig-effect-alias.json"]),
  );
  json("tsconfig.json", {
    extends: "@syzom/typescript-quality/tsconfig/effect.json",
    include: ["src/**/*.ts"],
  });
  json("biome.json", { extends: ["@syzom/typescript-quality/biome"] });
  mkdirSync(join(consumer, "src"));
  configure("");
  write(
    "src/valid.ts",
    `export function isNull(value: unknown): value is null {
  return value === null;
}

export function addCause(message: string, cause: unknown): string {
  void cause;

  return message;
}

export const answer: number = 42;
`,
  );
  expectSuccess(
    "Biome valid example",
    run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/valid.ts"]),
  );
  expectSuccess("Oxlint valid example", lint("src/valid.ts"));
  write("src/biome-severity.ts", 'export const node = document.querySelector("div")!;\n');
  expectErrorDiagnostic(
    "Inherited Biome severity",
    run("node_modules/.bin/biome", [
      "check",
      "--formatter-enabled=false",
      "--assist-enabled=false",
      "--reporter=json",
      "src/biome-severity.ts",
    ]),
    "noNonNullAssertion",
  );
  rmSync(join(consumer, "src/biome-severity.ts"));
  write("src/oxlint-severity.ts", "debugger;\nexport {};\n");
  expectErrorDiagnostic(
    "Inherited Oxlint severity",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--format",
      "json",
      "src/oxlint-severity.ts",
    ]),
    "no-debugger",
  );
  rmSync(join(consumer, "src/oxlint-severity.ts"));
  write(
    "src/unused-disable.ts",
    "// oxlint-disable-next-line no-debugger\nexport const safe = 1;\n",
  );
  expectErrorDiagnostic(
    "Unused disable severity",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--format",
      "json",
      "src/unused-disable.ts",
    ]),
    "Unused",
  );
  rmSync(join(consumer, "src/unused-disable.ts"));
  write(
    "src/exhaustive.ts",
    `export function label(value: "a" | "b"): string {
  switch (value) {
    case "a": return "A";
    case "b": return "B";
  }
}
`,
  );
  expectSuccess("Exhaustive union switch", lint("src/exhaustive.ts"));
  negative(
    "src/incomplete-switch.ts",
    `export function label(value: "a" | "b"): string {
  switch (value) {
    case "a": return "A";
    default: return "Other";
  }
}
`,
    "switch-exhaustiveness-check",
  );
  negative("src/type-error.ts", 'export const broken: number = "not a number";\n', "TS2322");
  negative(
    "src/unsafe.ts",
    "declare const unsafe: any;\nexport const value: string = unsafe;\n",
    "no-unsafe-assignment",
  );
  negative(
    "src/invalid-boundary.ts",
    "export function decode(input: unknown): string { return String(input); }\n",
    "no-unknown-parameters",
  );
  write(
    "src/assertions-valid.ts",
    `export const literal = { kind: "ready" } as const;

export const checked = { kind: "ready" } satisfies { kind: string };

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function exhaustive(value: "ready" | "done"): string {
  switch (value) {
    case "ready": return "Ready";
    case "done": return "Done";
    default: {
      const impossible: never = value;

      return impossible;
    }
  }
}
`,
  );
  expectSuccess("Narrowing, const, satisfies and proven never", lint("src/assertions-valid.ts"));

  for (const expression of [
    "value as never",
    "<never>value",
    "value as Impossible",
    "value as (Impossible)",
  ]) {
    negative(
      "src/assert-never.ts",
      `type Impossible = never;
export function impossible(value: string): never {
  // SAFETY: A comment must not bypass the assertion prohibition.
  return ${expression};
}
`,
      "no-never-type-assertion",
    );
  }

  for (const expression of [
    "value as unknown as string",
    "(value as unknown) as string",
    "value as any as string",
  ]) {
    negative(
      "src/assert-chain.ts",
      `export function launder(value: number): string {
  // SAFETY: A comment must not bypass the assertion prohibition.
  return ${expression};
}
`,
      "no-chained-type-assertions",
    );
  }

  negative(
    "src/scattered-typeof.ts",
    `export function display(value: string | number): string {
  return typeof value === "string" ? value : String(value);
}
`,
    "no-runtime-typeof",
  );
  negative(
    "src/filter-map.ts",
    "export const values = [1, 2, 3].filter((value) => value > 1).map((value) => value * 2);\n",
    "no-array-filter-map",
  );
  negative(
    "src/reducer-copy.ts",
    "export const values = [1, 2].reduce<number[]>((items, value) => items.concat(value), []);\n",
    "no-reduce-accumulator-copy",
  );
  negative(
    "src/accumulating-spread.ts",
    "export const values = [1, 2].reduce<number[]>((items, value) => [...items, value], []);\n",
    "no-accumulating-spread",
  );
  negative(
    "src/readable-spacing.ts",
    "export const first = 1;\nexport const second = 2;\n",
    "require-readable-spacing",
  );
  negative(
    "src/unnecessary-assertion.ts",
    'const value: string = "known";\n\n// SAFETY: The assertion is intentionally redundant to verify the compiler-backed lint rule.\nexport const text = value as string;\n',
    "no-unnecessary-type-assertion",
  );
  write(
    "src/complexity.ts",
    `export function tooComplex(value: number): number {
  let result = value;
${Array.from({ length: 20 }, (_, index) => `  if (result > ${index}) { result -= 1; }`).join("\n")}
  return result;
}
`,
  );
  expectFailure(
    "cognitive complexity",
    run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/complexity.ts"]),
    "noExcessiveCognitiveComplexity",
  );
  rmSync(join(consumer, "src/complexity.ts"));

  configure("/effect");
  write(
    "src/plugin-imports.ts",
    `import baseConfig from "@syzom/typescript-quality/oxlint";
import baseCompatibilityConfig from "@syzom/typescript-quality/oxlint/base.mjs";
import effectConfig from "@syzom/typescript-quality/oxlint/effect";
import genericPlugin from "@syzom/typescript-quality/anti-slop";
import canonicalPlugin from "@syzom/typescript-quality/anti-slop/canonical";
import effectPlugin from "@syzom/typescript-quality/anti-slop/effect";

export interface ShapeContract {
  readonly value: number;
}

export const configs = [baseConfig, baseCompatibilityConfig, effectConfig] as const;

export const plugins = [genericPlugin, canonicalPlugin, effectPlugin] as const;
`,
  );
  expectSuccess(
    "Effect Oxlint patch",
    run("node_modules/.bin/effect-tsgo", ["patch", "--oxlint", "--no-typescript"]),
  );
  expectSuccess(
    "Strict TypeScript plugin declaration imports",
    run("node_modules/.bin/tsc", ["--noEmit", "--pretty", "false"]),
  );
  expectSuccess("Plugin declaration import quality", lint("src/plugin-imports.ts"));
  write(
    "src/factory.ts",
    "export const counterFrom = (start: number): number => start;\nexport const makeCounter = counterFrom;\n",
  );
  write(
    "src/effect-valid.ts",
    `import * as Effect from "effect/Effect";
import { counterFrom } from "./factory.js";

export const program = Effect.succeed(counterFrom(1));
`,
  );
  expectSuccess("Effect and non-service factory example", lint("src/effect-valid.ts"));
  negative("src/type-error.ts", 'export const broken: number = "not a number";\n', "TS2322");
  negative(
    "src/effect-error-tag.ts",
    `import * as Effect from "effect/Effect";
declare const recover: Effect.Effect<number>;
declare const fail: Effect.Effect<number>;
export const recoverByTag = Effect.catch((error: { readonly _tag: "NotFound" }) => error._tag === "NotFound" ? recover : fail);
`,
    "no-manual-effect-error-tag",
  );
  negative(
    "src/manual-tag.ts",
    'declare const value: { readonly _tag: "Ready" };\nexport const ready = value._tag === "Ready";\n',
    "no-manual-tag-comparison",
  );
  negative(
    "src/manual-tagged-construction.ts",
    'export const ready = { _tag: "Ready", value: 1 };\n',
    "no-manual-tagged-construction",
  );
  negative(
    "src/service-constructor.ts",
    'import { makeCounter } from "./factory.js";\nexport const value = makeCounter(1);\n',
    "no-service-constructor-imports",
  );
  negative(
    "src/prefer-effect-match.ts",
    'declare const kind: "a" | "b" | "c";\nexport const value = kind === "a" ? 1 : kind === "b" ? 2 : 3;\n',
    "prefer-effect-match",
  );
  negative(
    "src/invalid-boundary.ts",
    "export function decode(input: unknown): string { return String(input); }\n",
    "no-unknown-parameters",
  );
  negative(
    "src/effect-floating.ts",
    `import * as Effect from "effect/Effect";
export const bad = () => {
  Effect.succeed(1);
  return Effect.succeed(2);
};
`,
    "floating-effect",
  );
  negative(
    "src/effect-unhandled.ts",
    `import type * as Effect from "effect/Effect";
declare const effect: Effect.Effect<number, "Boom">;
export const unhandled: () => Effect.Effect<number> = () => effect;
`,
    "missing-effect-error",
  );
  negative(
    "src/effect-unsafe-assertion.ts",
    `import type * as Effect from "effect/Effect";
declare const program: Effect.Effect<number, "Boom">;
export const hidden = program as Effect.Effect<number>;
`,
    "unsafe-effect-type-assertion",
  );
  negative(
    "src/effect-unknown-error.ts",
    `import * as Effect from "effect/Effect";
export const program = Effect.fail<unknown>("failure");
`,
    "any-unknown-in-error-context",
  );
  write(
    "oxlint.config.ts",
    `import { defineConfig } from "oxlint";
import baseConfig from "@syzom/typescript-quality/oxlint";

export default defineConfig({
  ...baseConfig,
  jsPlugins: [
    ...(baseConfig.jsPlugins ?? []),
    {
      name: "anti-slop-canonical",
      specifier: "@syzom/typescript-quality/anti-slop/canonical",
    },
  ],
  rules: {
    ...baseConfig.rules,
    "anti-slop-canonical/no-shape-in-symbol-names": "error",
  },
});
`,
  );
  negative(
    "src/canonical-shape.ts",
    "export interface ShapeContract { readonly value: number; }\n",
    "no-shape-in-symbol-names",
  );
  console.log("packed consumer validation passed");
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
