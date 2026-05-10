import { Service } from "@flamework/core";
import { Workspace, ReplicatedStorage, HttpService, CollectionService } from "@rbxts/services";
import { WeaponType } from "server/components/SummonComponent";

@Service({})
export class SummonBuilder {
	
	public createSummonModel(templateId: string, spawnPosition: Vector3, owner?: Player): Model | undefined {
		const template = ReplicatedStorage.FindFirstChild(templateId) as Model;
		if (!template) {
			warn(`[SummonBuilder] ❌ Шаблон ${templateId} не найден`);
			return undefined;
		}

		const model = template.Clone();
		model.Name = `Summon_${HttpService.GenerateGUID(false).sub(1, 6)}`;
		
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;

		if (!humanoid || !root) {
			model.Destroy();
			warn("[SummonBuilder] ❌ Модель не имеет Humanoid или HumanoidRootPart");
			return undefined;
		}

		// ========== ФИЗИКА: Чтобы не рассыпался ==========
		for (const child of model.GetDescendants()) {
			if (child.IsA("BasePart")) {
				child.Anchored = false;
				// Только RootPart имеет коллизию
				child.CanCollide = (child.Name === "HumanoidRootPart");
				child.CastShadow = true;
				child.Massless = true;
			}
		}
		
		root.CanCollide = true;
		root.Size = new Vector3(2, 2, 1);

		// ========== НАСТРОЙКА HUMANOD ==========
		humanoid.MaxHealth = 50;
		humanoid.Health = 50;
		humanoid.WalkSpeed = 16;
		humanoid.AutoRotate = true;
		humanoid.HipHeight = 2.5; // Увеличено для подъёма
		humanoid.PlatformStand = false;
		humanoid.JumpPower = 0;

		// ========== ПОЗИЦИОНИРОВАНИЕ (ПОДНИМАЕМ ВЫШЕ) ==========
		const finalPos = this.findGroundPosition(spawnPosition, model);
		model.PivotTo(new CFrame(finalPos));
		
		// ========== ТЕГИ ==========
		CollectionService.AddTag(model, "Summon");
		CollectionService.AddTag(model, "HasHealth");
		
		if (owner) {
			model.SetAttribute("OwnerId", owner.UserId);
		}
		
		model.SetAttribute("WeaponType", this.getRandomWeapon());
		model.SetAttribute("TemplateId", templateId);
		model.SetAttribute("SummonTime", os.clock());

		model.Parent = Workspace;

		// ========== ВАРКА ЧАСТЕЙ ==========
		this.weldParts(model, root);

		// ========== СЕТЕВОЕ ВЛАДЕНИЕ ==========
		task.spawn(() => {
			task.wait(0.1);
			root.SetNetworkOwner(undefined);
		});

		// ========== ПРИНУДИТЕЛЬНЫЙ ПОДЪЁМ ==========
		task.spawn(() => {
			task.wait(0.05);
			const currentPos = root.Position;
			const newPos = new Vector3(currentPos.X, currentPos.Y + 1.5, currentPos.Z);
			model.PivotTo(new CFrame(newPos));
			print(`[SummonBuilder] ⬆️ Юнит поднят на Y=${newPos.Y}`);
		});

		print(`[SummonBuilder] ✅ Скелет создан, позиция Y: ${finalPos.Y}`);
		
		return model;
	}

	private weldParts(model: Model, root: BasePart) {
		const parts: BasePart[] = [];
		for (const child of model.GetDescendants()) {
			if (child.IsA("BasePart") && child !== root) {
				parts.push(child);
			}
		}
		
		for (const part of parts) {
			const weld = new Instance("WeldConstraint");
			weld.Part0 = root;
			weld.Part1 = part;
			weld.Parent = part;
		}
		
		print(`[SummonBuilder] 🔗 Приварено ${parts.size()} частей к корню`);
	}

	private findGroundPosition(position: Vector3, excludeModel: Model): Vector3 {
		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		rayParams.FilterDescendantsInstances = [excludeModel];
		
		const rayOrigin = position.add(new Vector3(0, 15, 0)); // Увеличил луч
		const rayDirection = new Vector3(0, -30, 0);
		const rayResult = Workspace.Raycast(rayOrigin, rayDirection, rayParams);
		
		if (rayResult) {
			// Поднимаем выше: было 2.3, стало 3.5
			return rayResult.Position.add(new Vector3(0, 3.8, 0));
		}
		// Запасной вариант
		return position.add(new Vector3(0, 5, 0));
	}

	public getRandomWeapon(): WeaponType {
		const weapons: WeaponType[] = ["RustySword", "BoneBlade", "SpectralDagger"];
		return weapons[math.random(1, 3) - 1];
	}
}