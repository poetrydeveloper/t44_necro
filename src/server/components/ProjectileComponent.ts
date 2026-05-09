import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

interface ProjectileAttributes {
	OwnerId: number;
	TargetPos: Vector3;
	Speed: number;
}

@Component({
	tag: "Projectile",
})
export class ProjectileComponent extends BaseComponent<ProjectileAttributes, Model> implements OnStart {
	
	onStart() {
		// Временно отключено для отладки
		// const ownerId = this.attributes.OwnerId;
		// const targetPos = this.attributes.TargetPos;
		// const speed = this.attributes.Speed;
	}

	onDestroy() {
		// Очистка
	}
}