// src/server/services/GameService.ts
import { Service, OnStart } from "@flamework/core";
import { Players, Workspace, RunService } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";
import { EnemyService } from "./EnemyService";

@Service({})
export class GameService implements OnStart {
	constructor(
		private readonly playerDataService: PlayerDataService,
		private readonly enemyService: EnemyService,
	) {}

	onStart() {
		print("[GameService] 🏰 Сервис игры запущен");
		Players.CharacterAutoLoads = true;

		// Используем сигнал вместо цикла while
		this.playerDataService.onDataLoaded.Connect((player) => {
			this.onPlayerReady(player);
		});

		// На случай, если игрок зашел в микросекунду до подписки
		for (const player of Players.GetPlayers()) {
			const data = this.playerDataService.getPlayerData(player);
			if (data) this.onPlayerReady(player);
		}
	}

	private onPlayerReady(player: Player) {
		print(`[GameService] ✅ Игрок ${player.Name} загружен и готов.`);

		player.CharacterAdded.Connect((character) => {
			this.onCharacterSpawned(player, character);
		});

		if (player.Character) {
			this.onCharacterSpawned(player, player.Character);
		}
	}

	private onCharacterSpawned(player: Player, character: Model) {
		const rootPart = character.WaitForChild("HumanoidRootPart", 5) as BasePart;
		if (!rootPart) return;

		const spawnPos = this.getSpawnPosition();
		character.PivotTo(spawnPos);
		print(`[GameService] 🧙 ${player.Name} телепортирован на спавн.`);

		// Дебаг-спавн запускаем только в Studio
		if (RunService.IsStudio()) {
			this.spawnDebugEnemies(rootPart);
		}
	}

	/**
	 * Вынесенный дебаг-код для тестов в Studio
	 * 🛠 ОБНОВЛЕНО: Спавним 10 врагов по кругу для теста ИИ
	 */
	private spawnDebugEnemies(rootPart: BasePart) {
		task.defer(() => {
			const playerPos = rootPart.Position;
			const count = 10;       // Количество врагов
			const radius = 30;      // Радиус круга (студы)

			print(`[GameService] 🧪 Спавним ${count} тестовых врагов по кругу...`);

			for (let i = 0; i < count; i++) {
				// Вычисляем угол для равномерного распределения по кругу
				const angle = (i / count) * math.pi * 2;
				
				// Вычисляем позицию: смещение по кругу + подъем на 5 студов, чтобы не в полу
				const offset = new Vector3(math.cos(angle) * radius, 5, math.sin(angle) * radius);
				const pos = playerPos.add(offset);

				// Спавним врага
				const enemy = this.enemyService.spawnSkeleton(pos);
				
				if (enemy) {
					// 🛠 Немного увеличиваем здоровье для теста, чтобы бой был дольше
					const humanoid = enemy.FindFirstChildOfClass("Humanoid") as Humanoid;
					if (humanoid) {
						humanoid.MaxHealth = 100;
						humanoid.Health = 100;
					}
					print(`[GameService] ✅ Враг #${i+1} заспавнен`);
				}
			}
			print(`[GameService] 🎯 Все ${count} врагов готовы к бою!`);
		});
	}

	private getSpawnPosition(): CFrame {
		const world = Workspace.FindFirstChild("World");
		const locations = world?.FindFirstChild("Locations");
		const wellSpawn = locations?.FindFirstChild("WellSpawn") as BasePart;

		if (wellSpawn) {
			return wellSpawn.CFrame.add(new Vector3(0, 5, 0));
		}
		return new CFrame(0, 10, 0);
	}
}