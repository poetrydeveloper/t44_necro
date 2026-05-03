import { Service, OnStart } from "@flamework/core";
import { 
	Workspace, 
	HttpService, 
	ReplicatedStorage, 
	Players, 
	CollectionService 
} from "@rbxts/services";
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
	private skeletonTemplate: Model | undefined;
	
	onStart() {
		print("[EnemyService] 👹 Система врагов запущена");
		// Небольшая задержка, чтобы Workspace успел прогрузиться
		task.wait(1);
		this.loadTemplates();
	}
	
	private loadTemplates() {
		const enemiesFolder = Workspace.FindFirstChild("Enemies") as Folder;
		let template = enemiesFolder?.FindFirstChild("SkeletonWarrior") as Model;
		
		if (!template) {
			template = Workspace.FindFirstChild("SkeletonWarrior") as Model;
		}
		
		if (template) {
			this.skeletonTemplate = template.Clone();
			this.skeletonTemplate.Parent = ReplicatedStorage;
			print("[EnemyService] 🎯 Шаблон SkeletonWarrior успешно загружен");
		} else {
			warn("[EnemyService] ⚠️ ОШИБКА: SkeletonWarrior не найден. Проверьте папку Enemies в Workspace.");
		}
	}
	
	public getEnemyById(enemyId: string): ActiveEnemy | undefined {
		return this.activeEnemies.get(enemyId);
	}
	
	public getNearestEnemy(position: Vector3, maxDistance: number): ActiveEnemy | undefined {
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
	
	public spawnSkeleton(position: Vector3): string {
		const preset = EnemyPresets.skeleton;
		
		if (!this.skeletonTemplate) {
			warn("[EnemyService] ❌ Спавн невозможен: шаблон отсутствует");
			return "";
		}
		
		const model = this.skeletonTemplate.Clone();
		const enemyId = HttpService.GenerateGUID(false);
		model.Name = `${preset.modelName}_${enemyId.sub(1, 6)}`;
		
		const humanoid = model.FindFirstChildOfClass("Humanoid") || new Instance("Humanoid", model);
		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart;
		
		if (!rootPart) {
			model.Destroy();
			warn("[EnemyService] ❌ Ошибка: у модели врага нет HumanoidRootPart");
			return "";
		}

		// --- ПРИВЯЗКА ТЕГА ДЛЯ ПОЛОСКИ ХП (ВАЖНО) ---
		CollectionService.AddTag(model, "Enemy");
		
		humanoid.MaxHealth = preset.maxHealth;
		humanoid.Health = preset.health;
		humanoid.WalkSpeed = preset.walkSpeed;
		
		model.PrimaryPart = rootPart;
		model.PivotTo(new CFrame(position));
		
		const enemiesParent = Workspace.FindFirstChild("Enemies") || Workspace;
		model.Parent = enemiesParent;
		
		this.activeEnemies.set(enemyId, {
			instance: model,
			data: { ...preset },
			humanoid: humanoid,
			rootPart: rootPart,
		});
		
		this.startEnemyAI(model, humanoid, rootPart, preset);
		
		humanoid.Died.Connect(() => {
			this.onEnemyDeath(enemyId, model);
		});
		
		print(`[EnemyService] 🧟 ${preset.name} заспавнен`);
		return enemyId;
	}
	
	private startEnemyAI(model: Model, humanoid: Humanoid, rootPart: BasePart, preset: EnemyData) {
		let lastAttackTime = 0;
		const attackCooldown = 1 / preset.attackSpeed;
		
		task.spawn(() => {
			while (model.Parent && humanoid.Health > 0) {
				task.wait(0.2); // AI работает 5 раз в секунду (оптимально)
				
				let nearestPlayerChar: Model | undefined;
				let nearestDist = 50; // Дистанция агро (можно вынести в preset)
				
				for (const player of Players.GetPlayers()) {
					const char = player.Character;
					if (!char) continue;
					
					const pRoot = char.FindFirstChild("HumanoidRootPart") as BasePart;
					if (!pRoot) continue;
					
					const dist = rootPart.Position.sub(pRoot.Position).Magnitude;
					if (dist < nearestDist) {
						nearestDist = dist;
						nearestPlayerChar = char;
					}
				}
				
				if (nearestPlayerChar) {
					const targetPos = nearestPlayerChar.GetPivot().Position;
					
					if (nearestDist <= preset.attackRange) {
						// В зоне атаки: останавливаемся и бьем
						humanoid.MoveTo(rootPart.Position); 
						
						const now = os.clock();
						if (now - lastAttackTime >= attackCooldown) {
							lastAttackTime = now;
							const targetHumanoid = nearestPlayerChar.FindFirstChildOfClass("Humanoid");
							if (targetHumanoid) {
								targetHumanoid.TakeDamage(preset.damage);
								print(`[EnemyService] ⚔️ Враг ударил игрока на ${preset.damage}`);
							}
						}
					} else {
						// Вне зоны атаки: бежим к игроку
						humanoid.MoveTo(targetPos);
					}
				}
			}
		});
	}
	
	public spawnCorpseAt(position: Vector3): BasePart {
		const corpse = new Instance("Part");
		corpse.Name = "Corpse";
		corpse.Size = new Vector3(2.5, 0.5, 1.5);
		corpse.Color = Color3.fromRGB(60, 40, 30);
		corpse.Material = Enum.Material.Slate;
		corpse.CanCollide = true;
		corpse.Anchored = true;
		corpse.Position = position;
		
		const corpsesParent = Workspace.FindFirstChild("Corpses") || Workspace;
		corpse.Parent = corpsesParent;
		
		corpse.SetAttribute("IsCorpse", true);
		corpse.SetAttribute("SoulWeight", 50);
		
		return corpse;
	}
	
	public getNearestCorpse(position: Vector3, radius: number): BasePart | undefined {
		let nearest: BasePart | undefined;
		let nearestDist = radius;
		
		const corpsesParent = Workspace.FindFirstChild("Corpses") || Workspace;
		for (const child of corpsesParent.GetChildren()) {
			if (child.IsA("Part") && child.Name === "Corpse" && child.GetAttribute("IsCorpse") === true) {
				const dist = child.Position.sub(position).Magnitude;
				if (dist < nearestDist) {
					nearestDist = dist;
					nearest = child;
				}
			}
		}
		return nearest;
	}
	
	public removeCorpse(corpse: BasePart) {
		corpse.Destroy();
	}
	
	private onEnemyDeath(enemyId: string, model: Model) {
		const enemy = this.activeEnemies.get(enemyId);
		this.activeEnemies.delete(enemyId);
		
		if (enemy) {
			print(`[EnemyService] 💀 ${enemy.data.name} повержен!`);
		}
		
		const rootPart = model.PrimaryPart;
		if (rootPart) {
			this.spawnCorpseAt(rootPart.Position);
		}
		
		// Удаляем модель через 2 секунды после смерти
		task.delay(2, () => {
			if (model && model.Parent) model.Destroy();
		});
	}
	
	public getAllEnemies(): ActiveEnemy[] {
		const result: ActiveEnemy[] = [];
		this.activeEnemies.forEach((enemy) => result.push(enemy));
		return result;
	}
}
