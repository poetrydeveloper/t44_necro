import { Service, OnStart } from "@flamework/core";
import { Components } from "@flamework/components";
import { CollectionService, Players, RunService } from "@rbxts/services";
import { LifeComponent } from "server/components/LifeComponent";

@Service({})
export class UnitBehaviorService implements OnStart {
	private AGGRO_RANGE = 50;
	private ATTACK_RANGE = 12;
	private FOLLOW_RANGE = 15;
	private ATTACK_COOLDOWN = 1.2;
	private lastAttackTime = new Map<Instance, number>(); // Лучше хранить ссылку на Instance

	// Внедряем компоненты через конструктор (стандарт Flamework)
	constructor(private components: Components) {}

	onStart() {
		print("[UnitBehaviorService] 🧠 Логика юнитов активна.");
		RunService.Heartbeat.Connect(() => this.updateUnits());
	}

	private updateUnits() {
		for (const unit of CollectionService.GetTagged("Summon")) {
			const model = unit as Model;
			const humanoid = model.FindFirstChildOfClass("Humanoid");
			const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
			const ownerId = model.GetAttribute("OwnerId") as number;

			if (!humanoid || !root || !ownerId) continue;

			const owner = Players.GetPlayerByUserId(ownerId);
			const character = owner?.Character;
			if (!character || !character.PrimaryPart) continue;

			const enemy = this.findNearestEnemy(root.Position);

			if (enemy && enemy.PrimaryPart) {
				const enemyPos = enemy.PrimaryPart.Position;
				const dist = root.Position.sub(enemyPos).Magnitude;
				
				// Движение к врагу
				humanoid.MoveTo(enemyPos);
				humanoid.WalkSpeed = 16;
				
				// Атака
				if (dist <= this.ATTACK_RANGE) {
					const now = os.clock();
					const last = this.lastAttackTime.get(model) || 0;
					
					if (now - last >= this.ATTACK_COOLDOWN) {
						// Получаем LifeComponent (убедись, что на враге есть тег "HasHealth")
						const life = this.components.getComponent<LifeComponent>(enemy);
						
						if (life && life.isAlive()) {
							const weapon = model.GetAttribute("WeaponType") as string || "RustySword";
							const damage = weapon === "BoneBlade" ? 12 : (weapon === "SpectralDagger" ? 6 : 8);
							
							life.takeDamage(damage);
							this.lastAttackTime.set(model, now);
							print(`[UnitAI] ⚔️ ${model.Name} атаковал ${enemy.Name} на ${damage}`);
						}
					}
				}
			} else {
				// Следование за игроком
				const ownerPos = character.PrimaryPart.Position;
				const distToOwner = root.Position.sub(ownerPos).Magnitude;
				
				if (distToOwner > this.FOLLOW_RANGE) {
					humanoid.MoveTo(ownerPos);
					humanoid.WalkSpeed = 16;
				} else {
					// Остановка (важно для плавности)
					humanoid.MoveTo(root.Position);
					humanoid.WalkSpeed = 0;
				}
			}
		}
	}

	private findNearestEnemy(pos: Vector3): Model | undefined {
		let closest: Model | undefined;
		let lastDist = this.AGGRO_RANGE;

		for (const enemy of CollectionService.GetTagged("Enemy")) {
			const enemyModel = enemy as Model;
			const root = enemyModel.FindFirstChild("HumanoidRootPart") as BasePart;
			
			// Проверяем, жив ли враг перед тем как идти к нему
			const life = this.components.getComponent<LifeComponent>(enemyModel);
			if (life && !life.isAlive()) continue;

			if (root && enemyModel.Parent) {
				const dist = pos.sub(root.Position).Magnitude;
				if (dist < lastDist) {
					lastDist = dist;
					closest = enemyModel;
				}
			}
		}
		return closest;
	}
}