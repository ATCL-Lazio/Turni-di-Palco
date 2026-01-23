const fs = require("fs/promises");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "apps", "mobile", "build");
  const destination = path.join(root, "apps", "pwa", "dist", "public", "mobile");

  try {
    // Ensure mobile is built first
    const srcStat = await fs.stat(source).catch(() => null);
    if (!srcStat || !srcStat.isDirectory()) {
      throw new Error(`Mobile build not found: ${source}. Run 'npm run build:mobile' first.`);
    }

    // Remove existing mobile directory in dist
    await fs.rm(destination, { recursive: true, force: true });
    
    // Create destination directory
    await fs.mkdir(destination, { recursive: true });
    
    // Copy all mobile build files
    await fs.cp(source, destination, { recursive: true });
    
    console.log(`Copied mobile build from ${source} to ${destination}`);
  } catch (err) {
    console.error("Error copying mobile files:", err.message);
    process.exit(1);
  }
}

main();
