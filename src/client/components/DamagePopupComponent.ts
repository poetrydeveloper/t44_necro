// src/client/components/DamagePopupComponent.ts
import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { Players, TweenService, Debris, Workspace } from "@rbxts/services";
import { CombatNetworking } from "shared/networking/CombatNetworking";

@Component({})
export class DamagePopupComponent implements OnStart {
	private events = CombatNetworking.createClient({});
	private player = Players.LocalPlayer;

	onStart() {
		this.events.showDamagePopup.connect((targetId: string, damage: number, position: Vector3) => {
			this.showPopup(damage, position);
		});
	}

	private showPopup(damage: number, worldPosition: Vector3) {
		const popup = new Instance("TextLabel");
		popup.Text = `-${damage}`;
		popup.TextColor3 = Color3.fromRGB(255, 50, 50);
		popup.TextSize = 24;
		popup.Font = Enum.Font.GothamBold;
		popup.BackgroundTransparency = 1;
		popup.Size = new UDim2(0, 100, 0, 50);
		popup.Position = new UDim2(0.5, -50, 0.5, -25);
		popup.TextXAlignment = Enum.TextXAlignment.Center;
		popup.ZIndex = 10;

		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		// 🛠 ИСПРАВЛЕНИЕ: Деструктуризация кортежа [Vector3, boolean]
		// viewportPoint — это Vector3 (экранная позиция)
		// onScreen — это boolean (виден ли объект камере)
		const [viewportPoint, onScreen] = camera.WorldToViewportPoint(worldPosition);
		
		if (!onScreen) return; // Если объект за камерой — не показываем

		const gui = new Instance("ScreenGui");
		gui.Name = "DamagePopup";
		gui.IgnoreGuiInset = true;
		gui.ResetOnSpawn = false;
		gui.Parent = this.player.WaitForChild("PlayerGui");

		popup.Parent = gui;

		// 🛠 Теперь viewportPoint.X и .Y работают корректно
		popup.Position = new UDim2(
			0,
			viewportPoint.X - popup.AbsoluteSize.X / 2,
			0,
			viewportPoint.Y - popup.AbsoluteSize.Y
		);

		const tween = TweenService.Create(popup, new TweenInfo(1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			TextTransparency: 1,
			Position: new UDim2(
				0,
				viewportPoint.X - popup.AbsoluteSize.X / 2,
				0,
				viewportPoint.Y - popup.AbsoluteSize.Y - 50
			),
		});
		tween.Play();

		Debris.AddItem(gui, 1.5);
	}
}