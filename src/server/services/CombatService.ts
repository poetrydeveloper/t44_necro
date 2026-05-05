import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, RunService } from "@rbxts/services";
import { EnemyService } from "./EnemyService";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CombatNetworking } from "shared/networking/CombatNetworking";

interface CombatState {
	nextAttackTime: number;
}

@Service({})
export class CombatService implements OnStart {
	private autoAttackPlayers = new Set<number>();
	private combatStates = new Map<number, CombatState>();
	
	// Инициализируем серверные события через метод createServer
	private events = CombatNetworking.createServer({});

	private readonly ATTACK_RANGE = 40;
	private readonly BASE_ATTACK_COOLDOWN = 1.0;

	private components = Dependency<Components>();

	constructor(private readonly enemyService: EnemyService) {}

	onStart() {
		print("[CombatService] 🔥 Боевая система запущена");

		// Подключаемся к событию через созданный объект events
		this.events.setAutoAttackState.connect((player: Player, state: boolean) => {
			if (state) {
				this.autoAttackPlayers.add(player.UserId);
				print(`[CombatService] 🎯 Авто-атака ВКЛ для ${player.Name}`);
			} else {
				this.autoAttackPlayers.delete(player.UserId);
				this.combatStates.delete(player.UserId);
				print(`[CombatService] ⭕ Авто-атака ВЫКЛ для ${player.Name}`);
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

			const target = this.enemyService.getNearestEnemy(root.Position, this.ATTACK_RANGE);
			if (!target || !target.instance.Parent) continue;

			this.performAttack(player, target);
			state.nextAttackTime = now + this.BASE_ATTACK_COOLDOWN;
		}
	}

	private performAttack(player: Player, target: EnemyComponent) {
		const life = this.components.getComponent<LifeComponent>(target.instance);
		if (life && life.isAlive()) {
			print(`[Combat] 🪄 ${player.Name} атакует ${target.instance.Name}`);
			life.takeDamage(10);
		}
	}
}
