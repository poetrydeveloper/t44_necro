import { Service, OnStart, Dependency } from "@flamework/core";
import { 
    Workspace, 
    ServerStorage, 
    CollectionService, 
    HttpService // Он уже здесь, этого достаточно
} from "@rbxts/services";

interface CorpseData {
	corpseModel: Model;
	originalModel: Model;
	unitType: string;
	spawnTime: number;
}

@Service({})
export class CorpseManagerService implements OnStart {
	private corpses = new Map<string, CorpseData>();
	private readonly CORPSE_LIFETIME = 60;

	onStart() {
		print("[CorpseManagerService] 🪦 Система управления трупами запущена");
	}

	public createGrave(originalModel: Model, unitType: string, position: Vector3): Model | undefined {
		// 1. Ищем землю рейкастом
		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		const rayResult = Workspace.Raycast(position.add(new Vector3(0, 10, 0)), new Vector3(0, -25, 0), rayParams);
		const groundPos = rayResult ? rayResult.Position : position;

		// 2. Создаём визуальную могилу
		const grave = this.createGraveModel(groundPos);
		
		// 3. Прячем оригинал в хранилище
		originalModel.Parent = ServerStorage;
		const root = originalModel.PrimaryPart;
		if (root) root.Anchored = true;
		
		// 4. Если у модели нет PrimaryPart, пробуем найти HumanoidRootPart
		if (!root) {
			const altRoot = originalModel.FindFirstChild("HumanoidRootPart") as BasePart;
			if (altRoot) altRoot.Anchored = true;
		}

		// 5. Настраиваем могилу
		const corpseId = HttpService.GenerateGUID(false);
		grave.Name = `Grave_${corpseId.sub(1, 6)}`;
		grave.SetAttribute("UnitType", unitType);
		grave.SetAttribute("OriginalModelName", originalModel.Name);
		
		// 6. Регистрируем
		CollectionService.AddTag(grave, "Corpse");
		grave.Parent = Workspace;

		this.corpses.set(grave.Name, {
			corpseModel: grave,
			originalModel: originalModel,
			unitType: unitType,
			spawnTime: os.clock(),
		});
		
		task.delay(this.CORPSE_LIFETIME, () => this.removeGrave(grave.Name));
		
		print(`[CorpseManagerService] 🪦 Создана могила для ${unitType}`);
		
		return grave;
	}
	
	public resurrectFromGrave(graveModel: Model): Model | undefined {
		const corpseData = this.corpses.get(graveModel.Name);
		if (!corpseData) {
			warn("[CorpseManagerService] ❌ Могила не найдена");
			return undefined;
		}
		
		const model = corpseData.originalModel;
		const gravePos = graveModel.GetPivot().Position;
		
		// Оживляем Humanoid
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = humanoid.MaxHealth;
		}
		
		// Меняем фракцию: убираем Enemy, добавляем Summon
		CollectionService.RemoveTag(model, "Enemy");
		CollectionService.AddTag(model, "Summon");
		CollectionService.AddTag(model, "HasHealth");
		
		// Возвращаем физику
		const root = model.PrimaryPart;
		if (root) root.Anchored = false;
		
		// Ставим на место могилы (чуть выше)
		model.PivotTo(new CFrame(gravePos.add(new Vector3(0, 2.5, 0))));
		model.Parent = Workspace;
		
		// Удаляем могилу
		this.corpses.delete(graveModel.Name);
		graveModel.Destroy();
		
		print(`[CorpseManagerService] ⚡ Воскрешён ${corpseData.unitType}`);
		
		return model;
	}
	
	private removeGrave(graveName: string) {
		const data = this.corpses.get(graveName);
		if (data) {
			if (data.corpseModel.Parent) data.corpseModel.Destroy();
			if (data.originalModel.Parent === ServerStorage) data.originalModel.Destroy();
			this.corpses.delete(graveName);
		}
	}

	private createGraveModel(position: Vector3): Model {
		const model = new Instance("Model");
		
		// Холмик
		const mound = new Instance("Part");
		mound.Name = "Mound";
		mound.Size = new Vector3(3, 0.3, 4);
		mound.Anchored = true;
		mound.CanCollide = true;
		mound.Color = Color3.fromRGB(80, 55, 35);
		mound.Material = Enum.Material.SmoothPlastic;
		mound.Parent = model;
		mound.CFrame = new CFrame(position);
		
		// Крест (вертикаль)
		const crossV = new Instance("Part");
		crossV.Name = "CrossVertical";
		crossV.Size = new Vector3(0.4, 2, 0.4);
		crossV.Anchored = true;
		crossV.CanCollide = true;
		crossV.Color = Color3.fromRGB(100, 70, 50);
		crossV.Material = Enum.Material.Wood;
		crossV.Parent = model;
		crossV.CFrame = new CFrame(position.X, position.Y + 1.2, position.Z);
		
		// Крест (горизонталь)
		const crossH = new Instance("Part");
		crossH.Name = "CrossHorizontal";
		crossH.Size = new Vector3(1.2, 0.3, 0.3);
		crossH.Anchored = true;
		crossH.CanCollide = true;
		crossH.Color = Color3.fromRGB(100, 70, 50);
		crossH.Material = Enum.Material.Wood;
		crossH.Parent = model;
		crossH.CFrame = new CFrame(position.X, position.Y + 1.2, position.Z);
		
		// Свечение (для видимости)
		const glow = new Instance("Part");
		glow.Name = "Glow";
		glow.Shape = Enum.PartType.Ball;
		glow.Size = new Vector3(0.3, 0.3, 0.3);
		glow.Anchored = true;
		glow.CanCollide = false;
		glow.Color = Color3.fromRGB(150, 100, 200);
		glow.Material = Enum.Material.Neon;
		glow.Transparency = 0.4;
		glow.Parent = model;
		glow.CFrame = new CFrame(position.X, position.Y + 0.8, position.Z);
		
		model.PrimaryPart = mound;
		
		return model;
	}
}