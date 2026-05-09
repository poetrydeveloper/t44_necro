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

			const unitRoot = model.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!unitRoot) continue;

			const humanoid = model.FindFirstChildOfClass("Humanoid");
			if (!humanoid) continue;

			const owner = Players.GetPlayerByUserId(summon.ownerId);
			if (!owner?.Character) continue;
			
			const ownerRoot = owner.Character.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!ownerRoot) continue;

			const unitPos = unitRoot.Position;

			// Поиск ближайшего врага (по горизонтали)
			let nearestEnemy: EnemyComponent | undefined;
			let nearestDist: number = COMBAT_CONFIG.CHASE_RANGE;

			for (const enemy of enemies) {
				if (!isEnemyAlive(this.components, enemy.instance)) continue;

				const eRoot = enemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!eRoot) continue;

				const enemyPos = eRoot.Position;
				const dx = unitPos.X - enemyPos.X;
				const dz = unitPos.Z - enemyPos.Z;
				const horizontalDist = math.sqrt(dx * dx + dz * dz);
				
				if (horizontalDist < nearestDist) {
					nearestDist = horizontalDist;
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
					this.indicatorService.update(model.Name, "attack", nearestEnemy.instance.GetPivot().Position, unitPos);
					// Продолжаем движение — не делаем continue, чтобы юнит мог двигаться во время атаки
				}
			}

			// Движение (всегда, даже если атакуем)
			if (nearestEnemy && nearestDist <= COMBAT_CONFIG.CHASE_RANGE) {
				const eRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (eRoot) {
					humanoid.MoveTo(eRoot.Position);
					humanoid.WalkSpeed = COMBAT_CONFIG.MOVE_SPEED;
				}
			} else {
				const distToOwner = unitPos.sub(ownerRoot.Position).Magnitude;
				if (distToOwner > COMBAT_CONFIG.FOLLOW_DISTANCE) {
					humanoid.MoveTo(ownerRoot.Position);
					humanoid.WalkSpeed = COMBAT_CONFIG.MOVE_SPEED;
				} else if (humanoid.WalkSpeed !== 0) {
					humanoid.MoveTo(unitPos);
					humanoid.WalkSpeed = 0;
				}
			}

			this.indicatorService.update(model.Name, nearestEnemy ? "chase" : "follow", 
				nearestEnemy && nearestEnemy.instance.FindFirstChild("HumanoidRootPart") 
					? (nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart).Position 
					: ownerRoot.Position, 
				unitPos);
		}
	}

	/**
	 * Визуальный рывок при атаке (не влияет на реальное движение)
	 */
	private playAttackLunge(model: Model, targetPos: Vector3) {
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!root) return;
		
		const currentPos = root.Position;
		const dir = targetPos.sub(currentPos).Magnitude > 0 
			? targetPos.sub(currentPos).Unit 
			: new Vector3(0, 0, 1);
		const lungePos = currentPos.add(dir.mul(1.5));
		
		// Только визуальный эффект — твин CFrame корня
		const lookAtCFrame = new CFrame(lungePos, lungePos.add(dir));
		
		TweenService.Create(root, new TweenInfo(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			CFrame: lookAtCFrame
		}).Play();

		task.delay(0.15, () => {
			if (model.Parent) {
				TweenService.Create(root, new TweenInfo(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					CFrame: new CFrame(currentPos)
				}).Play();
			}
		});
	}
}