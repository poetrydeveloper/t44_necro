import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "Corpse",
})
export class CorpseComponent extends BaseComponent<{}, Model> implements OnStart {
	public templateId: string = "";
	public spawnTime: number = 0;
	private readonly lifetime = 60;

	onStart() {
		// 🛠 Читаем атрибуты, которые установил EnemyService
		this.templateId = this.instance.GetAttribute("templateId") as string || "Unknown";
		this.spawnTime = this.instance.GetAttribute("spawnTime") as number || os.clock();

		print(`[CorpseComponent] 🪦 Труп создан: ${this.templateId} в ${this.spawnTime}`);

		// Автоудаление через 60 сек
		task.delay(this.lifetime, () => {
			if (this.instance.Parent) {
				this.instance.Destroy();
			}
		});
	}
}