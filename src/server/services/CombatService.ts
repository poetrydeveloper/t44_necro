import { Service, OnStart } from "@flamework/core";
import { GameConfig } from "shared/constants/GameConfig";
import { CombatNetworking } from "shared/networking/CombatNetworking";
import { EnemyService } from "./EnemyService";
import { PlayerDataService } from "./PlayerDataService";
import { EnemyData } from "shared/types/EnemyTypes";

@Service({})
export class CombatService implements OnStart {
    // Явно создаем серверную часть нетворкинга
    private events = CombatNetworking.createServer({});

    constructor(
        private readonly enemyService: EnemyService,
        private readonly playerDataService: PlayerDataService,
    ) {}

    onStart() {
        print("[CombatService] ⚔️ Боевая система запущена");

        this.events.requestNearestEnemy.connect((player: Player, range: number) => {
            const char = player.Character;
            const rootPart = char?.PrimaryPart;
            if (!rootPart) return;

            const nearest = this.enemyService.getNearestEnemy(rootPart.Position, range);
            if (nearest) {
                this.events.updateNearestEnemy.fire(player, nearest.instance.Name, nearest.data);
            } else {
                this.events.updateNearestEnemy.fire(player, undefined, undefined);
            }
        });

        this.events.attackEnemy.connect((player: Player, enemyId: string) => {
            const enemy = this.enemyService.getEnemyById(enemyId);
            const character = player.Character;

            if (!enemy || !character?.PrimaryPart) return;

            const distance = character.PrimaryPart.Position.sub(enemy.rootPart.Position).Magnitude;
            if (distance > GameConfig.spells.fireball.castRange + 5) return;

            enemy.humanoid.TakeDamage(GameConfig.spells.fireball.damage);
            
            if (enemy.humanoid.Health <= 0) {
                this.playerDataService.updatePlayerData(player, (data) => {
                    data.gold += enemy.data.rewardGold;
                    data.stats.experience += enemy.data.rewardExp;
                });
            }
        });
    }
}
