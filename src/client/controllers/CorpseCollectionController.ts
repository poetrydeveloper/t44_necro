import { Controller, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, UserInputService, CollectionService } from "@rbxts/services";
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
	private isUIVisible = false;

	onStart() {
		print("[CorpseCollection] 💀 Система сбора запущена");
		this.setupUI();
		this.setupInput();
		this.setupProximityCheck();
		
		// 🔧 ФИКС 1: Слушаем появление новых могил
		CollectionService.GetInstanceAddedSignal("Corpse").Connect((instance) => {
			if (instance.IsA("Model")) {
				print(`[CorpseCollection] 🔔 Появилась новая могила: ${instance.Name}`);
			}
		});
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
		this.progressLabel.Text = "";
		this.progressLabel.TextColor3 = new Color3(1, 1, 1);
		this.progressLabel.TextSize = 14;
		this.progressLabel.Font = Enum.Font.GothamSemibold;
		this.progressLabel.Visible = false;
		this.progressLabel.Parent = this.progressBar;
	}

	private setupInput() {
		// 🔧 ФИКС: Добавлен фильтр gameProcessed
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

	// 🔧 ФИКС 2: Оптимизированный цикл проверки (10 раз в секунду вместо 60)
	private setupProximityCheck() {
		task.spawn(() => {
			while (true) {
				task.wait(0.1); // Проверяем 10 раз в секунду
				
				const character = this.player.Character;
				const root = character?.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!root) continue;

				let nearest: Model | undefined;
				let minDist = 15; // Радиус сбора

				const corpses = CollectionService.GetTagged("Corpse");
				
				for (const corpse of corpses) {
					if (!corpse.IsA("Model")) continue;
					
					const corpsePos = corpse.GetPivot().Position;
					const dist = root.Position.sub(corpsePos).Magnitude;

					if (dist < minDist) {
						minDist = dist;
						nearest = corpse;
					}
				}

				this.currentTargetCorpse = nearest;
				
				// Обновляем UI
				if (this.progressLabel) {
					if (nearest) {
						this.progressLabel.Visible = true;
						this.progressLabel.Text = `🕯 [E] Воскресить (${math.floor(minDist * 10) / 10}м)`;
					} else {
						this.progressLabel.Visible = false;
					}
				}
			}
		});

		// Слушаем события от сервера
		this.events.updateProgress.connect((percent) => {
			if (this.progressBar) {
				this.progressBar.Visible = true;
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
		if (!this.currentTargetCorpse || this.isHolding) {
			if (!this.currentTargetCorpse) {
				print("[DEBUG] Нет могилы рядом");
			}
			return;
		}
		
		// 🔧 ФИКС 3: Отправляем модель целиком (Instance), а не имя
		print(`[DEBUG] Начинаем воскрешение могилы: ${this.currentTargetCorpse.Name}`);
		this.isHolding = true;
		this.events.requestResurrection.fire(this.currentTargetCorpse);
	}

	private stopHold() {
		if (!this.isHolding) return;
		this.isHolding = false;
		if (this.progressBar) this.progressBar.Visible = false;
		this.events.cancelResurrection.fire();
	}
}