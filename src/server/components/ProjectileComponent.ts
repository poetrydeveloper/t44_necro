import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";

export interface ProjectileData {
	ownerId: number;
	targetPosition: Vector3;
	damage: number;
	speed: number;
	startTime: number;
}

@Component({
	tag: "Projectile",
})
export class ProjectileComponent extends BaseComponent<ProjectileData, Model> implements OnStart {
	
	onStart() {
		// Логика при создании снаряда на сервере (если нужна)
	}

	// Этот метод вызовется автоматически при удалении компонента/инстанса
	onDestroy() {
		// Очистка ресурсов, если нужно
	}
}