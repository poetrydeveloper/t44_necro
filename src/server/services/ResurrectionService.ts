// src/server/services/ResurrectionService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, CollectionService } from "@rbxts/services";
import { CorpseNetworking } from "shared/networking/CorpseNetworking";
import { SummonBuilder } from "./SummonBuilder";
import { UnitType } from "server/components/SummonComponent";
import { CorpseManagerService } from "./CorpseManagerService";

@Service({})
export class ResurrectionService implements OnStart {
	private components = Dependency<Components>();
	private events = CorpseNetworking.createServer({});
	private summonBuilder = Dependency<SummonBuilder>();
	private corpseManager = Dependency<CorpseManagerService>();

	private playerProcesses = new Map<number, { corpseId: string; startTime: number }>();
	private armyCounts = new Map<number, number>();
	private playerCooldowns = new Map<number, number>();

	private readonly HOLD_DURATION = 1.5;
	private readonly MANA_COST = 10;
	private readonly MAX_ARMY = 5;
	private readonly COOLDOWN = 2.0;

	// 🔧 ФИКС 3: Единая карта соответствия типов
	private readonly TYPE_MAP: Record<string, UnitType> = {
		"skeleton": "SkeletonWarrior",
		"ghost": "Ghost",
		"vampire": "Vampire",
		"zombie": "Zombie",
		"SkeletonWarrior": "SkeletonWarrior",
		"Ghost": "Ghost",
		"Vampire": "Vampire",
		"Zombie": "Zombie",
	};

	onStart() {
		print("[ResurrectionService] 🔄 Система воскрешения запущена");

		this.events.requestResurrection.connect((player, corpse: Model) => {
			print(`[DEBUG] ResurrectionService: получен запрос от ${player.Name}, могила: ${corpse.Name}`);
			this.handleResurrectionRequest(player, corpse);
		});

		this.events.cancelResurrection.connect((player) => {
			this.cancelProcess(player.UserId);
		});

		CollectionService.GetInstanceAddedSignal("Corpse").Connect(() => this.enforceCorpseLimit());
	}

	private enforceCorpseLimit() {
		const corpsesSet = CollectionService.GetTagged("Corpse");
		const limit = 50;
		if (corpsesSet.size() <= limit) return;

		const toSort: Array<{ inst: Instance; time: number }> = [];
		for (const corpse of corpsesSet) {
			const spawnTime = corpse.GetAttribute("SpawnTime") as number || 0;
			toSort.push({ inst: corpse, time: spawnTime });
		}
		toSort.sort((a, b) => a.time < b.time);
		const removeCount = toSort.size() - limit;
		for (let i = 0; i < removeCount; i++) {
			const item = toSort[i];
			if (item && item.inst.Parent) item.inst.Destroy();
		}
	}

	private handleResurrectionRequest(player: Player, corpse: Model) {
		const userId = player.UserId;
		
		// 🔧 ФИКС 1: Проверяем, что могила не уничтожена
		if (!corpse.Parent || corpse.Parent !== Workspace) {
			this.events.resurrectionFailed(player, "Могила исчезла");
			return;
		}
		
		if (!CollectionService.HasTag(corpse, "Corpse")) {
			this.events.resurrectionFailed(player, "Это не могила");
			return;
		}
		
		if (this.playerCooldowns.has(userId) && os.clock() < (this.playerCooldowns.get(userId) || 0)) {
			this.events.resurrectionFailed(player, "Кулдаун"); 
			return;
		}
		
		if ((this.armyCounts.get(userId) || 0) >= this.MAX_ARMY) {
			this.events.resurrectionFailed(player, "Лимит армии"); 
			return;
		}

		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot) return;
		
		// 🔧 ФИКС 1: Проверяем PrimaryPart перед расчётом дистанции
		const corpseRoot = corpse.PrimaryPart;
		if (!corpseRoot || charRoot.Position.sub(corpseRoot.Position).Magnitude > 20) {
			this.events.resurrectionFailed(player, "Слишком далеко"); 
			return;
		}

