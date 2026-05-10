import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, CollectionService } from "@rbxts/services";
import { CorpseComponent } from "server/components/CorpseComponent";
import { CorpseNetworking } from "shared/networking/CorpseNetworking";
import { SummonBuilder } from "./SummonBuilder";

@Service({})
export class ResurrectionService implements OnStart {
	private components = Dependency<Components>();
	private events = CorpseNetworking.createServer({});
	private summonBuilder = Dependency<SummonBuilder>();

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
			if (c.Name === corpseId && c.IsA("Model")) { corpse = c; break; }
		}

		if (!corpse) { 
			this.events.resurrectionFailed(player, "Труп не найден"); 
			return; 
		}

		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
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
				if (!charRoot || !corpse.Parent || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 25) {
					this.events.resurrectionFailed(player, "Прервано: далеко или труп исчез");
					this.events.updateProgress(player, 0);
					this.playerProcesses.delete(userId); 
					return;
				}
				const progress = math.min((os.clock() - startTime) / this.HOLD_DURATION, 1);
				this.events.updateProgress(player, progress);
				task.wait(0.1);
			}

			if (this.playerProcesses.has(userId)) {
				const comp = this.components.getComponent<CorpseComponent>(corpse);
				if (comp) {
					this.spawnSummon(player, comp, corpse);
					this.events.resurrectionSuccess(player);
					this.playerCooldowns.set(userId, os.clock() + this.COOLDOWN);
				}
				this.playerProcesses.delete(userId);
			}
		});
	}

	private cancelProcess(userId: number) { 
		this.playerProcesses.delete(userId); 
	}

	private spawnSummon(player: Player, comp: CorpseComponent, corpse: Model) {
		const userId = player.UserId;
		const currentCount = this.armyCounts.get(userId) || 0;
		
		if (currentCount >= this.MAX_ARMY) return;
		
		this.armyCounts.set(userId, currentCount + 1);
		this.events.updateMana(player, 40, 50);

		// ПОЗИЦИЯ ТРУПА
		const corpsePos = corpse.GetPivot().Position;
		
		// СОЗДАЁМ ЮНИТА (передаём владельца)
		const summonModel = this.summonBuilder.createSummonModel("SkeletonWarrior", corpsePos, player);

		if (summonModel) {
			// УДАЛЯЕМ ТРУП
			if (corpse.Parent) corpse.Destroy();
			this.updateArmyCountUI(player);
			print(`[Resurrection] ✅ ${player.Name} воскресил скелета! Армия: ${currentCount + 1}/${this.MAX_ARMY}`);
		} else {
			// Откат при ошибке
			this.armyCounts.set(userId, currentCount);
			this.events.resurrectionFailed(player, "Ошибка создания юнита");
		}
	}

	private updateArmyCountUI(player: Player) {
		const current = this.armyCounts.get(player.UserId) || 0;
		this.events.updateArmyCount(player, current, this.MAX_ARMY);
	}
}