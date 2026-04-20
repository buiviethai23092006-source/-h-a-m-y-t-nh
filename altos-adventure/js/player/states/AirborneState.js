/**
 * AirborneState.js — Trạng thái nhảy (trên không)
 * 
 * - Áp dụng gravity (free fall parabola)
 * - Input: Hold → chuyển sang FlippingState
 * - Landing check: Dot Product giữa Up Vector và Surface Normal
 *   + Safe → GroundedState + speed boost
 *   + Unsafe → CrashedState (Game Over)
 */

class AirborneState extends BaseState {
    constructor() {
        super();
        this.airTime = 0;
    }

    enter() {
        this.airTime = 0;
        this.owner.isGrounded = false;
    }

    update(dt, input) {
        const player = this.owner;
        const terrain = player.terrainManager;

        // === GRAVITY (Euler Integration) ===
        player.velocity.y += Physics.GRAVITY * dt;

        // Update position
        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;

        // Air drag — slight speed reduction
        player.velocity.x *= (1 - Physics.AIR_DRAG * dt);
        player.velocity.x = Math.max(player.velocity.x, Physics.MIN_SPEED);

        // Track air time
        this.airTime += dt;

        // Slight rotation based on velocity (natural arc)
        const velAngle = Math.atan2(player.velocity.y, player.velocity.x);
        player.targetRotation = velAngle * 0.5;
        player.rotation = MathUtils.lerp(player.rotation, player.targetRotation, 0.08);

        // === INPUT: Hold to flip ===
        if (input.isHeld && this.airTime > 0.1) {
            this.stateMachine.changeState('flipping');
            return;
        }

        // === LANDING CHECK ===
        const terrainY = terrain.getHeightAt(player.position.x);
        if (player.position.y <= terrainY && player.velocity.y <= 0) {
            player.position.y = terrainY;

            // === DOT PRODUCT LANDING CHECK ===
            // playerUpVector = (sin(rotation), cos(rotation)) — hướng "lên" của player
            // surfaceNormal = terrain normal tại điểm hạ cánh
            const normal = terrain.getNormalAt(player.position.x);
            const playerUpX = -Math.sin(player.rotation);
            const playerUpY = Math.cos(player.rotation);

            // cos(angle) = dot(playerUp, surfaceNormal)
            const cosAngle = MathUtils.dot2D(playerUpX, playerUpY, normal.x, normal.y);

            if (cosAngle < Physics.SAFE_LANDING_THRESHOLD) {
                // === CRASH — Góc lệch quá lớn ===
                this.stateMachine.changeState('crashed');
            } else {
                // === SAFE LANDING ===
                player.pendingPerfectLanding = (cosAngle > Physics.PERFECT_LANDING_THRESHOLD);
                
                // Air time bonus
                if (this.airTime > 0.5) {
                    const airBonus = Math.floor(this.airTime * 20);
                    player.score += airBonus;
                    player.showTrickText('Air Time +' + airBonus);
                }

                player.velocity.y = 0;
                this.stateMachine.changeState('grounded');
            }
        }

        // Fall off screen → crash
        if (player.position.y < -100) {
            this.stateMachine.changeState('crashed');
        }
    }

    exit() {
        // nothing
    }
}
