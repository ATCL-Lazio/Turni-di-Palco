const fs = require("fs/promises");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "UI", "build");
  const destination = path.join(root, "apps", "pwa", "public", "mobile");

  try {
    const srcStat = await fs.stat(source).catch(() => null);
    if (!srcStat || !srcStat.isDirectory()) {
      throw new Error(`Sorgente mancante: ${source}. Esegui prima "npm run build:mobile".`);
    }

    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });
    await fs.cp(source, destination, { recursive: true });

    console.log(`Copiato bundle mobile da ${source} a ${destination}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
