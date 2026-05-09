import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { TweenService, Debris } from "@rbxts/services";

@Component({ tag: "Projectile" })
export class ProjectileComponent extends BaseComponent<{}, Model> implements OnStart {
	
	onStart() {
		// 1. Читаем атрибуты с МОДЕЛИ (сервер поставил их сюда)
		const targetPos = this.instance.GetAttribute("TargetPos") as Vector3;
		const speed = this.instance.GetAttribute("Speed") as number || 40;

		// 2. Находим визуальную часть (Orb) внутри модели
		const orb = this.instance.WaitForChild("Orb", 2) as Part;
		if (!orb) {
			warn("[ProjectileComponent] ❌ Не найдена часть Orb!");
			this.instance.Destroy();
			return;
		}

		if (!targetPos) {
			warn("[ProjectileComponent] ❌ Нет целевой позиции!");
			this.instance.Destroy();
			return;
		}

		const distance = orb.Position.sub(targetPos).Magnitude;
		if (distance < 1) {
			this.instance.Destroy();
			return;
		}

		const duration = distance / speed;

		// --- ВИЗУАЛЬНЫЕ ЭФФЕКТЫ (вешаем на orb) ---
		
		// 1. Свечение
		const light = new Instance("PointLight");
		light.Color = Color3.fromRGB(138, 43, 226);
		light.Range = 10;
		light.Brightness = 2;
		light.Parent = orb;

		// 2. Шлейф (Trail)
		const att0 = new Instance("Attachment");
		att0.Parent = orb;
		
		const att1 = new Instance("Attachment");
		att1.Position = new Vector3(0, 0, -1);
		att1.Parent = orb;
		
		const trail = new Instance("Trail");
		trail.Attachment0 = att0;
		trail.Attachment1 = att1;
		trail.Color = new ColorSequence(Color3.fromRGB(138, 43, 226), Color3.fromRGB(0, 0, 0));
		trail.Lifetime = 0.5;
		trail.WidthScale = new NumberSequence(1, 0);
		trail.Parent = orb;

		// --- АНИМАЦИЯ ПОЛЕТА ---
		const tweenInfo = new TweenInfo(duration, Enum.EasingStyle.Linear);
		const tween = TweenService.Create(orb, tweenInfo, {
			Position: targetPos
		});

		tween.Play();
		
		tween.Completed.Connect(() => {
			this.instance.Destroy();
		});

		Debris.AddItem(this.instance, duration + 2);
	}
}