// client/main.client.ts
import { Flamework } from "@flamework/core";

print("--------------------------------------------------");
print("🧙‍♂️ NECROMANCER ROGUELITE - КЛИЕНТ ЗАПУСКАЕТСЯ");
print("--------------------------------------------------");

Flamework.addPaths("src/client/controllers");
Flamework.addPaths("src/client/managers");

Flamework.ignite();

print("✅ КЛИЕНТ: Все контроллеры загружены");
print("--------------------------------------------------");