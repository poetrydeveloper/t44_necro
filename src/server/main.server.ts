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
import "./components/ProjectileComponent";

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ СЕРВИСОВ
// =========================
import "./services/EnemyService";
import "./services/GameService";
import "./services/PlayerDataService";
import "./services/CombatService";
import "./services/ResurrectionService";
import "./services/UnitBehaviorService";
import "./services/UnitIndicatorService";
import "./services/StatsUpdateService";
import "./services/ProgressionService";
import "./services/InvisibleFloorService";
import "./services/SummonBuilder";
import "./services/CollectionService";
import "./services/SoulWeightService";
import "./services/CorpseManagerService"; // ✅ ДОБАВЛЕНО

// Автоматическая регистрация
Flamework.addPaths("src/server/services");
Flamework.addPaths("src/server/components");

Flamework.ignite();

print("✅ СЕРВЕР ГОТОВ");