import { Service, OnStart, Dependency } from "@flamework/core";
import { Players } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";
import { ProgressionService } from "./ProgressionService";
import { StatsNetworking } from "shared/networking/StatsNetworking";

@Service({})
export class StatsUpdateService implements OnStart {
	private events = StatsNetworking.createServer({});
	
	constructor(
		private playerDataService: PlayerDataService,
		private progressionService: ProgressionService
	) {}

	onStart() {
		print("[StatsUpdateService] 📊 Система обновления статистики запущена");
		
		// Отправляем статистику при загрузке игрока
		this.playerDataService.onDataLoaded.Connect((player, data) => {
			this.sendStatsToPlayer(player);
		});
		
		// Обновляем статистику при изменении данных (каждые 2 секунды)
		task.spawn(() => {
			while (true) {
				task.wait(2);
				for (const player of Players.GetPlayers()) {
					this.sendStatsToPlayer(player);
				}
			}
		});
	}
	
	private sendStatsToPlayer(player: Player) {
		const data = this.playerDataService.getPlayerData(player);
		if (!data) return;
		
		const requiredExp = data.requiredExperience;
		
		this.events.updateStats.fire(player, {
			level: data.stats.level,
			experience: data.stats.experience,
			requiredExperience: requiredExp,
			currentHealth: data.stats.currentHealth,
			maxHealth: data.stats.maxHealth,
			currentMana: data.stats.currentMana,
			maxMana: data.stats.maxMana,
		});
	}
}