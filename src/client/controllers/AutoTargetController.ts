import { Controller, OnStart } from "@flamework/core";
import { CombatNetworking } from "shared/networking/CombatNetworking";

@Controller({})
export class AutoTargetController implements OnStart {
    // Получаем доступ к событиям
    private events = CombatNetworking.createClient({});

    onStart() {
        print("[AutoTargetController] 🎯 Система захвата целей активна");

        // Просто уведомляем сервер один раз
        this.events.setAutoAttackState.fire(true);
    }
}
