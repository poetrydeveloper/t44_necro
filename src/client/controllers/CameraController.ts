import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, RunService } from "@rbxts/services";

@Controller({})
export class CameraController implements OnStart {
	private camera = Workspace.CurrentCamera!;
	private player = Players.LocalPlayer;
	private rootPart?: BasePart;

	private readonly OFFSET = new Vector3(0, 18, 22);
	private readonly SMOOTHNESS = 0.15; // Чем меньше, тем плавнее (0.05 - 0.2)

	onStart() {
		this.camera.CameraType = Enum.CameraType.Scriptable;
		
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		if (this.player.Character) this.onCharacterAdded(this.player.Character);

		// Используем BindToRenderStep с приоритетом ПОСЛЕ персонажа
		RunService.BindToRenderStep("CameraUpdate", Enum.RenderPriority.Camera.Value, () => {
			this.updateCamera();
		});
	}

	private onCharacterAdded(character: Model) {
		this.rootPart = character.WaitForChild("HumanoidRootPart", 10) as BasePart;
	}

	private updateCamera() {
		if (!this.rootPart) return;

		const targetCFrame = CFrame.lookAt(this.rootPart.Position.add(this.OFFSET), this.rootPart.Position);
		
		// Самый стабильный Lerp, который не зависит от FPS и не дрожит
		this.camera.CFrame = this.camera.CFrame.Lerp(targetCFrame, this.SMOOTHNESS);
	}
}
