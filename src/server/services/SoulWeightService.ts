// src/server/services/SoulWeightService.ts
import { Service, OnStart } from "@flamework/core";

@Service({})
export class SoulWeightService implements OnStart {
	
	// Базовый вес для 1 уровня
	private readonly BASE_WEIGHT = 50;
	// Прирост веса за уровень
	private readonly WEIGHT_PER_LEVEL = 5;

	onStart() {
		print("[SoulWeightService] ⚖️ Система веса душ запущена");
	}

	/**
	 * Получить максимальный вес душ для уровня игрока
	 */
	public getMaxSoulWeight(level: number): number {
		return this.BASE_WEIGHT + (level - 1) * this.WEIGHT_PER_LEVEL;
	}

	/**
	 * Проверить, можно ли добавить карточку
	 */
	public canAddCard(currentWeight: number, cardWeight: number, maxWeight: number): boolean {
		return currentWeight + cardWeight <= maxWeight;
	}

	/**
	 * Получить текущую загруженность (0-1)
	 */
	public getWeightLoad(currentWeight: number, maxWeight: number): number {
		if (maxWeight === 0) return 0;
		return currentWeight / maxWeight;
	}
}