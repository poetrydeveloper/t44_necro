import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "HasHealth",
})
export class LifeComponent extends BaseComponent<{}, Model> implements OnStart {
	public humanoid?: Humanoid;

	onStart() {
		// Используем WaitForChild, так как при спавне Humanoid может появиться чуть позже
		const humanoid = this.instance.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		
		if (!humanoid) {
			warn(`[LifeComponent] ❌ У объекта ${this.instance.Name} не найден Humanoid`);
			return;
		}
		this.humanoid = humanoid;
	}

	public takeDamage(amount: number) {
		if (this.humanoid) {
			this.humanoid.TakeDamage(amount);
		}
	}

	public isAlive(): boolean {
		return this.humanoid !== undefined && this.humanoid.Health > 0;
	}
}