import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "Enemy",
})
export class EnemyComponent extends BaseComponent<{}, Model> implements OnStart {
	public rootPart!: BasePart;

	onStart() {
		// Безопасный поиск главной части
		const root = this.instance.PrimaryPart 
			|| (this.instance.FindFirstChild("HumanoidRootPart") as BasePart | undefined);

		if (!root || !root.IsA("BasePart")) {
			warn(`[EnemyComponent] ❌ У ${this.instance.Name} нет корректного RootPart`);
			return;
		}

		this.rootPart = root;
	}

	/**
	 * Удобный метод для AI и расчетов расстояния
	 */
	public getPosition(): Vector3 {
		return this.rootPart.Position;
	}
}
