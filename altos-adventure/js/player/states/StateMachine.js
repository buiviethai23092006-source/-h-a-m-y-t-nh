/**
 * StateMachine.js — Finite State Machine framework
 * 
 * Nhân vật chỉ được phép ở 1 trạng thái duy nhất tại 1 thời điểm.
 * Mỗi trạng thái là 1 object riêng biệt với enter(), update(), exit().
 * Giúp tránh spaghetti code khi xử lý logic nhảy, lộn vòng, trượt dây cờ.
 */

class StateMachine {
    constructor(owner) {
        this.owner = owner;        // Reference đến Player
        this.states = {};          // Registry: name → state instance
        this.currentState = null;  // State hiện tại
        this.previousState = null; // State trước đó
        this.stateName = '';       // Tên state hiện tại
    }

    /**
     * Đăng ký state vào FSM
     * @param {string} name - Tên trạng thái (VD: 'grounded', 'airborne')
     * @param {object} state - State object có enter(), update(), exit()
     */
    register(name, state) {
        state.stateMachine = this;
        state.owner = this.owner;
        state.name = name;
        this.states[name] = state;
    }

    /**
     * Chuyển sang trạng thái mới
     * Gọi exit() trên state cũ → enter() trên state mới
     */
    changeState(name) {
        if (!this.states[name]) {
            console.warn(`State "${name}" not registered!`);
            return;
        }

        if (this.currentState) {
            this.currentState.exit();
        }

        this.previousState = this.currentState;
        this.currentState = this.states[name];
        this.stateName = name;
        this.currentState.enter();
    }

    /**
     * Update — delegate to current state
     */
    update(dt, input) {
        if (this.currentState) {
            this.currentState.update(dt, input);
        }
    }

    /**
     * Kiểm tra state hiện tại
     */
    isInState(name) {
        return this.stateName === name;
    }
}

/**
 * Base State class — Template cho tất cả states
 */
class BaseState {
    constructor() {
        this.stateMachine = null;
        this.owner = null;
        this.name = '';
    }

    enter() {}
    update(dt, input) {}
    exit() {}
}
