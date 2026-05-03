import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, UserInputService } from "@rbxts/services";

interface CorpseCard {
	corpse: BasePart;
	soulWeight: number;
}

@Controller({})
export class CorpseCollectionController implements OnStart {
	private player = Players.LocalPlayer;
	private rootPart?: BasePart;
	private currentCorpseInRange: BasePart | undefined;
	private cardVisible = false;
	private cardGui?: ScreenGui;
	private holdStartTime = 0;
	private isHolding = false;
	private readonly COLLECTION_RADIUS = 20;
	private readonly HOLD_DURATION = 1; // 1 секунда зажатия
	
	onStart() {
		print("[CorpseCollectionController] 💀 Система сбора трупов запущена");
		
		// Создаём UI для карточки
		this.createCardUI();
		
		// Отслеживаем персонажа
		this.player.CharacterAdded.Connect((char) => {
			this.rootPart = char.WaitForChild("HumanoidRootPart", 5) as BasePart;
		});
		
		if (this.player.Character) {
			this.rootPart = this.player.Character.WaitForChild("HumanoidRootPart", 5) as BasePart;
		}
		
		// Основной цикл проверки радиуса
		task.spawn(() => {
			while (task.wait(0.1)) {
				this.checkForCorpses();
			}
		});
		
		// Обработка зажатия кнопки
		UserInputService.InputBegan.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1 && this.currentCorpseInRange) {
				this.startHold();
			}
		});
		
		UserInputService.InputEnded.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				this.cancelHold();
			}
		});
	}
	
	private createCardUI() {
		this.cardGui = new Instance("ScreenGui");
		this.cardGui.Name = "CorpseCardGui";
		this.cardGui.Parent = this.player.FindFirstChild("PlayerGui") || this.player;
		
		const frame = new Instance("Frame");
		frame.Name = "CardFrame";
		frame.Size = new UDim2(0, 200, 0, 100);
		frame.Position = new UDim2(0.5, -100, 0.7, 0);
		frame.BackgroundColor3 = Color3.fromRGB(30, 30, 40);
		frame.BackgroundTransparency = 1;
		frame.BorderSizePixel = 0;
		frame.Parent = this.cardGui;
		
		const title = new Instance("TextLabel");
		title.Name = "Title";
		title.Size = new UDim2(1, 0, 0.5, 0);
		title.BackgroundTransparency = 1;
		title.Text = "Мёртвый скелет";
		title.TextColor3 = Color3.fromRGB(255, 200, 100);
		title.TextScaled = true;
		title.Font = Enum.Font.GothamBold;
		title.Parent = frame;
		
		const subtitle = new Instance("TextLabel");
		subtitle.Name = "Subtitle";
		subtitle.Size = new UDim2(1, 0, 0.4, 0);
		subtitle.Position = new UDim2(0, 0, 0.5, 0);
		subtitle.BackgroundTransparency = 1;
		subtitle.Text = "Зажмите ЛКМ для воскрешения";
		subtitle.TextColor3 = Color3.fromRGB(200, 200, 200);
		subtitle.TextSize = 14;
		subtitle.Font = Enum.Font.Gotham;
		subtitle.Parent = frame;
		
		const progressBar = new Instance("Frame");
		progressBar.Name = "ProgressBar";
		progressBar.Size = new UDim2(0, 0, 0.1, 0);
		progressBar.Position = new UDim2(0, 0, 0.9, 0);
		progressBar.BackgroundColor3 = Color3.fromRGB(100, 200, 100);
		progressBar.BackgroundTransparency = 0.5;
		progressBar.Parent = frame;
	}
	
	private checkForCorpses() {
		if (!this.rootPart) return;
		
		const corpsesParent = Workspace.FindFirstChild("Corpses") || Workspace;
		let nearestCorpse: BasePart | undefined;
		let nearestDist = this.COLLECTION_RADIUS;
		
		for (const child of corpsesParent.GetChildren()) {
			if (child.IsA("Part") && child.Name === "Corpse") {
				const dist = child.Position.sub(this.rootPart.Position).Magnitude;
				if (dist < nearestDist) {
					nearestDist = dist;
					nearestCorpse = child;
				}
			}
		}
		
		this.currentCorpseInRange = nearestCorpse;
		this.updateCardVisibility(nearestCorpse !== undefined);
	}
	
	private updateCardVisibility(visible: boolean) {
		if (visible === this.cardVisible) return;
		this.cardVisible = visible;
		
		const frame = this.cardGui?.FindFirstChild("CardFrame") as Frame;
		if (frame) {
			frame.BackgroundTransparency = visible ? 0.7 : 1;
		}
	}
	
	private startHold() {
		this.isHolding = true;
		this.holdStartTime = os.clock();
		
		task.spawn(() => {
			while (this.isHolding && this.currentCorpseInRange) {
				task.wait(0.05);
				const elapsed = os.clock() - this.holdStartTime;
				const progress = math.min(elapsed / this.HOLD_DURATION, 1);
				
				const progressBar = this.cardGui?.FindFirstChild("CardFrame")?.FindFirstChild("ProgressBar") as Frame;
				if (progressBar) {
					progressBar.Size = new UDim2(progress, 0, 0.1, 0);
				}
				
				if (elapsed >= this.HOLD_DURATION) {
					this.collectCorpse();
					break;
				}
			}
		});
	}
	
	private cancelHold() {
		this.isHolding = false;
		const progressBar = this.cardGui?.FindFirstChild("CardFrame")?.FindFirstChild("ProgressBar") as Frame;
		if (progressBar) {
			progressBar.Size = new UDim2(0, 0, 0.1, 0);
		}
	}
	
	private collectCorpse() {
		if (!this.currentCorpseInRange) return;
		
		const soulWeight = this.currentCorpseInRange.GetAttribute("SoulWeight") || 50;
		print(`[CorpseCollectionController] 💀 Подобран труп! Вес души: ${soulWeight}`);
		
		// Отправляем событие на сервер
		// (пока просто логируем, позже добавим сетевой вызов)
		
		this.currentCorpseInRange.Destroy();
		this.currentCorpseInRange = undefined;
		this.updateCardVisibility(false);
		this.cancelHold();
	}
}