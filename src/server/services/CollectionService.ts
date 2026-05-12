// src/server/services/CollectionService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Players } from "@rbxts/services";
import { PlayerDataService } from "./PlayerDataService";
import { SoulWeightService } from "./SoulWeightService";
import { CardData, CollectionData, CARD_BASE_STATS } from "shared/types/CollectionTypes";

@Service({})
export class CollectionService implements OnStart {
	private playerCollections = new Map<number, CollectionData>();
	private soulWeightService!: SoulWeightService;
	
	constructor(private playerDataService: PlayerDataService) {}

	onStart() {
		print("[CollectionService] 📚 Система коллекции запущена");
		this.soulWeightService = Dependency<SoulWeightService>();
		
		this.playerDataService.onDataLoaded.Connect((player, data) => {
			this.loadCollection(player, data.userId);
		});
	}

	private loadCollection(player: Player, userId: number) {
		const level = player.GetAttribute("Level") as number || 1;
		const maxSoulWeight = this.soulWeightService.getMaxSoulWeight(level);
		
		const collection: CollectionData = {
			userId: userId,
			maxSoulWeight: maxSoulWeight,
			currentSoulWeight: 0,
			cards: [],
			activeDeck: [],
		};
		
		this.playerCollections.set(userId, collection);
		print(`[CollectionService] 📚 Загружена коллекция для ${player.Name}, макс. вес: ${maxSoulWeight}`);
	}

	public getCollection(userId: number): CollectionData | undefined {
		return this.playerCollections.get(userId);
	}

	public addCard(player: Player, card: CardData): boolean {
		const collection = this.playerCollections.get(player.UserId);
		if (!collection) return false;
		
		if (!this.soulWeightService.canAddCard(collection.currentSoulWeight, card.soulWeight, collection.maxSoulWeight)) {
			print(`[CollectionService] ❌ Недостаточно места! Вес: ${collection.currentSoulWeight}/${collection.maxSoulWeight}`);
			return false;
		}
		
		collection.cards.push(card);
		collection.currentSoulWeight += card.soulWeight;
		
		print(`[CollectionService] ✅ Добавлена карточка ${card.unitName} (${card.tier}★) для ${player.Name}`);
		return true;
	}

	public removeCard(player: Player, cardId: string): boolean {
		const collection = this.playerCollections.get(player.UserId);
		if (!collection) return false;
		
		const index = collection.cards.findIndex(c => c.cardId === cardId);
		if (index === -1) return false;
		
		const card = collection.cards[index];
		collection.cards.remove(index);
		collection.currentSoulWeight -= card.soulWeight;
		
		return true;
	}

	public upgradeCard(player: Player, cardId: string): boolean {
		const collection = this.playerCollections.get(player.UserId);
		if (!collection) return false;
		
		const card = collection.cards.find(c => c.cardId === cardId);
		if (!card || card.upgradeLevel >= 10) return false;
		
		card.upgradeLevel++;
		
		print(`[CollectionService] ⬆️ Карточка ${card.unitName} улучшена до +${card.upgradeLevel}`);
		return true;
	}
}