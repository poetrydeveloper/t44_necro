import { Service, OnStart } from "@flamework/core";
import { Players, Workspace } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";
import { EnemyService } from "./EnemyService";

@Service({})
export class GameService implements OnStart {
	constructor(
		private readonly playerDataService: PlayerDataService,
		private readonly enemyService: EnemyService,
	) {}

	onStart() {
		print("[GameService] 🏰 Сервис игры запущен (Стандартный режим)");

		// ВОЗВРАЩАЕМ ГЕРОЯ ПО УМОЛЧАНИЮ
		Players.CharacterAutoLoads = true;

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		
		// Для тех, кто уже в игре (при перезагрузке скрипта)
		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}
	}

	private async onPlayerAdded(player: Player) {
		// Ждём загрузки данных игрока
		let data = this.playerDataService.getPlayerData(player);
		let attempts = 0;
		while (!data && attempts < 50) {
			task.wait(0.1);
			data = this.playerDataService.getPlayerData(player);
			attempts++;
		}

		// Когда персонаж появится в мире
		player.CharacterAdded.Connect((character) => {
			this.onCharacterSpawned(player, character);
		});

		// Если персонаж уже есть
		if (player.Character) {
			this.onCharacterSpawned(player, player.Character);
		}
	}

	private onCharacterSpawned(player: Player, character: Model) {
		const rootPart = character.WaitForChild("HumanoidRootPart", 5) as BasePart;
		if (!rootPart) return;

		print(`[GameService] 🧙 ${player.Name} готов к бою!`);

		// Телепортируем на спавн, если нужно
		const spawnPos = this.getSpawnPosition();
		character.PivotTo(spawnPos);

		// ТЕСТОВЫЙ СПАВН ВРАГА
		task.delay(3, () => {
			const enemyPos = rootPart.Position.add(new Vector3(15, 0, 15));
			this.enemyService.spawnEnemy("skeleton", enemyPos);
			print("[GameService] ⚔️ Тестовый скелет заспавнен рядом со стандартным ГГ");
		});
	}

	private getSpawnPosition(): CFrame {
		const wellSpawn = Workspace.FindFirstChild("World")?.FindFirstChild("Locations")?.FindFirstChild("WellSpawn") as BasePart;
		if (wellSpawn) {
			return wellSpawn.CFrame.add(new Vector3(0, 5, 0));
		}
		return new CFrame(0, 10, 0);
	}
}
