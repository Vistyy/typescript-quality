import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(new URL("..", import.meta.url).pathname);
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
  if (result.status === 0) {
    throw new Error(`${label} unexpectedly passed`);
  }
  if (expectedText !== undefined && !result.output.includes(expectedText)) {
    throw new Error(`${label} failed without ${expectedText}\n${result.output}`);
  }
};

try {
  writeFileSync(
    join(consumer, "package.json"),
    `${JSON.stringify({
      name: "packed-consumer",
      private: true,
      type: "module",
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
    }, null, 2)}\n`,
  );
  expectSuccess(
    "consumer install",
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]),
  );

  writeFileSync(
    join(consumer, "tsconfig.json"),
    `${JSON.stringify({
      extends: "@vistyy/typescript-quality/tsconfig/base.json",
      include: ["src/**/*.ts"],
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(consumer, "biome.json"),
    `${JSON.stringify({ extends: ["@vistyy/typescript-quality/biome"] }, null, 2)}\n`,
  );
  writeFileSync(
    join(consumer, "oxlint.config.ts"),
    `import baseConfig from "@vistyy/typescript-quality/oxlint";\nimport { defineConfig } from "oxlint";\n\nexport default defineConfig({\n  extends: [baseConfig]\n});\n`,
  );
  execFileSync("mkdir", ["-p", join(consumer, "src")]);
  writeFileSync(
    join(consumer, "src/valid.ts"),
    `export type UserShape = { id: string };\n\nexport function isUser(value: unknown): value is UserShape {\n  void value;\n  return true;\n}\n\nexport function addCause(message: string, cause: unknown): string {\n  void cause;\n  return message;\n}\n\nexport const answer: number = 42;\n`,
  );
  expectSuccess("Biome valid example", run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/valid.ts"]));
  expectSuccess(
    "Oxlint valid example",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "--report-unused-disable-directives",
      "src/valid.ts",
    ]),
  );

  writeFileSync(
    join(consumer, "src/complexity.ts"),
    `export function tooComplex(value: number): number {\n  let result = value;\n${Array.from({ length: 20 }, (_, index) => `  if (result > ${index}) { result -= 1; }`).join("\n")}\n  return result;\n}\n`,
  );
  expectFailure(
    "cognitive complexity example",
    run("node_modules/.bin/biome", ["check", "--error-on-warnings", "src/complexity.ts"]),
    "noExcessiveCognitiveComplexity",
  );

  writeFileSync(
    join(consumer, "src/unsafe.ts"),
    "declare const unsafe: any;\nexport const value: string = unsafe;\n",
  );
  expectFailure(
    "unsafe type example",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "src/unsafe.ts",
    ]),
    "no-unsafe-assignment",
  );

  writeFileSync(
    join(consumer, "src/invalid-boundary.ts"),
    "export function decode(input: unknown): string { return String(input); }\n",
  );
  expectFailure(
    "invalid unknown boundary",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "src/invalid-boundary.ts",
    ]),
    "no-unknown-parameters",
  );

  writeFileSync(
    join(consumer, "oxlint.config.ts"),
    `import effectConfig from "@vistyy/typescript-quality/oxlint/effect";\nimport { defineConfig } from "oxlint";\n\nexport default defineConfig({\n  extends: [effectConfig]\n});\n`,
  );
  writeFileSync(
    join(consumer, "src/effect-valid.ts"),
    `import * as Effect from "effect/Effect";\n\nexport const program = Effect.succeed(1);\n`,
  );
  expectSuccess("Effect Oxlint patch", run("node_modules/.bin/effect-tsgo", ["patch", "--oxlint"]));
  expectSuccess(
    "Effect valid example",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "src/effect-valid.ts",
    ]),
  );

  writeFileSync(
    join(consumer, "src/effect-floating.ts"),
    `import * as Effect from "effect/Effect";\n\nexport const bad = () => {\n  Effect.succeed(1);\n  return Effect.succeed(2);\n};\n`,
  );
  expectFailure(
    "floating Effect example",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "src/effect-floating.ts",
    ]),
    "floating-effect",
  );

  writeFileSync(
    join(consumer, "src/effect-unhandled.ts"),
    `import type * as Effect from "effect/Effect";\n\ndeclare const effect: Effect.Effect<number, "Boom">;\nexport const unhandled: () => Effect.Effect<number> = () => effect;\n`,
  );
  expectFailure(
    "unhandled Effect example",
    run("node_modules/.bin/oxlint", [
      "--config",
      "oxlint.config.ts",
      "--type-aware",
      "--type-check",
      "--deny-warnings",
      "src/effect-unhandled.ts",
    ]),
    "missing-effect-error",
  );

  console.log("packed consumer validation passed");
} finally {
  rmSync(consumer, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
