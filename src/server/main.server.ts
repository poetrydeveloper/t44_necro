import { Flamework } from "@flamework/core";

print("🏰 NECROMANCER ROGUELITE - СЕРВЕР ЗАПУСКАЕТСЯ");

// ПРЯМОЙ ИМПОРТ КОМПОНЕНТОВ (решает проблему ArtificialDependency)
import "./components/EnemyComponent";
import "./components/LifeComponent";

// Добавляем пути для сервисов
Flamework.addPaths("src/server/services");

Flamework.ignite();

print("✅ СЕРВЕР ГОТОВ");
