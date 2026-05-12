// src/server/services/EnemyService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Workspace, HttpService, ReplicatedStorage, Players, CollectionService } from "@rbxts/services";
import { EnemyPresets, EnemyData } from "shared/types/EnemyTypes";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { ProgressionService } from "./ProgressionService";
import { CorpseManagerService } from "./CorpseManagerService";

@Service({})
export class EnemyService implements OnStart {
	private templates = new Map<string, Model>();
	private components = Dependency<Components>();
	private pendingAttacks = new Map<Instance, number>();
	private progressionService!: ProgressionService;
	private corpseManager!: CorpseManagerService;
	private templatesReady = false;

	onStart() {
		print("[EnemyService] 👹 Система врагов запущена");
		this.progressionService = Dependency<ProgressionService>();
		this.corpseManager = Dependency<CorpseManagerService>();
		this.loadTemplates();
	}

	private loadTemplates() {
		for (const [key, preset] of pairs(EnemyPresets)) {
			const template = ReplicatedStorage.FindFirstChild(preset.modelName) as Model;
			if (template) {
				this.templates.set(key, template);
				print(`[EnemyService] ✅ Загружен: ${key} (${preset.modelName})`);
			}
		}
		this.templatesReady = true;
	}

	public getNearestEnemy(position: Vector3, maxDistance: number): EnemyComponent | undefined {
		let nearest: EnemyComponent | undefined;
		let nearestDist = maxDistance;
		for (const enemy of this.components.getAllComponents<EnemyComponent>(EnemyComponent)) {
			const life = this.components.getComponent<LifeComponent>(enemy.instance);
			if (!life?.isAlive()) continue;
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

	public recordAttackOnEnemy(enemy: Instance, playerUserId: number) {
		this.pendingAttacks.set(enemy, playerUserId);
	}

	private getKillerUserId(enemy: Instance): number | undefined {
		return this.pendingAttacks.get(enemy);
	}

	private clearAttacks(enemy: Instance) {
		this.pendingAttacks.delete(enemy);
	}

	public spawnEnemy(enemyType: string, position: Vector3): Model | undefined {
		if (!this.templatesReady) return;
		const preset = EnemyPresets[enemyType];
		const template = this.templates.get(enemyType);
		if (!preset || !template) return;

		const model = template.Clone();
		model.Name = `${preset.modelName}_${HttpService.GenerateGUID(false).sub(1, 6)}`;

		const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!humanoid || !root) {
			model.Destroy();
			return;
		}

		CollectionService.AddTag(model, "Enemy");
		CollectionService.AddTag(model, "HasHealth");

		humanoid.MaxHealth = preset.maxHealth;
		humanoid.Health = preset.health;
		humanoid.WalkSpeed = preset.walkSpeed;
		model.PrimaryPart = root;

		const rayParams = new RaycastParams();
		rayParams.FilterDescendantsInstances = [model];
		const rayResult = Workspace.Raycast(position.add(new Vector3(0, 10, 0)), new Vector3(0, -25, 0), rayParams);
		const finalPos = rayResult ? new Vector3(position.X, rayResult.Position.Y + 2.5, position.Z) : position;
		model.PivotTo(new CFrame(finalPos));
		model.Parent = Workspace;
		model.SetAttribute("EnemyType", enemyType);
		model.SetAttribute("ProcessingDeath", false);

		this.startEnemyAI(model, humanoid, root, preset);
		humanoid.Died.Connect(() => this.onEnemyDeath(model, enemyType));
		return model;
	}

	private startEnemyAI(model: Model, humanoid: Humanoid, root: BasePart, preset: EnemyData) {
		let lastAttack = 0;
		const cooldown = 1 / preset.attackSpeed;

		task.spawn(() => {
			while (model.Parent === Workspace && humanoid.Health > 0) {
				task.wait(0.25);
				let target: Model | undefined;
				let nearestDist = 50;

				// Ищем игроков
				for (const player of Players.GetPlayers()) {
					const char = player.Character;
					const pRoot = char?.PrimaryPart;
					if (!char || !pRoot) continue;
					const dist = root.Position.sub(pRoot.Position).Magnitude;
					if (dist < nearestDist) {
						nearestDist = dist;
						target = char;
					}
				}

				// Ищем союзников (Summon)
				for (const summon of CollectionService.GetTagged("Summon")) {
					const summonModel = summon as Model;
					const sRoot = summonModel.PrimaryPart;
					if (!sRoot || !summonModel.Parent) continue;
					const dist = root.Position.sub(sRoot.Position).Magnitude;
					if (dist < nearestDist) {
						nearestDist = dist;
						target = summonModel;
					}
				}

				if (!target || !target.PrimaryPart) continue;

				if (nearestDist <= preset.attackRange) {
					humanoid.MoveTo(root.Position);
					const now = os.clock();
					if (now - lastAttack >= cooldown) {
						lastAttack = now;
						const life = this.components.getComponent<LifeComponent>(target);
						life?.takeDamage(preset.damage);
					}
				} else {
					humanoid.MoveTo(target.PrimaryPart.Position);
				}
			}
		});
	}

	private onEnemyDeath(model: Model, enemyType: string) {
		if (model.GetAttribute("ProcessingDeath") === true) return;
		model.SetAttribute("ProcessingDeath", true);

		const killerId = this.getKillerUserId(model);
		if (killerId) {
			const killer = Players.GetPlayerByUserId(killerId);
			if (killer) {
				this.progressionService.grantExperience(killer, 50);
				print(`[EnemyService] ✨ ${killer.Name} получил 50 опыта`);
			}
		}
		this.clearAttacks(model);

		const originalPos = model.GetPivot().Position;
		CollectionService.RemoveTag(model, "Enemy");
		CollectionService.RemoveTag(model, "HasHealth");
		this.corpseManager.createGrave(model, enemyType, originalPos);
	}
}