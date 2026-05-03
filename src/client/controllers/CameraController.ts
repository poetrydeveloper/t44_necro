import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, UserInputService, RunService } from "@rbxts/services";

@Controller({})
export class CameraController implements OnStart {
	private player = Players.LocalPlayer;
	private rootPart?: BasePart;

	private yaw = 0;
	private pitch = 20;
	private isRightMouseDown = false;

	// --- НАСТРОЙКИ ---
	private readonly DISTANCE = 20;
	private readonly SENSITIVITY = 0.4;
	private readonly MIN_PITCH = 5; 
	private readonly MAX_PITCH = 75;
	private readonly SMOOTH_SPEED = 25; 
	private readonly RETURN_SPEED = 1.5; // Скорость доводки камеры за спину

	onStart() {
		const onCharAdded = (char: Model) => {
			this.rootPart = char.WaitForChild("HumanoidRootPart", 10) as BasePart;
			// Начальный ракурс
			const [, rootYaw] = this.rootPart.CFrame.ToOrientation();
			this.yaw = math.deg(rootYaw) + 180;
		};

		this.player.CharacterAdded.Connect(onCharAdded);
		if (this.player.Character) onCharAdded(this.player.Character);

		// Управление правой кнопкой мыши
		UserInputService.InputBegan.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton2) {
				this.isRightMouseDown = true;
				UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition;
			}
		});

		UserInputService.InputEnded.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton2) {
				this.isRightMouseDown = false;
				UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
			}
		});

		// Вращение мышью
		UserInputService.InputChanged.Connect((input) => {
			if (this.isRightMouseDown && input.UserInputType === Enum.UserInputType.MouseMovement) {
				this.yaw -= input.Delta.X * this.SENSITIVITY;
				this.pitch -= input.Delta.Y * this.SENSITIVITY;
				this.pitch = math.clamp(this.pitch, this.MIN_PITCH, this.MAX_PITCH);
			}
		});

		RunService.RenderStepped.Connect((dt) => this.updateCamera(dt));
	}

	private updateCamera(dt: number) {
		if (!this.rootPart) return;
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		camera.CameraType = Enum.CameraType.Scriptable;

		const humanoid = this.player.Character?.FindFirstChildOfClass("Humanoid");
		
		if (!this.isRightMouseDown) {
			// Проверяем, движется ли персонаж
			if (humanoid && humanoid.MoveDirection.Magnitude > 0.1) {
				// Вычисляем угол направления движения (куда жмет игрок)
				const moveDir = humanoid.MoveDirection;
				const targetYawDeg = math.deg(math.atan2(moveDir.X, moveDir.Z)) + 180;

				// Плавный поворот за спину (низкий коэффициент, чтобы не бегать по кругу)
				this.yaw = this.lerpAngle(this.yaw, targetYawDeg, dt * this.RETURN_SPEED);
				this.pitch = math.lerp(this.pitch, 25, dt * this.RETURN_SPEED);
			} else {
				// Если игрок остановился, МЫ НЕ ТРОГАЕМ YAW. 
				// Камера просто остается в последнем положении.
				this.pitch = math.lerp(this.pitch, 25, dt * this.RETURN_SPEED);
			}
		}

		// РАСЧЕТ ПОЗИЦИИ (Математически верная сфера)
		const yawRad = math.rad(this.yaw);
		const pitchRad = math.rad(this.pitch);

		const finalOffset = new Vector3(
			math.sin(yawRad) * math.cos(pitchRad),
			math.sin(pitchRad),
			math.cos(yawRad) * math.cos(pitchRad)
		).mul(this.DISTANCE);

		const targetPosition = this.rootPart.Position.add(finalOffset);
		const targetCFrame = CFrame.lookAt(targetPosition, this.rootPart.Position);

		// Применяем плавное следование
		const alpha = math.clamp(1 - math.exp(-this.SMOOTH_SPEED * dt), 0, 1);
		camera.CFrame = camera.CFrame.Lerp(targetCFrame, alpha);
	}

	// Помощник для интерполяции углов без прыжков через 0/360
	private lerpAngle(a: number, b: number, t: number): number {
		let delta = (b - a) % 360;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;
		return a + delta * math.clamp(t, 0, 1);
	}
}
