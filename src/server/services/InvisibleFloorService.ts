import { Service, OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";

@Service({})
export class InvisibleFloorService implements OnStart {
	onStart() {
		this.createInvisibleFloor();
	}

	private createInvisibleFloor() {
		if (Workspace.FindFirstChild("InvisibleAI_Floor")) return;
		
		const floor = new Instance("Part");
		floor.Name = "InvisibleAI_Floor";
		floor.Size = new Vector3(2048, 1, 2048);
		floor.Position = new Vector3(0, -0.5, 0);
		floor.Transparency = 1;
		floor.Anchored = true;
		floor.CanCollide = true;
		floor.CastShadow = false;
		floor.Material = Enum.Material.SmoothPlastic;
		floor.Parent = Workspace;
		
		print("[InvisibleFloorService] 🏗 Искусственный пол создан");
	}
}