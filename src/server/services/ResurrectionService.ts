// src/server/services/ResurrectionService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, CollectionService, ReplicatedStorage, HttpService } from "@rbxts/services";
import { CorpseComponent } from "server/components/CorpseComponent";
import { SummonComponent } from "server/components/SummonComponent";
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

	// =========================
	// 🗑 ОГРАНИЧЕНИЕ КОЛИЧЕСТВА ТРУПОВ
	// =========================
	private enforceCorpseLimit() {
		const corpsesSet = CollectionService.GetTagged("Corpse");
		const limit = 100;

		if (corpsesSet.size() <= limit) return;

		const toSort: Array<{ inst: Instance; time: number }> = [];
		for (const corpse of corpsesSet) {
			const comp = this.components.getComponent<CorpseComponent>(corpse);
			if (comp) {
				toSort.push({ inst: corpse, time: comp.spawnTime });
			}
		}

		toSort.sort((a, b) => a.time < b.time);

		const total = toSort.size();
		const removeCount = total - limit;

		for (let i = 0; i < removeCount; i++) {
			const item = toSort[i];
			if (item && item.inst.Parent) {
				item.inst.Destroy();
			}
		}
	}

	// =========================
	// 🔄 ЗАПРОС НА ВОСКРЕШЕНИЕ
	// =========================
	private handleResurrectionRequest(player: Player, corpseId: string) {
		const userId = player.UserId;

		if (this.playerCooldowns.has(userId) && os.clock() < (this.playerCooldowns.get(userId) || 0)) {
			this.events.resurrectionFailed(player, "Кулдаун");
			return;
		}

		if ((this.armyCounts.get(userId) || 0) >= this.MAX_ARMY) {
			this.events.resurrectionFailed(player, "Лимит армии");
			return;
		}

		const corpses = CollectionService.GetTagged("Corpse");
		let corpse: Model | undefined;
		
		for (const c of corpses) {
			if (c.Name === corpseId && c.IsA("Model")) {
				corpse = c;
				break;
			}
		}

		if (!corpse) {
			this.events.resurrectionFailed(player, "Труп не найден");
			return;
		}

		const comp = this.components.getComponent<CorpseComponent>(corpse);
		if (!comp) {
			this.events.resurrectionFailed(player, "Труп не найден");
			return;
		}

		const mana = this.getPlayerMana(player);
		if (mana < this.MANA_COST) {
			this.events.resurrectionFailed(player, "Недостаточно маны");
			return;
		}

		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
			this.events.resurrectionFailed(player, "Слишком далеко");
			return;
		}

		this.startHoldProcess(player, corpse, comp);
	}

	// =========================
	// ⏳ ПРОЦЕСС УДЕРЖАНИЯ КНОПКИ
	// =========================
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
					this.playerProcesses.delete(userId);
					return;
				}

				const progress = math.min((os.clock() - startTime) / this.HOLD_DURATION, 1);
				this.events.updateProgress(player, progress);
				
				task.wait(0.1);
			}

			this.spawnSummon(player, comp);
			this.events.resurrectionSuccess(player);
			this.playerCooldowns.set(userId, os.clock() + this.COOLDOWN);
			this.playerProcesses.delete(userId);
		});
	}

	// =========================
	// ❌ ОТМЕНА ПРОЦЕССА
	// =========================
	private cancelProcess(userId: number) {
		this.playerProcesses.delete(userId);
	}

	// =========================
	// 🧟 СПАВН ВОСКРЕШЁННОГО ЮНИТА
	// =========================
	private spawnSummon(player: Player, comp: CorpseComponent) {
		const userId = player.UserId;
		
		this.armyCounts.set(userId, (this.armyCounts.get(userId) || 0) + 1);
		this.spendMana(player, this.MANA_COST);

		const spawnPos = player.Character?.GetPivot().Position.add(new Vector3(5, 0, 0)) || new Vector3(0, 10, 0);
		const summonModel = this.createSummonModel(comp.templateId, spawnPos);
		
		if (summonModel) {
			summonModel.SetAttribute("OwnerId", userId);
			summonModel.SetAttribute("TemplateId", comp.templateId);
			summonModel.SetAttribute("SummonTime", os.clock());

			CollectionService.AddTag(summonModel, "Summon");
			
			print(`[Resurrection] ✅ ${player.Name} воскресил ${comp.templateId}. Армия: ${this.armyCounts.get(userId)}/${this.MAX_ARMY}`);
		}
	}

	// Вспомогательный метод для клонирования шаблона
	private createSummonModel(templateId: string, position: Vector3): Model | undefined {
		const template = ReplicatedStorage.FindFirstChild("SkeletonWarrior") as Model;
		
		if (!template) {
			warn("[ResurrectionService] ❌ Шаблон SkeletonWarrior не найден в ReplicatedStorage");
			return undefined;
		}

		const model = template.Clone();
		model.Name = `Summon_${templateId}_${HttpService.GenerateGUID(false).sub(1, 6)}`;
		
		const humanoid = model.FindFirstChildOfClass("Humanoid") as Humanoid;
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		
		if (humanoid && root) {
			// 🛠 ИСПРАВЛЕНИЕ: Не трогаем Anchored у всех частей! Это ломает суставы.
			// Разанкориваем только корень, Humanoid сам управляет остальной физикой.
			root.Anchored = false;
			
			// Отключаем разрушение суставов при смерти (на всякий случай)
			humanoid.BreakJointsOnDeath = false;
			
			humanoid.MaxHealth = 50;
			humanoid.Health = 50;
			humanoid.WalkSpeed = 16;
			
			model.PrimaryPart = root;
			model.PivotTo(new CFrame(position));
			model.Parent = Workspace;
			
			// Заставляем Humanoid встать в стандартную позу, если модель "сломалась"
			humanoid.ChangeState(Enum.HumanoidStateType.GettingUp);
		}
		
		return model;
	}

	// =========================
	// 💰 ЗАГЛУШКИ ДЛЯ МАНЫ
	// =========================
	private getPlayerMana(player: Player): number {
		return 50; 
	}

	private spendMana(player: Player, amount: number) {
		this.events.updateMana(player, 40, 50);
	}
}