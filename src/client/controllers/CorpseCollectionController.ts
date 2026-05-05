import { Controller, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, UserInputService, RunService, CollectionService } from "@rbxts/services";
import { CorpseNetworking } from "shared/networking/CorpseNetworking";

@Controller({})
export class CorpseCollectionController implements OnStart {
	private player = Players.LocalPlayer;
	private events = CorpseNetworking.createClient({});
	private components = Dependency<Components>();

	private isHolding = false;
	private currentTargetCorpse?: Model;
	private progressGui?: ScreenGui;
	private progressBar?: Frame;
	private progressLabel?: TextLabel;

	onStart() {
		print("[CorpseCollection] 💀 Система сбора запущена");
		this.setupUI();
		this.setupInput();
		this.setupProximityCheck();
	}

	private setupUI() {
		this.progressGui = new Instance("ScreenGui");
		this.progressGui.Name = "ResurrectionUI";
		this.progressGui.ResetOnSpawn = false;
		this.progressGui.IgnoreGuiInset = true;
		this.progressGui.Parent = this.player.WaitForChild("PlayerGui");

		this.progressBar = new Instance("Frame");
		this.progressBar.Name = "ProgressBar";
		this.progressBar.Size = new UDim2(0.3, 0, 0.05, 0);
		this.progressBar.Position = new UDim2(0.5, -0.15, 0.8, 0);
		this.progressBar.BackgroundColor3 = new Color3(0.15, 0.15, 0.15);
		this.progressBar.BorderSizePixel = 0;
		this.progressBar.Visible = false;
		this.progressBar.Parent = this.progressGui;

		const fill = new Instance("Frame");
		fill.Name = "Fill";
		fill.Size = new UDim2(0, 0, 1, 0);
		fill.BackgroundColor3 = Color3.fromRGB(138, 43, 226);
		fill.BorderSizePixel = 0;
		fill.Parent = this.progressBar;

		this.progressLabel = new Instance("TextLabel");
		this.progressLabel.Name = "Label";
		this.progressLabel.Size = new UDim2(1, 0, 1, 0);
		this.progressLabel.BackgroundTransparency = 1;
		this.progressLabel.Text = "Зажми E для воскрешения";
		this.progressLabel.TextColor3 = new Color3(1, 1, 1);
		this.progressLabel.TextSize = 14;
		this.progressLabel.Font = Enum.Font.GothamSemibold;
		this.progressLabel.Parent = this.progressBar;
	}

	private setupInput() {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;
			if (input.KeyCode === Enum.KeyCode.E) {
				this.startHold();
			}
		});
		UserInputService.InputEnded.Connect((input) => {
			if (input.KeyCode === Enum.KeyCode.E) {
				this.stopHold();
			}
		});
	}

	private setupProximityCheck() {
		RunService.RenderStepped.Connect(() => {
			const root = this.player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!root) return;

			let nearest: Model | undefined;
			let minDist = 20;

			const corpses = CollectionService.GetTagged("Corpse");
			for (const corpse of corpses) {
				if (!corpse.IsA("Model")) continue;
				const dist = root.Position.sub(corpse.GetPivot().Position).Magnitude;
				if (dist < minDist) {
					minDist = dist;
					nearest = corpse as Model;
				}
			}

			this.currentTargetCorpse = nearest;
			if (this.progressLabel) {
				this.progressLabel.Text = nearest ? "🕯 Зажми E" : "";
			}
		});

		this.events.updateProgress.connect((percent) => {
			if (this.progressBar) {
				const fill = this.progressBar.FindFirstChild("Fill") as Frame;
				if (fill) fill.Size = new UDim2(percent, 0, 1, 0);
			}
		});

		this.events.resurrectionSuccess.connect(() => {
			if (this.progressBar) this.progressBar.Visible = false;
			this.isHolding = false;
		});

		this.events.resurrectionFailed.connect((reason) => {
			if (this.progressBar) this.progressBar.Visible = false;
			this.isHolding = false;
			print(`[Client] ❌ Воскрешение прервано: ${reason}`);
		});
	}

	private startHold() {
		if (!this.currentTargetCorpse || this.isHolding) return;
		this.isHolding = true;
		if (this.progressBar) this.progressBar.Visible = true;
		this.events.requestResurrection.fire(this.currentTargetCorpse.Name);
	}

	private stopHold() {
		if (!this.isHolding) return;
		this.isHolding = false;
		if (this.progressBar) this.progressBar.Visible = false;
		this.events.cancelResurrection.fire();
	}
}