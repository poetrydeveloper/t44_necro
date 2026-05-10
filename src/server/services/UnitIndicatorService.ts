import { Service, OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";

interface IndicatorData {
	circle: BasePart;
	arrow: BasePart;
	container: Model;
}

@Service({})
export class UnitIndicatorService implements OnStart {
	private indicators = new Map<string, IndicatorData>();
	private readonly CHASE_RANGE = 50;

	onStart() {
		print("[UnitIndicatorService] 🎨 Система индикаторов запущена");
	}

	public update(unitId: string, state: string, targetPos: Vector3, unitPos: Vector3) {
		const { circle, arrow } = this.getOrCreate(unitId);
		const hasTarget = (state === "chase" || state === "attack");
		
		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		rayParams.FilterDescendantsInstances = [circle, arrow];
		
		const rayResult = Workspace.Raycast(unitPos.add(new Vector3(0, 5, 0)), new Vector3(0, -15, 0), rayParams);
		const groundY = rayResult ? rayResult.Position.Y + 0.1 : unitPos.Y - 2.9;

		circle.Size = new Vector3(0.1, this.CHASE_RANGE * 2, this.CHASE_RANGE * 2);
		circle.CFrame = new CFrame(unitPos.X, groundY, unitPos.Z).mul(CFrame.Angles(0, 0, 90 * math.pi / 180));

		if (hasTarget) {
			arrow.Transparency = 0;
			const arrowHeight = groundY + 0.3;
			arrow.CFrame = new CFrame(
				new Vector3(unitPos.X, arrowHeight, unitPos.Z),
				new Vector3(targetPos.X, arrowHeight, targetPos.Z)
			);
			circle.Color = Color3.fromRGB(255, 50, 50);
			circle.Transparency = 0.6;
			circle.Material = Enum.Material.Neon;
		} else {
			arrow.Transparency = 1;
			circle.Color = Color3.fromRGB(50, 200, 100);
			circle.Transparency = 0.85;
			circle.Material = Enum.Material.SmoothPlastic;
		}
	}

	// Получить позицию индикатора по ID юнита
	public getIndicatorPosition(unitId: string): Vector3 | undefined {
		const data = this.indicators.get(unitId);
		if (data) {
			return data.circle.Position;
		}
		return undefined;
	}

	public destroy(unitId: string) {
		const data = this.indicators.get(unitId);
		if (data) {
			data.container.Destroy();
			this.indicators.delete(unitId);
		}
	}

	private getOrCreate(unitId: string): IndicatorData {
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

		const data = { circle, arrow, container };
		this.indicators.set(unitId, data);
		return data;
	}
}