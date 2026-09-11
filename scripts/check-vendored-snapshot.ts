import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

interface Snapshot {
  readonly files: Readonly<Record<string, string>>;
  readonly revision: string;
}

const expectedRevision = "c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b";

const expectedLicenseHash = "10ed33bf340d6d63dc0633dfc917a346b369b6aa41fe20734aefc6a3fb75ba17";

const vendorRoot = fileURLToPath(new URL("../vendor/anti-slop/upstream/", import.meta.url));

const licenseUrl = new URL("../vendor/anti-slop/LICENSE", import.meta.url);

const manifestUrl = new URL("../vendor/anti-slop/upstream.snapshot.json", import.meta.url);

const manifestContent = await readFile(manifestUrl, "utf8");

// SAFETY: This checked-in release manifest is validated below against its exact revision, complete file set, and SHA-256 digest shape.
const snapshot = JSON.parse(manifestContent) as Snapshot;

if (snapshot.revision !== expectedRevision) {
  throw new Error(`Expected anti-slop snapshot ${expectedRevision}, found ${snapshot.revision}.`);
}

const licenseHash = createHash("sha256")
  .update(await readFile(licenseUrl))
  .digest("hex");

if (licenseHash !== expectedLicenseHash) {
  throw new Error(
    `Vendored anti-slop LICENSE drifted: expected ${expectedLicenseHash}, found ${licenseHash}.`,
  );
}

const actualFiles: string[] = [];

const collectFiles = async (directory: string, relativeDirectory: string): Promise<void> => {
  const entries = await readdir(directory, { withFileTypes: true });

  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

  for (const entry of entries) {
    const relativePath =
      relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(absolutePath, relativePath);
    } else if (entry.isFile()) {
      actualFiles.push(relativePath);
    } else {
      throw new Error(`Unsupported entry in vendored snapshot: ${relativePath}`);
    }
  }
};

await collectFiles(vendorRoot, "");

const expectedFiles = Object.keys(snapshot.files).sort((left, right) =>
  left.localeCompare(right, "en"),
);

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(
    `Vendored anti-slop file set drifted from ${expectedRevision}.\nExpected: ${expectedFiles.join(", ")}\nActual: ${actualFiles.join(", ")}`,
  );
}

for (const relativePath of actualFiles) {
  const expectedHash = snapshot.files[relativePath];

  if (!/^[0-9a-f]{64}$/.test(expectedHash ?? "")) {
    throw new Error(`Invalid recorded SHA-256 for ${relativePath}.`);
  }

  const content = await readFile(join(vendorRoot, relativePath));
  const actualHash = createHash("sha256").update(content).digest("hex");

  if (actualHash !== expectedHash) {
    throw new Error(
      `Vendored anti-slop file ${relativePath} drifted from ${expectedRevision}: expected ${expectedHash}, found ${actualHash}.`,
    );
  }
}

console.log(
  `Vendored anti-slop LICENSE and snapshot ${expectedRevision} verified (${actualFiles.length} upstream files).`,
);
