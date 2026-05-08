import { Service, OnStart } from "@flamework/core";
import { PlayerDataService } from "./PlayerDataService";
import { GameConfig } from "shared/constants/GameConfig";

@Service({})
export class ProgressionService implements OnStart {
    constructor(private playerDataService: PlayerDataService) {}

    onStart() {
        print("[ProgressionService] 📈 Система прогрессии запущена");
    }

    /**
     * Формула опыта: 100 * (уровень ^ 1.5)
     * Ур 1 -> 100, Ур 2 -> ~282, Ур 3 -> ~519
     */
    private calculateRequiredExp(level: number): number {
        return math.floor(100 * math.pow(level, 1.5));
    }

    /**
     * Начислить опыт игроку
     */
    public grantExperience(player: Player, amount: number) {
        this.playerDataService.updatePlayerData(player, (data) => {
            data.stats.experience += amount;

            // Проверка на повышение уровня (цикл, если опыта дали очень много)
            while (data.stats.experience >= data.requiredExperience) {
                data.stats.experience -= data.requiredExperience;
                data.stats.level += 1;
                
                // Обновляем порог для следующего уровня
                data.requiredExperience = this.calculateRequiredExp(data.stats.level);

                // Бонусы за уровень из GameConfig
                const statsPerLevel = GameConfig.levelProgression.statsPerLevel;
                data.stats.maxHealth += statsPerLevel.maxHealth;
                data.stats.currentHealth = data.stats.maxHealth;
                data.stats.maxMana += statsPerLevel.maxMana;
                data.stats.currentMana = data.stats.maxMana;
                data.stats.intelligence += statsPerLevel.intelligence;
                data.stats.spirit += statsPerLevel.spirit;
                data.stats.vitality += statsPerLevel.vitality;
                data.stats.manaRegen = GameConfig.manaSystem.baseRegen + (data.stats.spirit * GameConfig.manaSystem.regenFromSpirit);

                this.onLevelUp(player, data.stats.level);
            }
        });
    }

    private onLevelUp(player: Player, newLevel: number) {
        print(`[ProgressionService] ✨ Игрок ${player.Name} достиг уровня ${newLevel}!`);
        // Здесь в будущем: запуск эффекта на клиенте или выдача награды
    }

    /**
     * Получить прогресс до следующего уровня (0-1)
     */
    public getProgress(player: Player): number {
        const data = this.playerDataService.getPlayerData(player);
        if (!data) return 0;
        return data.stats.experience / data.requiredExperience;
    }
}