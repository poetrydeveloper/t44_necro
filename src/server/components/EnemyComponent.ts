import { Component, BaseComponent } from "@flamework/components";
import { OnStart } from "@flamework/core";

@Component({
    tag: "Enemy",
})
export class EnemyComponent extends BaseComponent<{}, Model> implements OnStart {
    public rootPart!: BasePart;
    private isActive = true; // Флаг жизненного цикла

    onStart() {
        const root = this.instance.PrimaryPart 
            || (this.instance.FindFirstChild("HumanoidRootPart") as BasePart | undefined);

        if (!root || !root.IsA("BasePart")) {
            warn(`[EnemyComponent] ❌ У ${this.instance.Name} нет корректного RootPart`);
            return;
        }

        this.rootPart = root;
    }

    public getPosition(): Vector3 {
        return this.rootPart.Position;
    }

    /**
     * Вызывай это ПЕРЕД тем, как превратить врага в труп
     */
    public setDead() {
        if (!this.isActive) return;
        this.isActive = false;

        // 1. Мгновенно останавливаем падение
        this.rootPart.Anchored = true;
        
        // 2. Отключаем коллизии, чтобы не конфликтовать с новым объектом трупа
        for (const part of this.instance.GetChildren()) {
            if (part.IsA("BasePart")) {
                part.CanCollide = false;
                part.CanQuery = false; // Чтобы не мешать рейкастам сбора
            }
        }
        
        // 3. Убираем тег, чтобы Flamework перестал считать его врагом
        this.instance.RemoveTag("Enemy");
    }

    public getIsActive(): boolean {
        return this.isActive;
    }
}
