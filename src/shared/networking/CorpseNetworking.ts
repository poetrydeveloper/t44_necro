import { Networking } from "@flamework/networking";

interface ServerEvents {
	/** Клиент хочет начать воскрешение */
	requestResurrection(corpseId: string): void;
	/** Клиент отменил удержание или отошёл */
	cancelResurrection(): void;
}

interface ClientEvents {
	/** Обновить прогресс-бар (0.0 - 1.0) */
	updateProgress(percent: number): void;
	/** Воскрешение завершено успешно */
	resurrectionSuccess(): void;
	/** Воскрешение прервано/отклонено */
	resurrectionFailed(reason: string): void;
	/** Обновить текущую ману игрока */
	updateMana(current: number, max: number): void;
	/** Обновить количество армии */
	updateArmyCount(current: number, max: number): void;
}

export const CorpseNetworking = Networking.createEvent<ServerEvents, ClientEvents>();