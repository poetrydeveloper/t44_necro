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

	private readonly HOLD_DURATION = 1.5; // Секунд удержания кнопки
	private readonly MANA_COST = 10;      // Стоимость воскрешения
	private readonly MAX_ARMY = 5;         // Лимит юнитов в армии
	private readonly COOLDOWN = 2.0;       // Кулдаун между воскрешениями

	onStart() {
		print("[ResurrectionService] 🔄 Система воскрешения запущена");

		// Обработчики событий от клиента
		this.events.requestResurrection.connect((player, corpseId: string) => {
			this.handleResurrectionRequest(player, corpseId);
		});

		this.events.cancelResurrection.connect((player) => {
			this.cancelProcess(player.UserId);
		});

		// Следим за появлением новых трупов для лимита
		CollectionService.GetInstanceAddedSignal("Corpse").Connect(() => this.enforceCorpseLimit());
	}

	// =========================
	// 🗑 ОГРАНИЧЕНИЕ КОЛИЧЕСТВА ТРУПОВ
	// =========================
	private enforceCorpseLimit() {
	const corpsesSet = CollectionService.GetTagged("Corpse");
	const limit = 100;

	// Если трупов меньше лимита, выходим сразу
	if (corpsesSet.size() <= limit) return;

	// 1. Собираем данные вручную (чтобы избежать Array.from)
	const toSort: Array<{ inst: Instance; time: number }> = [];
	for (const corpse of corpsesSet) {
		const comp = this.components.getComponent<CorpseComponent>(corpse);
		if (comp) {
			toSort.push({ inst: corpse, time: comp.spawnTime });
		}
	}

	// 2. Сортировка: старые трупы (меньшее время) идут в начало
	// Важно: возвращаем boolean для совместимости с Luau
	toSort.sort((a, b) => a.time < b.time);

	// 3. Удаляем лишние
	// В roblox-ts у массивов есть метод .size()
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

		// 3. Поиск трупа в мире
		const corpse = Workspace.FindFirstChild(corpseId) as Model;
		const comp = corpse ? this.components.getComponent<CorpseComponent>(corpse) : undefined;
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
		const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!charRoot || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
			this.events.resurrectionFailed(player, "Слишком далеко");
			return;
		}

		// 6. Запуск процесса удержания
		this.startHoldProcess(player, corpse, comp);
	}

	// =========================
	// ⏳ ПРОЦЕСС УДЕРЖАНИЯ КНОПКИ
	// =========================
	private startHoldProcess(player: Player, corpse: Model, comp: CorpseComponent) {
		const userId = player.UserId;
		this.cancelProcess(userId); // Сбросить предыдущий процесс если был

		const startTime = os.clock();
		this.playerProcesses.set(userId, { corpseId: corpse.Name, startTime });

		task.spawn(() => {
			const proc = this.playerProcesses.get(userId);
			// Защита: если процесс сменился или труп не тот — выходим
			if (!proc || proc.corpseId !== corpse.Name) return;

			while (os.clock() - startTime < this.HOLD_DURATION) {
				const charRoot = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart;
				
				// Проверки каждый кадр: игрок на месте? труп существует? дистанция в норме?
				if (!charRoot || !corpse.Parent || charRoot.Position.sub(corpse.GetPivot().Position).Magnitude > 20) {
					this.events.resurrectionFailed(player, "Отошёл далеко или труп исчез");
					this.events.updateProgress(player, 0);
					this.playerProcesses.delete(userId);
					return;
				}

				// Обновляем прогресс-бар на клиенте
				const progress = math.min((os.clock() - startTime) / this.HOLD_DURATION, 1);
				this.events.updateProgress(player, progress);
				
				task.wait(0.1); // Проверка каждые 100мс
			}

			// 🎉 Успех: время удержания истекло
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
		// Примечание: task.spawn нельзя прервать напрямую, 
		// но проверка proc.corpseId выше остановит "старый" процесс
	}

	// =========================
	// 🧟 СПАВН ВОСКРЕШЁННОГО ЮНИТА
	// =========================
	private spawnSummon(player: Player, comp: CorpseComponent) {
		const userId = player.UserId;
		
		// Увеличиваем счётчик армии
		this.armyCounts.set(userId, (this.armyCounts.get(userId) || 0) + 1);
		
		// Списываем ману
		this.spendMana(player, this.MANA_COST);
		
		print(`[Resurrection] ✅ ${player.Name} воскресил ${comp.templateId}`);
		
		// 🛠 Здесь в Спринте 5 будет вызов SpawnService.createSummon(...)
		// Пока просто логируем успех
	}

	// =========================
	// 💰 ЗАГЛУШКИ ДЛЯ МАНЫ (до Спринта 5)
	// =========================
	private getPlayerMana(player: Player): number {
		// Временно возвращаем фиксированное значение
		// В Спринте 5 подключим реальный ManaComponent
		return 50; 
	}

	private spendMana(player: Player, amount: number) {
		// Синхронизируем с клиентом (заглушка)
		this.events.updateMana(player, 40, 50);
	}
}