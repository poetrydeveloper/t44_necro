import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, RunService, Workspace, CollectionService } from "@rbxts/services";
import { EnemyService } from "./EnemyService";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { ProjectileData } from "server/components/ProjectileComponent";
import { CombatNetworking } from "shared/networking/CombatNetworking";

@Service({})
export class CombatService implements OnStart {
	private autoAttackPlayers = new Set<number>();
	private combatStates = new Map<number, { nextAttackTime: number }>();
	
	private events = CombatNetworking.createServer({});
	private components = Dependency<Components>();

	constructor(private readonly enemyService: EnemyService) {}

	onStart() {
		print("[CombatService] 🔥 Боевая система запущена (ECS Projectiles)");

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
			if (!target || !target.instance.Parent) continue;

			this.performAttack(player, target);
			state.nextAttackTime = now + 1.0;
		}
	}

	private performAttack(player: Player, target: EnemyComponent) {
		const life = this.components.getComponent<LifeComponent>(target.instance);
		const character = player.Character;
		if (!life || !life.isAlive() || !character) return;

		const startPos = character.GetPivot().Position.add(new Vector3(0, 3, 0));
		const targetPos = target.getPosition();
		const distance = startPos.sub(targetPos).Magnitude;
		const speed = 40; 
		const travelTime = distance / speed;

		// 1. Создаем КОНТЕЙНЕР (Model)
		const projectileModel = new Instance("Model");
		projectileModel.Name = "Projectile";
		
		// 2. Создаем визуальную часть (Part)
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

		// 3. Атрибуты ставим на МОДЕЛЬ, чтобы клиентский компонент их увидел
		// Клиентский ProjectileComponent висит на модели и читает атрибуты с неё
		projectileModel.SetAttribute("TargetPos", targetPos);
		projectileModel.SetAttribute("Speed", speed);

		// 4. Данные снаряда (используем в замыкании ниже)
		// 🛠 Убрали this.components.addComponent - он не нужен для этой логики
		const projData: ProjectileData = {
			ownerId: player.UserId,
			targetPosition: targetPos,
			damage: 10,
			speed: speed,
			startTime: os.clock()
		};
		
		// 5. Добавляем тег для клиента и спавним в мир
		CollectionService.AddTag(projectileModel, "Projectile");
		projectileModel.Parent = Workspace;

		// 6. Логика попадания на сервере
		// Используем замыкание: projData, target, life доступны внутри
		task.delay(travelTime, () => {
			// Если снаряд уже удалили (например, игрок ушел), выходим
			if (!projectileModel.Parent) return;
			
			// Проверяем, что цель всё ещё существует и жива
			// Получаем актуальный компонент жизни (на случай, если он обновился)
			const currentLife = this.components.getComponent<LifeComponent>(target.instance);
			if (currentLife && target.instance.Parent && currentLife.isAlive()) {
				currentLife.takeDamage(projData.damage);
				print(`[Combat] 💥 Попадание! ${projData.damage} урона по ${target.instance.Name}`);
			}
			
			// Удаляем снаряд из мира
			projectileModel.Destroy();
		});
	}
}