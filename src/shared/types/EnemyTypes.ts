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
}

export interface EnemySpawnInfo {
    enemyType: string;
    position: Vector3; // Используем встроенный тип Roblox
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
        modelName: "SkeletonModel",
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
        modelName: "GhostModel",
    },
};