/**
 * HUD.js — Score, Distance, Combo, Trick Text display
 * Quản lý tất cả UI elements trong game
 */

class HUD {
    constructor() {
        this.elements = {};
        this._createElements();
    }

    _createElements() {
        // Score
        this.elements.score = document.getElementById('hud-score');
        this.elements.distance = document.getElementById('hud-distance');
        this.elements.combo = document.getElementById('hud-combo');
        this.elements.trick = document.getElementById('hud-trick');
        this.elements.state = document.getElementById('hud-state');
        this.elements.speed = document.getElementById('hud-speed');
    }

    update(player) {
        if (this.elements.score) {
            this.elements.score.textContent = Math.floor(player.score).toLocaleString();
        }
        if (this.elements.distance) {
            this.elements.distance.textContent = Math.floor(player.distance) + 'm';
        }
        if (this.elements.combo && player.comboMultiplier > 1) {
            this.elements.combo.textContent = 'x' + player.comboMultiplier;
            this.elements.combo.style.opacity = '1';
            this.elements.combo.style.transform = 'scale(' + (1 + player.comboMultiplier * 0.05) + ')';
        } else if (this.elements.combo) {
            this.elements.combo.style.opacity = '0';
        }
        if (this.elements.trick) {
            if (player.trickText && player.trickTextTimer > 0) {
                this.elements.trick.textContent = player.trickText;
                this.elements.trick.style.opacity = Math.min(1, player.trickTextTimer * 2).toString();
                this.elements.trick.style.transform = 'translateY(' + ((1.5 - player.trickTextTimer) * -20) + 'px)';
            } else {
                this.elements.trick.style.opacity = '0';
            }
        }
        if (this.elements.speed) {
            const speed = Math.floor(Math.abs(player.velocity.x) * 3.6); // km/h
            this.elements.speed.textContent = speed + ' km/h';
        }
        if (this.elements.state) {
            this.elements.state.textContent = player.fsm.stateName.toUpperCase();
        }
    }

    showGameOver(score, distance) {
        const overlay = document.getElementById('game-over');
        if (overlay) {
            overlay.style.display = 'flex';
            const finalScore = document.getElementById('final-score');
            const finalDist = document.getElementById('final-distance');
            if (finalScore) finalScore.textContent = Math.floor(score).toLocaleString();
            if (finalDist) finalDist.textContent = Math.floor(distance) + 'm';
        }
    }

    hideGameOver() {
        const overlay = document.getElementById('game-over');
        if (overlay) overlay.style.display = 'none';
    }

    showStartScreen() {
        const screen = document.getElementById('start-screen');
        if (screen) screen.style.display = 'flex';
    }

    hideStartScreen() {
        const screen = document.getElementById('start-screen');
        if (screen) screen.style.display = 'none';
    }
}
