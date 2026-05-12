// shared/types/EnemyTypes.ts

export interface EnemyData {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    damage: number;
    attackRange: number;
    attackSpeed: number;
    walkSpeed: number;
    rewardGold: number;
    rewardExp: number;
    modelName: string;
    soulWeight?: number;  // Вес души для коллекции
    tier?: number;        // Редкость (1-5)
}

export interface EnemySpawnInfo {
    enemyType: string;
    position: Vector3;
    level: number;
}

export const EnemyPresets: Record<string, EnemyData> = {
    skeleton: {
        id: "skeleton",
        name: "Скелет-воин",
        health: 50,
        maxHealth: 50,
        damage: 10,
        attackRange: 8,
        attackSpeed: 1.5,
        walkSpeed: 12,
        rewardGold: 10,
        rewardExp: 20,
        modelName: "Zombie",  // Используем Zombie модель
        soulWeight: 10,
        tier: 1,
    },
    ghost: {
        id: "ghost",
        name: "Призрак",
        health: 30,
        maxHealth: 30,
        damage: 8,
        attackRange: 10,
        attackSpeed: 1.2,
        walkSpeed: 14,
        rewardGold: 15,
        rewardExp: 25,
        modelName: "Ghost",
        soulWeight: 15,
        tier: 2,
    },
    vampire: {
        id: "vampire",
        name: "Вампир",
        health: 70,
        maxHealth: 70,
        damage: 15,
        attackRange: 8,
        attackSpeed: 1.3,
        walkSpeed: 11,
        rewardGold: 25,
        rewardExp: 40,
        modelName: "Vampire",
        soulWeight: 25,
        tier: 3,
    },
    zombie: {
        id: "zombie",
        name: "Зомби",
        health: 60,
        maxHealth: 60,
        damage: 12,
        attackRange: 7,
        attackSpeed: 1.4,
        walkSpeed: 10,
        rewardGold: 20,
        rewardExp: 35,
        modelName: "Drooling Zombie",
        soulWeight: 20,
        tier: 2,
    },
};