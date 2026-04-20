/**
 * GroundedState.js — Trạng thái trượt tuyết trên mặt đất
 * 
 * - Snap Y to terrain height
 * - Rotate board theo slope angle
 * - Tăng tốc khi xuống dốc, giảm tốc khi lên dốc
 * - Input: Tap → nhảy (chuyển sang AirborneState)
 */

class GroundedState extends BaseState {
    constructor() {
        super();
        this.trailTimer = 0;
    }

    enter() {
        const player = this.owner;
        player.isGrounded = true;
        player.flipAngle = 0;

        // Perfect landing bonus
        if (this.stateMachine.previousState &&
            this.stateMachine.previousState.name === 'airborne') {
            if (player.pendingPerfectLanding) {
                player.score += 50 * player.comboMultiplier;
                player.comboMultiplier = Math.min(player.comboMultiplier + 1, 10);
                player.pendingPerfectLanding = false;
                player.showTrickText('Perfect Landing! +' + (50 * player.comboMultiplier));
            }
        }
    }

    update(dt, input) {
        const player = this.owner;
        const terrain = player.terrainManager;

        // Lấy terrain height và slope tại vị trí player
        const terrainY = terrain.getHeightAt(player.position.x);
        const slope = terrain.getSlopeAt(player.position.x);

        // === SLOPE ACCELERATION (Euler Integration) ===
        // Gia tốc = g * sin(slope) — tăng tốc khi xuống dốc
        const slopeAccel = Physics.GRAVITY * Math.sin(-slope);
        player.velocity.x += slopeAccel * dt;

        // Base forward speed (luôn đi tiến)
        player.velocity.x = Math.max(player.velocity.x, Physics.MIN_SPEED);

        // Friction
        player.velocity.x *= (1 - Physics.FRICTION * dt);

        // Clamp max speed
        player.velocity.x = Math.min(player.velocity.x, Physics.MAX_SPEED);

        // Snap to terrain
        player.position.x += player.velocity.x * dt;
        player.position.y = terrainY;
        player.velocity.y = 0;

        // Rotate board to match slope
        player.targetRotation = slope;
        player.rotation = MathUtils.lerp(player.rotation, player.targetRotation, 0.15);

        // Reset combo if grounded for too long
        this.trailTimer += dt;
        if (this.trailTimer > 3) {
            player.comboMultiplier = 1;
        }

        // === INPUT: Tap to jump ===
        if (input.justPressed) {
            player.velocity.y = Physics.JUMP_FORCE;
            player.velocity.x += 2; // Slight forward boost on jump
            this.stateMachine.changeState('airborne');
        }

        // Update distance score
        player.distance = Math.max(player.distance, player.position.x);
    }

    exit() {
        this.owner.isGrounded = false;
        this.trailTimer = 0;
    }
}
