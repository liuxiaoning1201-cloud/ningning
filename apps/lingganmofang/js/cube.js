// ==================== 3D 魔方引擎（element 綁定面 + 選詞收集） ====================
// 由 apps/shijingmofang 的 Cube3D 改造：每個外面 = 一種記敘文要素，面上 9 格鋪同類詞。
//
// 設計取捨（修正版）：
//   1. 不再做「分層打亂（rotateLayer）」——那會把「每面=一個要素」的乾淨結構打散、
//      令字顛倒、且重新掛載時有浮點漂移造成碎裂。
//   2. 「轉一轉」改為整顆魔方平滑旋轉，露出不同要素面，保持工整可讀。
//   3. 放大魔方與字體、收窄縫隙，讓詞語清楚可見。

// faceIndex -> element（BoxGeometry 面序：0:X+ 1:X- 2:Y+ 3:Y- 4:Z+ 5:Z-）
const FACE_ELEMENT = window.LGMF_DATA.ELEMENT_ORDER; // 依序對應六面

const CUBE_SIZE = 0.96;
const CUBE_GAP = 0.04;
const CUBE_STEP = CUBE_SIZE + CUBE_GAP;

class Cube3D {
    constructor(container, onWordPick) {
        this.container = container;
        this.onWordPick = onWordPick;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.cubeGroup = new THREE.Group();
        this.pieces = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.down = { x: 0, y: 0, t: 0 };
        this.picked = {};
        this.spinning = false;
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        const width = this.container.offsetWidth || 540;
        const height = this.container.offsetHeight || 460;
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.container.appendChild(this.renderer.domElement);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        // 稍微近一點、略帶俯視的等角視角，讓魔方填滿視窗、字大好讀
        this.camera.position.set(3.2, 2.7, 3.9);
        this.camera.lookAt(0, 0, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.92));
        const dir = new THREE.DirectionalLight(0xffffff, 0.35);
        dir.position.set(6, 10, 8);
        this.scene.add(dir);

        this.createCube();
        this.setupControls();

