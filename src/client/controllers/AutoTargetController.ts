import { Controller, OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";
import { CombatNetworking } from "shared/networking/CombatNetworking";
import { EnemyData } from "shared/types/EnemyTypes";

@Controller({})
export class AutoTargetController implements OnStart {
    // Явно создаем клиентскую часть нетворкинга
    private events = CombatNetworking.createClient({});
    
    private player = Players.LocalPlayer;
    private rootPart?: BasePart;
    private currentTargetId: string | undefined;
    
    private readonly TARGET_RANGE = 40;
    private readonly ATTACK_COOLDOWN = 1.2;
    private nextAttackTime = 0;
    
    onStart() {
        print("[AutoTargetController] 🎯 Авто-прицел активирован");

        this.player.CharacterAdded.Connect((char) => {
            this.rootPart = char.WaitForChild("HumanoidRootPart", 5) as BasePart;
        });
        if (this.player.Character) this.rootPart = this.player.Character.WaitForChild("HumanoidRootPart", 5) as BasePart;

        this.events.updateNearestEnemy.connect((enemyId: string | undefined, enemyData: EnemyData | undefined) => {
            this.currentTargetId = enemyId;
        });
        
        this.startLoops();
    }
    
    private startLoops() {
        task.spawn(() => {
            while (task.wait(0.3)) {
                if (this.rootPart) {
                    this.events.requestNearestEnemy.fire(this.TARGET_RANGE);
                }
            }
        });

        task.spawn(() => {
            while (task.wait(0.1)) {
                this.tryAttack();
            }
        });
    }
    
    private tryAttack() {
        if (!this.currentTargetId || !this.rootPart) return;
        if (os.clock() < this.nextAttackTime) return;

        const humanoid = this.player.Character?.FindFirstChildOfClass("Humanoid");
        if (humanoid && humanoid.Health <= 0) return;

        this.events.attackEnemy.fire(this.currentTargetId);
        this.nextAttackTime = os.clock() + this.ATTACK_COOLDOWN;
    }
}
