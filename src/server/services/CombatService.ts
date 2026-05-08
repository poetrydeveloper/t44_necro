// src/server/services/CombatService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, RunService, Workspace, CollectionService } from "@rbxts/services";
import { EnemyService } from "./EnemyService";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CombatNetworking } from "shared/networking/CombatNetworking";

@Service({})
export class CombatService implements OnStart {
	private autoAttackPlayers = new Set<number>();
	private combatStates = new Map<number, { nextAttackTime: number }>();
	
	private events = CombatNetworking.createServer({});
	private components!: Components;

	constructor(private readonly enemyService: EnemyService) {}

	onStart() {
		print("[CombatService] 🔥 Боевая система запущена (ECS Projectiles)");
		this.components = Dependency<Components>();

		this.events.setAutoAttackState.connect((player: Player, state: boolean) => {
			if (state) {
				this.autoAttackPlayers.add(player.UserId);
			} else {
				this.autoAttackPlayers.delete(player.UserId);
				this.combatStates.delete(player.UserId);
			}
		});

		RunService.Heartbeat.Connect(() => this.onHeartbeat());
	}

	private onHeartbeat() {
		const now = os.clock();
		for (const userId of this.autoAttackPlayers) {
			const player = Players.GetPlayerByUserId(userId);
			const character = player?.Character;
			const root = character?.PrimaryPart;
			if (!player || !character || !root) continue;

			let state = this.combatStates.get(userId);
			if (!state) {
				state = { nextAttackTime: 0 };
				this.combatStates.set(userId, state);
			}
			if (now < state.nextAttackTime) continue;

			const target = this.enemyService.getNearestEnemy(root.Position, 40);
			
			if (!target) continue;
			
			// Исправлено: убран второй аргумент
			const life = this.components.getComponent<LifeComponent>(target.instance);
			if (!life || !life.isAlive()) continue;
			
			const enemyModel = target.instance;
			if (!enemyModel.Parent) continue;

			this.performAttack(player, target);
			state.nextAttackTime = now + 1.0;
		}
	}

	private performAttack(player: Player, target: EnemyComponent) {
		// Исправлено: убран второй аргумент
		const life = this.components.getComponent<LifeComponent>(target.instance);
		const character = player.Character;
		if (!life || !life.isAlive() || !character) return;

		const startPos = character.GetPivot().Position.add(new Vector3(0, 3, 0));
		const targetPos = target.instance.GetPivot().Position;
		const distance = startPos.sub(targetPos).Magnitude;
		const speed = 40; 
		const travelTime = distance / speed;

		const projectileModel = new Instance("Model");
		projectileModel.Name = "Projectile";
		
		const orb = new Instance("Part");
		orb.Name = "Orb";
		orb.Shape = Enum.PartType.Ball;
		orb.Size = new Vector3(2, 2, 2);
		orb.Material = Enum.Material.Neon;
		orb.Color = Color3.fromRGB(138, 43, 226);
		orb.CanCollide = false;
		orb.Anchored = true;
		orb.Position = startPos;
		orb.Parent = projectileModel;

		projectileModel.SetAttribute("TargetPos", targetPos);
		projectileModel.SetAttribute("Speed", speed);
		projectileModel.SetAttribute("OwnerId", player.UserId);

		CollectionService.AddTag(projectileModel, "Projectile");
		projectileModel.Parent = Workspace;

		task.delay(travelTime, () => {
			if (!projectileModel.Parent) return;
			
			// Исправлено: убран второй аргумент
			const currentLife = this.components.getComponent<LifeComponent>(target.instance);
			if (currentLife && target.instance.Parent && currentLife.isAlive()) {
				currentLife.takeDamage(10);
				
				this.enemyService.recordAttackOnEnemy(target.instance, player.UserId);
				print(`[Combat] 💥 Попадание! 10 урона по ${target.instance.Name}`);
			}
			
			projectileModel.Destroy();
		});
	}
}