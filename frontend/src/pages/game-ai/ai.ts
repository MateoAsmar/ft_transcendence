// TypeScript AI Module - Fully Typed Version

// ===== TYPE DEFINITIONS =====
export interface GameState {
	ball: {
		x: number;
		y: number;
		vx: number;
		vy: number;
		radius: number;
	};
	paddle1: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	paddle2: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	canvasWidth: number;
	canvasHeight: number;
}

export type AIAction = 'UP' | 'DOWN' | 'STAY';

interface DifficultySettings {
	accuracy: number;
	speed: number;
}

// ===== PONG AI CLASS =====
export class PongAI {
	private difficulty: string = 'medium';
	private lastUpdateTime: number = 0;
	private readonly UPDATE_INTERVAL: number = 1000; // 1 second constraint
	private targetY: number = 0;
	private isEnabled: boolean = false;

	constructor(difficulty: string = 'medium') {
		this.difficulty = difficulty;
		this.isEnabled = false;
	}

	public enable(): void {
		this.isEnabled = true;
		this.lastUpdateTime = 0;
	}

	public disable(): void {
		this.isEnabled = false;
	}

	public update(gameState: GameState): AIAction {
		if (!this.isEnabled) return 'STAY';

		const currentTime = Date.now();

		// Respect 1-second refresh constraint
		if (currentTime - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
			this.analyzeGameState(gameState);
			this.lastUpdateTime = currentTime;
		}

		// Make movement decision
		const paddleCenter = gameState.paddle2.y + gameState.paddle2.height / 2;
		const diff = this.targetY - paddleCenter;
		const tolerance = 15; // Movement tolerance

		if (Math.abs(diff) < tolerance) {
			return 'STAY';
		}

		return diff < 0 ? 'UP' : 'DOWN';
	}

	private analyzeGameState(gameState: GameState): void {
		const { ball, paddle2, canvasHeight } = gameState;

		// Enhanced prediction with wall bounces
		if (ball.vx > 0) { // Ball moving toward AI
			let predictedX = ball.x;
			let predictedY = ball.y;
			let vx = ball.vx;
			let vy = ball.vy;

			// Simulate until ball reaches AI paddle
			while (predictedX < paddle2.x && vx > 0) {
				predictedX += vx;
				predictedY += vy;

				// Handle wall bounces
				if (predictedY <= 0 || predictedY >= canvasHeight) {
					vy = -vy;
					predictedY = predictedY <= 0 ? 0 : canvasHeight;
				}
			}

			// Add difficulty-based accuracy
			const settings = this.getDifficultySettings();
			const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

			// Speed affects accuracy - faster = more errors
			const speedFactor = Math.min(ballSpeed / 6, 2);
			const baseError = (1 - settings.accuracy) * 80;
			const speedError = speedFactor * 25;
			const totalError = baseError + speedError;

			const error = (Math.random() - 0.5) * totalError;

			this.targetY = Math.max(40, Math.min(canvasHeight - 40, predictedY + error));

			console.log(`🤖 AI: Speed ${ballSpeed.toFixed(1)}, Target: ${this.targetY.toFixed(1)}, Error: ${error.toFixed(1)}`);
		} else {
			// Ball moving away - return to center with some randomness
			const centerY = canvasHeight / 2;
			const randomOffset = (Math.random() - 0.5) * 60;
			this.targetY = centerY + randomOffset;
		}
	}

	private getDifficultySettings(): DifficultySettings {
		const settings: Record<string, DifficultySettings> = {
			easy: { accuracy: 0.65, speed: 0.7 },
			medium: { accuracy: 0.78, speed: 0.85 },
			hard: { accuracy: 0.88, speed: 0.95 },
			expert: { accuracy: 0.95, speed: 1.0 }
		};

		return settings[this.difficulty] || settings.medium;
	}

	public simulateInput(keys: { [key: string]: boolean }, action: AIAction): void {
		if (!this.isEnabled) return;

		// Clear AI keys
		keys['arrowup'] = false;
		keys['arrowdown'] = false;

		// Apply AI action
		if (action === 'UP') {
			keys['arrowup'] = true;
		} else if (action === 'DOWN') {
			keys['arrowdown'] = true;
		}
	}

	public setDifficulty(difficulty: string): void {
		this.difficulty = difficulty;
		console.log(`AI difficulty: ${difficulty}`);
	}

	public reset(): void {
		this.lastUpdateTime = 0;
		this.targetY = 0;
	}
}
