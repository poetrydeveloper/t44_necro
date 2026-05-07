// src/server/main.server.ts
import { Flamework } from "@flamework/core";

print("🏰 NECROMANCER ROGUELITE - СЕРВЕР ЗАПУСКАЕТСЯ");

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ КОМПОНЕНТОВ
// =========================
import "./components/EnemyComponent";
import "./components/LifeComponent";
import "./components/CorpseComponent";
import "./components/SummonComponent";

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ СЕРВИСОВ (ГАРАНТИЯ ЗАГРУЗКИ)
// =========================
import "./services/EnemyService";
import "./services/GameService";
import "./services/PlayerDataService";
import "./services/CombatService";
import "./services/ResurrectionService";
import "./services/UnitBehaviorService"; // 🛠 ДОБАВЛЕНО: Логика поведения юнитов

// Автоматическая регистрация (на случай, если добавишь новые сервисы позже)
Flamework.addPaths("src/server/services");
Flamework.addPaths("src/server/components");

Flamework.ignite();

print("✅ СЕРВЕР ГОТОВ");