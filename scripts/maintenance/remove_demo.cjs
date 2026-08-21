const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(srcDir, function (filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Remove isAllowedMockData import line completely if it's the only import
    content = content.replace(/import\s*\{\s*\n?\s*isAllowedMockData\s*,?\s*\n?\}\s*from\s*['`\"].*?['`\"];?\n/g, '');

    // Remove if it's imported with other things
    content = content.replace(/,\s*isAllowedMockData/g, '');
    content = content.replace(/isAllowedMockData\s*,/g, '');

    // Remove if (isAllowedMockData(user.role)) return ...
    content = content.replace(/\s*\/\/[^\n]*(?i:demo)[^\n]*\n\s*if\s*\([^)]*isAllowedMockData[^)]*\)\s*(?:return[^;]*;|return\s*\(\)\s*=>\s*{[^}]*}\s*;?)/g, '');

    // Remove single line if's
    content = content.replace(/\s*if\s*\([^)]*isAllowedMockData[^)]*\)\s*(?:return[^;]*;|return\s*\(\)\s*=>\s*{[^}]*}\s*;?)/g, '');

    // Catch multiline blocks:
    content = content.replace(/\s*\/\/[^\n]*(?i:demo)[^\n]*\n\s*if\s*\([^)]*isAllowedMockData[^)]*\)\s*\{[\s\S]*?\}/g, (match) => {
        // Find closing brace correctly
        return '';
    });
    content = content.replace(/\s*if\s*\([^)]*isAllowedMockData[^)]*\)\s*\{[\s\S]*?\}/g, (match) => {
        return '';
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Modified:', filePath);
    }
});
