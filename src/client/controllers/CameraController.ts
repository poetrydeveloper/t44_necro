import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, RunService } from "@rbxts/services";

@Controller({})
export class CameraController implements OnStart {
	private camera = Workspace.CurrentCamera!;
	private player = Players.LocalPlayer;
	private rootPart?: BasePart;

	private readonly OFFSET = new Vector3(0, 18, 22); // Чуть увеличил для лучшего обзора
	private readonly LERP_SPEED = 12;

	onStart() {
		print("[CameraController] 📷 Система камеры запущена");

		this.setupCamera();

		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		if (this.player.Character) this.onCharacterAdded(this.player.Character);

		// Используем BindToRenderStep для максимальной плавности (приоритет Camera)
		RunService.BindToRenderStep(
			"CameraUpdate",
			Enum.RenderPriority.Camera.Value,
			(dt) => this.update(dt)
		);
	}

	private setupCamera() {
		this.camera.CameraType = Enum.CameraType.Scriptable;
		this.camera.FieldOfView = 75;
	}

	private onCharacterAdded(character: Model) {
		// Ждем RootPart аккуратно
		this.rootPart = character.WaitForChild("HumanoidRootPart", 5) as BasePart;
		
		if (this.rootPart) {
			// Мгновенно перемещаем камеру в начальную точку, чтобы не было "пролета" через всю карту
			const targetPos = this.rootPart.Position.add(this.OFFSET);
			this.camera.CFrame = CFrame.lookAt(targetPos, this.rootPart.Position);
		}
	}

	private update(dt: number) {
		if (!this.rootPart || !this.rootPart.Parent) return;

		const targetPos = this.rootPart.Position.add(this.OFFSET);
		const targetCframe = CFrame.lookAt(targetPos, this.rootPart.Position);

		// Плавная интерполяция с защитой от больших скачков dt
		const alpha = math.clamp(dt * this.LERP_SPEED, 0, 1);
		this.camera.CFrame = this.camera.CFrame.Lerp(targetCframe, alpha);
	}
}
