import { Service, OnStart } from "@flamework/core";
import { Workspace, HttpService } from "@rbxts/services";
import { EnemyPresets, EnemyData } from "shared/types/EnemyTypes";

export interface ActiveEnemy {
	instance: Model;
	data: EnemyData;
	humanoid: Humanoid;
	rootPart: BasePart;
}

@Service({})
export class EnemyService implements OnStart {
	private activeEnemies = new Map<string, ActiveEnemy>();
	
	onStart() {
		print("[EnemyService] 👹 Система врагов запущена");
	}
	
	public spawnSkeleton(position: Vector3): string {
		return this.spawnEnemy("skeleton", position, 1);
	}
	
	/**
	 * Найти врага по его уникальному ID
	 */
	public getEnemyById(enemyId: string): ActiveEnemy | undefined {
		return this.activeEnemies.get(enemyId);
	}

	/**
	 * Найти ближайшего живого врага в радиусе.
	 * Мы используем forEach вместо Map.values(), чтобы избежать ошибок компиляции.
	 */
	public getNearestEnemy(position: Vector3, maxDistance: number = 50): ActiveEnemy | undefined {
		let nearest: ActiveEnemy | undefined;
		let nearestDist = maxDistance;
		
		this.activeEnemies.forEach((enemy) => {
			if (!enemy.instance.Parent || enemy.humanoid.Health <= 0) return;
			
			const dist = enemy.rootPart.Position.sub(position).Magnitude;
			if (dist < nearestDist) {
				nearestDist = dist;
				nearest = enemy;
			}
		});
		
		return nearest;
	}
	
	public spawnEnemy(enemyType: string, position: Vector3, level: number = 1): string {
		const preset = EnemyPresets[enemyType];
		if (!preset) {
			warn(`[EnemyService] ❌ Неизвестный тип врага: ${enemyType}`);
			return "";
		}
		
		const model = new Instance("Model");
		const enemyId = HttpService.GenerateGUID(false);
		model.Name = enemyId;
		
		const humanoid = new Instance("Humanoid");
		humanoid.Name = "Humanoid";
		humanoid.MaxHealth = preset.health;
		humanoid.Health = preset.health;
		humanoid.WalkSpeed = preset.walkSpeed;
		humanoid.Parent = model;
		
		const rootPart = new Instance("Part");
		rootPart.Name = "HumanoidRootPart";
		rootPart.Size = new Vector3(2, 2, 1);
		rootPart.CanCollide = true;
		rootPart.Transparency = 1;
		rootPart.Parent = model;
		
		model.PrimaryPart = rootPart;
		
		const body = new Instance("Part");
		body.Name = "Body";
		body.Size = new Vector3(1.4, 1.9, 0.9);
		body.Color = Color3.fromRGB(80, 80, 80);
		body.CanCollide = false;
		body.Parent = model;
		
		const bodyWeld = new Instance("Weld");
		bodyWeld.Part0 = rootPart;
		bodyWeld.Part1 = body;
		bodyWeld.Parent = body;
		
		const head = new Instance("Part");
		head.Name = "Head";
		head.Size = new Vector3(1.2, 1.2, 1.2);
		head.Color = Color3.fromRGB(200, 200, 200);
		head.CanCollide = false;
		head.Parent = model;
		
		const headWeld = new Instance("Weld");
		headWeld.Part0 = body;
		headWeld.Part1 = head;
		headWeld.C0 = new CFrame(0, 1.2, 0);
		headWeld.Parent = head;
		
		model.PivotTo(new CFrame(position));
		model.Parent = Workspace.FindFirstChild("World")?.FindFirstChild("Enemies") || Workspace;
		
		this.activeEnemies.set(enemyId, {
			instance: model,
			data: preset,
			humanoid: humanoid,
			rootPart: rootPart,
		});
		
		humanoid.Died.Connect(() => {
			this.onEnemyDeath(enemyId, model);
		});
		
		return enemyId;
	}
	
	private onEnemyDeath(enemyId: string, model: Model) {
		this.activeEnemies.delete(enemyId);
		this.spawnCorpse(model);
		model.Destroy();
	}
	
	private spawnCorpse(model: Model) {
		const rootPart = model.PrimaryPart;
		if (!rootPart) return;
		
		const corpse = new Instance("Part");
		corpse.Name = "Corpse";
		corpse.Size = new Vector3(2, 0.5, 1);
		corpse.Color = Color3.fromRGB(60, 40, 30);
		corpse.CanCollide = true;
		corpse.Anchored = true;
		corpse.Position = rootPart.Position.sub(new Vector3(0, 0.8, 0));
		corpse.Parent = Workspace.FindFirstChild("World")?.FindFirstChild("Corpses") || Workspace;
		
		corpse.SetAttribute("IsCorpse", true);
		
		task.delay(45, () => {
			if (corpse && corpse.Parent) corpse.Destroy();
		});
	}

	/**
	 * Безопасный способ получить всех врагов без ошибок типизации Map.values()
	 */
	public getAllEnemies(): ActiveEnemy[] {
		const result: ActiveEnemy[] = [];
		this.activeEnemies.forEach((enemy) => result.push(enemy));
		return result;
	}
}
