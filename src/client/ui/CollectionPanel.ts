// src/client/ui/CollectionPanel.ts
import { Controller, OnStart } from "@flamework/core";
import { Players, UserInputService } from "@rbxts/services";

interface CardDisplay {
	cardId: string;
	unitName: string;
	tier: number;
	soulWeight: number;
	upgradeLevel: number;
}

@Controller({})
export class CollectionPanel implements OnStart {
	private screenGui?: ScreenGui;
	private frame?: Frame;
	private weightLabel?: TextLabel;
	private isOpen = false;

	onStart() {
		print("[CollectionPanel] 🃏 UI коллекции запущен");
		this.createUI();
		this.setupInput();
	}

	private createUI() {
		const player = Players.LocalPlayer;
		if (!player) return;
		
		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "CollectionUI";
		this.screenGui.Enabled = false;
		this.screenGui.Parent = player.WaitForChild("PlayerGui");
		
		const overlay = new Instance("Frame");
		overlay.Name = "Overlay";
		overlay.Size = new UDim2(1, 0, 1, 0);
		overlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
		overlay.BackgroundTransparency = 0.7;
		overlay.Parent = this.screenGui;
		
		overlay.InputBegan.Connect(() => this.close());
		
		this.frame = new Instance("Frame");
		this.frame.Name = "CollectionFrame";
		this.frame.Size = new UDim2(0.8, 0, 0.8, 0);
		this.frame.Position = new UDim2(0.1, 0, 0.1, 0);
		this.frame.BackgroundColor3 = Color3.fromRGB(30, 30, 40);
		this.frame.BorderSizePixel = 0;
		this.frame.Parent = this.screenGui;
		
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 12);
		corner.Parent = this.frame;
		
		const title = new Instance("TextLabel");
		title.Name = "Title";
		title.Size = new UDim2(1, 0, 0, 50);
		title.Position = new UDim2(0, 0, 0, 0);
		title.BackgroundColor3 = Color3.fromRGB(40, 40, 50);
		title.Text = "📚 КОЛЛЕКЦИЯ КАРТОЧЕК";
		title.TextColor3 = Color3.fromRGB(255, 215, 100);
		title.TextSize = 24;
		title.Font = Enum.Font.GothamBold;
		title.Parent = this.frame;
		
		const titleCorner = new Instance("UICorner");
		titleCorner.CornerRadius = new UDim(0, 12);
		titleCorner.Parent = title;
		
		const closeBtn = new Instance("TextButton");
		closeBtn.Name = "CloseButton";
		closeBtn.Size = new UDim2(0, 40, 0, 40);
		closeBtn.Position = new UDim2(1, -50, 0, 5);
		closeBtn.BackgroundColor3 = Color3.fromRGB(255, 50, 50);
		closeBtn.Text = "✕";
		closeBtn.TextColor3 = Color3.fromRGB(255, 255, 255);
		closeBtn.TextSize = 24;
		closeBtn.Font = Enum.Font.GothamBold;
		closeBtn.Parent = this.frame;
		
		const closeCorner = new Instance("UICorner");
		closeCorner.CornerRadius = new UDim(0, 8);
		closeCorner.Parent = closeBtn;
		
		closeBtn.MouseButton1Click.Connect(() => this.close());
		
		const container = new Instance("ScrollingFrame");
		container.Name = "CardsContainer";
		container.Size = new UDim2(1, -20, 1, -80);
		container.Position = new UDim2(0, 10, 0, 60);
		container.BackgroundTransparency = 1;
		container.ScrollBarThickness = 8;
		container.Parent = this.frame;
		
		const gridLayout = new Instance("UIGridLayout");
		gridLayout.CellSize = new UDim2(0, 180, 0, 200);
		gridLayout.CellPadding = new UDim2(0, 10, 0, 10);
		gridLayout.FillDirection = Enum.FillDirection.Vertical;
		gridLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
		gridLayout.Parent = container;
		
		this.weightLabel = new Instance("TextLabel");
		this.weightLabel.Name = "WeightLabel";
		this.weightLabel.Size = new UDim2(1, 0, 0, 30);
		this.weightLabel.Position = new UDim2(0, 0, 1, -35);
		this.weightLabel.BackgroundColor3 = Color3.fromRGB(40, 40, 50);
		this.weightLabel.Text = "⚖️ Вес душ: 0/50";
		this.weightLabel.TextColor3 = Color3.fromRGB(150, 200, 255);
		this.weightLabel.TextSize = 14;
		this.weightLabel.Font = Enum.Font.Gotham;
		this.weightLabel.Parent = this.frame;
		
