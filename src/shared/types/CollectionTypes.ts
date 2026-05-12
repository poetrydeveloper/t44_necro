// src/shared/types/CollectionTypes.ts

export interface CardModifier {
	type: "damage" | "health" | "speed" | "range";
	value: number;
	stackable: boolean;
}

export interface CardData {
	cardId: string;           // Уникальный ID карточки
	unitType: string;         // Тип юнита (SkeletonWarrior, Ghost и т.д.)
	unitName: string;         // Отображаемое имя
	tier: 1 | 2 | 3 | 4 | 5;  // Редкость (1-5)
	soulWeight: number;       // Вес души
	upgradeLevel: number;     // Уровень улучшения (0-10)
	modifiers: CardModifier[];
}

export interface CollectionData {
	userId: number;
	maxSoulWeight: number;    // Максимальный вес душ (растёт с уровнем)
	currentSoulWeight: number; // Текущий вес
	cards: CardData[];        // Все карточки в коллекции
	activeDeck: string[];     // ID карточек в активной колоде (до 5)
}

export const CARD_TIERS = {
	COMMON: 1,
	UNCOMMON: 2,
	RARE: 3,
	EPIC: 4,
	LEGENDARY: 5,
} as const;

// Базовая статистика карточек по типам
export const CARD_BASE_STATS: Record<string, { soulWeight: number; baseHealth: number; baseDamage: number }> = {
	SkeletonWarrior: { soulWeight: 10, baseHealth: 50, baseDamage: 8 },
	Ghost: { soulWeight: 15, baseHealth: 40, baseDamage: 10 },
	Vampire: { soulWeight: 25, baseHealth: 70, baseDamage: 15 },
};