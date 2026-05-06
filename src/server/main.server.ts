import { Flamework } from "@flamework/core";

print("🏰 NECROMANCER ROGUELITE - СЕРВЕР ЗАПУСКАЕТСЯ");

// 🛠 ПРЯМЫЕ ИМПОРТЫ КОМПОНЕНТОВ
import "./components/EnemyComponent";
import "./components/LifeComponent";
import "./components/CorpseComponent"; // <-- ДОБАВИТЬ ЭТУ СТРОКУ

// Добавляем пути для сервисов
Flamework.addPaths("src/server/services");

Flamework.ignite();

print("✅ СЕРВЕР ГОТОВ");