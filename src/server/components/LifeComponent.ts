import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "HasHealth",
})
export class LifeComponent extends BaseComponent<{}, Model> implements OnStart {
	public humanoid?: Humanoid; // Сделали опциональным для безопасности

	onStart() {
		const humanoid = this.instance.FindFirstChildOfClass("Humanoid");
		if (!humanoid) {
			warn(`[LifeComponent] ❌ У объекта ${this.instance.Name} нет Humanoid`);
			return;
		}
		this.humanoid = humanoid;
	}

	public takeDamage(amount: number) {
		// Защита от вызова до инициализации или если humanoid пропал
		if (!this.humanoid) return;
		this.humanoid.TakeDamage(amount);
	}

	public isAlive(): boolean {
		return this.humanoid ? this.humanoid.Health > 0 : false;
	}
}
