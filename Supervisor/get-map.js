const fs = require('fs');
const path = require('path');

// Теперь пути ведут внутрь директории Supervisor
const SUPERVISOR_PATH = __dirname; 
const PROJECT_ROOT = path.join(SUPERVISOR_PATH, '..');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');

// Папка outcode теперь внутри Supervisor
const OUT_PATH = path.join(SUPERVISOR_PATH, 'outcode');
const MAP_FILE = path.join(OUT_PATH, 'map.md');

function generateMap(dir, depth = 0) {
    if (!fs.existsSync(dir)) return "";
    let result = "";
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        if (item === "node_modules" || item === ".git") return;

        const fullPath = path.join(dir, item);
        const isDirectory = fs.statSync(fullPath).isDirectory();
        const indent = "  ".repeat(depth);
        
        if (isDirectory) {
            result += `${indent}- 📁 **${item}**\n`;
            result += generateMap(fullPath, depth + 1);
        } else {
            const ext = path.extname(item);
            if (ext === ".ts" && !item.endsWith(".d.ts")) {
                const mdFile = fullPath.replace(/\.ts$/, "_exam.md");
                const hasMd = fs.existsSync(mdFile);
                result += `${indent}- 📄 ${item} ${hasMd ? "✅" : "❌ (нет .md)"}\n`;
            }
        }
    });
    return result;
}

try {
    // Создаем Supervisor/outcode если её нет
    if (!fs.existsSync(OUT_PATH)) {
        fs.mkdirSync(OUT_PATH, { recursive: true });
    }

    const mapContent = `# Карта проекта\n\n` + 
                       `Путь: ${SRC_PATH}\n` +
                       `Дата: ${new Date().toLocaleString()}\n\n` +
                       `## Структура SRC\n\n` + 
                       generateMap(SRC_PATH);

    fs.writeFileSync(MAP_FILE, mapContent);
    console.log(`\x1b[32m✅ Карта создана здесь: Supervisor/outcode/map.md\x1b[0m`);
} catch (err) {
    console.error(`\x1b[31m❌ Ошибка: ${err.message}\x1b[0m`);
}