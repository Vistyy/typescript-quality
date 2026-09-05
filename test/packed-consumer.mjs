import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const packageTarball = execFileSync("npm", ["pack", "--silent"], {
  cwd: repository,
  encoding: "utf8",
}).trim().split(/\r?\n/).at(-1);
const tarballPath = join(repository, packageTarball);
const consumer = mkdtempSync(join(tmpdir(), "vistyy-typescript-quality-"));

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: consumer,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status ?? 1,
  };
};
const expectSuccess = (label, result) => {
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}\n${result.output}`);
  }
};
const expectFailure = (label, result, expectedText) => {
  if (result.status === 0 || !result.output.includes(expectedText)) {
    throw new Error(`${label}: expected failure containing ${expectedText}\n${result.output}`);
  }
};
const write = (path, content) => writeFileSync(join(consumer, path), content);
const json = (path, value) => write(path, `${JSON.stringify(value, null, 2)}\n`);
// Deliberately no type-check/type-aware/deny-warnings flags: adopted config owns them.
const lint = (path) => run("node_modules/.bin/oxlint", [
  "--config", "oxlint.config.ts", "--report-unused-disable-directives", path,
]);
const configure = (preset) => write("oxlint.config.ts", `import { defineConfig } from "oxlint";
import config from "@vistyy/typescript-quality/oxlint${preset}";
export default defineConfig({ ...config });
`);
const negative = (path, content, expectedText) => {
  write(path, content);
  expectFailure(path, lint(path), expectedText);
  // Full type-checking can inspect all files in the tsconfig, not just the lint target.
  rmSync(join(consumer, path));
};

try {
  json("package.json", {
    name: "packed-consumer", private: true, type: "module",
    dependencies: {
      "@vistyy/typescript-quality": `file:${tarballPath}`,
      "@biomejs/biome": "2.5.12",
      "@effect/tsgo": "0.41.0",
      "@oxlint/plugins": "1.81.0",
      effect: "4.0.0-rc.112",
      oxlint: "1.81.0",
      "oxlint-tsgolint": "7.0.2001",
      typescript: "7.0.2",
    },
  });
  expectSuccess("consumer install", run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]));
  json("tsconfig.json", {
    extends: "@vistyy/typescript-quality/tsconfig/base.json",
    include: ["src/**/*.ts"],
  });
  json("biome.json", { extends: ["@vistyy/typescript-quality/biome"] });
  mkdirSync(join(consumer, "src"));
  configure("");
  write("src/valid.ts", `export function isNull(value: unknown): value is null {
  return value === null;
}

export function addCause(message: string, cause: unknown): string {
  void cause;
  return message;
}

export const answer: number = 42;
`);
  expectSuccess("Biome valid example", run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/valid.ts"]));
  expectSuccess("Oxlint valid example", lint("src/valid.ts"));
  negative("src/type-error.ts", 'export const broken: number = "not a number";\n', "TS2322");
  negative("src/unsafe.ts", "declare const unsafe: any;\nexport const value: string = unsafe;\n", "no-unsafe-assignment");
  negative("src/invalid-boundary.ts", "export function decode(input: unknown): string { return String(input); }\n", "no-unknown-parameters");
  write("src/complexity.ts", `export function tooComplex(value: number): number {
  let result = value;
${Array.from({ length: 20 }, (_, index) => `  if (result > ${index}) { result -= 1; }`).join("\n")}
  return result;
}
`);
  expectFailure("cognitive complexity", run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/complexity.ts"]), "noExcessiveCognitiveComplexity");
  rmSync(join(consumer, "src/complexity.ts"));

  configure("/effect");
  expectSuccess("Effect Oxlint patch", run("node_modules/.bin/effect-tsgo", ["patch", "--oxlint", "--no-typescript"]));
  write("src/factory.ts", "export const makeCounter = (start: number): number => start;\n");
  write("src/effect-valid.ts", `import * as Effect from "effect/Effect";
import { makeCounter } from "./factory.js";
export const program = Effect.succeed(makeCounter(1));
`);
  expectSuccess("Effect and non-service factory example", lint("src/effect-valid.ts"));
  negative("src/type-error.ts", 'export const broken: number = "not a number";\n', "TS2322");
  negative("src/invalid-boundary.ts", "export function decode(input: unknown): string { return String(input); }\n", "no-unknown-parameters");
  negative("src/effect-floating.ts", `import * as Effect from "effect/Effect";
export const bad = () => {
  Effect.succeed(1);
  return Effect.succeed(2);
};
`, "floating-effect");
  negative("src/effect-unhandled.ts", `import type * as Effect from "effect/Effect";
declare const effect: Effect.Effect<number, "Boom">;
export const unhandled: () => Effect.Effect<number> = () => effect;
`, "missing-effect-error");
  console.log("packed consumer validation passed");
} finally {
  rmSync(consumer, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
