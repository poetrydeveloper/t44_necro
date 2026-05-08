import { Networking } from "@flamework/networking";

interface ClientToServerEvents {
	// Пока пусто, клиент только получает
}

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

interface ClientToServerFunctions {}
interface ServerToClientFunctions {}

export const StatsNetworking = Networking.createEvent<ClientToServerEvents, ServerToClientEvents>();