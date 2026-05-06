// src/server/services/UnitBehaviorService.ts
import { Service, OnTick, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players } from "@rbxts/services";
import { SummonComponent } from "server/components/SummonComponent";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CombatNetworking } from "shared/networking/CombatNetworking";

@Service({})
export class UnitBehaviorService implements OnTick {
	private components = Dependency<Components>();
	private events = CombatNetworking.createServer({});

	private readonly ATTACK_RANGE = 6;      // Дистанция удара
	private readonly CHASE_RANGE = 20;      // Дистанция обнаружения врага
	private readonly FOLLOW_DISTANCE = 8;   // Дистанция следования за игроком
	private readonly MOVE_SPEED = 16;       // Скорость (студов/сек)
	private readonly ATTACK_COOLDOWN = 1.2; // Кулдаун удара
	private readonly DAMAGE = 8;            // Урон юнита

	private lastAttackTime = new Map<string, number>();

	onStart() {
		print("[UnitBehaviorService] 🧠 Логика юнитов активна (Приоритет: Атака > Враг > Игрок)");
	}

	// 🛠 Вспомогательный метод: движение строго по земле (Y = 0)
	private moveTowards(model: Model, targetPos: Vector3, dt: number) {
		const currentPivot = model.GetPivot();
		const diff = targetPos.sub(currentPivot.Position);
		
		// Обнуляем Y, чтобы модель не взлетала и не проваливалась
		const flatDir = new Vector3(diff.X, 0, diff.Z).Unit;
		
		model.PivotTo(currentPivot.add(flatDir.mul(this.MOVE_SPEED * dt)));
	}

	onTick(dt: number) {
		const summons = this.components.getAllComponents<SummonComponent>(SummonComponent);
		const enemies = this.components.getAllComponents<EnemyComponent>(EnemyComponent);

		for (const summon of summons) {
			const model = summon.instance;
			if (!model.Parent) continue;
			if (summon.ownerId === 0) continue;

			const owner = Players.GetPlayerByUserId(summon.ownerId);
			if (!owner || !owner.Character) continue;
			
			const ownerRoot = owner.Character.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!ownerRoot) continue;

			const currentPivot = model.GetPivot();

			// 🔍 1. Поиск ближайшего живого врага
			let nearestEnemy: EnemyComponent | undefined;
			let nearestDist = this.CHASE_RANGE;

			for (const enemy of enemies) {
				const life = this.components.getComponent<LifeComponent>(enemy.instance);
				if (!life || !life.isAlive()) continue;

				const enemyRoot = enemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!enemyRoot) continue;

				const dist = currentPivot.Position.sub(enemyRoot.Position).Magnitude;
				if (dist < nearestDist) {
					nearestDist = dist;
					nearestEnemy = enemy;
				}
			}

			const now = os.clock();
			const lastAttack = this.lastAttackTime.get(model.Name) || 0;

			// 🎯 2. Машина состояний с приоритетами
			if (nearestEnemy && nearestDist <= this.ATTACK_RANGE && now - lastAttack >= this.ATTACK_COOLDOWN) {
				// ⚔️ СОСТОЯНИЕ: АТАКА (наносим урон, стоим на месте)
				const life = this.components.getComponent<LifeComponent>(nearestEnemy.instance);
				if (life && life.isAlive()) {
					life.takeDamage(this.DAMAGE);
					
					const targetRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
					if (targetRoot) {
						this.events.showDamagePopup(
							owner, 
							nearestEnemy.instance.Name, 
							this.DAMAGE, 
							targetRoot.Position.add(new Vector3(0, 3, 0))
						);
					}
					
					this.lastAttackTime.set(model.Name, now);
				}
			} 
			else if (nearestEnemy && nearestDist <= this.CHASE_RANGE) {
				// 🏃 СОСТОЯНИЕ: ПРЕСЛЕДОВАНИЕ ВРАГА
				const enemyRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (enemyRoot) {
					this.moveTowards(model, enemyRoot.Position, dt);
				}
			} 
			else {
				// 🛡 СОСТОЯНИЕ: СЛЕДОВАНИЕ ЗА ИГРОКОМ (врагов нет рядом)
				const distToOwner = currentPivot.Position.sub(ownerRoot.Position).Magnitude;
				if (distToOwner > this.FOLLOW_DISTANCE) {
					this.moveTowards(model, ownerRoot.Position, dt);
				}
			}
		}
	}
}