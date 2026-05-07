// src/server/services/UnitBehaviorService.ts
import { Service, OnStart, Dependency } from "@flamework/core";
import { Components } from "@flamework/components";
import { Players, TweenService, Workspace } from "@rbxts/services";
import { SummonComponent, WeaponType } from "server/components/SummonComponent";
import { EnemyComponent } from "server/components/EnemyComponent";
import { LifeComponent } from "server/components/LifeComponent";
import { CombatNetworking } from "shared/networking/CombatNetworking";

const WEAPON_STATS: Record<WeaponType, { damage: number; range: number }> = {
	RustySword: { damage: 8, range: 6 },
	BoneBlade: { damage: 12, range: 7 },
	SpectralDagger: { damage: 6, range: 5 }
};

@Service({})
export class UnitBehaviorService implements OnStart {
	private components = Dependency<Components>();
	private events = CombatNetworking.createServer({});

	private readonly CHASE_RANGE = 50;
	private readonly FOLLOW_DISTANCE = 8;
	private readonly MOVE_SPEED = 16;
	private readonly ATTACK_COOLDOWN = 1.2;

	private lastAttackTime = new Map<string, number>();
	private indicators = new Map<string, { circle: BasePart; arrow: BasePart }>();

	onStart() {
		print("[UnitBehaviorService] 🧠 Логика юнитов активна.");
		task.spawn(() => {
			while (true) {
				const dt = task.wait(1/60);
				try {
					this.update(dt);
				} catch (e) {
					warn(`[UnitBehaviorService] ❌ Ошибка: ${e}`);
				}
			}
		});
	}

	private update(dt: number) {
		const summons = this.components.getAllComponents<SummonComponent>(SummonComponent);
		const enemies = this.components.getAllComponents<EnemyComponent>(EnemyComponent);

		for (const summon of summons) {
			const model = summon.instance;
			if (!model.Parent || summon.ownerId === 0) continue;

			const owner = Players.GetPlayerByUserId(summon.ownerId);
			if (!owner?.Character) continue;
			
			const ownerRoot = owner.Character.FindFirstChild("HumanoidRootPart") as BasePart;
			if (!ownerRoot) continue;

			const currentPivot = model.GetPivot();

			// 🔍 1. ПОИСК ВРАГА
			let nearestEnemy: EnemyComponent | undefined;
			let nearestDist = this.CHASE_RANGE;

			for (const enemy of enemies) {
				const life = this.components.getComponent<LifeComponent>(enemy.instance);
				if (!life?.isAlive()) continue;

				const eRoot = enemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (!eRoot) continue;

				const d = currentPivot.Position.sub(eRoot.Position).Magnitude;
				if (d < nearestDist) {
					nearestDist = d;
					nearestEnemy = enemy;
				}
			}

			const now = os.clock();
			const last = this.lastAttackTime.get(model.Name) || 0;
			const weapon = (summon.weaponType as WeaponType) || "RustySword";
			const stats = WEAPON_STATS[weapon] || WEAPON_STATS.RustySword;
			const effectiveRange = stats.range + 2.0; 

			// 🛠 ОТЛАДКА: Печатаем состояние каждые 60 кадров (1 сек)
			// 🛠 ИСПРАВЛЕНО: убран .toFixed() для совместимости с roblox-ts
			if (os.clock() % 1 < dt && nearestEnemy) {
				print(`[DEBUG] 📏 Дист: ${nearestDist} | Радиус атаки: ${effectiveRange} | Кулдаун: ${now - last}/${this.ATTACK_COOLDOWN}`);
			}

			// ⚔️ 2. ЛОГИКА АТАКИ
			if (nearestEnemy) {
				const life = this.components.getComponent<LifeComponent>(nearestEnemy.instance);
				const isAlive = life?.isAlive();
				const inRange = nearestDist <= effectiveRange;
				const cooldownReady = now - last >= this.ATTACK_COOLDOWN;

				if (inRange && cooldownReady && isAlive) {
					// 🎯 БЬЕМ!
					life!.takeDamage(stats.damage);
					this.playAttackLunge(model, nearestEnemy.instance.GetPivot().Position);
					
					const tRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
					if (tRoot) {
						this.events.showDamagePopup(owner, nearestEnemy.instance.Name, stats.damage, tRoot.Position.add(new Vector3(0, 3, 0)));
					}
					this.lastAttackTime.set(model.Name, now);
					print(`[UnitAI] ⚔️ АТАКА УСПЕШНА! Урон: ${stats.damage}`);
					
					this.updateIndicators(model.Name, "attack", nearestEnemy.instance.GetPivot().Position, currentPivot.Position);
					continue; 
				} else {
					// Если не бьем, печатаем причину (редко, чтобы не спамить)
					// 🛠 ИСПРАВЛЕНО: убран .toFixed()
					if (os.clock() % 2 < dt) {
						if (!inRange) print(`[DEBUG] ❌ Не в радиусе (${nearestDist} > ${effectiveRange})`);
						if (!cooldownReady) print(`[DEBUG] ⏳ Кулдаун не готов`);
						if (!isAlive) print(`[DEBUG] 💀 Враг мертв`);
					}
				}
			}

			// 🏃 3. ЛОГИКА ДВИЖЕНИЯ
			let state = "follow";
			let targetPos = ownerRoot.Position;

			if (nearestEnemy && nearestDist <= this.CHASE_RANGE) {
				state = "chase";
				targetPos = nearestEnemy.instance.GetPivot().Position;
				const eRoot = nearestEnemy.instance.FindFirstChild("HumanoidRootPart") as BasePart;
				if (eRoot) this.moveTowards(model, eRoot.Position, dt);
			} else {
				state = "follow";
				targetPos = ownerRoot.Position;
				const distToOwner = currentPivot.Position.sub(ownerRoot.Position).Magnitude;
				if (distToOwner > this.FOLLOW_DISTANCE) {
					this.moveTowards(model, ownerRoot.Position, dt);
				}
			}

			// 🎨 4. ОБНОВЛЕНИЕ ИНДИКАТОРОВ
			this.updateIndicators(model.Name, state, targetPos, currentPivot.Position);
		}
	}

