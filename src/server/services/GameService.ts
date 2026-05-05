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
	 */
	private spawnDebugEnemies(rootPart: BasePart) {
		task.delay(2, () => {
			const playerPos = rootPart.Position;
			const aliveSkeletonPos = playerPos.add(new Vector3(20, 0, 20));
			this.enemyService.spawnSkeleton(aliveSkeletonPos);
			print("[DEBUG] ⚔️ Живой скелет заспавнен рядом");
		});

		task.delay(2.5, () => {
			const playerPos = rootPart.Position;
			const corpsePos = playerPos.add(new Vector3(10, 0, 15));
			
			print("[DEBUG] 💀 Мёртвый скелет (труп) заспавнен рядом");
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
