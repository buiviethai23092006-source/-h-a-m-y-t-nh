/**
 * BoostingState.js — Trạng thái tăng tốc
 * 
 * - Kích hoạt sau perfect landing hoặc combo cao
 * - Speed multiplier + particle trail effect
 * - Auto-expire sau duration → GroundedState
 */

class BoostingState extends BaseState {
    constructor() {
        super();
        this.boostTimer = 0;
        this.boostDuration = 2.0; // seconds
    }

    enter() {
        const player = this.owner;
        this.boostTimer = 0;
        player.isBoosting = true;
        player.velocity.x *= 1.5; // Speed boost
        player.showTrickText('BOOST!');
    }

    update(dt, input) {
        const player = this.owner;
        const terrain = player.terrainManager;

        this.boostTimer += dt;

        // Get terrain data
        const terrainY = terrain.getHeightAt(player.position.x);
        const slope = terrain.getSlopeAt(player.position.x);

        // Enhanced speed during boost
        const slopeAccel = Physics.GRAVITY * Math.sin(-slope) * 1.5;
        player.velocity.x += slopeAccel * dt;
        player.velocity.x = Math.max(player.velocity.x, Physics.MIN_SPEED * 2);
        player.velocity.x = Math.min(player.velocity.x, Physics.MAX_SPEED * 1.3);

        // Minimal friction during boost
        player.velocity.x *= (1 - Physics.FRICTION * 0.3 * dt);

        // Update position
        player.position.x += player.velocity.x * dt;
        player.position.y = terrainY;

        // Rotate to slope
        player.targetRotation = slope;
        player.rotation = MathUtils.lerp(player.rotation, player.targetRotation, 0.2);

        // Score bonus during boost
        player.score += Math.floor(dt * 30 * player.comboMultiplier);

        // Jump during boost
        if (input.justPressed) {
            player.velocity.y = Physics.JUMP_FORCE * 1.2;
            this.stateMachine.changeState('airborne');
            return;
        }

        // Auto-expire
        if (this.boostTimer >= this.boostDuration) {
            this.stateMachine.changeState('grounded');
        }

        player.distance = Math.max(player.distance, player.position.x);
    }

    exit() {
        this.owner.isBoosting = false;
    }
}
