/**
 * FlippingState.js — Trạng thái lộn vòng (Backflip)
 * 
 * - Giữ màn hình → nhân vật xoay 360°
 * - Mỗi vòng hoàn thành → +1 combo multiplier + score bonus
 * - Release → quay lại AirborneState
 * - Vẫn áp dụng gravity
 */

class FlippingState extends BaseState {
    constructor() {
        super();
        this.totalFlipAngle = 0;
        this.flipsCompleted = 0;
    }

    enter() {
        this.totalFlipAngle = 0;
        this.flipsCompleted = 0;
        this.owner.isFlipping = true;
    }

    update(dt, input) {
        const player = this.owner;
        const terrain = player.terrainManager;

        // === GRAVITY (vẫn áp dụng khi flip) ===
        player.velocity.y += Physics.GRAVITY * dt;

        // Update position
        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;

        // === BACKFLIP ROTATION ===
        const flipSpeed = Physics.FLIP_SPEED; // rad/s
        const flipDelta = flipSpeed * dt;

        player.rotation -= flipDelta; // Xoay ngược chiều kim đồng hồ (backflip)
        this.totalFlipAngle += flipDelta;

        // Check completed flips
        const newFlips = Math.floor(this.totalFlipAngle / (Math.PI * 2));
        if (newFlips > this.flipsCompleted) {
            this.flipsCompleted = newFlips;
            player.comboMultiplier = Math.min(player.comboMultiplier + 2, 15);
            const flipScore = 100 * this.flipsCompleted * player.comboMultiplier;
            player.score += flipScore;
            player.showTrickText('Backflip x' + this.flipsCompleted + '! +' + flipScore);
        }

        // === INPUT: Release to stop flipping ===
        if (!input.isHeld) {
            this.stateMachine.changeState('airborne');
            return;
        }

        // === LANDING CHECK (same as airborne) ===
        const terrainY = terrain.getHeightAt(player.position.x);
        if (player.position.y <= terrainY && player.velocity.y <= 0) {
            player.position.y = terrainY;

            const normal = terrain.getNormalAt(player.position.x);
            const playerUpX = -Math.sin(player.rotation);
            const playerUpY = Math.cos(player.rotation);
            const cosAngle = MathUtils.dot2D(playerUpX, playerUpY, normal.x, normal.y);

            if (cosAngle < Physics.SAFE_LANDING_THRESHOLD) {
                this.stateMachine.changeState('crashed');
            } else {
                player.pendingPerfectLanding = true;
                player.velocity.y = 0;
                this.stateMachine.changeState('grounded');
            }
        }

        if (player.position.y < -100) {
            this.stateMachine.changeState('crashed');
        }
    }

    exit() {
        this.owner.isFlipping = false;
    }
}
