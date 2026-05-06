import { Controller, OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";

@Controller({})
export class TopStackPanel implements OnStart {
	private gui?: ScreenGui;
	private label?: TextLabel;

	onStart() {
		this.setupUI();
	}

	private setupUI() {
		this.gui = new Instance("ScreenGui");
		this.gui.Name = "ArmyStackPanel";
		this.gui.ResetOnSpawn = false;
		this.gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");

		this.label = new Instance("TextLabel");
		this.label.Name = "ArmyCount";
		this.label.Size = new UDim2(0.2, 0, 0.05, 0);
		this.label.Position = new UDim2(0.5, -0.1, 0.05, 0); // По центру сверху
		this.label.BackgroundColor3 = new Color3(0, 0, 0);
		this.label.BackgroundTransparency = 0.5;
		this.label.TextColor3 = new Color3(1, 1, 1);
		this.label.TextSize = 18;
		this.label.Font = Enum.Font.GothamBold;
		this.label.Text = "🧟 Армия: 0/5";
		this.label.Parent = this.gui;
	}

	// Этот метод можно вызывать из ResurrectionService через Networking для обновления UI
	public updateArmyCount(current: number, max: number) {
		if (this.label) {
			this.label.Text = `🧟 Армия: ${current}/${max}`;
		}
	}
}