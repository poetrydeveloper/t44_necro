import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components"; // Импортируем типы компонентов
import { Workspace, HttpService, ReplicatedStorage, Players, CollectionService } from "@rbxts/services";
import { EnemyPresets, EnemyData } from "shared/types/EnemyTypes";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";

@Service({})
export class EnemyService implements OnStart {
	private skeletonTemplate?: Model;
	
	// Используем официальный макрос Flamework для получения сервиса компонентов
	private components = Dependency<Components>();

	onStart() {
		print("[EnemyService] 👹 Система врагов запущена");
		task.wait(1);
		this.loadTemplates();
	}

	// =========================
	// 📦 ЗАГРУЗКА ШАБЛОНОВ
	// =========================
	private loadTemplates() {
		const enemiesFolder = Workspace.FindFirstChild("World")?.FindFirstChild("Enemies") as Folder;
		let template = enemiesFolder?.FindFirstChild("SkeletonWarrior") as Model;

		if (!template) {
			template = Workspace.FindFirstChild("SkeletonWarrior") as Model;
		}

		if (!template) {
			warn("[EnemyService] ❌ SkeletonWarrior НЕ найден");
			return;
		}

		this.skeletonTemplate = template.Clone();
		this.skeletonTemplate.Parent = ReplicatedStorage;

		print("[EnemyService] ✅ Шаблон SkeletonWarrior загружен");
	}

	// =========================
	// 🎯 ПОИСК ВРАГА
	// =========================
	public getNearestEnemy(position: Vector3, maxDistance: number): EnemyComponent | undefined {
		let nearest: EnemyComponent | undefined;
		let nearestDist = maxDistance;

		// Используем this.components вместо componentService
		const enemies = this.components.getAllComponents<EnemyComponent>(EnemyComponent);

		for (const enemy of enemies) {
			const life = this.components.getComponent<LifeComponent>(enemy.instance);
			if (!life || !life.isAlive()) continue;

			const dist = enemy.rootPart.Position.sub(position).Magnitude;

			if (dist < nearestDist) {
				nearestDist = dist;
				nearest = enemy;
			}
		}

		return nearest;
	}

	// =========================
	// 🧟 СПАВН ВРАГА
	// =========================
	public spawnSkeleton(position: Vector3): Model | undefined {
		if (!this.skeletonTemplate) {
			warn("[EnemyService] ❌ Нет шаблона врага");
			return;
		}

		const preset = EnemyPresets.skeleton;
		const model = this.skeletonTemplate.Clone();

		const id = HttpService.GenerateGUID(false);
		model.Name = `${preset.modelName}_${id.sub(1, 6)}`;

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;

		if (!humanoid || !root) {
			model.Destroy();
			warn("[EnemyService] ❌ Некорректная модель врага");
			return;
		}

		// ECS теги
		CollectionService.AddTag(model, "Enemy");
		CollectionService.AddTag(model, "HasHealth");

		// Статы
		humanoid.MaxHealth = preset.maxHealth;
		humanoid.Health = preset.health;
		humanoid.WalkSpeed = preset.walkSpeed;

		model.PrimaryPart = root;
		model.PivotTo(new CFrame(position));

		const folder = Workspace.FindFirstChild("World")?.FindFirstChild("Enemies") as Folder;
		model.Parent = folder ?? Workspace;

		// AI
		this.startEnemyAI(model, humanoid, root, preset);

		// Смерть
		humanoid.Died.Connect(() => this.onEnemyDeath(model));

		return model;
	}

	// =========================
	// 🤖 AI
	// =========================
	private startEnemyAI(model: Model, humanoid: Humanoid, root: BasePart, preset: EnemyData) {
		let lastAttack = 0;
		const cooldown = 1 / preset.attackSpeed;

		task.spawn(() => {
			while (model.Parent && humanoid.Health > 0) {
				task.wait(0.25);

				let target: Model | undefined;
				let nearestDist = 50;

				for (const player of Players.GetPlayers()) {
					const char = player.Character;
					const pRoot = char?.FindFirstChild("HumanoidRootPart") as BasePart;
					if (!char || !pRoot) continue;

					const dist = root.Position.sub(pRoot.Position).Magnitude;

					if (dist < nearestDist) {
						nearestDist = dist;
						target = char;
					}
				}

				if (!target) continue;

				const targetRoot = target.PrimaryPart;
				if (!targetRoot) continue;

				if (nearestDist <= preset.attackRange) {
					humanoid.MoveTo(root.Position);

					const now = os.clock();
					if (now - lastAttack >= cooldown) {
						lastAttack = now;

						const life = this.components.getComponent<LifeComponent>(target);
						if (life) {
							life.takeDamage(preset.damage);
						}
					}
				} else {
					humanoid.MoveTo(targetRoot.Position);
				}
			}
		});
	}

	private onEnemyDeath(model: Model) {
		const pos = model.GetPivot().Position;
		print(`[EnemyService] 💀 ${model.Name} убит`);
		this.spawnCorpseAt(pos);

		task.delay(2, () => {
			if (model.Parent) model.Destroy();
		});
	}

	public spawnCorpseAt(position: Vector3): BasePart {
		const corpse = new Instance("Part");
		corpse.Name = "Corpse";
		corpse.Size = new Vector3(3, 0.5, 3);
		corpse.Color = Color3.fromRGB(70, 70, 70);
		corpse.Material = Enum.Material.Slate;
		corpse.Anchored = true;
		corpse.CanCollide = false;
		corpse.Position = position.sub(new Vector3(0, 2.5, 0));

		const folder = Workspace.FindFirstChild("World")?.FindFirstChild("Corpses") as Folder;
		corpse.Parent = folder ?? Workspace;

		corpse.SetAttribute("IsCorpse", true);
		corpse.SetAttribute("SoulWeight", 50);

		return corpse;
	}
}
