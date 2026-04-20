/**
 * CrashedState.js — Trạng thái ngã / Game Over
 * 
 * - Ragdoll-like tumble animation
 * - Slowdown → stop
 * - Trigger Game Over UI
 * - Tap to restart
 */

class CrashedState extends BaseState {
    constructor() {
        super();
        this.crashTimer = 0;
        this.gameOverTriggered = false;
    }

    enter() {
        const player = this.owner;
        this.crashTimer = 0;
        this.gameOverTriggered = false;
        player.isCrashed = true;
        player.comboMultiplier = 1;

        // The crash physics
        player.velocity.x *= 0.3;
        player.velocity.y = Physics.JUMP_FORCE * 0.5; // Bump up slightly
    }

    update(dt, input) {
        const player = this.owner;
        const terrain = player.terrainManager;

        this.crashTimer += dt;

        // Tumble rotation
        player.rotation += 8 * dt;

        // Apply gravity
        player.velocity.y += Physics.GRAVITY * dt;
        player.velocity.x *= (1 - 3 * dt); // High friction to slow down

        // Update position
        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;

        // Ground collision
        const terrainY = terrain.getHeightAt(player.position.x);
        if (player.position.y <= terrainY) {
            player.position.y = terrainY;
            player.velocity.y = -player.velocity.y * 0.3; // Small bounce
            player.velocity.x *= 0.5;

            // Stop bouncing after a while
            if (Math.abs(player.velocity.y) < 0.5) {
                player.velocity.y = 0;
                player.velocity.x = 0;
            }
        }

        // Trigger Game Over after delay
        if (this.crashTimer > 1.5 && !this.gameOverTriggered) {
            this.gameOverTriggered = true;
            if (player.onGameOver) {
                player.onGameOver();
            }
        }

        // Tap to restart (after game over is shown)
        if (this.gameOverTriggered && input.justPressed && this.crashTimer > 2.0) {
            if (player.onRestart) {
                player.onRestart();
            }
        }
    }

    exit() {
        this.owner.isCrashed = false;
    }
}
