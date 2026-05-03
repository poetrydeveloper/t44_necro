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
		print("[GameService] 🏰 Сервис игры запущен");
		Players.CharacterAutoLoads = true;

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}
	}

	private async onPlayerAdded(player: Player) {
		let data = this.playerDataService.getPlayerData(player);
		let attempts = 0;
		while (!data && attempts < 50) {
			task.wait(0.1);
			data = this.playerDataService.getPlayerData(player);
			attempts++;
		}

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

		print(`[GameService] 🧙 ${player.Name} готов к бою!`);

		const spawnPos = this.getSpawnPosition();
		character.PivotTo(spawnPos);

		// Спавн живого скелета в 20 стедах от игрока
		task.delay(2, () => {
			const playerPos = rootPart.Position;
			const aliveSkeletonPos = new Vector3(
				playerPos.X + 20,
				playerPos.Y,
				playerPos.Z + 20
			);
			this.enemyService.spawnSkeleton(aliveSkeletonPos);
			print("[GameService] ⚔️ Живой скелет заспавнен рядом");
		});

		// Спавн мёртвого скелета (трупа) в 10 стедах от игрока
		task.delay(2.5, () => {
			const playerPos = rootPart.Position;
			const corpsePos = new Vector3(
				playerPos.X + 10,
				playerPos.Y,
				playerPos.Z + 15
			);
			this.enemyService.spawnCorpseAt(corpsePos);
			print("[GameService] 💀 Мёртвый скелет (труп) заспавнен рядом");
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