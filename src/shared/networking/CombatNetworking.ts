import { Networking } from "@flamework/networking";
import { EnemyData } from "shared/types/EnemyTypes";

/**
 * События, отправляемые КЛИЕНТОМ на СЕРВЕР
 */
interface ServerEvents {
	/** Запрос на поиск ближайшего врага */
	requestNearestEnemy(range: number): void;
	/** Запрос на атаку конкретного врага */
	attackEnemy(enemyId: string): void;
}

/**
 * События, отправляемые СЕРВЕРОМ на КЛИЕНТ
 */
interface ClientEvents {
	/** Обновление данных о текущей цели */
	updateNearestEnemy(enemyId: string | undefined, enemyData: EnemyData | undefined): void;
}

/**
 * Создание сетевого моста.
 * Мы экспортируем это как константу. 
 * В коде сервисов/контроллеров используй .createClient({}) или .createServer({})
 * для получения доступа к методам без ошибок типизации.
 */
export const CombatNetworking = Networking.createEvent<ServerEvents, ClientEvents>();
