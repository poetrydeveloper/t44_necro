const fs = require('fs');
const path = require('path');

const SUPERVISOR_PATH = __dirname;
const PROJECT_ROOT = path.join(SUPERVISOR_PATH, '..');
const SRC_PATH = path.join(PROJECT_ROOT, 'src');
const REPORT_FILE = path.join(SUPERVISOR_PATH, 'outcode', 'audit_report.md');

const CRITICAL_FILES = ['default.project.json', 'tsconfig.json', 'package.json'];
let reportData = `# Отчет проверки архитектуры (DI & ECS)\n\nДата: ${new Date().toLocaleString()}\n\n`;

function checkCriticalFiles() {
    reportData += `## 1. Системные файлы\n`;
    CRITICAL_FILES.forEach(file => {
        const exists = fs.existsSync(path.join(PROJECT_ROOT, file));
        reportData += `${exists ? '✅' : '❌'} ${file}\n`;
    });
    reportData += `\n`;
}

function analyzeTsFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(SRC_PATH, filePath);
    
    let issues = [];
    let classes = [];
    
    // 1. Поиск классов и методов
    const classMatches = content.matchAll(/class\s+(\w+)/g);
    for (const m of classMatches) classes.push(m[1]);

    const methodMatches = content.matchAll(/(?:public|private|protected|static)\s+(\w+)\s*\(/g);
    const methods = Array.from(methodMatches).map(m => m[1]);

    // 2. Проверка Dependency Injection (Flamework style)
    // Ищем использование глобальных сервисов Roblox напрямую (плохо для DI)
    if (content.includes('game.GetService') || content.includes('Workspace.')) {
        issues.push("⚠️ Прямое обращение к сервисам Roblox (используйте @Service или Dependency Injection)");
    }

    // Проверка на "ручное" создание зависимостей
    if (content.match(/new\s+(?!Vector3|CFrame|RaycastParams|Color3)\w+Service/)) {
        issues.push("🚫 Подозрение на создание сервиса через 'new' (нарушение DI)");
    }

    // 3. Проверка ECS (Logic in Components)
    if (relativePath.includes('components') && lines.length > 80) {
        issues.push("🧨 Компонент слишком тяжелый. Логика должна быть в Services/Systems.");
    }

    // 4. Лимит строк
    if (lines.length > 100) {
        issues.push(`📏 Размер файла: ${lines.length} строк (превышает лимит 100)`);
    }

    // Проверка парного .md
    if (!fs.existsSync(filePath.replace(/\.ts$/, '_exam.md'))) {
        issues.push("📝 Отсутствует файл контракта (_exam.md)");
    }

    if (issues.length > 0) {
        reportData += `### 📄 ${relativePath}\n`;
        if (classes.length > 0) reportData += `**Классы:** \`${classes.join(', ')}\`\n`;
        reportData += `**Проблемы:**\n- ${issues.join('\n- ')}\n\n`;
    }
}

function scan(dir) {
    fs.readdirSync(dir).forEach(item => {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            if (item !== "node_modules") scan(full);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
            analyzeTsFile(full);
        }
    });
}

try {
    checkCriticalFiles();
    reportData += `## 2. Анализ кода\n\n`;
    scan(SRC_PATH);
    fs.writeFileSync(REPORT_FILE, reportData);
    console.log(`✅ Аудит готов: Supervisor/outcode/audit_report.md`);
} catch (e) {
    console.error(`❌ Ошибка: ${e.message}`);
}
