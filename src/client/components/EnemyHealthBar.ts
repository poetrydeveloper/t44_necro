import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { RunService } from "@rbxts/services";

@Component({ tag: "HasHealth" }) // Делаем универсальным
export class EnemyHealthBar extends BaseComponent<{}, Model> implements OnStart {
	private billboard?: BillboardGui;
	private healthFill?: Frame;
	private textLabel?: TextLabel;
	private connection?: RBXScriptConnection;
	private renderConnection?: RBXScriptConnection;

	private targetHealthPercent = 1;
	private currentDisplayPercent = 1;

	onStart() {
		const model = this.instance;
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		// Используем PrimaryPart, если он есть, иначе ищем RootPart
		const rootPart = (model.PrimaryPart || model.WaitForChild("HumanoidRootPart", 5)) as BasePart;

		if (!humanoid || !rootPart) return;

		this.billboard = new Instance("BillboardGui");
		this.billboard.Name = "HealthDisplay";
		this.billboard.Size = new UDim2(4, 0, 0.6, 0);
		this.billboard.StudsOffset = new Vector3(0, 3.5, 0);
		this.billboard.AlwaysOnTop = true;
		this.billboard.Adornee = rootPart;
		this.billboard.Parent = model;

		const background = new Instance("Frame");
		background.Size = new UDim2(1, 0, 1, 0);
		background.BackgroundColor3 = Color3.fromRGB(15, 15, 15);
		background.BackgroundTransparency = 0.3;
		background.BorderSizePixel = 0;
		background.ZIndex = 1;
		background.Parent = this.billboard;

		new Instance("UICorner", background).CornerRadius = new UDim(0.5, 0);

		this.healthFill = new Instance("Frame");
		this.healthFill.Size = new UDim2(1, 0, 1, 0);
		this.healthFill.BackgroundColor3 = Color3.fromRGB(255, 50, 50);
		this.healthFill.BorderSizePixel = 0;
		this.healthFill.ZIndex = 2;
		this.healthFill.Parent = background;

		new Instance("UICorner", this.healthFill).CornerRadius = new UDim(0.5, 0);

		this.textLabel = new Instance("TextLabel");
		this.textLabel.Size = new UDim2(1, 0, 1, 0);
		this.textLabel.BackgroundTransparency = 1;
		this.textLabel.TextColor3 = new Color3(1, 1, 1);
		this.textLabel.TextSize = 14;
		this.textLabel.Font = Enum.Font.GothamBold;
		this.textLabel.TextStrokeTransparency = 0.5;
		this.textLabel.ZIndex = 3;
		this.textLabel.Parent = background;

		const updateHealth = () => {
			this.targetHealthPercent = math.clamp(humanoid.Health / humanoid.MaxHealth, 0, 1);
		};

		this.connection = humanoid.GetPropertyChangedSignal("Health").Connect(updateHealth);
		updateHealth();

		this.renderConnection = RunService.RenderStepped.Connect((dt) => {
			if (!this.healthFill || !this.textLabel) return;

			this.currentDisplayPercent = math.lerp(this.currentDisplayPercent, this.targetHealthPercent, dt * 10);
			this.healthFill.Size = new UDim2(this.currentDisplayPercent, 0, 1, 0);
			
			// Обновляем текст
			const percentInt = math.floor(this.currentDisplayPercent * 100);
			this.textLabel.Text = `${percentInt}%`;

			// Плавная смена цвета: от зеленого к красному
			this.healthFill.BackgroundColor3 = Color3.fromRGB(255, 50, 50).Lerp(Color3.fromRGB(50, 255, 50), this.currentDisplayPercent);
		});
	}

	onDestroy() {
		this.connection?.Disconnect();
		this.renderConnection?.Disconnect();
		this.billboard?.Destroy();
	}
}
