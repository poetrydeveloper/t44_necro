import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, TweenService } from "@rbxts/services";
import { SummonComponent } from "server/components/SummonComponent";
import { EnemyComponent } from "server/components/EnemyComponent";
import { UnitIndicatorService } from "./UnitIndicatorService";
import { WEAPON_STATS, COMBAT_CONFIG, getLifeComponent, isEnemyAlive } from "./UnitCombatUtils";

@Service({})
export class UnitBehaviorService implements OnStart {
	private components = Dependency<Components>();
	private indicatorService = Dependency<UnitIndicatorService>();
	
	private lastAttackTime = new Map<string, number>();
	private isReady = false;

	onStart() {
		print("[UnitBehaviorService] 🧠 Логика юнитов активна.");
		task.wait(0.1);
		this.isReady = true;
		
		task.spawn(() => {
			while (true) {
				const dt = task.wait(1/60);
				if (!this.isReady) continue;
				try {
					this.update(dt);
				} catch (e) {
					warn(`[UnitBehaviorService] ❌ Ошибка: ${e}`);
				}
			}
		});
	}

	private update(dt: number) {
		const summons = this.components.getAllComponents<SummonComponent>(SummonComponent);
		const enemies = this.components.getAllComponents<EnemyComponent>(EnemyComponent);

		for (const summon of summons) {
			const model = summon.instance;
			if (!model.Parent || summon.ownerId === 0) continue;

			const owner = Players.GetPlayerByUserId(summon.ownerId);
			if (!owner?.Character) continue;
			
			const ownerRoot = owner.Character.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!ownerRoot) continue;

			const currentPivot = model.GetPivot();

			// Поиск ближайшего врага
			let nearestEnemy: EnemyComponent | undefined;
			let nearestDist: number = COMBAT_CONFIG.CHASE_RANGE;

			for (const enemy of enemies) {
				if (!isEnemyAlive(this.components, enemy.instance)) continue;

				const eRoot = enemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!eRoot) continue;

				const d = currentPivot.Position.sub(eRoot.Position).Magnitude;
				if (d < nearestDist) {
					nearestDist = d;
					nearestEnemy = enemy;
				}
			}

			const now = os.clock();
			const last = this.lastAttackTime.get(model.Name) || 0;
			const weapon = summon.weaponType || "RustySword";
			const stats = WEAPON_STATS[weapon] || WEAPON_STATS.RustySword;
			const effectiveRange = stats.range + 2.0;

			// Атака
			if (nearestEnemy) {
				const life = getLifeComponent(this.components, nearestEnemy.instance);
				const inRange = nearestDist <= effectiveRange;
				const cooldownReady = now - last >= COMBAT_CONFIG.ATTACK_COOLDOWN;

				if (inRange && cooldownReady && life && life.isAlive()) {
					life.takeDamage(stats.damage);
					this.playAttackLunge(model, nearestEnemy.instance.GetPivot().Position);
					
					print(`[UnitAI] ⚔️ АТАКА! Урон: ${stats.damage} по ${nearestEnemy.instance.Name}`);
					this.lastAttackTime.set(model.Name, now);
					this.indicatorService.update(model.Name, "attack", nearestEnemy.instance.GetPivot().Position, currentPivot.Position);
					continue;
				}
			}

			// Движение
			let state = "follow";
			let targetPos = ownerRoot.Position;

			if (nearestEnemy && nearestDist <= COMBAT_CONFIG.CHASE_RANGE) {
				state = "chase";
				targetPos = nearestEnemy.instance.GetPivot().Position;
				const eRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (eRoot) this.moveTowards(model, eRoot.Position, dt);
			} else {
				const distToOwner = currentPivot.Position.sub(ownerRoot.Position).Magnitude;
				if (distToOwner > COMBAT_CONFIG.FOLLOW_DISTANCE) {
					this.moveTowards(model, ownerRoot.Position, dt);
				}
			}

			this.indicatorService.update(model.Name, state, targetPos, currentPivot.Position);
		}
	}

	private moveTowards(model: Model, targetPos: Vector3, dt: number) {
		const currentPivot = model.GetPivot();
		const diff = targetPos.sub(currentPivot.Position);
		const flatDir = diff.Magnitude > 0 ? new Vector3(diff.X, 0, diff.Z).Unit : new Vector3(0, 0, 0);
		model.PivotTo(currentPivot.add(flatDir.mul(COMBAT_CONFIG.MOVE_SPEED * dt)));
	}

	private playAttackLunge(model: Model, targetPos: Vector3) {
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!root) return;
		
		const currentPivot = model.GetPivot();
		const dir = targetPos.sub(currentPivot.Position).Magnitude > 0 
			? targetPos.sub(currentPivot.Position).Unit 
			: new Vector3(0, 0, 1);
		const lungePos = currentPivot.Position.add(dir.mul(1.5));
		const lookAtCFrame = CFrame.lookAt(lungePos, lungePos.add(dir));

		TweenService.Create(root, new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			CFrame: lookAtCFrame
		}).Play();

		task.delay(0.15, () => {
			if (model.Parent) {
				TweenService.Create(root, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					CFrame: currentPivot
				}).Play();
			}
		});
	}
}