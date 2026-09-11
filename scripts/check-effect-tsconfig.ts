import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ErrorObject } from "ajv";

type JsonScalar = boolean | null | number | string;

type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

interface EffectPlugin {
  readonly [key: string]: JsonValue;
  readonly diagnosticSeverity: Readonly<{ [key: string]: JsonValue }>;
  readonly name: string;
}

interface EffectTsconfig {
  readonly compilerOptions: {
    readonly plugins: readonly [EffectPlugin];
  };
}

interface SchemaDefinitions extends Readonly<Record<string, AnySchema>> {
  readonly effectLanguageServicePluginDiagnosticSeverityDefinition?: AnySchema;
  readonly effectLanguageServicePluginOptionsDefinition?: AnySchema;
}

interface JsonSchema {
  readonly definitions: SchemaDefinitions;
}

const require = createRequire(import.meta.url);

const schemaPath = join(dirname(require.resolve("@effect/tsgo/package.json")), "schema.json");

const schemaContent = await readFile(schemaPath, "utf8");

// SAFETY: The installed package owns this JSON schema; Ajv validates its use below.
const schema = JSON.parse(schemaContent) as JsonSchema & AnySchema;

const configPath = fileURLToPath(new URL("../tsconfig/effect.json", import.meta.url));

const configContent = await readFile(configPath, "utf8");

// SAFETY: The complete document and its Effect plugin object are validated before use.
const config = JSON.parse(configContent) as EffectTsconfig;

const effectOptions = schema.definitions.effectLanguageServicePluginOptionsDefinition;

if (effectOptions === undefined || effectOptions === true || effectOptions === false) {
  throw new Error("Installed @effect/tsgo schema omitted its language-service options definition.");
}

// SAFETY: The installed options schema has been narrowed to its object form above.
const effectOptionProperties = (
  effectOptions as { readonly properties?: Readonly<Record<string, AnySchema>> }
).properties;

const diagnosticSeverity =
  schema.definitions.effectLanguageServicePluginDiagnosticSeverityDefinition;

if (
  diagnosticSeverity === undefined ||
  diagnosticSeverity === true ||
  diagnosticSeverity === false
) {
  throw new Error("Installed @effect/tsgo schema omitted its diagnostic-severity definition.");
}

const pluginSchema: AnySchema = {
  ...effectOptions,
  definitions: {
    ...schema.definitions,
    effectLanguageServicePluginDiagnosticSeverityDefinition: {
      ...diagnosticSeverity,
      additionalProperties: false,
    },
  },
  properties: {
    ...effectOptionProperties,
    name: { const: "@effect/language-service", type: "string" },
  },
  required: ["name"],
};

const ajv = new Ajv({ allErrors: true, strict: false });

const validateTsconfig = ajv.compile(schema);

const validatePlugin = ajv.compile(pluginSchema);

const describeErrors = (errors: null | undefined | readonly ErrorObject[]): string =>
  errors?.map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`).join("; ") ??
  "unknown validation error";

if (validateTsconfig(config) !== true) {
  throw new Error(
    `tsconfig/effect.json does not match @effect/tsgo 0.45.0 schema: ${describeErrors(validateTsconfig.errors)}`,
  );
}

const plugin = config.compilerOptions.plugins[0];

if (validatePlugin(plugin) !== true) {
  throw new Error(
    `tsconfig/effect.json has an invalid Effect plugin: ${describeErrors(validatePlugin.errors)}`,
  );
}

const expectInvalidPlugin = (label: string, candidate: Readonly<EffectPlugin>): void => {
  if (validatePlugin(candidate) === true) {
    throw new Error(`${label} unexpectedly matched the installed Effect plugin schema.`);
  }
};

expectInvalidPlugin("wrong plugin name", { ...plugin, name: "@effect/not-language-service" });

expectInvalidPlugin("unknown plugin option", { ...plugin, inventedOption: true });

expectInvalidPlugin("unknown diagnosticSeverity key", {
  ...plugin,
  diagnosticSeverity: {
    ...plugin.diagnosticSeverity,
    inventedDiagnostic: "error",
  },
});

try {
  JSON.parse(`${configContent.slice(0, -2)},`);
  throw new Error("Malformed Effect tsconfig unexpectedly parsed.");
} catch (error) {
  if (!(error instanceof SyntaxError)) throw error;
}

console.log("Effect tsconfig and discriminating schema mutations verified against @effect/tsgo.");
