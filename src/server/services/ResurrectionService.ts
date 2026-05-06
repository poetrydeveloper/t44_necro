import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, Workspace, CollectionService } from "@rbxts/services";
import { CorpseComponent } from "server/components/CorpseComponent";
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

		// Собираем данные вручную (безопасно для roblox-ts)
		const toSort: Array<{ inst: Instance; time: number }> = [];
		for (const corpse of corpsesSet) {
			const comp = this.components.getComponent<CorpseComponent>(corpse);
			if (comp) {
				toSort.push({ inst: corpse, time: comp.spawnTime });
			}
		}

		// Сортировка: старые трупы (меньшее время) идут в начало
		// Возвращаем boolean для совместимости с Luau table.sort
		toSort.sort((a, b) => a.time < b.time);

		// Удаляем лишние (через .size(), так как в roblox-ts массивы используют этот метод)
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
	// 🔄 ЗАПРОС НА ВОСКРЕШЕНИЕ (ИСПРАВЛЕНО)
	// =========================
	private handleResurrectionRequest(player: Player, corpseId: string) {
		const userId = player.UserId;

		// 1. Проверка кулдауна
		if (this.playerCooldowns.has(userId) && os.clock() < (this.playerCooldowns.get(userId) || 0)) {
			this.events.resurrectionFailed(player, "Кулдаун");
			return;
		}

		// 2. Проверка лимита армии
		if ((this.armyCounts.get(userId) || 0) >= this.MAX_ARMY) {
			this.events.resurrectionFailed(player, "Лимит армии");
			return;
		}

		// 🛠 3. Поиск трупа через CollectionService (работает в любой папке)
		const corpses = CollectionService.GetTagged("Corpse");
		let corpse: Model | undefined;
		
		for (const c of corpses) {
			if (c.Name === corpseId && c.IsA("Model")) {
				corpse = c;
				break;
			}
		}

		// 🛠 ВАЖНО: Явная проверка для TypeScript, чтобы сузить тип до 'Model'
		if (!corpse) {
			this.events.resurrectionFailed(player, "Труп не найден");
			return;
		}

		// Теперь TypeScript знает, что corpse — это точно Model, а не undefined
		const comp = this.components.getComponent<CorpseComponent>(corpse);
		if (!comp) {
			this.events.resurrectionFailed(player, "Труп не найден");
			return;
		}

		// 4. Проверка маны (заглушка до Спринта 5)
		const mana = this.getPlayerMana(player);
		if (mana < this.MANA_COST) {
			this.events.resurrectionFailed(player, "Недостаточно маны");
			return;
		}

		// 5. Проверка дистанции (серверная валидация)
		// 🛠 Теперь здесь нет ошибок: corpse гарантированно существует
		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
			this.events.resurrectionFailed(player, "Слишком далеко");
			return;
		}

		// 6. Запуск процесса удержания
		// 🛠 И здесь тоже: передаём валидную модель
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
				
				// Проверки: игрок на месте? труп существует? дистанция в норме?
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

			// 🎉 Успех
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
		
		print(`[Resurrection] ✅ ${player.Name} воскресил ${comp.templateId}`);
		// В Спринте 5 здесь будет вызов SpawnService.createSummon(...)
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