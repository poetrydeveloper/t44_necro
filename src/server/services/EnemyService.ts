import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Workspace, HttpService, ReplicatedStorage, Players, CollectionService } from "@rbxts/services";
import { EnemyPresets, EnemyData } from "shared/types/EnemyTypes";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CorpseComponent } from "server/components/CorpseComponent";

@Service({})
export class EnemyService implements OnStart {
	private skeletonTemplate?: Model;
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

		const enemies = this.components.getAllComponents<EnemyComponent>(EnemyComponent);

		for (const enemy of enemies) {
			const life = this.components.getComponent<LifeComponent>(enemy.instance);
			if (!life || !life.isAlive()) continue;

			const root = enemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!root) continue;

			const dist = root.Position.sub(position).Magnitude;
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

		const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
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
		humanoid.Died.Connect(() => this.onEnemyDeath(model, preset.modelName));

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

	// =========================
	// 💀 СМЕРТЬ ВРАГА → ТРУП
	// =========================
	private onEnemyDeath(model: Model, templateId: string) {
		print(`[EnemyService] 💀 ${model.Name} убит → превращаем в труп`);

		// 1. Удаляем старые теги
		CollectionService.RemoveTag(model, "Enemy");
		CollectionService.RemoveTag(model, "HasHealth");

		// 2. 🛠 ВАЖНО: Сначала устанавливаем атрибуты, ПОТОМ добавляем тег
		// Так как тег триггерит создание CorpseComponent, и он прочитает атрибуты в onStart
		model.SetAttribute("templateId", templateId);
		model.SetAttribute("spawnTime", os.clock());

		// 3. Добавляем тег трупа → Flamework создаст CorpseComponent автоматически
		CollectionService.AddTag(model, "Corpse");

		// 4. Визуальные изменения "смерти"
		this.makeCorpseVisuals(model);

		// 5. Отключаем логику врага
		const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
		if (humanoid) {
			humanoid.ChangeState(Enum.HumanoidStateType.Dead);
			humanoid.BreakJointsOnDeath = false; // Не ломать модель при смерти
		}

		// 6. Удаляем скрипты и части, которые не нужны трупу (оптимизация)
		// Можно удалить, если они мешают или нагружают
		// model.FindFirstChild("AttackHitbox")?.Destroy();
	}

	private makeCorpseVisuals(model: Model) {
		// Делаем модель "мёртвой" визуально
		for (const child of model.GetDescendants()) {
			if (child.IsA("BasePart")) {
				// Серый цвет для всех частей
				child.Color = Color3.fromRGB(80, 80, 80);
				child.Material = Enum.Material.Concrete;
				child.CanCollide = false; // Не блокировать проход
				// Можно добавить прозрачность, если хочешь "призрачный" труп
				// child.Transparency = 0.3;
			}
			// Удаляем ненужные эффекты
			if (child.IsA("ParticleEmitter") || child.IsA("Light")) {
				child.Destroy();
			}
		}

		// Добавляем маркер "это труп" (опционально, для отладки)
		const marker = new Instance("Part");
		marker.Name = "CorpseIndicator";
		marker.Shape = Enum.PartType.Cylinder;
		marker.Size = new Vector3(0.3, 0.5, 0.3);
		marker.Color = Color3.fromRGB(100, 100, 255);
		marker.Material = Enum.Material.Neon;
		marker.Anchored = true;
		marker.CanCollide = false;
		marker.Transparency = 0.5;
		marker.CFrame = model.GetPivot().add(new Vector3(0, 3, 0));
		marker.Parent = model;
	}
}