	private moveTowards(model: Model, targetPos: Vector3, dt: number) {
		const currentPivot = model.GetPivot();
		const diff = targetPos.sub(currentPivot.Position);
		const flatDir = new Vector3(diff.X, 0, diff.Z).Unit;
		model.PivotTo(currentPivot.add(flatDir.mul(this.MOVE_SPEED * dt)));
	}

	private playAttackLunge(model: Model, targetPos: Vector3) {
		const root = model.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!root) return;
		
		const currentPivot = model.GetPivot();
		const dir = targetPos.sub(currentPivot.Position).Unit;
		const lungePos = currentPivot.Position.add(dir.mul(1.5));
		const lookAtCFrame = CFrame.lookAt(lungePos, lungePos.add(dir));

		TweenService.Create(root, new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			CFrame: lookAtCFrame
		}).Play();

		task.delay(0.15, () => {
			if (model.Parent) {
				TweenService.Create(root, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					CFrame: currentPivot
				}).Play();
			}
		});
	}

	// =========================
	// 🎨 ИНДИКАТОРЫ (ТВОЙ КОД — БЕЗ ИЗМЕНЕНИЙ)
	// =========================
	
	private getOrCreateIndicators(unitId: string): { circle: BasePart; arrow: BasePart } {
		if (this.indicators.has(unitId)) {
			return this.indicators.get(unitId)!;
		}

		const container = new Instance("Model");
		container.Name = `Indicator_${unitId}`;
		container.Parent = Workspace;

		const circle = new Instance("Part");
		circle.Name = "DetectionCircle";
		circle.Shape = Enum.PartType.Cylinder;
		circle.Size = new Vector3(0.1, this.CHASE_RANGE * 2, this.CHASE_RANGE * 2);
		circle.Anchored = true;
		circle.CanCollide = false;
		circle.Transparency = 0.85;
		circle.Color = Color3.fromRGB(50, 200, 100);
		circle.Material = Enum.Material.SmoothPlastic;
		circle.Parent = container;

		const arrow = new Instance("Part");
		arrow.Name = "StateArrow";
		arrow.Shape = Enum.PartType.Wedge;
		arrow.Size = new Vector3(2, 0.15, 1);
		arrow.Anchored = true;
		arrow.CanCollide = false;
		arrow.Color = Color3.fromRGB(255, 255, 255);
		arrow.Parent = container;

		const data = { circle, arrow };
		this.indicators.set(unitId, data);
		return data;
	}

	private updateIndicators(unitId: string, state: string, targetPos: Vector3, unitPos: Vector3) {
		const { circle, arrow } = this.getOrCreateIndicators(unitId);
		const hasTarget = (state === "chase" || state === "attack");
		
		// 1. Поиск земли (Raycast)
		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		rayParams.FilterDescendantsInstances = [circle, arrow];
		
		const rayResult = Workspace.Raycast(unitPos.add(new Vector3(0, 5, 0)), new Vector3(0, -15, 0), rayParams);
		const groundY = rayResult ? rayResult.Position.Y + 0.1 : unitPos.Y - 2.9;

		// 2. РИСУЕМ КРУГ (ТВОЙ КОД)
		circle.Size = new Vector3(0.1, this.CHASE_RANGE * 2, this.CHASE_RANGE * 2);
		circle.CFrame = new CFrame(unitPos.X, groundY, unitPos.Z).mul(CFrame.Angles(0, 0, math.rad(90)));

		// 3. ЛОГИКА СТРЕЛКИ
		if (hasTarget) {
			arrow.Transparency = 0;
			const arrowHeight = groundY + 0.3;
			arrow.CFrame = CFrame.lookAt(
				new Vector3(unitPos.X, arrowHeight, unitPos.Z), 
				new Vector3(targetPos.X, arrowHeight, targetPos.Z)
			);
		} else {
			arrow.Transparency = 1;
		}

		// 4. ЦВЕТА
		if (hasTarget) {
			circle.Color = Color3.fromRGB(255, 50, 50);
			circle.Transparency = 0.6;
			circle.Material = Enum.Material.Neon;
		} else {
			circle.Color = Color3.fromRGB(50, 200, 100);
			circle.Transparency = 0.85;
			circle.Material = Enum.Material.SmoothPlastic;
		}
	}
}