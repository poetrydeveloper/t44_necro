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
		// Компонент автоматически прочитает атрибуты OwnerId, TargetPos, Speed из модели
		const ownerId = this.attributes.OwnerId;
		const targetPos = this.attributes.TargetPos;
		const speed = this.attributes.Speed;
		
		// print(`[ProjectileComponent] Снаряд создан игроком ${ownerId}, скорость ${speed}`);
	}

	onDestroy() {
		// Очистка
	}
}