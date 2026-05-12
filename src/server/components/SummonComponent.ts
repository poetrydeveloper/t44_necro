// src/server/components/SummonComponent.ts
import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

export type WeaponType = "RustySword" | "BoneBlade" | "SpectralDagger";
export type UnitType = "SkeletonWarrior" | "Ghost" | "Vampire" | "Zombie";

@Component({
	tag: "Summon",
})
export class SummonComponent extends BaseComponent<{}, Model> implements OnStart {
	public ownerId: number = 0;
	public unitType: UnitType = "SkeletonWarrior";
	public summonTime: number = 0;
	public weaponType: WeaponType = "RustySword";
	public soulWeight: number = 10;
	public tier: number = 1;

	onStart() {
		this.ownerId = this.instance.GetAttribute("OwnerId") as number || 0;
		this.unitType = (this.instance.GetAttribute("UnitType") as UnitType) || "SkeletonWarrior";
		this.weaponType = (this.instance.GetAttribute("WeaponType") as WeaponType) || "RustySword";
		this.summonTime = this.instance.GetAttribute("SummonTime") as number || os.clock();
		this.soulWeight = this.instance.GetAttribute("SoulWeight") as number || 10;
		this.tier = this.instance.GetAttribute("Tier") as number || 1;

		print(`[SummonComponent] 🧟 Юнит ${this.unitType} [${this.weaponType}] призван игроком ${this.ownerId}`);
	}
}