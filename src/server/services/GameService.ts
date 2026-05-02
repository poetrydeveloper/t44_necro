import { Service, OnStart } from "@flamework/core";
import { Players, Workspace } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";

@Service({})
export class GameService implements OnStart {
	// Flamework автоматически внедрит PlayerDataService при создании
	constructor(private readonly playerDataService: PlayerDataService) {}

	onStart() {
		print("[GameService] 🏰 Сервис игры запущен");
		Players.CharacterAutoLoads = false;

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}
	}

	private async onPlayerAdded(player: Player) {
		// ВАЖНО: Ждем данные без task.wait, а через проверку
		let data = this.playerDataService.getPlayerData(player);
		let attempts = 0;

		while (!data && attempts < 50) { // Ждем до 5 секунд (50 * 0.1)
			task.wait(0.1);
			data = this.playerDataService.getPlayerData(player);
			attempts++;
		}

		if (data) {
			print(`[GameService] 👋 ${player.Name} загружен (Уровень ${data.stats.level})`);
		} else {
			warn(`[GameService] ⚠️ Не удалось загрузить данные для ${player.Name}`);
		}

		this.spawnPlayer(player);
	}

	private spawnPlayer(player: Player) {
		const character = new Instance("Model");
		character.Name = player.Name;

		const humanoid = new Instance("Humanoid");
		humanoid.Name = "Humanoid";
		humanoid.Parent = character;

		const rootPart = new Instance("Part");
		rootPart.Name = "HumanoidRootPart";
		rootPart.Size = new Vector3(2, 2, 1);
		rootPart.CanCollide = true;
		rootPart.Transparency = 1;
		rootPart.Parent = character;

		character.PrimaryPart = rootPart;

		const torso = new Instance("Part");
		torso.Name = "Torso";
		torso.Size = new Vector3(1.9, 1.9, 0.9);
		torso.Color = Color3.fromRGB(40, 20, 60);
		torso.CanCollide = false;
		torso.Parent = character;

		const torsoWeld = new Instance("Weld");
		torsoWeld.Part0 = rootPart;
		torsoWeld.Part1 = torso;
		torsoWeld.Parent = torso;

		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1.2, 1.2, 1.2);
		head.Color = Color3.fromRGB(220, 200, 150);
		head.CanCollide = false;
		head.Parent = character;

		const headWeld = new Instance("Weld");
		headWeld.Part0 = torso;
		headWeld.Part1 = head;
		headWeld.C0 = new CFrame(0, 1.5, 0);
		headWeld.Parent = head;

		const cloak = new Instance("Part");
		cloak.Name = "Cloak";
		cloak.Size = new Vector3(2.2, 2.5, 0.5);
		cloak.Color = Color3.fromRGB(100, 40, 120);
		cloak.CanCollide = false;
		cloak.Transparency = 0.2;
		cloak.Parent = character;

		const cloakWeld = new Instance("Weld");
		cloakWeld.Part0 = torso;
		cloakWeld.Part1 = cloak;
		cloakWeld.C0 = new CFrame(0, -0.2, 0.6);
		cloakWeld.Parent = cloak;

		const spawnPos = this.getSpawnPosition();
		character.PivotTo(spawnPos);

		character.Parent = Workspace;
		player.Character = character;
	}

	private getSpawnPosition(): CFrame {
		const wellSpawn = Workspace.FindFirstChild("WellSpawn") as BasePart | undefined;
		return wellSpawn ? wellSpawn.CFrame.add(new Vector3(0, 3, 0)) : new CFrame(0, 10, 0);
	}
}
