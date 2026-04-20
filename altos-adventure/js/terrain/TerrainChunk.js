/**
 * TerrainChunk.js — Đơn vị địa hình cơ bản
 * Mỗi chunk = 1 THREE.Mesh với custom BufferGeometry
 * Quy trình: SimplexNoise → Control Points → Catmull-Rom Spline → BufferGeometry
 */

class TerrainChunk {
    constructor(scene, config) {
        this.scene = scene;
        this.config = {
            chunkWidth: config.chunkWidth || 80,      // Chiều rộng chunk
            segmentCount: config.segmentCount || 160,  // Số segment trên chunk
            depth: config.depth || 40,                 // Chiều sâu (z-axis) cho 3D
            controlPoints: config.controlPoints || 12, // Số control points từ noise
            maxHeight: config.maxHeight || 20,          // Biên độ cao tối đa
            baseHeight: config.baseHeight || 0,        // Độ cao nền
            segmentsPerCP: config.segmentsPerCP || 14, // Segments nội suy giữa mỗi control point
        };

        this.segmentWidth = this.config.chunkWidth / this.config.segmentCount;
        this.xOffset = 0;        // Vị trí X hiện tại trong world space
        this.noiseOffset = 0;    // Offset noise để sinh terrain mới
        this.heightMap = [];     // Mảng heightmap đã nội suy
        this.normals = [];       // Surface normals cho physics

        // Colors for snow gradient
        this.snowColor = new THREE.Color(0.95, 0.97, 1.0);
        this.shadowColor = new THREE.Color(0.6, 0.7, 0.85);
        this.sideColor = new THREE.Color(0.45, 0.52, 0.7);

        this.mesh = null;
        this.geometry = null;
        this._createMesh();
    }

    /**
     * Tạo mesh ban đầu với placeholder geometry
     */
    _createMesh() {
        this.geometry = new THREE.BufferGeometry();

        this.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: false,
            roughness: 0.8,
            metalness: 0.05,
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = false;
        this.scene.add(this.mesh);
    }

    /**
     * Sinh terrain mới cho chunk này
     * @param {number} xOffset - Vị trí X trong world space
     * @param {number} noiseOffset - Noise offset (để Simplex Noise liên tục)
     * @param {SimplexNoise} noise - Simplex Noise instance
     * @param {number} [startHeight] - Chiều cao bắt đầu (để nối liền chunk trước)
     */
    generate(xOffset, noiseOffset, noise, startHeight) {
        this.xOffset = xOffset;
        this.noiseOffset = noiseOffset;

        // === BƯỚC 1: Sinh control points từ Simplex Noise ===
        const cpCount = this.config.controlPoints;
        const controlPointsY = [];

        for (let i = 0; i < cpCount; i++) {
            const globalIndex = noiseOffset + i;
            
            // 1. Trượt xuống liên tục (độ dốc nền -1.2 mỗi đoạn)
            // Bắt buộc phải có hệ số kéo xuống rất mạnh để triệt tiêu các đoạn "lên dốc" của nhiễu.
            const baseDownward = -globalIndex * 1.2; 
            
            // 2. Chế độ tạo hình bậc thang/thác (Thẳng - Dốc mạnh - Lên cực ngắn)
            // Hàm nhiễu noise(x * 0.03) * 45 có đạo hàm cực đại khoảng 1.35
            // Kết hợp với baseDownward (-1.2), địa hình sẽ có đạo hàm dốc nằm trong khoảng từ -2.55 (dốc cắm đầu) đến +0.15 (lên dốc cực nhẹ).
            // Điều này đảm bảo 95% là dốc xuống hoặc đi ngang phẳng, chỉ có 5% là hơi gợn lên.
            const hills = noise.noise(globalIndex * 0.03, 0) * 45;

            // 3. Đá dăm nhỏ gợn sóng bề mặt
            const bumps = noise.noise(globalIndex * 0.15, 100) * 1.5;

            // Tổng hợp lại
            let height = this.config.baseHeight + baseDownward + hills + bumps;

            controlPointsY.push(height);
        }

        // Nối liền với chunk trước
        if (startHeight !== undefined) {
            controlPointsY[0] = startHeight;
        }

        // === BƯỚC 2: Nội suy Catmull-Rom Spline ===
        const segmentsPerCP = this.config.segmentsPerCP;
        this.heightMap = MathUtils.catmullRomChain(controlPointsY, segmentsPerCP);

        // Trim hoặc pad để khớp segmentCount + 1 vertices
        const neededVertices = this.config.segmentCount + 1;
        while (this.heightMap.length < neededVertices) {
            this.heightMap.push(this.heightMap[this.heightMap.length - 1]);
        }
        if (this.heightMap.length > neededVertices) {
            this.heightMap = this.heightMap.slice(0, neededVertices);
        }

        // === BƯỚC 3: Tính surface normals ===
        this.normals = [];
        for (let i = 0; i < this.heightMap.length; i++) {
            this.normals.push(
                MathUtils.getSurfaceNormal(this.heightMap, i, this.segmentWidth)
            );
        }

        // === BƯỚC 4: Build BufferGeometry ===
        this._buildGeometry();
    }