		const weightCorner = new Instance("UICorner");
		weightCorner.CornerRadius = new UDim(0, 6);
		weightCorner.Parent = this.weightLabel;
	}

	private setupInput() {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;
			
			if (input.KeyCode === Enum.KeyCode.C) {
				if (this.isOpen) {
					this.close();
				} else {
					this.open();
				}
			}
		});
	}

	private open() {
		if (!this.screenGui) return;
		this.isOpen = true;
		this.screenGui.Enabled = true;
		this.refreshCards();
	}

	private close() {
		if (!this.screenGui) return;
		this.isOpen = false;
		this.screenGui.Enabled = false;
	}

	private refreshCards() {
		this.updateWeightDisplay(30, 50);
		
		const testCards: CardDisplay[] = [
			{ cardId: "1", unitName: "Скелет-воин", tier: 1, soulWeight: 10, upgradeLevel: 0 },
			{ cardId: "2", unitName: "Призрак", tier: 2, soulWeight: 15, upgradeLevel: 1 },
			{ cardId: "3", unitName: "Вампир", tier: 3, soulWeight: 25, upgradeLevel: 0 },
		];
		
		this.displayCards(testCards);
	}

	private updateWeightDisplay(current: number, max: number) {
		if (this.weightLabel) {
			this.weightLabel.Text = `⚖️ Вес душ: ${current}/${max}`;
		}
	}

	private displayCards(cards: CardDisplay[]) {
		const container = this.frame?.FindFirstChild("CardsContainer") as ScrollingFrame;
		if (!container) return;
		
		for (const child of container.GetChildren()) {
			if (child.IsA("Frame")) child.Destroy();
		}
		
		for (const card of cards) {
			const cardFrame = this.createCardFrame(card);
			cardFrame.Parent = container;
		}
	}

	private createCardFrame(card: CardDisplay): Frame {
		const frame = new Instance("Frame");
		frame.Size = new UDim2(0, 180, 0, 200);
		frame.BackgroundColor3 = this.getTierColor(card.tier);
		frame.BorderSizePixel = 0;
		
		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 10);
		corner.Parent = frame;
		
		const icon = new Instance("TextLabel");
		icon.Size = new UDim2(1, 0, 0, 80);
		icon.Position = new UDim2(0, 0, 0, 10);
		icon.BackgroundTransparency = 1;
		icon.Text = "🃏";
		icon.TextSize = 50;
		icon.TextColor3 = Color3.fromRGB(255, 255, 255);
		icon.Parent = frame;
		
		const nameLabel = new Instance("TextLabel");
		nameLabel.Size = new UDim2(1, 0, 0, 30);
		nameLabel.Position = new UDim2(0, 0, 0, 95);
		nameLabel.BackgroundTransparency = 1;
		nameLabel.Text = card.unitName;
		nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
		nameLabel.TextSize = 14;
		nameLabel.Font = Enum.Font.GothamBold;
		nameLabel.Parent = frame;
		
		// Исправлено: вместо repeat используем цикл
		let stars = "";
		for (let i = 0; i < card.tier; i++) {
			stars += "★";
		}
		for (let i = 0; i < 5 - card.tier; i++) {
			stars += "☆";
		}
		
		const tierLabel = new Instance("TextLabel");
		tierLabel.Size = new UDim2(1, 0, 0, 20);
		tierLabel.Position = new UDim2(0, 0, 0, 125);
		tierLabel.BackgroundTransparency = 1;
		tierLabel.Text = stars;
		tierLabel.TextColor3 = Color3.fromRGB(255, 215, 100);
		tierLabel.TextSize = 12;
		tierLabel.Parent = frame;
		
		const weightLabel = new Instance("TextLabel");
		weightLabel.Size = new UDim2(1, 0, 0, 20);
		weightLabel.Position = new UDim2(0, 0, 0, 145);
		weightLabel.BackgroundTransparency = 1;
		weightLabel.Text = `⚖️ ${card.soulWeight}`;
		weightLabel.TextColor3 = Color3.fromRGB(150, 200, 255);
		weightLabel.TextSize = 12;
		weightLabel.Parent = frame;
		
		if (card.upgradeLevel > 0) {
			const upgradeLabel = new Instance("TextLabel");
			upgradeLabel.Size = new UDim2(1, 0, 0, 20);
			upgradeLabel.Position = new UDim2(0, 0, 0, 165);
			upgradeLabel.BackgroundTransparency = 1;
			upgradeLabel.Text = `+${card.upgradeLevel}`;
			upgradeLabel.TextColor3 = Color3.fromRGB(100, 255, 100);
			upgradeLabel.TextSize = 12;
			upgradeLabel.Parent = frame;
		}
		
		return frame;
	}

	private getTierColor(tier: number): Color3 {
		switch (tier) {
			case 1: return Color3.fromRGB(100, 100, 100);
			case 2: return Color3.fromRGB(50, 100, 50);
			case 3: return Color3.fromRGB(50, 50, 150);
			case 4: return Color3.fromRGB(150, 50, 150);
			case 5: return Color3.fromRGB(200, 150, 50);
			default: return Color3.fromRGB(60, 60, 70);
		}
	}
}