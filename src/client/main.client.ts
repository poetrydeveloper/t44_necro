import { Flamework } from "@flamework/core";

// Приветственное сообщение в консоли Studio
print("--------------------------------------------------");
print("🧙‍♂️ NECROMANCER ROGUELITE - КЛИЕНТ ЗАПУСКАЕТСЯ");
print("--------------------------------------------------");

/**
 * Flamework.addPaths сканирует папки и ищет классы с декораторами @Controller.
 * Мы указываем пути относительно корня проекта.
 */
Flamework.addPaths("src/client/controllers");
Flamework.addPaths("src/client/managers");

/**
 * ignite() запускает жизненный цикл Flamework:
 * 1. Вызывает onInit() у всех контроллеров.
 * 2. Вызывает onStart() у всех контроллеров.
 */
Flamework.ignite();

print("✅ КЛИЕНТ: Все контроллеры и менеджеры запущены");
print("--------------------------------------------------");
