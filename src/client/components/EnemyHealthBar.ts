import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { RunService } from "@rbxts/services";

print("[EnemyHealthBar] ⚡ МОДУЛЬ ЗАГРУЖЕН");

@Component({ tag: "Enemy" })
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
		print("[EnemyHealthBar] 🩸 onStart() ВЫЗВАН для:", model.Name);

		// Ждем гуманоида и основную часть (важно для Adornee)
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		const rootPart = model.WaitForChild("HumanoidRootPart", 5) as BasePart;

		if (!humanoid || !rootPart) {
			warn(`[EnemyHealthBar] ❌ Ошибка: У ${model.Name} не найден Humanoid или RootPart`);
			return;
		}

		// 1. Создаем BillboardGui (над головой)
		this.billboard = new Instance("BillboardGui");
		this.billboard.Name = "HealthDisplay";
		this.billboard.Size = new UDim2(4, 0, 0.8, 0); // Оптимальный размер
		this.billboard.StudsOffset = new Vector3(0, 3.5, 0);
		this.billboard.AlwaysOnTop = true; // Видно сквозь стены (можно выключить)
		this.billboard.Adornee = rootPart;
		this.billboard.Parent = model;

		// 2. Фон со скруглением
		const background = new Instance("Frame");
		background.Size = new UDim2(1, 0, 0.5, 0);
		background.BackgroundColor3 = Color3.fromRGB(15, 15, 15);
		background.BackgroundTransparency = 0.2;
		background.BorderSizePixel = 0;
		background.Parent = this.billboard;

		const bgCorner = new Instance("UICorner");
		bgCorner.CornerRadius = new UDim(0.5, 0); // Закругленные края
		bgCorner.Parent = background;

		// 3. Линия заполнения
		this.healthFill = new Instance("Frame");
		this.healthFill.Size = new UDim2(1, 0, 1, 0);
		this.healthFill.BackgroundColor3 = Color3.fromRGB(255, 50, 50);
		this.healthFill.BorderSizePixel = 0;
		this.healthFill.Parent = background;

		const fillCorner = new Instance("UICorner");
		fillCorner.CornerRadius = new UDim(0.5, 0);
		fillCorner.Parent = this.healthFill;

		// 4. Текст процентов
		this.textLabel = new Instance("TextLabel");
		this.textLabel.Size = new UDim2(1, 0, 1, 0);
		this.textLabel.BackgroundTransparency = 1;
		this.textLabel.TextColor3 = new Color3(1, 1, 1);
		this.textLabel.TextSize = 13;
		this.textLabel.Font = Enum.Font.GothamBold;
		this.textLabel.TextStrokeTransparency = 0.5; // Обводка для читаемости
		this.textLabel.ZIndex = 3;
		this.textLabel.Parent = background;

		// Функция обновления данных
		const updateHealth = () => {
			const maxHealth = humanoid.MaxHealth > 0 ? humanoid.MaxHealth : 100;
			this.targetHealthPercent = math.clamp(humanoid.Health / maxHealth, 0, 1);
		};

		// Подписываемся на изменения
		this.connection = humanoid.GetPropertyChangedSignal("Health").Connect(updateHealth);
		updateHealth(); // Сразу ставим текущее значение

		// Плавная анимация движения полоски и цифр
		this.renderConnection = RunService.RenderStepped.Connect((dt) => {
			if (!this.healthFill || !this.textLabel) return;

			// Плавное приближение к целевому значению
			this.currentDisplayPercent = math.lerp(this.currentDisplayPercent, this.targetHealthPercent, dt * 8);
			
			// Обновляем UI
			this.healthFill.Size = new UDim2(this.currentDisplayPercent, 0, 1, 0);
			const percentInt = math.floor(this.currentDisplayPercent * 100);
			this.textLabel.Text = `${percentInt}%`;

			// Опционально: полоска становится желтой, если HP мало
			if (this.currentDisplayPercent < 0.3) {
				this.healthFill.BackgroundColor3 = Color3.fromRGB(255, 200, 50);
			} else {
				this.healthFill.BackgroundColor3 = Color3.fromRGB(255, 50, 50);
			}
		});

		print(`[EnemyHealthBar] ✅ Полоска HP успешно создана для ${model.Name}`);
	}

	/**
	 * Автоматическая очистка ресурсов Flamework 1.3.2
	 */
	onInstanceDestroyed() {
		print(`[EnemyHealthBar] 🧹 Удаление полоски для ${this.instance.Name}`);
		this.connection?.Disconnect();
		this.renderConnection?.Disconnect();
		this.billboard?.Destroy();
	}
}
