// ==================== 3D 魔方引擎（element 綁定面 + 選詞收集） ====================
// 由 apps/shijingmofang 的 Cube3D 改造：每個外面 = 一種記敘文要素，面上 9 格鋪同類詞。

// faceIndex -> element（BoxGeometry 面序：0:X+ 1:X- 2:Y+ 3:Y- 4:Z+ 5:Z-）
const FACE_ELEMENT = window.LGMF_DATA.ELEMENT_ORDER; // 依序對應六面

class Cube3D {
    constructor(container, onWordPick) {
        this.container = container;
        this.onWordPick = onWordPick;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.cubeGroup = new THREE.Group();
        this.pieces = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.picked = {}; // element -> {wordId, word, element, stage}
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight || 480;
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(5, 5, 6);
        this.camera.lookAt(0, 0, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dir = new THREE.DirectionalLight(0xffffff, 0.4);
        dir.position.set(8, 12, 6);
        this.scene.add(dir);

        this.createCube();
        this.setupControls();

        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onMouseClick(e);
        });
        window.addEventListener('resize', () => this.onResize());
        this.animate();
    }

    onResize() {
        if (!this.container.offsetWidth) return;
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight || 480;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    createCube() {
        const size = 0.92, gap = 0.06;
        for (let x = -1; x <= 1; x++)
            for (let y = -1; y <= 1; y++)
                for (let z = -1; z <= 1; z++) {
                    const geometry = new THREE.BoxGeometry(size, size, size);
                    const materials = [];
                    for (let i = 0; i < 6; i++) {
                        materials.push(new THREE.MeshPhongMaterial({ map: this.blankTexture(i) }));
                    }
                    const piece = new THREE.Mesh(geometry, materials);
                    piece.position.set(x * (size + gap), y * (size + gap), z * (size + gap));
                    piece.userData = { x, y, z, words: {} };
                    this.pieces.push(piece);
                    this.cubeGroup.add(piece);
                }
        this.scene.add(this.cubeGroup);
    }

    blankTexture(faceIndex) {
        const element = window.LGMF_DATA.ELEMENTS[FACE_ELEMENT[faceIndex]];
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = element ? element.color : '#eee';
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, 0, 256, 256);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 250, 250);
        return new THREE.CanvasTexture(canvas);
    }

    // 在某格畫詞；isStretch=true 時加金色光框（桃子）
    drawWordOnFace(pieceIndex, faceIndex, item) {
        const piece = this.pieces[pieceIndex];
        const element = window.LGMF_DATA.ELEMENTS[item.element];
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 底色（要素色，淺）
        ctx.fillStyle = element.color;
        ctx.globalAlpha = item.stage === 'new' ? 0.95 : 0.55;
        ctx.fillRect(0, 0, 256, 256);
        ctx.globalAlpha = 1;

        // 桃子金框
        if (item.stage === 'new') {
            ctx.strokeStyle = '#f5b301';
            ctx.lineWidth = 14;
            ctx.strokeRect(7, 7, 242, 242);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('✨', 14, 48);
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 5;
            ctx.strokeRect(4, 4, 248, 248);
        }

        // 詞（自動縮放 + 換行）
        const word = item.word;
        ctx.fillStyle = '#1c2b27';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lines = word.length > 4 ? [word.slice(0, Math.ceil(word.length / 2)), word.slice(Math.ceil(word.length / 2))] : [word];
        let fontSize = word.length <= 2 ? 96 : (word.length <= 4 ? 70 : 56);
        ctx.font = `bold ${fontSize}px "KaiTi","楷体",serif`;
        const lineH = fontSize * 1.05;
        const startY = 128 - (lines.length - 1) * lineH / 2;
        lines.forEach((ln, i) => ctx.fillText(ln, 128, startY + i * lineH));

        const material = piece.material[faceIndex];
        material.map = new THREE.CanvasTexture(canvas);
        material.needsUpdate = true;
        piece.userData.words[faceIndex] = item;
    }

    // 用每個要素的詞牌鋪滿對應面
    fillFacesByElement(decksByElement) {
        this.picked = {};
        this.pieces.forEach((piece, pieceIndex) => {
            const faces = this.getVisibleFaces(piece.userData);
            faces.forEach(faceIndex => {
                const element = FACE_ELEMENT[faceIndex];
                const deck = decksByElement[element] || [];
                if (!piece.userData._slotIndex) piece.userData._slotIndex = {};
                // 依該面在 3x3 的位置取一個 index
                const idx = this.faceSlotIndex(piece.userData, faceIndex);
                const item = deck[idx % deck.length];
                if (item) {
                    this.drawWordOnFace(pieceIndex, faceIndex, {
                        wordId: item.word.id, word: item.word.word,
                        element: item.word.element, stage: item.stage,
                        difficulty: item.word.difficulty, example: item.word.example,
                        pinyin: item.word.pinyin,
                    });
                }
            });
        });
    }

    // 給定 piece 與面，回傳 0-8 的格位序號
    faceSlotIndex(pos, faceIndex) {
        const { x, y, z } = pos;
        // 用另外兩軸組合出 0-8
        let a, b;
        if (faceIndex === 0 || faceIndex === 1) { a = y; b = z; }
        else if (faceIndex === 2 || faceIndex === 3) { a = x; b = z; }
        else { a = x; b = y; }
        return (a + 1) * 3 + (b + 1);
    }

    getVisibleFaces(pos) {
        const { x, y, z } = pos;
        const faces = [];
        if (x === 1) faces.push(0);
        if (x === -1) faces.push(1);
        if (y === 1) faces.push(2);
        if (y === -1) faces.push(3);
        if (z === 1) faces.push(4);
        if (z === -1) faces.push(5);
        return faces;
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.enableZoom = true;
        this.controls.minDistance = 4;
        this.controls.maxDistance = 12;
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: -1 };
    }

    rotateLayer(axis, layer, direction) {
        const pieces = this.pieces.filter(p => Math.round(p.userData[axis]) === layer);
        if (!pieces.length) return;
        const angle = direction * Math.PI / 2;
        const tempGroup = new THREE.Group();
        this.scene.add(tempGroup);
        pieces.forEach(piece => {
            const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
            piece.getWorldPosition(wp); piece.getWorldQuaternion(wq);
            this.cubeGroup.remove(piece);
            piece.position.copy(wp); piece.quaternion.copy(wq);
            tempGroup.add(piece);
        });
        gsap.to(tempGroup.rotation, {
            [axis]: angle, duration: 0.3, ease: 'power2.out',
            onComplete: () => {
                pieces.forEach(piece => {
                    piece.updateMatrixWorld();
                    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
                    piece.getWorldPosition(wp); piece.getWorldQuaternion(wq);
                    tempGroup.remove(piece);
                    this.cubeGroup.add(piece);
                    piece.position.copy(wp); piece.quaternion.copy(wq);
                    const s = 0.92 + 0.06;
                    piece.userData.x = Math.round(piece.position.x / s);
                    piece.userData.y = Math.round(piece.position.y / s);
                    piece.userData.z = Math.round(piece.position.z / s);
                });
                this.scene.remove(tempGroup);
            }
        });
    }

    // 隨機打亂（靈感魔方的「轉一轉」）
    shuffle(times = 12, onDone) {
        const axes = ['x', 'y', 'z'];
        let count = 0;
        const step = () => {
            if (count >= times) { if (onDone) setTimeout(onDone, 350); return; }
            const axis = axes[Math.floor(Math.random() * 3)];
            const layer = [-1, 0, 1][Math.floor(Math.random() * 3)];
            const dir = Math.random() > 0.5 ? 1 : -1;
            this.rotateLayer(axis, layer, dir);
            count++;
            setTimeout(step, 120);
        };
        step();
    }

    onMouseClick(event) {
        const isRotate = event.button === 2 || event.shiftKey;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.pieces);
        if (!hits.length) return;
        const piece = hits[0].object;
        const faceIndex = Math.floor(hits[0].faceIndex / 2);
        if (isRotate) {
            const axisMap = ['x', 'x', 'y', 'y', 'z', 'z'];
            const axis = axisMap[faceIndex];
            this.rotateLayer(axis, piece.userData[axis], 1);
        } else {
            const item = piece.userData.words[faceIndex];
            if (item && this.onWordPick) this.onWordPick(item);
        }
    }

    animate() {
        this._raf = requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this.renderer.dispose();
        this.container.innerHTML = '';
    }
}

window.Cube3D = Cube3D;
