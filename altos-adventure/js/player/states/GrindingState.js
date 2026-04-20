/**
 * GrindingState.js — Trạng thái trượt trên dây cờ
 * 
 * - Player di chuyển dọc theo path của dây cờ
 * - Tích điểm liên tục khi grinding
 * - Auto-exit khi hết dây → AirborneState
 */

class GrindingState extends BaseState {
    constructor() {
        super();
        this.grindProgress = 0;
        this.grindLine = null;
        this.scoreTimer = 0;
    }

    enter() {
        const player = this.owner;
        this.grindProgress = 0;
        this.scoreTimer = 0;
        this.grindLine = player.currentGrindLine;
        player.isGrinding = true;
        player.velocity.y = 0;
        player.showTrickText('Grinding!');
    }

    update(dt, input) {
        const player = this.owner;

        if (!this.grindLine) {
            this.stateMachine.changeState('airborne');
            return;
        }

        // Move along grind line
        const grindSpeed = player.velocity.x * 1.1; // Slight speed boost while grinding
        this.grindProgress += grindSpeed * dt;

        // Interpolate position along grind line
        const startX = this.grindLine.startX;
        const endX = this.grindLine.endX;
        const startY = this.grindLine.startY;
        const endY = this.grindLine.endY;
        const lineLength = endX - startX;

        const t = MathUtils.clamp(this.grindProgress / lineLength, 0, 1);
        player.position.x = MathUtils.lerp(startX, endX, t);
        player.position.y = MathUtils.lerp(startY, endY, t);

        // Keep board level while grinding
        const grindAngle = Math.atan2(endY - startY, endX - startX);
        player.rotation = MathUtils.lerp(player.rotation, grindAngle, 0.2);

        // Score accumulation
        this.scoreTimer += dt;
        if (this.scoreTimer >= 0.2) {
            this.scoreTimer = 0;
            const grindScore = 10 * player.comboMultiplier;
            player.score += grindScore;
        }

        // End of grind line
        if (t >= 1.0) {
            player.velocity.y = -3; // Slight upward launch
            player.comboMultiplier = Math.min(player.comboMultiplier + 1, 15);
            this.stateMachine.changeState('airborne');
            return;
        }

        // Tap to jump off grind
        if (input.justPressed) {
            player.velocity.y = Physics.JUMP_FORCE * 0.8;
            player.comboMultiplier = Math.min(player.comboMultiplier + 1, 15);
            this.stateMachine.changeState('airborne');
        }
    }

    exit() {
        this.owner.isGrinding = false;
        this.grindLine = null;
    }
}
