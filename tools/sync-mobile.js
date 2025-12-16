const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

async function hashDirectory(dir) {
  const hash = crypto.createHash("sha256");

  async function walk(current, relativeBase = "") {
    const entries = await fs.readdir(current, { withFileTypes: true });
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const entryPath = path.join(current, entry.name);
      const relativePath = path.join(relativeBase, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath, relativePath);
      } else if (entry.isFile()) {
        hash.update(relativePath);
        const content = await fs.readFile(entryPath);
        hash.update(content);
      }
    }
  }

  await walk(dir);
  return hash.digest("hex");
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "apps", "mobile", "build");
  const destination = path.join(root, "apps", "pwa", "public", "mobile");
  const checksumFile = path.join(destination, ".mobile-checksum");

  try {
    const srcStat = await fs.stat(source).catch(() => null);
    if (!srcStat || !srcStat.isDirectory()) {
      throw new Error(`Sorgente mancante: ${source}. Esegui prima "npm run build:mobile".`);
    }

    const sourceHash = await hashDirectory(source);
    const destinationStat = await fs.stat(destination).catch(() => null);
    const existingHash = await fs.readFile(checksumFile, "utf8").then((value) => value.trim()).catch(() => null);

    if (destinationStat?.isDirectory() && existingHash && existingHash === sourceHash) {
      console.log("Bundle mobile già allineato: nessuna copia necessaria.");
      return;
    }

    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });
    await fs.cp(source, destination, { recursive: true });
    await fs.writeFile(checksumFile, sourceHash, "utf8");

    console.log(`Copiato bundle mobile da ${source} a ${destination} (checksum ${sourceHash.slice(0, 12)}...)`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
