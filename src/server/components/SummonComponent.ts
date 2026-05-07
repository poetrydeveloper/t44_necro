// src/server/components/SummonComponent.ts
import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

export type WeaponType = "RustySword" | "BoneBlade" | "SpectralDagger";

@Component({
	tag: "Summon",
})
export class SummonComponent extends BaseComponent<{}, Model> implements OnStart {
	public ownerId: number = 0;
	public templateId: string = "";
	public summonTime: number = 0;
	public weaponType: WeaponType = "RustySword";

	onStart() {
		this.ownerId = this.instance.GetAttribute("OwnerId") as number || 0;
		this.templateId = this.instance.GetAttribute("TemplateId") as string || "Unknown";
		this.weaponType = (this.instance.GetAttribute("WeaponType") as WeaponType) || "RustySword";
		this.summonTime = this.instance.GetAttribute("SummonTime") as number || os.clock();

		print(`[SummonComponent] 🧟 Юнит ${this.templateId} [${this.weaponType}] призван игроком ${this.ownerId}`);
	}
}