		this.startHoldProcess(player, corpse);
	}

	private startHoldProcess(player: Player, corpse: Model) {
		const userId = player.UserId;
		this.cancelProcess(userId);
		const startTime = os.clock();
		this.playerProcesses.set(userId, { corpseId: corpse.Name, startTime });

		task.spawn(() => {
			while (this.playerProcesses.has(userId) && os.clock() - startTime < this.HOLD_DURATION) {
				const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
				
				// 🔧 ФИКС 1: Проверяем существование могилы
				if (!charRoot || !corpse.Parent || !corpse.PrimaryPart) {
					this.events.resurrectionFailed(player, "Прервано: могила исчезла");
					this.events.updateProgress(player, 0);
					this.playerProcesses.delete(userId); 
					return;
				}
				
				if (charRoot.Position.sub(corpse.PrimaryPart.Position).Magnitude > 25) {
					this.events.resurrectionFailed(player, "Прервано: слишком далеко");
					this.events.updateProgress(player, 0);
					this.playerProcesses.delete(userId); 
					return;
				}
				
				const progress = math.min((os.clock() - startTime) / this.HOLD_DURATION, 1);
				this.events.updateProgress(player, progress);
				task.wait(0.1);
			}

			if (this.playerProcesses.has(userId)) {
				this.resurrectFromGrave(player, corpse);
				this.events.resurrectionSuccess(player);
				this.playerCooldowns.set(userId, os.clock() + this.COOLDOWN);
				this.playerProcesses.delete(userId);
			}
		});
	}

	private cancelProcess(userId: number) { 
		this.playerProcesses.delete(userId); 
	}

	// 🔧 ФИКС 2: Воскрешение с отслеживанием смерти юнита
	private resurrectFromGrave(player: Player, grave: Model) {
		const userId = player.UserId;
		const currentCount = this.armyCounts.get(userId) || 0;
		
		if (currentCount >= this.MAX_ARMY) return;
		
		// Получаем тип юнита из атрибутов могилы
		const unitTypeStr = grave.GetAttribute("UnitType") as string || "skeleton";
		const unitType = this.convertToUnitType(unitTypeStr);
		
		// Воскрешаем через менеджер
		const revivedUnit = this.corpseManager.resurrectFromGrave(grave);
		
		if (revivedUnit) {
			this.armyCounts.set(userId, currentCount + 1);
			this.events.updateMana(player, 40, 50);
			
			// Настраиваем атрибуты для SummonComponent
			revivedUnit.SetAttribute("OwnerId", userId);
			revivedUnit.SetAttribute("WeaponType", this.summonBuilder.getRandomWeapon());
			revivedUnit.SetAttribute("UnitType", unitType);
			
			this.updateArmyCountUI(player);
			print(`[Resurrection] ✅ ${player.Name} воскресил ${unitType}! Армия: ${currentCount + 1}/${this.MAX_ARMY}`);
			
			// 🔧 ФИКС 2: Слушаем смерть воскрешённого юнита
			const humanoid = revivedUnit.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				humanoid.Died.Connect(() => {
					const lastCount = this.armyCounts.get(userId) || 1;
					const newCount = math.max(0, lastCount - 1);
					this.armyCounts.set(userId, newCount);
					this.updateArmyCountUI(player);
					print(`[Resurrection] 💀 ${revivedUnit.Name} погиб. Армия: ${newCount}/${this.MAX_ARMY}`);
				});
			}
		} else {
			this.armyCounts.set(userId, currentCount);
			this.events.resurrectionFailed(player, "Ошибка воскрешения");
		}
	}

	// 🔧 ФИКС 3: Единый метод конвертации типов
	private convertToUnitType(unitTypeStr: string): UnitType {
	const mapped = this.TYPE_MAP[unitTypeStr];
	if (mapped) return mapped;
	
	// Логгируем неизвестный тип для отладки
	warn(`[ResurrectionService] ⚠️ Неизвестный тип: ${unitTypeStr}, используем SkeletonWarrior`);
	return "SkeletonWarrior";
	}

	private updateArmyCountUI(player: Player) {
		const current = this.armyCounts.get(player.UserId) || 0;
		this.events.updateArmyCount(player, current, this.MAX_ARMY);
	}
}