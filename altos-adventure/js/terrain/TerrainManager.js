/**
 * TerrainManager.js — Circular Queue Object Pool cho terrain chunks
 * 
 * Nguyên lý: Khởi tạo sẵn ~6 chunks. Khi player trượt qua chunk đầu,
 * chunk đó được tái sử dụng (reset) và đặt ra cuối hàng đợi.
 * KHÔNG bao giờ new/delete chunk trong game loop → Zero GC pressure.
 */

class TerrainManager {
    constructor(scene, config) {
        this.scene = scene;
        this.noise = new SimplexNoise(config.seed || 42);

        this.config = {
            poolSize: config.poolSize || 6,        // Số chunks trong pool
            chunkWidth: config.chunkWidth || 80,    // Chiều rộng mỗi chunk
            segmentCount: config.segmentCount || 160,
            depth: config.depth || 40,
            controlPoints: config.controlPoints || 12,
            maxHeight: config.maxHeight || 20,
            baseHeight: config.baseHeight || 0,
            recycleMargin: config.recycleMargin || 40, // Khoảng cách phía sau player để recycle
        };

        // Circular Queue
        this.chunks = [];          // Mảng chunks
        this.headIndex = 0;        // Index chunk đầu tiên (cũ nhất)
        this.noiseOffsetCounter = 0;   // Noise offset liên tục
        this.lastEndX = 0;             // Vị trí X cuối cùng
        this.lastEndHeight = 0;        // Chiều cao cuối cùng (để nối seamless)

        this._initPool();
    }

    /**
     * Khởi tạo pool — tạo sẵn tất cả chunks
     */
    _initPool() {
        const chunkConfig = {
            chunkWidth: this.config.chunkWidth,
            segmentCount: this.config.segmentCount,
            depth: this.config.depth,
            controlPoints: this.config.controlPoints,
            maxHeight: this.config.maxHeight,
            baseHeight: this.config.baseHeight,
        };

        for (let i = 0; i < this.config.poolSize; i++) {
            const chunk = new TerrainChunk(this.scene, chunkConfig);

            // Sinh terrain cho chunk
            const noiseOff = this.noiseOffsetCounter;
            const startH = i === 0 ? 0 : this.lastEndHeight;

            chunk.generate(this.lastEndX, noiseOff, this.noise, startH);

            this.lastEndX = chunk.getEndX();
            this.lastEndHeight = chunk.getEndHeight();
            this.noiseOffsetCounter += this.config.controlPoints;

            this.chunks.push(chunk);
        }
    }

    /**
     * Update mỗi frame — kiểm tra và recycle chunks
     * @param {number} playerX - Vị trí X hiện tại của player
     */
    update(playerX) {
        // Kiểm tra chunk đầu tiên (cũ nhất)
        const head = this.chunks[this.headIndex];
        const headEndX = head.getEndX();

        // Nếu player đã trượt qua chunk đầu + margin → recycle
        if (playerX > headEndX + this.config.recycleMargin) {
            this._recycleHead();
        }
    }

    /**
     * Recycle chunk đầu tiên → đặt ra cuối hàng đợi
     * Đây là core của Object Pooling pattern
     */
    _recycleHead() {
        const chunk = this.chunks[this.headIndex];

        // Reset chunk với terrain mới
        chunk.reset(
            this.lastEndX,
            this.noiseOffsetCounter,
            this.noise,
            this.lastEndHeight
        );

        // Cập nhật tracking
        this.lastEndX = chunk.getEndX();
        this.lastEndHeight = chunk.getEndHeight();
        this.noiseOffsetCounter += this.config.controlPoints;

        // Di chuyển head pointer (circular)
        this.headIndex = (this.headIndex + 1) % this.config.poolSize;
    }

    /**
     * Lấy chiều cao terrain tại bất kỳ vị trí X nào
     * Tìm chunk chứa vị trí đó và truy vấn heightMap
     */
    getHeightAt(worldX) {
        for (let i = 0; i < this.config.poolSize; i++) {
            const idx = (this.headIndex + i) % this.config.poolSize;
            const height = this.chunks[idx].getHeightAt(worldX);
            if (height !== null) return height;
        }
        return 0;
    }

    /**
     * Lấy surface normal tại vị trí X
     */
    getNormalAt(worldX) {
        for (let i = 0; i < this.config.poolSize; i++) {
            const idx = (this.headIndex + i) % this.config.poolSize;
            const normal = this.chunks[idx].getNormalAt(worldX);
            if (normal !== null) return normal;
        }
        return { x: 0, y: 1 };
    }

    /**
     * Lấy slope angle tại vị trí X
     */
    getSlopeAt(worldX) {
        for (let i = 0; i < this.config.poolSize; i++) {
            const idx = (this.headIndex + i) % this.config.poolSize;
            const chunk = this.chunks[idx];
            const localX = worldX - chunk.xOffset;
            if (localX >= 0 && localX <= chunk.config.chunkWidth) {
                return chunk.getSlopeAt(worldX);
            }
        }
        return 0;
    }

    /**
     * Lấy tất cả chunks hiện đang active (theo thứ tự từ gần→xa)
     */
    getActiveChunks() {
        const result = [];
        for (let i = 0; i < this.config.poolSize; i++) {
            const idx = (this.headIndex + i) % this.config.poolSize;
            result.push(this.chunks[idx]);
        }
        return result;
    }

    dispose() {
        this.chunks.forEach(c => c.dispose());
        this.chunks = [];
    }
}
