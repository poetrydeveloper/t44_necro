import { Service, OnStart } from "@flamework/core";
import { Players, DataStoreService } from "@rbxts/services";
import { Signal } from "@rbxts/lemon-signal";
import { GameConfig } from "shared/constants/GameConfig";
import { NecromancerStats } from "shared/types/GameTypes";

export interface PlayerData {
	userId: number;
	stats: NecromancerStats;
	gold: number;
	soulEssence: number;
	currentRun: number;
	requiredExperience: number;
}

@Service({})
export class PlayerDataService implements OnStart {
	private dataStore = DataStoreService.GetDataStore("NecromancerData_v1");
	private playerDataMap = new Map<number, PlayerData>();
	private dirtyPlayers = new Set<number>();

	public readonly onDataLoaded = new Signal<(player: Player, data: PlayerData) => void>();

	onStart() {
		print("[PlayerDataService] 💾 Система сохранений запущена");

		Players.PlayerAdded.Connect((player) => this.loadPlayerData(player));

		Players.PlayerRemoving.Connect((player) => {
			this.savePlayerData(player);
			this.playerDataMap.delete(player.UserId);
			this.dirtyPlayers.delete(player.UserId);
		});

		task.spawn(() => {
			while (task.wait(60)) {
				this.saveDirtyPlayers();
			}
		});
	}

	private reconcile(source: object, template: object): object {
		// Используем Lua pairs через for..in
		for (const [key, value] of pairs(template)) {
			const sourceValue = (source as Record<string, unknown>)[key as string];

			if (sourceValue === undefined) {
				(source as Record<string, unknown>)[key as string] = value;
			} else if (typeIs(value, "table") && typeIs(sourceValue, "table")) {
				this.reconcile(sourceValue as object, value as object);
			}
		}
		return source;
	}

	private calculateRequiredExp(level: number): number {
		return math.floor(100 * (level ^ 1.5));
	}

	private createDefaultData(player: Player): PlayerData {
		const startingStats = { ...GameConfig.startingStats } as NecromancerStats;
		return {
			userId: player.UserId,
			stats: startingStats,
			gold: 0,
			soulEssence: 0,
			currentRun: 1,
			requiredExperience: this.calculateRequiredExp(1),
		};
	}

	private async loadPlayerData(player: Player) {
		const userId = player.UserId;
		const key = `User_${userId}`;
		const template = this.createDefaultData(player);

		const [success, data] = pcall(() => this.dataStore.GetAsync(key));

		let finalData: PlayerData;

		if (success && data !== undefined) {
			finalData = this.reconcile(data as PlayerData, template) as PlayerData;
			print(`[PlayerDataService] 📥 Данные синхронизированы для: ${player.Name}`);
		} else {
			finalData = template;
			print(`[PlayerDataService] 🆕 Создан профиль для: ${player.Name}`);
		}

		this.playerDataMap.set(userId, finalData);
		this.onDataLoaded.Fire(player, finalData);
	}

	private saveDirtyPlayers() {
		if (this.dirtyPlayers.size() === 0) return;

		print(`[PlayerDataService] 🔃 Авто-сохранение ${this.dirtyPlayers.size()} игроков...`);
		for (const userId of this.dirtyPlayers) {
			const player = Players.GetPlayerByUserId(userId);
			if (player) {
				this.savePlayerData(player);
			}
		}
		this.dirtyPlayers.clear();
	}

	private savePlayerData(player: Player) {
		const userId = player.UserId;
		const data = this.playerDataMap.get(userId);

		if (data) {
			const [success, err] = pcall(() => this.dataStore.SetAsync(`User_${userId}`, data));
			if (success) {
				this.dirtyPlayers.delete(userId);
			} else {
				warn(`[PlayerDataService] ❌ Ошибка DataStore для ${player.Name}: ${err}`);
			}
		}
	}

	public getPlayerData(player: Player): PlayerData | undefined {
		return this.playerDataMap.get(player.UserId);
	}

	public updatePlayerData(player: Player, updater: (data: PlayerData) => void) {
		const data = this.playerDataMap.get(player.UserId);
		if (data) {
			updater(data);
			this.dirtyPlayers.add(player.UserId);
		}
	}
}