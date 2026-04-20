/**
 * CameraController.js — Smooth follow camera
 * 
 * - Lerp camera position toward player
 * - Dynamic zoom: zoom out when airborne
 * - Look-ahead based on velocity
 */

class CameraController {
    constructor(camera) {
        this.camera = camera;

        // Camera offset from player
        this.offset = { x: -5, y: 12, z: 25 };
        this.lookAheadFactor = 3;

        // Smooth follow params
        this.followSpeed = 0.04;
        this.verticalFollowSpeed = 0.06;

        // Dynamic zoom
        this.baseZoom = 25;
        this.airborneZoom = 35;
        this.currentZoom = this.baseZoom;

        // Target position
        this.targetPosition = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
    }

    /**
     * Update camera each frame
     */
    update(player, dt) {
        const px = player.position.x;
        const py = player.position.y;
        const vx = player.velocity.x;

        // Look-ahead: camera leads the player based on speed
        const lookAheadX = vx * this.lookAheadFactor * 0.1;

        // Dynamic zoom based on state
        const targetZoom = player.isGrounded ? this.baseZoom : this.airborneZoom;
        this.currentZoom = MathUtils.lerp(this.currentZoom, targetZoom, 0.03);

        // Target camera position
        this.targetPosition.set(
            px + this.offset.x + lookAheadX,
            py + this.offset.y,
            this.currentZoom
        );

        // Smooth follow
        this.camera.position.x = MathUtils.lerp(
            this.camera.position.x, this.targetPosition.x, this.followSpeed
        );
        this.camera.position.y = MathUtils.lerp(
            this.camera.position.y, this.targetPosition.y, this.verticalFollowSpeed
        );
        this.camera.position.z = MathUtils.lerp(
            this.camera.position.z, this.targetPosition.z, 0.03
        );

        // Look at point (slightly ahead of player)
        this.targetLookAt.set(px + lookAheadX + 5, py, 0);
        this.currentLookAt.lerp(this.targetLookAt, 0.05);
        this.camera.lookAt(this.currentLookAt);
    }

    /**
     * Reset camera for new game
     */
    reset(player) {
        const px = player.position.x;
        const py = player.position.y;
        this.camera.position.set(px + this.offset.x, py + this.offset.y, this.baseZoom);
        this.currentLookAt.set(px + 5, py, 0);
        this.camera.lookAt(this.currentLookAt);
        this.currentZoom = this.baseZoom;
    }
}
