// src/server/services/GameService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, RunService } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";
import { EnemyService } from "./EnemyService";

@Service({})
export class GameService implements OnStart {
	private components!: Components;

	constructor(
		private readonly playerDataService: PlayerDataService,
		private readonly enemyService: EnemyService,
	) {}

	onStart() {
		print("[GameService] 🏰 Сервис игры запущен");
		
		Players.CharacterAutoLoads = true;
		this.components = Dependency<Components>();

		this.playerDataService.onDataLoaded.Connect((player) => {
			this.onPlayerReady(player);
		});

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

		if (RunService.IsStudio()) {
			this.spawnDebugEnemies(rootPart);
		}
	}

	private spawnDebugEnemies(rootPart: BasePart) {
		task.defer(() => {
			const playerPos = rootPart.Position;
			const count = 10;
			const radius = 30;

			print(`[GameService] 🧪 Спавним ${count} тестовых врагов по кругу...`);

			for (let i = 0; i < count; i++) {
				const angle = (i / count) * math.pi * 2;
				const offset = new Vector3(math.cos(angle) * radius, 5, math.sin(angle) * radius);
				const pos = playerPos.add(offset);

				const enemy = this.enemyService.spawnSkeleton(pos);
				
				if (enemy) {
					const humanoid = enemy.FindFirstChildOfClass("Humanoid") as Humanoid;
					if (humanoid) {
						humanoid.MaxHealth = 100;
						humanoid.Health = 100;
						
						// Сетевое владение для врагов (только после добавления в Workspace)
						task.defer(() => {
							for (const child of enemy.GetDescendants()) {
								if (child.IsA("BasePart") && !child.Anchored) {
									child.SetNetworkOwner(undefined);
								}
							}
						});
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