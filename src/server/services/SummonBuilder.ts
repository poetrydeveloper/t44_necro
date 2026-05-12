import { Service } from "@flamework/core";
import { Workspace, ReplicatedStorage, HttpService, CollectionService } from "@rbxts/services";
import { WeaponType, UnitType } from "server/components/SummonComponent";
import { EnemyPresets } from "shared/types/EnemyTypes";

interface UnitTemplate {
	modelName: string;
	soulWeight: number;
	tier: number;
	health: number;
	walkSpeed: number;
}

const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {
	SkeletonWarrior: { 
		modelName: "Zombie", 
		soulWeight: 10, 
		tier: 1,
		health: 50,
		walkSpeed: 16,
	},
	Ghost: { 
		modelName: "Ghost", 
		soulWeight: 15, 
		tier: 2,
		health: 40,
		walkSpeed: 20,
	},
	Vampire: { 
		modelName: "Vampire", 
		soulWeight: 25, 
		tier: 3,
		health: 70,
		walkSpeed: 14,
	},
	Zombie: { 
		modelName: "Drooling Zombie", 
		soulWeight: 20, 
		tier: 2,
		health: 60,
		walkSpeed: 12,
	},
};

@Service({})
export class SummonBuilder {
	
	public createSummon(unitType: UnitType, spawnPosition: Vector3, owner?: Player): Model | undefined {
		const templateInfo = UNIT_TEMPLATES[unitType];
		if (!templateInfo) {
			warn(`[SummonBuilder] ❌ Неизвестный тип юнита: ${unitType}`);
			return undefined;
		}
		
		const template = ReplicatedStorage.FindFirstChild(templateInfo.modelName) as Model;
		if (!template) {
			warn(`[SummonBuilder] ❌ Шаблон ${templateInfo.modelName} не найден в ReplicatedStorage`);
			return undefined;
		}

		const model = template.Clone();
		model.Name = `Summon_${unitType}_${HttpService.GenerateGUID(false).sub(1, 6)}`;
		
		// ========== ПРОВЕРКА И СОЗДАНИЕ HUMANOD ==========
		let humanoid = model.FindFirstChildOfClass("Humanoid");
		if (!humanoid) {
			humanoid = new Instance("Humanoid");
			humanoid.Parent = model;
			print(`[SummonBuilder] 🔧 Добавлен Humanoid для ${model.Name}`);
		}
		
		// ========== ПРОВЕРКА HUMANODROOTPART ==========
		let root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!root) {
			// Создаём корень, если его нет
			root = new Instance("Part");
			root.Name = "HumanoidRootPart";
			root.Size = new Vector3(2, 2, 1);
			root.Anchored = false;
			root.CanCollide = true;
			root.Parent = model;
			model.PrimaryPart = root;
			print(`[SummonBuilder] 🔧 Добавлен HumanoidRootPart для ${model.Name}`);
		}

		// ========== ФИЗИКА ==========
		for (const child of model.GetDescendants()) {
			if (child.IsA("BasePart")) {
				child.Anchored = false;
				child.CanCollide = (child.Name === "HumanoidRootPart");
				child.CastShadow = true;
				child.Massless = true;
			}
		}
		
		root.CanCollide = true;
		root.Size = new Vector3(2, 2, 1);

		// ========== НАСТРОЙКА HUMANOD ==========
		humanoid.MaxHealth = templateInfo.health;
		humanoid.Health = templateInfo.health;
		humanoid.WalkSpeed = templateInfo.walkSpeed;
		humanoid.AutoRotate = true;
		humanoid.HipHeight = 2;
		humanoid.PlatformStand = false;
		humanoid.JumpPower = 0;

		// ========== ПОЗИЦИОНИРОВАНИЕ ==========
		const finalPos = this.findGroundPosition(spawnPosition, model);
		model.PivotTo(new CFrame(finalPos));
		
		// ========== ТЕГИ ==========
		CollectionService.AddTag(model, "Summon");
		CollectionService.AddTag(model, "HasHealth");
		
		if (owner) {
			model.SetAttribute("OwnerId", owner.UserId);
		}
		
		model.SetAttribute("UnitType", unitType);
		model.SetAttribute("WeaponType", this.getRandomWeapon());
		model.SetAttribute("SoulWeight", templateInfo.soulWeight);
		model.SetAttribute("Tier", templateInfo.tier);
		model.SetAttribute("SummonTime", os.clock());

		model.Parent = Workspace;

		// ========== ВАРКА ЧАСТЕЙ ==========
		this.weldParts(model, root);

		// ========== СЕТЕВОЕ ВЛАДЕНИЕ ==========
		task.spawn(() => {
			task.wait(0.1);
			root.SetNetworkOwner(undefined);
		});

		print(`[SummonBuilder] ✅ ${unitType} создан, здоровье: ${templateInfo.health}, позиция Y: ${finalPos.Y}`);
		
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
		
		if (parts.size() > 0) {
			print(`[SummonBuilder] 🔗 Приварено ${parts.size()} частей к корню`);
		}
	}

	private findGroundPosition(position: Vector3, excludeModel: Model): Vector3 {
		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		rayParams.FilterDescendantsInstances = [excludeModel];
		
		const rayOrigin = position.add(new Vector3(0, 15, 0));
		const rayDirection = new Vector3(0, -30, 0);
		const rayResult = Workspace.Raycast(rayOrigin, rayDirection, rayParams);
		
		if (rayResult) {
			return rayResult.Position.add(new Vector3(0, 2.8, 0));
		}
		return position.add(new Vector3(0, 3, 0));
	}

	public getRandomWeapon(): WeaponType {
		const weapons: WeaponType[] = ["RustySword", "BoneBlade", "SpectralDagger"];
		return weapons[math.random(1, 3) - 1];
	}
}