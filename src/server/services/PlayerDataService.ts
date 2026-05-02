import { Service, OnStart } from "@flamework/core";
import { Players, DataStoreService } from "@rbxts/services";
import { GameConfig } from "shared/constants/GameConfig";
import { NecromancerStats } from "shared/types/GameTypes";

// Выносим интерфейс, чтобы другие сервисы могли его импортировать
export interface PlayerData {
	userId: number;
	stats: NecromancerStats;
	gold: number;
	soulEssence: number;
	currentRun: number;
}

@Service({})
export class PlayerDataService implements OnStart {
	private dataStore = DataStoreService.GetDataStore("NecromancerData_v1");
	private playerDataMap = new Map<number, PlayerData>();
	
	onStart() {
		print("[PlayerDataService] 💾 Система сохранений запущена");
		
		Players.PlayerAdded.Connect((player) => this.loadPlayerData(player));
		Players.PlayerRemoving.Connect((player) => {
			this.savePlayerData(player);
			this.playerDataMap.delete(player.UserId);
		});
		
		// Авто-сохранение (безопасный цикл)
		task.spawn(() => {
			while (task.wait(60)) {
				this.saveAllPlayers();
			}
		});
	}
	
	private async loadPlayerData(player: Player) {
		const userId = player.UserId;
		const key = `User_${userId}`;
		
		// В TS pcall возвращает массив: [success, result]
		const [success, data] = pcall(() => this.dataStore.GetAsync(key));
		
		if (success && data !== undefined) {
			const parsed = data as PlayerData;
			// Важно: мерджим со стартовыми статами на случай обновления конфига
			this.playerDataMap.set(userId, parsed);
			print(`[PlayerDataService] 📥 Данные загружены: ${player.Name}`);
		} else {
			const newData: PlayerData = {
				userId: userId,
				stats: { ...GameConfig.startingStats },
				gold: 0,
				soulEssence: 0,
				currentRun: 1,
			};
			this.playerDataMap.set(userId, newData);
			print(`[PlayerDataService] 🆕 Создан профиль: ${player.Name}`);
		}
	}
	
	private savePlayerData(player: Player) {
		const userId = player.UserId;
		const data = this.playerDataMap.get(userId);
		
		if (data) {
			const [success, err] = pcall(() => this.dataStore.SetAsync(`User_${userId}`, data));
			if (!success) warn(`[PlayerDataService] ❌ Ошибка сохранения ${player.Name}: ${err}`);
		}
	}
	
	private saveAllPlayers() {
		for (const player of Players.GetPlayers()) {
			this.savePlayerData(player);
		}
	}
	
	public getPlayerData(player: Player): PlayerData | undefined {
		return this.playerDataMap.get(player.UserId);
	}

	// Удобный метод для изменения данных (например, добавить золото)
	public updatePlayerData(player: Player, updater: (data: PlayerData) => void) {
		const data = this.playerDataMap.get(player.UserId);
		if (data) {
			updater(data);
			// В Flamework данные обновляются по ссылке, но можно перестраховаться:
			this.playerDataMap.set(player.UserId, data);
		}
	}
}
