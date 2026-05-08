import { Controller, OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";
import { StatsNetworking } from "shared/networking/StatsNetworking";

interface StatsData {
	level: number;
	experience: number;
	requiredExperience: number;
	currentHealth: number;
	maxHealth: number;
	currentMana: number;
	maxMana: number;
}

@Controller({})
export class PlayerStatsPanel implements OnStart {
	private events = StatsNetworking.createClient({});
	
	private screenGui?: ScreenGui;
	private frame?: Frame;
	private levelLabel?: TextLabel;
	private expBar?: Frame;
	private expText?: TextLabel;
	private healthLabel?: TextLabel;
	private manaLabel?: TextLabel;
	
	onStart() {
		print("[PlayerStatsPanel] 🎨 UI панель игрока запущена");
		this.createUI();
		
		this.events.updateStats.connect((stats: StatsData) => {
			this.updateUI(stats);
		});
	}
	
	private createUI() {
		// Ждём появления игрока
		const player = Players.LocalPlayer;
		if (!player) return;
		
		// Создаём ScreenGui
		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "PlayerStatsUI";
		this.screenGui.Parent = player.WaitForChild("PlayerGui");
		
		// Главная панель (левый верхний угол)
		this.frame = new Instance("Frame");
		this.frame.Name = "StatsPanel";
		this.frame.Size = new UDim2(0, 250, 0, 120);
		this.frame.Position = new UDim2(0, 15, 0, 15);
		this.frame.BackgroundColor3 = Color3.fromRGB(30, 30, 40);
		this.frame.BackgroundTransparency = 0.2;
		this.frame.BorderSizePixel = 0;
		this.frame.Parent = this.screenGui;
		
		// Скругление углов
		const uiCorner = new Instance("UICorner");
		uiCorner.CornerRadius = new UDim(0, 8);
		uiCorner.Parent = this.frame;
		
		// Заголовок "Некромант"
		const title = new Instance("TextLabel");
		title.Name = "Title";
		title.Size = new UDim2(1, 0, 0, 25);
		title.Position = new UDim2(0, 0, 0, 5);
		title.BackgroundTransparency = 1;
		title.Text = "🧙 НЕКРОМАНТ";
		title.TextColor3 = Color3.fromRGB(200, 150, 255);
		title.TextSize = 18;
		title.TextXAlignment = Enum.TextXAlignment.Center;
		title.Font = Enum.Font.GothamBold;
		title.Parent = this.frame;
		
		// Уровень
		this.levelLabel = new Instance("TextLabel");
		this.levelLabel.Name = "Level";
		this.levelLabel.Size = new UDim2(1, 0, 0, 25);
		this.levelLabel.Position = new UDim2(0, 0, 0, 30);
		this.levelLabel.BackgroundTransparency = 1;
		this.levelLabel.Text = "Уровень: 1";
		this.levelLabel.TextColor3 = Color3.fromRGB(255, 215, 100);
		this.levelLabel.TextSize = 14;
		this.levelLabel.TextXAlignment = Enum.TextXAlignment.Left;
		this.levelLabel.Parent = this.frame;
		
		// Полоска опыта (фон)
		const expBg = new Instance("Frame");
		expBg.Name = "ExpBg";
		expBg.Size = new UDim2(1, 0, 0, 12);
		expBg.Position = new UDim2(0, 0, 0, 55);
		expBg.BackgroundColor3 = Color3.fromRGB(60, 60, 70);
		expBg.BorderSizePixel = 0;
		expBg.Parent = this.frame;
		
		const expCorner = new Instance("UICorner");
		expCorner.CornerRadius = new UDim(0, 4);
		expCorner.Parent = expBg;
		
		// Полоска опыта (заполнение)
		this.expBar = new Instance("Frame");
		this.expBar.Name = "ExpBar";
		this.expBar.Size = new UDim2(0, 0, 1, 0);
		this.expBar.BackgroundColor3 = Color3.fromRGB(100, 200, 255);
		this.expBar.BorderSizePixel = 0;
		this.expBar.Parent = expBg;
		
		const expBarCorner = new Instance("UICorner");
		expBarCorner.CornerRadius = new UDim(0, 4);
		expBarCorner.Parent = this.expBar;
		
		// Текст опыта
		this.expText = new Instance("TextLabel");
		this.expText.Name = "ExpText";
		this.expText.Size = new UDim2(1, 0, 1, 0);
		this.expText.BackgroundTransparency = 1;
		this.expText.Text = "0/100 опыта";
		this.expText.TextColor3 = Color3.fromRGB(255, 255, 255);
		this.expText.TextSize = 10;
		this.expText.TextXAlignment = Enum.TextXAlignment.Center;
		this.expText.Font = Enum.Font.Gotham;
		this.expText.Parent = expBg;
		
		// Здоровье
		this.healthLabel = new Instance("TextLabel");
		this.healthLabel.Name = "Health";
		this.healthLabel.Size = new UDim2(0.5, -5, 0, 20);
		this.healthLabel.Position = new UDim2(0, 0, 0, 70);
		this.healthLabel.BackgroundTransparency = 1;
		this.healthLabel.Text = "❤️ 100/100";
		this.healthLabel.TextColor3 = Color3.fromRGB(255, 100, 100);
		this.healthLabel.TextSize = 12;
		this.healthLabel.TextXAlignment = Enum.TextXAlignment.Left;
		this.healthLabel.Parent = this.frame;
		
		// Мана
		this.manaLabel = new Instance("TextLabel");
		this.manaLabel.Name = "Mana";
		this.manaLabel.Size = new UDim2(0.5, -5, 0, 20);
		this.manaLabel.Position = new UDim2(0.5, 5, 0, 70);
		this.manaLabel.BackgroundTransparency = 1;
		this.manaLabel.Text = "💙 200/200";
		this.manaLabel.TextColor3 = Color3.fromRGB(100, 150, 255);
		this.manaLabel.TextSize = 12;
		this.manaLabel.TextXAlignment = Enum.TextXAlignment.Left;
		this.manaLabel.Parent = this.frame;
	}
	
	private updateUI(stats: StatsData) {
		if (!this.levelLabel || !this.expBar || !this.expText || !this.healthLabel || !this.manaLabel) return;
		
		// Обновляем уровень
		this.levelLabel.Text = `Уровень: ${stats.level}`;
		
		// Обновляем полоску опыта
		const progress = stats.experience / stats.requiredExperience;
		this.expBar.Size = new UDim2(progress, 0, 1, 0);
		this.expText.Text = `${stats.experience}/${stats.requiredExperience} опыта`;
		
		// Обновляем здоровье
		this.healthLabel.Text = `❤️ ${stats.currentHealth}/${stats.maxHealth}`;
		
		// Обновляем ману
		this.manaLabel.Text = `💙 ${stats.currentMana}/${stats.maxMana}`;
		
		// Анимация при повышении уровня (мигание)
		if (stats.experience === 0 && stats.level > 1) {
			this.levelLabel.TextColor3 = Color3.fromRGB(255, 255, 100);
			task.delay(0.5, () => {
				if (this.levelLabel) {
					this.levelLabel.TextColor3 = Color3.fromRGB(255, 215, 100);
				}
			});
		}
	}
}