// src/server/services/ResurrectionService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, CollectionService, ReplicatedStorage, HttpService, TweenService } from "@rbxts/services";
import { CorpseComponent } from "server/components/CorpseComponent";
import { SummonComponent, WeaponType } from "server/components/SummonComponent";
import { CorpseNetworking } from "shared/networking/CorpseNetworking";

@Service({})
export class ResurrectionService implements OnStart {
	private components = Dependency<Components>();
	private events = CorpseNetworking.createServer({});

	private playerProcesses = new Map<number, { corpseId: string; startTime: number }>();
	private armyCounts = new Map<number, number>();
	private playerCooldowns = new Map<number, number>();

	private readonly HOLD_DURATION = 1.5;
	private readonly MANA_COST = 10;
	private readonly MAX_ARMY = 5;
	private readonly COOLDOWN = 2.0;

	onStart() {
		print("[ResurrectionService] 🔄 Система воскрешения запущена");

		this.events.requestResurrection.connect((player, corpseId: string) => {
			this.handleResurrectionRequest(player, corpseId);
		});

		this.events.cancelResurrection.connect((player) => {
			this.cancelProcess(player.UserId);
		});

		CollectionService.GetInstanceAddedSignal("Corpse").Connect(() => this.enforceCorpseLimit());
	}

	private enforceCorpseLimit() {
		const corpsesSet = CollectionService.GetTagged("Corpse");
		const limit = 100;
		if (corpsesSet.size() <= limit) return;

		const toSort: Array<{ inst: Instance; time: number }> = [];
		for (const corpse of corpsesSet) {
			const comp = this.components.getComponent<CorpseComponent>(corpse);
			if (comp) toSort.push({ inst: corpse, time: comp.spawnTime });
		}
		toSort.sort((a, b) => a.time < b.time);
		const removeCount = toSort.size() - limit;
		for (let i = 0; i < removeCount; i++) {
			const item = toSort[i];
			if (item && item.inst.Parent) item.inst.Destroy();
		}
	}

	private handleResurrectionRequest(player: Player, corpseId: string) {
		const userId = player.UserId;
		if (this.playerCooldowns.has(userId) && os.clock() < (this.playerCooldowns.get(userId) || 0)) {
			this.events.resurrectionFailed(player, "Кулдаун"); return;
		}
		if ((this.armyCounts.get(userId) || 0) >= this.MAX_ARMY) {
			this.events.resurrectionFailed(player, "Лимит армии"); return;
		}

		const corpses = CollectionService.GetTagged("Corpse");
		let corpse: Model | undefined;
		for (const c of corpses) {
			if (c.Name === corpseId && c.IsA("Model")) { corpse = c; break; }
		}
		if (!corpse) { this.events.resurrectionFailed(player, "Труп не найден"); return; }

		const comp = this.components.getComponent<CorpseComponent>(corpse);
		if (!comp) { this.events.resurrectionFailed(player, "Труп не найден"); return; }

		const mana = this.getPlayerMana(player);
		if (mana < this.MANA_COST) { this.events.resurrectionFailed(player, "Недостаточно маны"); return; }

		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
			this.events.resurrectionFailed(player, "Слишком далеко"); return;
		}

