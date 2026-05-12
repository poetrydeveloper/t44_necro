import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { Workspace } from "@rbxts/services";

@Component({
	tag: "Corpse",
})
export class CorpseComponent extends BaseComponent<{}, Model> implements OnStart {
	public templateId: string = "";
	public spawnTime: number = 0;
	private readonly lifetime = 60;

	onStart() {
		this.templateId = this.instance.GetAttribute("templateId") as string || "Unknown";
		this.spawnTime = this.instance.GetAttribute("spawnTime") as number || os.clock();

		// --- ИНЖЕНЕРНЫЙ FIX ПРОТИВ ПРОВАЛА ---
		const root = this.instance.PrimaryPart || this.instance.FindFirstChildWhichIsA("BasePart");
		
		if (root) {
			// 1. Делаем Raycast вниз, чтобы найти физический пол
			const rayParams = new RaycastParams();
			rayParams.FilterType = Enum.RaycastFilterType.Exclude;
			rayParams.FilterDescendantsInstances = [this.instance];

			const rayResult = Workspace.Raycast(root.Position.add(new Vector3(0, 2, 0)), new Vector3(0, -10, 0), rayParams);

			if (rayResult) {
				// Ставим труп точно на пол
				this.instance.PivotTo(new CFrame(rayResult.Position.add(new Vector3(0, 0.5, 0))));
			}

			// 2. Якорим все части, чтобы они не падали сквозь InvisibleFloor
			for (const part of this.instance.GetDescendants()) {
				if (part.IsA("BasePart")) {
					part.Anchored = true;
					part.CanCollide = false; // Труп не должен мешать игроку ходить
					part.CanQuery = true;   // НО он должен ловиться рейкастом сбора!
				}
			}
		}
		// ---------------------------------------

		print(`[CorpseComponent] 🪦 Труп зафиксирован: ${this.templateId}`);

		task.delay(this.lifetime, () => {
			if (this.instance.Parent) this.instance.Destroy();
		});
	}
}
