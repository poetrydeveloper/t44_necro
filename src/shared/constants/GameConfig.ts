import { NecromancerStats } from "shared/types/GameTypes";

export const GameConfig = {
    version: "0.1.0",
    
    // Стартовые статы некроманта
    startingStats: {
        level: 1,
        experience: 0,
        maxHealth: 100,
        currentHealth: 100,
        maxMana: 200,
        currentMana: 200,
        manaRegen: 10,
        intelligence: 10,
        spirit: 10,
        vitality: 10,
        resistances: { // Сгруппировал как в интерфейсе
            fire: 0,
            ice: 0,
            poison: 0,
            dark: 0,
        },
    } satisfies NecromancerStats, // Проверка, что конфиг не врет типам
    
    // ... остальной твой код без изменений ...
    levelProgression: {
        baseExpToLevel: 100,
        expMultiplier: 1.2,
        maxLevel: 100,
        statsPerLevel: {
            intelligence: 2,
            spirit: 1,
            vitality: 2,
            maxHealth: 15,
            maxMana: 10,
        },
    },

    manaSystem: {
        baseRegen: 10,
        regenFromSpirit: 0.5,
        combatRegenMultiplier: 0.5,
        outOfCombatRegenMultiplier: 1.5,
    },

    spells: {
        fireball: {
            damage: 40,
            manaCost: 20,
            cooldown: 1.5,
            castRange: 50,
            projectileSpeed: 80,
            effect: { burnDamage: 10, burnDuration: 3 },
        },
        // ... и так далее
    },

    world: {
        collectionRadius: 20,
        locationOrder: ["well", "graveyard", "village", "city", "castle"],
    },
} as const;
