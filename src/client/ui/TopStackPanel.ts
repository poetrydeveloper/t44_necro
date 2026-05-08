import { Controller, OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";
import { CorpseNetworking } from "shared/networking/CorpseNetworking";

@Controller({})
export class TopStackPanel implements OnStart {
	private gui?: ScreenGui;
	private label?: TextLabel;
	private events = CorpseNetworking.createClient({});

	onStart() {
		this.setupUI();
		
		// Обновляем UI при изменении армии (player не передаётся)
		this.events.updateArmyCount.connect((current: number, max: number) => {
			this.updateArmyCount(current, max);
		});
	}

	private setupUI() {
		const player = Players.LocalPlayer;
		if (!player) return;
		
		this.gui = new Instance("ScreenGui");
		this.gui.Name = "ArmyStackPanel";
		this.gui.ResetOnSpawn = false;
		this.gui.Parent = player.WaitForChild("PlayerGui");

		this.label = new Instance("TextLabel");
		this.label.Name = "ArmyCount";
		this.label.Size = new UDim2(0.2, 0, 0.05, 0);
		this.label.Position = new UDim2(0.5, -0.1, 0.05, 0);
		this.label.BackgroundColor3 = new Color3(0, 0, 0);
		this.label.BackgroundTransparency = 0.5;
		this.label.TextColor3 = new Color3(1, 1, 1);
		this.label.TextSize = 18;
		this.label.Font = Enum.Font.GothamBold;
		this.label.Text = "🧟 Армия: 0/5";
		this.label.Parent = this.gui;
	}

	public updateArmyCount(current: number, max: number) {
		if (this.label) {
			this.label.Text = `🧟 Армия: ${current}/${max}`;
		}
	}
}