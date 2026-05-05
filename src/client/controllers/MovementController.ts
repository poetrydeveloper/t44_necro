import { Controller, OnStart } from "@flamework/core";
import { Players, UserInputService, Workspace, Debris, TweenService } from "@rbxts/services";

@Controller({})
export class MovementController implements OnStart {
	private player = Players.LocalPlayer;
	private character?: Model;
	private humanoid?: Humanoid;
	
	private moveConnection?: RBXScriptConnection;
	private raycastParams = new RaycastParams();

	onStart() {
		print("[MovementController] 🏃 Ручное управление готово");
		
		this.setupRaycast();
		
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		if (this.player.Character) this.onCharacterAdded(this.player.Character);
		
		// ЕДИНЫЙ слушатель ввода
		UserInputService.InputBegan.Connect((input, processed) => {
			if (processed) return;

			// 1. Остановка при нажатии WASD
			const keyCode = input.KeyCode;
			if (
				keyCode === Enum.KeyCode.W || 
				keyCode === Enum.KeyCode.A || 
				keyCode === Enum.KeyCode.S || 
				keyCode === Enum.KeyCode.D
			) {
				this.Stop();
				return;
			}

			// 2. Движение по клику мыши или тапу
			const isClick = input.UserInputType === Enum.UserInputType.MouseButton1;
			const isTouch = input.UserInputType === Enum.UserInputType.Touch;
			
			if (isClick || isTouch) {
				const mousePos = UserInputService.GetMouseLocation();
				const hit = this.getMouseWorldPosition(mousePos);
				if (hit) this.moveTo(hit);
			}
		});
	}

	private setupRaycast() {
		this.raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
	}

	private onCharacterAdded(character: Model) {
		this.character = character;
		this.humanoid = character.WaitForChild("Humanoid", 5) as Humanoid;
		this.raycastParams.FilterDescendantsInstances = [character];
	}

	private getMouseWorldPosition(mousePos: Vector2): Vector3 | undefined {
		const camera = Workspace.CurrentCamera;
		if (!camera) return undefined;
		
		const unitRay = camera.ViewportPointToRay(mousePos.X, mousePos.Y);
		const result = Workspace.Raycast(unitRay.Origin, unitRay.Direction.mul(500), this.raycastParams);
		
		return result?.Position;
	}

	private moveTo(position: Vector3) {
		if (!this.humanoid) return;
		
		this.moveConnection?.Disconnect();
		
		this.humanoid.MoveTo(position);
		this.showMarker(position);
		
		this.moveConnection = this.humanoid.MoveToFinished.Connect(() => {
			this.moveConnection?.Disconnect();
		});
	}

	private showMarker(position: Vector3) {
		const marker = new Instance("Part");
		marker.Name = "MoveEffect";
		marker.Shape = Enum.PartType.Cylinder; 
		marker.Size = new Vector3(0.1, 1.5, 1.5);
		marker.Color = Color3.fromRGB(170, 85, 255); 
		marker.Material = Enum.Material.Neon;
		marker.Anchored = true;
		marker.CanCollide = false;
		
		marker.CFrame = new CFrame(position.add(new Vector3(0, 0.05, 0))).mul(CFrame.Angles(0, 0, math.rad(90)));
		marker.Parent = Workspace;

		const tween = TweenService.Create(marker, new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size: new Vector3(0, 0, 0),
			Transparency: 1
		});
		
		tween.Play();
		Debris.AddItem(marker, 0.4);
	}

	public Stop() {
		this.moveConnection?.Disconnect();
		if (this.humanoid && this.character?.PrimaryPart) {
			this.humanoid.MoveTo(this.character.PrimaryPart.Position);
		}
	}
}
