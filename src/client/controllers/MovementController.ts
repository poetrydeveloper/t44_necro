import { Controller, OnStart } from "@flamework/core";
import { Players, UserInputService, Workspace, Debris, TweenService } from "@rbxts/services";

@Controller({})
export class MovementController implements OnStart {
	private player = Players.LocalPlayer;
	private character?: Model;
	private humanoid?: Humanoid;
	
	private currentTarget?: Vector3;
	private moveConnection?: RBXScriptConnection;
	private raycastParams = new RaycastParams();

	onStart() {
		print("[MovementController] 🚶 Система движения готова");
		
		this.setupRaycast();
		
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		if (this.player.Character) this.onCharacterAdded(this.player.Character);
		
		UserInputService.InputBegan.Connect((input, processed) => {
			if (processed) return;
			
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
		
		this.currentTarget = position;
		this.humanoid.MoveTo(position);
		this.showMarker(position);
		
		this.moveConnection?.Disconnect();
		this.moveConnection = this.humanoid.MoveToFinished.Connect(() => {
			this.currentTarget = undefined;
			this.moveConnection?.Disconnect();
		});
	}

	private showMarker(position: Vector3) {
		const marker = new Instance("Part");
		marker.Name = "MoveEffect";
		marker.Shape = Enum.PartType.Cylinder; // Цилиндр выглядит лучше для круга под ногами
		marker.Size = new Vector3(0.2, 2, 2);
		marker.Color = Color3.fromRGB(170, 85, 255); // Фиолетовый некромант
		marker.Material = Enum.Material.Neon;
		marker.Anchored = true;
		marker.CanCollide = false;
		
		// Кладем цилиндр плашмя на землю
		marker.CFrame = new CFrame(position.add(new Vector3(0, 0.1, 0))).mul(CFrame.Angles(0, 0, math.rad(90)));
		marker.Parent = Workspace;

		// Плавная анимация исчезновения
		const tween = TweenService.Create(marker, new TweenInfo(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Size: new Vector3(0, 0, 0),
			Transparency: 1
		});
		
		tween.Play();
		Debris.AddItem(marker, 0.6); // Авто-удаление
	}

	public Stop() {
		const root = this.character?.PrimaryPart;
		if (this.humanoid && root) {
			this.humanoid.MoveTo(root.Position);
			this.currentTarget = undefined;
		}
	}
}
