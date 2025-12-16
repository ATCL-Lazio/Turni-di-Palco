const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'shared', 'styles', 'main.css');

const files = [
    path.join(rootDir, 'apps', 'mobile', 'src', 'styles', 'globals.css'),
    path.join(rootDir, 'apps', 'pwa', 'src', 'styles', 'tokens.css'),
    path.join(rootDir, 'apps', 'pwa', 'src', 'styles', 'layout.css'),
    path.join(rootDir, 'apps', 'pwa', 'src', 'style.css'),
    path.join(rootDir, 'apps', 'mobile', 'src', 'index.css')
];

let content = '';

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`Processing ${file}...`);
        let fileContent = fs.readFileSync(file, 'utf8');
        // Remove imports to avoid nesting issues or dead links
        fileContent = fileContent.replace(/@import\s+['"].*['"];/g, '');
        content += `\n/* Source: ${path.basename(file)} */\n`;
        content += fileContent + '\n';
    } else {
        console.warn(`Warning: File not found ${file}`);
    }
});

fs.writeFileSync(outputFile, content);
console.log(`Created ${outputFile} (${content.length} bytes)`);
