// src/client/main.client.ts
import { Flamework } from "@flamework/core";

print("--------------------------------------------------");
print("🧙‍♂️ NECROMANCER ROGUELITE - КЛИЕНТ ЗАПУСКАЕТСЯ");
print("--------------------------------------------------");

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ КОМПОНЕНТОВ
// =========================
import "./components/CorpseHighlightComponent";
import "./components/DamagePopupComponent";
import "./components/EnemyHealthBar";
import "./components/ProjectileComponent";

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ КОНТРОЛЛЕРОВ
// =========================
import "./controllers/AutoTargetController";
import "./controllers/CameraController";
import "./controllers/CorpseCollectionController";
import "./controllers/MovementController";

// =========================
// 📦 ПРЯМЫЕ ИМПОРТЫ UI
// =========================
import "./ui/TopStackPanel";
import "./ui/PlayerStatsPanel";


// Добавь UI коллекции
import "./ui/CollectionPanel";

Flamework.addPaths("src/client/controllers");
Flamework.addPaths("src/client/components");
Flamework.addPaths("src/client/ui");

Flamework.ignite();

print("✅ КЛИЕНТ: Все контроллеры загружены");
print("--------------------------------------------------");