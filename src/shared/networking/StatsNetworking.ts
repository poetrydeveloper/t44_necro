import { Networking } from "@flamework/networking";

interface ServerToClientEvents {
	updateStats: (stats: {
		level: number;
		experience: number;
		requiredExperience: number;
		currentHealth: number;
		maxHealth: number;
		currentMana: number;
		maxMana: number;
	}) => void;
}

interface ClientToServerEvents {
	// Пока пусто
}

export const StatsNetworking = Networking.createEvent<ClientToServerEvents, ServerToClientEvents>();