		this.startHoldProcess(player, corpse, comp);
	}

	private startHoldProcess(player: Player, corpse: Model, comp: CorpseComponent) {
		const userId = player.UserId;
		this.cancelProcess(userId);
		const startTime = os.clock();
		this.playerProcesses.set(userId, { corpseId: corpse.Name, startTime });

		task.spawn(() => {
			const proc = this.playerProcesses.get(userId);
			if (!proc || proc.corpseId !== corpse.Name) return;

			while (os.clock() - startTime < this.HOLD_DURATION) {
				const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!charRoot || !corpse.Parent || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
					this.events.resurrectionFailed(player, "Отошёл далеко или труп исчез");
					this.events.updateProgress(player, 0);
					this.playerProcesses.delete(userId); return;
				}
				const progress = math.min((os.clock() - startTime) / this.HOLD_DURATION, 1);
				this.events.updateProgress(player, progress);
				task.wait(0.1);
			}

			this.spawnSummon(player, comp, corpse);
			this.events.resurrectionSuccess(player);
			this.playerCooldowns.set(userId, os.clock() + this.COOLDOWN);
			this.playerProcesses.delete(userId);
		});
	}

	private cancelProcess(userId: number) { this.playerProcesses.delete(userId); }

	private spawnSummon(player: Player, comp: CorpseComponent, corpse: Model) {
	const userId = player.UserId;
	this.armyCounts.set(userId, (this.armyCounts.get(userId) || 0) + 1);
	this.spendMana(player, this.MANA_COST);

	const spawnPos = player.Character?.GetPivot().Position.add(new Vector3(5, 0, 0)) || new Vector3(0, 10, 0);
	const summonModel = this.createSummonModel(comp.templateId, spawnPos);

	if (summonModel) {
		const weapons: WeaponType[] = ["RustySword", "BoneBlade", "SpectralDagger"];
		const randomIndex = math.random(1, 3);
		const chosen = weapons[randomIndex - 1];

		// ✅ 1. СНАЧАЛА добавляем тег (триггерит создание SummonComponent)
		CollectionService.AddTag(summonModel, "Summon");
		
		// ✅ 2. ПОТОМ устанавливаем атрибуты (компонент их прочитает в onStart)
		summonModel.SetAttribute("OwnerId", userId);
		summonModel.SetAttribute("TemplateId", comp.templateId);
		summonModel.SetAttribute("SummonTime", os.clock());
		summonModel.SetAttribute("WeaponType", chosen);

		this.addCrimsonEyes(summonModel);

		// Удаляем труп
		if (corpse.Parent) corpse.Destroy();

		print(`[Resurrection] ✅ ${player.Name} воскресил ${comp.templateId} [${chosen}]. Армия: ${this.armyCounts.get(userId)}/${this.MAX_ARMY}`);
		
		// 🛠 ОТЛАДКА: проверяем, создался ли компонент
		task.wait(0.1);
		const checkComp = this.components.getComponent<SummonComponent>(summonModel);
		if (checkComp) {
			print(`[Resurrection] ✅ Component SummonComponent найден для ${summonModel.Name}`);
		} else {
			warn(`[Resurrection] ❌ Component SummonComponent НЕ создан для ${summonModel.Name}`);
		}
	}
	}

	private createSummonModel(templateId: string, position: Vector3): Model | undefined {
	const template = ReplicatedStorage.FindFirstChild("SkeletonWarrior") as Model;
	if (!template) { warn("[ResurrectionService] ❌ Шаблон не найден"); return undefined; }

	const model = template.Clone();
	model.Name = `Summon_${templateId}_${HttpService.GenerateGUID(false).sub(1, 6)}`;
	const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
	const root = model.FindFirstChild("HumanoidRootPart") as BasePart;

	if (humanoid && root) {
		humanoid.MaxHealth = 50;
		humanoid.Health = 50;
		humanoid.WalkSpeed = 16;
		humanoid.BreakJointsOnDeath = false;
		model.PrimaryPart = root;
		model.PivotTo(new CFrame(position));
		model.Parent = Workspace;
		
		// ✅ Добавляем тег здоровья (если нужно, чтобы юнит мог умирать)
		CollectionService.AddTag(model, "HasHealth");
	}
	return model;
	}

	private addCrimsonEyes(model: Model) {
		const head = model.FindFirstChild("Head") as BasePart || model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!head) return;

		const createEye = (offset: Vector3, name: string) => {
			const eye = new Instance("Part");
			eye.Name = name;
			eye.Size = new Vector3(0.15, 0.15, 0.1);
			eye.Color = Color3.fromRGB(255, 0, 0);
			eye.Material = Enum.Material.Neon;
			eye.Anchored = false;
			eye.CanCollide = false;
			// ИСПРАВЛЕНИЕ: используем конструктор new CFrame(), а не CFrame.new()
			eye.CFrame = head.CFrame.mul(new CFrame(offset)); 
			eye.Parent = model;
		};
		createEye(new Vector3(0.35, 0.2, 0.45), "CrimsonEyeL");
		createEye(new Vector3(-0.35, 0.2, 0.45), "CrimsonEyeR");
	}

	private getPlayerMana(player: Player): number { return 50; }
	private spendMana(player: Player, amount: number) { this.events.updateMana(player, 40, 50); }
}