import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
	tag: "HasHealth",
})
export class LifeComponent extends BaseComponent<{}, Model> implements OnStart {
	public humanoid?: Humanoid;
	private isDead = false;

	onStart() {
		const humanoid = this.instance.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		
		if (!humanoid) {
			warn(`[LifeComponent] ❌ У объекта ${this.instance.Name} не найден Humanoid`);
			return;
		}
		this.humanoid = humanoid;

		// Подключаем слушатель смерти
		humanoid.Died.Connect(() => {
			this.handleDeath();
		});
	}

	private handleDeath() {
		if (this.isDead) return;
		this.isDead = true;

		const root = this.instance.PrimaryPart;
		if (root) {
			root.Anchored = true; // Фиксируем, чтобы не провалился
		}
		
		print(`[LifeComponent] 💀 ${this.instance.Name} официально мертв.`);
	}

	public takeDamage(amount: number) {
		if (this.humanoid && !this.isDead) {
			this.humanoid.TakeDamage(amount);
		}
	}

	public isAlive(): boolean {
		return !this.isDead && this.humanoid !== undefined && this.humanoid.Health > 0;
	}
}
