// src/server/services/EnemyService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Workspace, HttpService, ReplicatedStorage, Players, CollectionService } from "@rbxts/services";
import { EnemyPresets, EnemyData } from "shared/types/EnemyTypes";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CorpseComponent } from "server/components/CorpseComponent";
import { ProgressionService } from "./ProgressionService";

@Service({})
export class EnemyService implements OnStart {
	private skeletonTemplate?: Model;
	private components = Dependency<Components>();
	private pendingAttacks = new Map<Instance, number>();
	private templateReady = false; // Флаг готовности

	onStart() {
		print("[EnemyService] 👹 Система врагов запущена");
		this.loadTemplates(); // Убираем task.wait(1)
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
		this.templateReady = true; // Шаблон загружен
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
	// 📝 ЗАПИСЬ АТАКИ (ДЛЯ НАГРАДЫ)
	// =========================
	public recordAttackOnEnemy(enemy: Instance, playerUserId: number) {
		this.pendingAttacks.set(enemy, playerUserId);
	}

	private getKillerUserId(enemy: Instance): number | undefined {
		return this.pendingAttacks.get(enemy);
	}

	private clearAttacks(enemy: Instance) {
		this.pendingAttacks.delete(enemy);
	}

	// =========================
	// 🧟 СПАВН ВРАГА
	// =========================
	public spawnSkeleton(position: Vector3): Model | undefined {
		if (!this.templateReady || !this.skeletonTemplate) {
			warn("[EnemyService] ❌ Шаблон ещё не загружен");
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

		// Raycast для земли
		const rayParams = new RaycastParams();
		rayParams.FilterDescendantsInstances = [model];
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		
		const rayOrigin = position.add(new Vector3(0, 10, 0));
		const rayDirection = new Vector3(0, -20, 0);
		const rayResult = Workspace.Raycast(rayOrigin, rayDirection, rayParams);
		
		const finalPos = rayResult 
			? new Vector3(position.X, rayResult.Position.Y + 2.5, position.Z)
			: position;

		model.PivotTo(new CFrame(finalPos));

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

		// 💰 Начисляем опыт убийце
		const killerUserId = this.getKillerUserId(model);
		if (killerUserId) {
			const killer = Players.GetPlayerByUserId(killerUserId);
			if (killer) {
				try {
					const progression = Dependency<ProgressionService>();
					progression.grantExperience(killer, 50);
					print(`[EnemyService] ✨ ${killer.Name} получил 50 опыта за убийство`);
				} catch (e) {
					warn("[EnemyService] ProgressionService не найден, опыт не начислен");
				}
			}
		}
		this.clearAttacks(model);

		// Сохраняем позицию
		const originalPos = model.GetPivot().Position;

		// Удаляем боевые теги
		CollectionService.RemoveTag(model, "Enemy");
		CollectionService.RemoveTag(model, "HasHealth");

		// Атрибуты для трупа
		model.SetAttribute("templateId", templateId);
		model.SetAttribute("spawnTime", os.clock());

		// Тег трупа
		CollectionService.AddTag(model, "Corpse");

		// Превращаем в лежащий труп
		this.transformToCorpse(model, originalPos);

		// Отключаем Humanoid
		const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
		if (humanoid) {
			humanoid.BreakJointsOnDeath = false;
			humanoid.ChangeState(Enum.HumanoidStateType.Dead);
		}
	}

	// =========================
	// 🪦 ТРАНСФОРМАЦИЯ В ТРУП
	// =========================
	private transformToCorpse(model: Model, spawnPos: Vector3) {
		const rayParams = new RaycastParams();
		rayParams.FilterDescendantsInstances = [model];
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		
		const rayOrigin = spawnPos.add(new Vector3(0, 5, 0));
		const rayDirection = new Vector3(0, -15, 0);
		const rayResult = Workspace.Raycast(rayOrigin, rayDirection, rayParams);
		
		const groundY = rayResult ? rayResult.Position.Y + 0.5 : spawnPos.Y - 2;

		// Исправлено: math.random -> прямой вызов, math.rad -> ручной перевод
		const randomRotY = math.random() * math.pi * 2;
		const fallAngleDeg = 85 + math.random() * 10;
		const fallAngleRad = fallAngleDeg * math.pi / 180;
		
		model.PivotTo(
			new CFrame(new Vector3(spawnPos.X, groundY, spawnPos.Z))
				.mul(CFrame.Angles(0, randomRotY, fallAngleRad))
		);

		for (const child of model.GetDescendants()) {
			if (child.IsA("BasePart")) {
				child.Color = Color3.fromRGB(65, 65, 65);
				child.Material = Enum.Material.Concrete;
				child.Anchored = true;
				child.CanCollide = false;
			}
			if (child.IsA("ParticleEmitter") || child.IsA("Light") || child.IsA("Sound")) {
				child.Destroy();
			}
		}

		const marker = new Instance("Part");
		marker.Name = "CorpseMarker";
		marker.Shape = Enum.PartType.Cylinder;
		marker.Size = new Vector3(0.2, 0.8, 0.2);
		marker.Color = Color3.fromRGB(100, 150, 255);
		marker.Material = Enum.Material.Neon;
		marker.Anchored = true;
		marker.CanCollide = false;
		marker.Transparency = 0.3;
		marker.CFrame = model.GetPivot().add(new Vector3(0, 2.5, 0));
		marker.Parent = model;
	}
}