        // 用 pointerdown/up 判斷「點選」與「拖曳旋轉」，避免拖曳時誤選詞
        const el = this.renderer.domElement;
        el.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
        el.addEventListener('pointerup', (e) => {
            const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
            if (moved < 6 && Date.now() - this.down.t < 400) this.onPick(e);
        });
        window.addEventListener('resize', this._onResize = () => this.onResize());
        this.animate();
    }

    onResize() {
        if (!this.container.offsetWidth) return;
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight || 460;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    createCube() {
        for (let x = -1; x <= 1; x++)
            for (let y = -1; y <= 1; y++)
                for (let z = -1; z <= 1; z++) {
                    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
                    const materials = [];
                    for (let i = 0; i < 6; i++) {
                        materials.push(new THREE.MeshPhongMaterial({ map: this.blankTexture(i) }));
                    }
                    const piece = new THREE.Mesh(geometry, materials);
                    piece.position.set(x * CUBE_STEP, y * CUBE_STEP, z * CUBE_STEP);
                    piece.userData = { x, y, z, words: {} };
                    this.pieces.push(piece);
                    this.cubeGroup.add(piece);
                }
        this.scene.add(this.cubeGroup);
    }

    blankTexture(faceIndex) {
        const element = window.LGMF_DATA.ELEMENTS[FACE_ELEMENT[faceIndex]];
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = element ? element.color : '#eee';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(0, 0, 128, 128);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 124, 124);
        return new THREE.CanvasTexture(canvas);
    }

    // 在某格畫詞；stage==='new' 時加金色光框（桃子）
    drawWordOnFace(pieceIndex, faceIndex, item) {
        const piece = this.pieces[pieceIndex];
        const element = window.LGMF_DATA.ELEMENTS[item.element];
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 底色（要素色）
        ctx.fillStyle = element.color;
        ctx.globalAlpha = item.stage === 'new' ? 0.9 : 0.4;
        ctx.fillRect(0, 0, 256, 256);
        ctx.globalAlpha = 1;
        // 白色內襯讓黑字更清楚
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(20, 20, 216, 216);

        // 邊框：桃子金框 or 普通框
        if (item.stage === 'new') {
            ctx.strokeStyle = '#f5b301';
            ctx.lineWidth = 16;
            ctx.strokeRect(8, 8, 240, 240);
            ctx.fillStyle = '#f5b301';
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('✦', 16, 50);
        } else {
            ctx.strokeStyle = element.color;
            ctx.lineWidth = 10;
            ctx.strokeRect(5, 5, 246, 246);
        }

        // 詞（依字數自動縮放 + 換行），讓每格都清楚好讀
        const word = item.word;
        ctx.fillStyle = '#1c2b27';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let lines, fontSize;
        const len = word.length;
        if (len <= 2) { lines = [word]; fontSize = 112; }
        else if (len === 3) { lines = [word]; fontSize = 78; }
        else if (len === 4) { lines = [word.slice(0, 2), word.slice(2)]; fontSize = 86; } // 四字成語：上下兩行「小心／翼翼」
        else { const h = Math.ceil(len / 2); lines = [word.slice(0, h), word.slice(h)]; fontSize = 58; }
        ctx.font = `bold ${fontSize}px "KaiTi","楷体","Noto Serif TC",serif`;
        const lineH = fontSize * 1.05;
        const startY = 128 - (lines.length - 1) * lineH / 2;
        lines.forEach((ln, i) => ctx.fillText(ln, 128, startY + i * lineH));

        const material = piece.material[faceIndex];
        if (material.map) material.map.dispose();
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        material.map = tex;
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

    faceSlotIndex(pos, faceIndex) {
        const { x, y, z } = pos;
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
        this.controls.dampingFactor = 0.08;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 3.6;
        this.controls.maxDistance = 9;
        this.controls.rotateSpeed = 0.9;
        this.controls.target.set(0, 0, 0);
        // 只用左鍵旋轉鏡頭；右鍵不再做分層轉動
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: -1 };
    }

    // 用上/下/左/右把整顆魔方繞「世界軸」平滑旋轉 90°，露出對應的要素面。
    // 採四元數球面插值，確保每次都軸對齊（始終端正、不打散），上下面也能轉到正面。
    spin(direction = 'left', onDone) {
        if (this.spinning) return;
        this.spinning = true;
        const half = Math.PI / 2;
        const map = {
            left:  [new THREE.Vector3(0, 1, 0), -half],
            right: [new THREE.Vector3(0, 1, 0),  half],
            up:    [new THREE.Vector3(1, 0, 0), -half],
            down:  [new THREE.Vector3(1, 0, 0),  half],
        };
        const [axis, angle] = map[direction] || map.left;
        const start = this.cubeGroup.quaternion.clone();
        // 世界軸旋轉：delta 左乘目前姿態
        const end = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(start);
        const proxy = { t: 0 };
        gsap.to(proxy, {
            t: 1, duration: 0.5, ease: 'power2.inOut',
            onUpdate: () => { this.cubeGroup.quaternion.copy(start).slerp(end, proxy.t); },
            onComplete: () => { this.cubeGroup.quaternion.copy(end); this.spinning = false; if (onDone) onDone(); },
        });
    }

    onPick(event) {
        if (this.spinning) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.pieces);
        if (!hits.length) return;
        const piece = hits[0].object;
        const faceIndex = Math.floor(hits[0].faceIndex / 2);
        const item = piece.userData.words[faceIndex];
        if (item && this.onWordPick) {
            this.flashFace(piece, faceIndex);
            this.onWordPick(item);
        }
    }

    // 選中時的小回饋：該格短暫放大
    flashFace(piece, faceIndex) {
        const mat = piece.material[faceIndex];
        if (!mat) return;
        const orig = mat.emissive ? mat.emissive.getHex() : null;
        if (mat.emissive) {
            mat.emissive.setHex(0x666633);
            setTimeout(() => mat.emissive.setHex(orig), 220);
        }
    }

    animate() {
        this._raf = requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        this.pieces.forEach(p => p.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }));
        this.renderer.dispose();
        this.container.innerHTML = '';
    }
}

window.Cube3D = Cube3D;
