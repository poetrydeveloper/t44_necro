// src/server/components/SummonComponent.ts
import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "Summon",
})
export class SummonComponent extends BaseComponent<{}, Model> implements OnStart {
	public ownerId: number = 0;
	public templateId: string = "";
	public summonTime: number = 0;

	onStart() {
		// 🛠 Читаем данные из атрибутов модели. 
		// Это надёжнее, чем ждать инициализации свойств извне, 
		// так как атрибуты реплицируются и сохраняются на инстансе.
		this.ownerId = this.instance.GetAttribute("OwnerId") as number || 0;
		this.templateId = this.instance.GetAttribute("TemplateId") as string || "Unknown";
		this.summonTime = this.instance.GetAttribute("SummonTime") as number || os.clock();

		print(`[SummonComponent] 🧟 Юнит ${this.templateId} призван игроком ${this.ownerId}`);
	}
}