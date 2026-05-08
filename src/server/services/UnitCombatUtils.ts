import { WeaponType } from "server/components/SummonComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { Components } from "@flamework/components";

export const WEAPON_STATS: Record<WeaponType, { damage: number; range: number }> = {
	RustySword: { damage: 8, range: 6 },
	BoneBlade: { damage: 12, range: 7 },
	SpectralDagger: { damage: 6, range: 5 }
};

export const COMBAT_CONFIG = {
	CHASE_RANGE: 50,
	FOLLOW_DISTANCE: 8,
	MOVE_SPEED: 16,
	ATTACK_COOLDOWN: 1.2
} as const;

export function getLifeComponent(components: Components, instance: Instance): LifeComponent | undefined {
	const [success, life] = pcall(() => components.getComponent<LifeComponent>(instance));
	if (success && life) {
		return life as LifeComponent;
	}
	return undefined;
}

export function isEnemyAlive(components: Components, instance: Instance): boolean {
	const life = getLifeComponent(components, instance);
	return life !== undefined && life.isAlive();
}