    /**
     * Build BufferGeometry từ heightMap
     * Tạo surface 3D với depth dọc trục Z và mặt cắt bên
     */
    _buildGeometry() {
        const segCount = this.config.segmentCount;
        const depth = this.config.depth;
        const halfDepth = depth / 2;
        const sw = this.segmentWidth;
        const bottomY = -50; // Đáy mesh

        // Tính tổng vertices & indices
        // Top surface: (segCount+1) * 2 vertices (front & back Z)
        // Bottom: (segCount+1) * 2 vertices
        // Front face: (segCount+1) * 2 vertices
        // Back face: (segCount+1) * 2 vertices
        const topVerts = (segCount + 1) * 2;
        const bottomVerts = (segCount + 1) * 2;
        const frontVerts = (segCount + 1) * 2;
        const backVerts = (segCount + 1) * 2;
        const totalVerts = topVerts + bottomVerts + frontVerts + backVerts;

        const positions = new Float32Array(totalVerts * 3);
        const colors = new Float32Array(totalVerts * 3);
        const normalsArr = new Float32Array(totalVerts * 3);

        let vi = 0; // vertex index

        // Helper
        const setVertex = (x, y, z, nx, ny, nz, r, g, b) => {
            const idx = vi * 3;
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;
            normalsArr[idx] = nx;
            normalsArr[idx + 1] = ny;
            normalsArr[idx + 2] = nz;
            colors[idx] = r;
            colors[idx + 1] = g;
            colors[idx + 2] = b;
            vi++;
        };

        // ===== TOP SURFACE =====
        const topStart = 0;
        for (let i = 0; i <= segCount; i++) {
            const x = this.xOffset + i * sw;
            const y = this.heightMap[i];
            const n = this.normals[i];

            // Slope-based coloring: steeper = more shadow
            const slope = Math.abs(n.x);
            const r = MathUtils.lerp(this.snowColor.r, this.shadowColor.r, slope * 0.8);
            const g = MathUtils.lerp(this.snowColor.g, this.shadowColor.g, slope * 0.8);
            const b = MathUtils.lerp(this.snowColor.b, this.shadowColor.b, slope * 0.8);

            // Front edge (z = +halfDepth)
            setVertex(x, y, halfDepth, n.x, n.y, 0, r, g, b);
            // Back edge (z = -halfDepth)
            setVertex(x, y, -halfDepth, n.x, n.y, 0, r, g, b);
        }

        // ===== FRONT FACE =====
        const frontStart = vi;
        for (let i = 0; i <= segCount; i++) {
            const x = this.xOffset + i * sw;
            const y = this.heightMap[i];
            // Top vertex
            setVertex(x, y, halfDepth, 0, 0, 1, this.sideColor.r, this.sideColor.g, this.sideColor.b);
            // Bottom vertex
            setVertex(x, bottomY, halfDepth, 0, 0, 1,
                this.sideColor.r * 0.5, this.sideColor.g * 0.5, this.sideColor.b * 0.5);
        }

        // ===== BACK FACE =====
        const backStart = vi;
        for (let i = 0; i <= segCount; i++) {
            const x = this.xOffset + i * sw;
            const y = this.heightMap[i];
            setVertex(x, y, -halfDepth, 0, 0, -1, this.sideColor.r, this.sideColor.g, this.sideColor.b);
            setVertex(x, bottomY, -halfDepth, 0, 0, -1,
                this.sideColor.r * 0.5, this.sideColor.g * 0.5, this.sideColor.b * 0.5);
        }

        // Build indices
        const indices = [];

        // Top surface quads
        for (let i = 0; i < segCount; i++) {
            const a = topStart + i * 2;
            const b = topStart + i * 2 + 1;
            const c = topStart + (i + 1) * 2;
            const d = topStart + (i + 1) * 2 + 1;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }

        // Front face quads
        for (let i = 0; i < segCount; i++) {
            const a = frontStart + i * 2;
            const b = frontStart + i * 2 + 1;
            const c = frontStart + (i + 1) * 2;
            const d = frontStart + (i + 1) * 2 + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }

        // Back face quads
        for (let i = 0; i < segCount; i++) {
            const a = backStart + i * 2;
            const b = backStart + i * 2 + 1;
            const c = backStart + (i + 1) * 2;
            const d = backStart + (i + 1) * 2 + 1;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }

        // Update geometry
        this.geometry.dispose();
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('normal', new THREE.BufferAttribute(normalsArr, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setIndex(indices);
        this.mesh.geometry = this.geometry;
    }

    /**
     * Lấy chiều cao terrain tại vị trí X trong world space
     * @param {number} worldX - Vị trí X trong world
     * @returns {number|null} Chiều cao Y, hoặc null nếu ngoài phạm vi chunk
     */
    getHeightAt(worldX) {
        const localX = worldX - this.xOffset;
        if (localX < 0 || localX > this.config.chunkWidth) return null;

        const segIndex = localX / this.segmentWidth;
        const i = Math.floor(segIndex);
        const t = segIndex - i;

        if (i >= this.heightMap.length - 1) return this.heightMap[this.heightMap.length - 1];

        return MathUtils.lerp(this.heightMap[i], this.heightMap[i + 1], t);
    }

    /**
     * Lấy surface normal tại vị trí X
     */
    getNormalAt(worldX) {
        const localX = worldX - this.xOffset;
        if (localX < 0 || localX > this.config.chunkWidth) return null;

        const i = Math.min(
            Math.floor(localX / this.segmentWidth),
            this.normals.length - 1
        );
        return this.normals[i];
    }

    /**
     * Lấy slope angle tại vị trí X
     */
    getSlopeAt(worldX) {
        const localX = worldX - this.xOffset;
        if (localX < 0 || localX > this.config.chunkWidth) return 0;

        const i = Math.min(
            Math.floor(localX / this.segmentWidth),
            this.heightMap.length - 2
        );
        return MathUtils.getSlopeAngle(this.heightMap, i, this.segmentWidth);
    }

    /**
     * Lấy chiều cao cuối cùng của chunk (để nối liền chunk tiếp theo)
     */
    getEndHeight() {
        return this.heightMap[this.heightMap.length - 1];
    }

    /**
     * Lấy vị trí X cuối cùng
     */
    getEndX() {
        return this.xOffset + this.config.chunkWidth;
    }

    /**
     * Tái sử dụng chunk — gọi khi chunk cũ được recycle
     */
    reset(xOffset, noiseOffset, noise, startHeight) {
        this.generate(xOffset, noiseOffset, noise, startHeight);
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.mesh);
    }
}
