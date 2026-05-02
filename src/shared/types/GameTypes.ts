// ============================================
// ХАРАКТЕРИСТИКИ НЕКРОМАНТА
// ============================================
export interface NecromancerStats {
    level: number;
    experience: number;
    maxHealth: number;
    currentHealth: number;
    maxMana: number;
    currentMana: number;
    manaRegen: number;
    intelligence: number;   
    spirit: number;         
    vitality: number;       
    resistances: {
        fire: number;
        ice: number;
        poison: number;
        dark: number;
    };
}

export type SlotType = "weapon" | "helmet" | "chest" | "pants" | "boots" | "gloves" | "cloak" | "ring" | "amulet" | "bracer";

export interface Item {
    id: string;
    name: string;
    type: "weapon" | "armor" | "jewelry";
    slot: SlotType;
    rarity: 1 | 2 | 3 | 4 | 5;
    stats?: Partial<Pick<NecromancerStats, "intelligence" | "spirit" | "vitality" | "manaRegen">>;
    elementalBonus?: {
        fire?: number;
        ice?: number;
        poison?: number;
        dark?: number;
    };
}

export interface Card {
    cardId: string;
    unitType: string;
    unitName: string;
    tier: 1 | 2 | 3 | 4 | 5;
    soulWeight: number;
    upgradeLevel: number;
    modifiers: { type: string; value: number; stackable: boolean }[];
}

export interface Collection {
    maxSoulWeight: number;
    currentSoulWeight: number;
    cards: Record<string, Card>;
    activeStack: Card[];
}

export type SpellType = "fireball" | "iceball" | "poisonball" | "necroball";

export interface Spell {
    type: SpellType;
    damage: number;
    manaCost: number;
    cooldown: number;
}
