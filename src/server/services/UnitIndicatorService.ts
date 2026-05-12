import { Service, OnStart } from "@flamework/core";
import { Workspace, Debris } from "@rbxts/services";

interface IndicatorData {
    circle: BasePart;
    arrow: BasePart;
    container: Model;
}

@Service({})
export class UnitIndicatorService implements OnStart {
    private indicators = new Map<string, IndicatorData>();
    private readonly CHASE_RANGE = 50;
    
    // Оптимизация: создаем параметры рейкаста один раз, а не каждый кадр
    private rayParams = new RaycastParams();

    onStart() {
        print("[UnitIndicatorService] 🎨 Система индикаторов запущена");
        this.rayParams.FilterType = Enum.RaycastFilterType.Exclude;
        // Сюда можно добавить папку с игроками, чтобы рейкаст не попадал по ним
    }

    public update(unitId: string, state: string, targetPos: Vector3, unitPos: Vector3) {
        const data = this.getOrCreate(unitId);
        const { circle, arrow } = data;
        const hasTarget = (state === "chase" || state === "attack");

        // ОБНОВЛЕНИЕ ФИЛЬТРА: исключаем индикаторы из рейкаста
        this.rayParams.FilterDescendantsInstances = [data.container];

        // РЕЙКАСТ: ищем только пол (статические объекты)
        const rayOrigin = unitPos.add(new Vector3(0, 5, 0)); // 10м многовато, 5м достаточно
        const rayDirection = new Vector3(0, -15, 0);
        const rayResult = Workspace.Raycast(rayOrigin, rayDirection, this.rayParams);

        let groundY: number;
        if (rayResult) {
            groundY = rayResult.Position.Y + 0.05; // Минимальный отступ над полом (Z-fighting fix)
        } else {
            // Если пол не найден (юнит падает), принудительно держим индикатор на визуальном "нуле"
            groundY = math.max(unitPos.Y, 0.5); 
        }

        // ОПТИМИЗАЦИЯ CFRAME: создаем один раз
        const baseRotation = CFrame.Angles(0, 0, math.rad(90));
        circle.CFrame = new CFrame(unitPos.X, groundY, unitPos.Z).mul(baseRotation);

        if (hasTarget) {
            arrow.Transparency = 0;
            const arrowHeight = groundY + 0.2;
            
            // FIX: Защита от LookAt Error (если позиции совпадают)
            const direction = targetPos.sub(unitPos);
            if (direction.Magnitude > 0.1) {
                arrow.CFrame = new CFrame(
                    new Vector3(unitPos.X, arrowHeight, unitPos.Z),
                    new Vector3(targetPos.X, arrowHeight, targetPos.Z)
                );
            }
            
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

    public destroy(unitId: string) {
        const data = this.indicators.get(unitId);
        if (data) {
            // Использование Debris безопаснее для физического движка
            Debris.AddItem(data.container, 0);
            this.indicators.delete(unitId);
        }
    }

    private getOrCreate(unitId: string): IndicatorData {
        let data = this.indicators.get(unitId);
        if (data) return data;

        const container = new Instance("Model");
        container.Name = `Indicator_${unitId}`;
        
        // ОПТИМИЗАЦИЯ: храним части в специальной папке в Workspace
        container.Parent = Workspace.FindFirstChild("Ignore") || Workspace;

        const circle = new Instance("Part");
        circle.Name = "DetectionCircle";
        circle.Shape = Enum.PartType.Cylinder;
        circle.Size = new Vector3(0.1, this.CHASE_RANGE * 2, this.CHASE_RANGE * 2);
        circle.Anchored = true;
        circle.CanCollide = false;
        circle.CastShadow = false; // Выключаем тени для оптимизации
        circle.CanQuery = false;   // Чтобы рейкасты сквозь него пролетали
        circle.Parent = container;

        const arrow = new Instance("Part");
        arrow.Name = "StateArrow";
        arrow.Shape = Enum.PartType.Wedge;
        arrow.Size = new Vector3(1.5, 0.1, 3); // Изменил размеры для лучшего вида
        arrow.Anchored = true;
        arrow.CanCollide = false;
        arrow.CastShadow = false;
        arrow.CanQuery = false;
        arrow.Color = Color3.fromRGB(255, 255, 255);
        arrow.Parent = container;

        data = { circle, arrow, container };
        this.indicators.set(unitId, data);
        return data;
    }
}
