import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({ tag: "Corpse" })
export class CorpseHighlightComponent extends BaseComponent<{}, Model> implements OnStart {
	onStart() {
		// 1. Маркер над головой
		const marker = new Instance("Part");
		marker.Name = "CorpseMarker";
		marker.Shape = Enum.PartType.Cylinder;
		marker.Size = new Vector3(0.2, 0.5, 0.5);
		marker.Material = Enum.Material.Neon;
		marker.Color = Color3.fromRGB(100, 100, 255);
		marker.Anchored = true;
		marker.CanCollide = false;
		marker.Transparency = 0.5;
		marker.CFrame = this.instance.GetPivot().add(new Vector3(0, 4, 0)).mul(CFrame.Angles(0, 0, math.rad(90)));
		marker.Parent = this.instance;

		// 2. Контур (SelectionBox)
		const outline = new Instance("SelectionBox", this.instance);
		outline.Adornee = this.instance;
		outline.Color3 = Color3.fromRGB(150, 50, 250);
		outline.LineThickness = 0.05;
		outline.SurfaceColor3 = Color3.fromRGB(150, 50, 250);
	}
}