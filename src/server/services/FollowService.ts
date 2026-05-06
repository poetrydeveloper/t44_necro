// src/server/services/FollowService.ts
import { Service, OnStart, OnTick, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players } from "@rbxts/services";
import { SummonComponent } from "server/components/SummonComponent";

@Service({})
export class FollowService implements OnStart, OnTick {
	private components = Dependency<Components>();
	
	private readonly FOLLOW_DISTANCE = 8;
	private readonly SPEED = 16;

	onStart() {
		print("[FollowService] 🏃 Система следования активна");
	}

	onTick(dt: number) {
		const summons = this.components.getAllComponents<SummonComponent>(SummonComponent);

		for (const summon of summons) {
			const model = summon.instance;
			if (!model.Parent) continue;
			if (summon.ownerId === 0) continue;

			const owner = Players.GetPlayerByUserId(summon.ownerId);
			if (!owner || !owner.Character) continue;

			const ownerRoot = owner.Character.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!ownerRoot) continue;

			const currentPivot = model.GetPivot();
			const dist = currentPivot.Position.sub(ownerRoot.Position).Magnitude;

			// Если далеко — двигаем модель к игроку
			if (dist > this.FOLLOW_DISTANCE) {
				const direction = ownerRoot.Position.sub(currentPivot.Position).Unit;
				const moveStep = direction.mul(this.SPEED * dt);
				
				// 🛠 PivotTo двигает ВСЮ модель, даже без суставов (Motor6D)
				model.PivotTo(currentPivot.add(moveStep));
			}
		}
	}
}