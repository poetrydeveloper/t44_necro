// src/shared/networking/CombatNetworking.ts
import { Networking } from "@flamework/networking";

/**
 * События сетевого взаимодействия для боевой системы.
 */
interface ServerEvents {
	/** Клиент сообщает серверу: включить (true) или выключить (false) авто-атаку */
	setAutoAttackState(state: boolean): void;
}

interface ClientEvents {
	/** Сервер сообщает клиенту: проиграй эффект удара или звука */
	playHitEffect(position: Vector3): void;
	
	// 🛠 НОВОЕ: Сервер отправляет данные для всплывающего урона
	/** Показывает всплывающий урон над целью */
	showDamagePopup(targetId: string, damage: number, position: Vector3): void;
}

// Экспортируем константу для использования в сервисах и контроллерах
export const CombatNetworking = Networking.createEvent<ServerEvents, ClientEvents>();