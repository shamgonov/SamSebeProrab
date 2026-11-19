/* ==========================================
   js/renderer.js
   Слой графики: сцена, камера, рендерер, свет
   и геометрия комнаты.
   Не содержит игровой логики — только отрисовка.
   ========================================== */

(function () {
    "use strict";

    window.GameRenderer = {
        scene: null,
        camera: null,
        renderer: null,
        clock: null,

        // Массив объектов, на которые может «смотреть» игрок.
        // Raycaster в game.js проверяет пересечения именно с ними.
        interactableObjects: [],

        // Мусор: оборванные куски обоев, падают на пол по своей физике.
        debrisObjects: [],

        // Стены комнаты: нужны, чтобы предметы не проваливались
        // в геометрию и не улетали за пределы помещения.
        wallObjects: [],

        // Меши инструментов, прикреплённых к рукам: { right: mesh, left: mesh }
        heldToolMeshes: { right: null, left: null },

        // Смещения инструментов относительно камеры для каждой руки
        handOffsets: {
            right: new THREE.Vector3(0.4, -0.3, -0.6),
            left: new THREE.Vector3(-0.4, -0.3, -0.6)
        },

        // Луч «поиска опоры» вниз: позволяет предметам лежать не только
        // на полу, но и на кубе, мешке и других объектах сцены
        supportRay: new THREE.Raycaster(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -1, 0),
            0,
            2.0
        ),

        /** Инициализация всей графики. */
        init: function () {
            var data = window.GameData;

            // --- Сцена ---
            this.scene = new THREE.Scene();
            // Светлый фон: в оконном проёме читается как свет с улицы
            this.scene.background = new THREE.Color(0x9fc9e8);

            // --- Камера ---
            this.camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                100
            );
            this.camera.position.set(
                data.player.position.x,
                data.player.position.y,
                data.player.position.z
            );
            // Порядок YXZ обязателен для FPS: иначе при взгляде вверх
            // камера перекашивается по оси Z
            this.camera.rotation.order = 'YXZ';

            // --- Рендерер ---
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            document.body.appendChild(this.renderer.domElement);

            // --- Свет ---
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

            var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(5, 10, 5);
            this.scene.add(dirLight);

            // --- Комната и тестовый объект ---
            this.createRoom();
            this.addTestCube();

            // --- Объекты для механики мусора ---
            this.addTrashInteractables();

            // --- Инструменты, разложенные по полу ---
            this.addLooseTools();

            // --- Хозяйственный инвентарь: умывальник, вёдра, канистры,
            //     рулоны, нож, рулетка ---
            this.addWorkProps();

            // --- Таймер для расчёта delta времени ---
            this.clock = new THREE.Clock();

            // --- Адаптивность ---
            window.addEventListener('resize', function () {
                window.GameRenderer.onWindowResize();
            }, false);
        },

        /**
         * Строит комнату 5×3×4 м из плоскостей.
         * Задняя стена (z = -2) разбита на 4 куска,
         * чтобы оставить оконный проём 1.5×1.4 м
         * с нижним краем на высоте 0.9 м.
         */
        createRoom: function () {
            var W = window.GameData.world.roomWidth;
            var H = window.GameData.world.roomHeight;
            var D = window.GameData.world.roomDepth;

            // Материалы: плоскости с DoubleSide, чтобы стены были
            // видны с обеих сторон (мы стоим внутри комнаты)
            var matFloor = new THREE.MeshLambertMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
            var matWall = new THREE.MeshLambertMaterial({ color: 0x888888, side: THREE.DoubleSide });
            var matCeil = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

            // --- Пол (y = 0) ---
            var floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matFloor);
            floor.rotation.x = -Math.PI / 2;
            this.scene.add(floor);

            // --- Потолок (y = H) ---
            var ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matCeil);
            ceiling.position.y = H;
            ceiling.rotation.x = Math.PI / 2;
            this.scene.add(ceiling);

            // --- Передняя стена (z = +D/2) ---
            var frontWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matWall);
            frontWall.position.set(0, H / 2, D / 2);
            frontWall.rotation.y = Math.PI;
            this.scene.add(frontWall);
            this.wallObjects.push(frontWall);

            // --- Левая стена (x = -W/2): РЕМОНТИРУЕМАЯ ---
            // Базовый бетонный Plane здесь НЕ создаётся: его место
            // занимают полосы старых обоев (см. createWallpaperWall ниже).
            // Стена выбрана именно эта, а не задняя, потому что задняя
            // разбита оконным проёмом и ровной сетки полос по 1 м там не выйдет.
            this.createWallpaperWall(matWall);

            // --- Правая стена (x = +W/2) ---
            var rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), matWall);
            rightWall.position.set(W / 2, H / 2, 0);
            rightWall.rotation.y = -Math.PI / 2;
            this.scene.add(rightWall);
            this.wallObjects.push(rightWall);

            // --- Задняя стена (z = -D/2) с оконным проёмом ---
            var winW = 1.5;      // ширина проёма
            var winH = 1.4;      // высота проёма
            var winBottom = 0.9; // нижний край от пола
            var winTop = winBottom + winH; // 2.3
            var sideW = (W - winW) / 2;    // ширина боковых кусков = 1.75

            // Кусок слева от проёма
            var backLeft = new THREE.Mesh(new THREE.PlaneGeometry(sideW, H), matWall);
            backLeft.position.set(-(winW / 2 + sideW / 2), H / 2, -D / 2);
            this.scene.add(backLeft);
            this.wallObjects.push(backLeft);

            // Кусок справа от проёма
            var backRight = new THREE.Mesh(new THREE.PlaneGeometry(sideW, H), matWall);
            backRight.position.set(winW / 2 + sideW / 2, H / 2, -D / 2);
            this.scene.add(backRight);
            this.wallObjects.push(backRight);

            // Кусок под проёмом (от пола до нижнего края окна)
            var backBottom = new THREE.Mesh(new THREE.PlaneGeometry(winW, winBottom), matWall);
            backBottom.position.set(0, winBottom / 2, -D / 2);
            this.scene.add(backBottom);
            this.wallObjects.push(backBottom);

            // Кусок над проёмом (от верхнего края окна до потолка)
            var overH = H - winTop;
            var backTop = new THREE.Mesh(new THREE.PlaneGeometry(winW, overH), matWall);
            backTop.position.set(0, winTop + overH / 2, -D / 2);
            this.scene.add(backTop);
            this.wallObjects.push(backTop);
        },

        /**
         * Строит ремонтируемую стену (x = -W/2) из вертикальных полос обоев.
         * Полосы — самостоятельные меши, каждая регистрируется в
         * interactableObjects, чтобы Raycaster показывал подсказку.
         * @param {THREE.Material} concreteMat - материал бетона под обоями
         */
        createWallpaperWall: function (concreteMat) {
            var W = window.GameData.world.roomWidth;
            var H = window.GameData.world.roomHeight;
            var D = window.GameData.world.roomDepth;

            var STRIP_W = 1.0; // ширина одной полосы обоев, метры
            var STRIP_COUNT = Math.floor(D / STRIP_W); // по глубине стены = 4
            var wallX = -W / 2; // плоскость стены
            // Отступ по нормали стены (вдоль X), чтобы обои не мерцали с бетоном
            var offsetFromWall = 0.01;

            // Бетонная подложка стены: её не видно сейчас под обоями,
            // но она закрывает проём и понадобится, когда обои ободрём
            var concrete = new THREE.Mesh(new THREE.PlaneGeometry(D, H), concreteMat);
            concrete.position.set(wallX, H / 2, 0);
            concrete.rotation.y = Math.PI / 2;
            this.scene.add(concrete);
            // Левая стена — тоже препятствие для летящих инструментов
            this.wallObjects.push(concrete);

            // Центрируем полосы по стене: от -D/2 до +D/2
            var startX = -D / 2 + STRIP_W / 2;

            for (var i = 0; i < STRIP_COUNT; i++) {
                // Своя текстура для каждой полосы: узор со сдвигом,
                // чтобы полосы не выглядели копипастой
                var texture = this.createWallpaperTexture(i);

                // transparent + alphaTest: материал остаётся в непрозрачном
                // проходе (корректно пишется depth), но пиксели с альфой 0
                // не рисуются — так в обоях видно дырку, а не чёрный квадрат.
                var mat = new THREE.MeshLambertMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.5
                });
                var strip = new THREE.Mesh(new THREE.PlaneGeometry(STRIP_W, H), mat);

                // Plane повёрнут лицом в комнату (к +X)
                strip.position.set(wallX + offsetFromWall, H / 2, startX + i * STRIP_W);
                strip.rotation.y = Math.PI / 2;

                strip.userData = {
                    interactive: true,
                    name: "Старые обои",
                    type: "wallpaper",
                    // === ЗАГОТОВКА под будущий инструмент "губка/распылитель" ===
                    // wet — полоса размочена (скребок по мокрой срывает полотно)
                    // tornPieces — сколько кусков уже отодрано с этой полосы
                    // Логику на эти поля НЕ навешивать до модуля 1.5.
                    wet: false,
                    tornPieces: 0
                    // Действие над обоями выбирает game.js по активному
                    // инструменту: одна и та же цель даёт «оторвать»
                    // скребком или «покрасить» валиком.
                };

                this.scene.add(strip);
                this.interactableObjects.push(strip);
            }
        },

        /**
         * Рисует Canvas-текстуру «старых обоев»: фиолетовый фон
         * и узор из кружочков.
         * @param {number} index - номер полосы, сдвигает узор по вертикали
         * @returns {THREE.CanvasTexture}
         */
        createWallpaperTexture: function (index) {
            var SIZE = 512;

            var canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;

            var ctx = canvas.getContext('2d');

            // Фиолетовый фон
            ctx.fillStyle = '#663399';
            ctx.fillRect(0, 0, SIZE, SIZE);

            // Лёгкая вертикальная полоска по краям — имитация стыка обоев
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, 6, SIZE);
            ctx.fillRect(SIZE - 6, 0, 6, SIZE);

            // Узор: сетка кружочков. Сдвиг по Y зависит от номера полосы,
            // чтобы рисунок не совпадал на соседних полотнах
            var step = 64;
            var shiftY = (index * 22) % step;

            ctx.fillStyle = 'rgba(220, 190, 255, 0.55)';
            for (var y = -step; y < SIZE + step; y += step) {
                for (var x = step / 2; x < SIZE; x += step) {
                    ctx.beginPath();
                    ctx.arc(x, y + shiftY, 9, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Затемнение низа полосы — обои «от времени» потемнели
            var grad = ctx.createLinearGradient(0, SIZE * 0.6, 0, SIZE);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, SIZE, SIZE);

            var texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 4;

            return texture;
        },

        /**
         * Индикатор предметов в руках (правый нижний угол).
         * Принимает текст с \n — CSS превращает его в две строки.
         * @param {string|null} text — текст или null, чтобы скрыть
         */
        showHeldItem: function (text) {
            var el = document.getElementById('held-item');
            if (!el) return;

            if (text) {
                el.textContent = text;
                el.classList.add('visible');
            } else {
                el.textContent = '';
                el.classList.remove('visible');
            }
        },

        /**
         * Поставить мешок на пол перед игроком.
         * Позиция — 1.5 м по направлению взгляда, на уровне пола.
         */
        dropTrashBag: function () {
            var bag = this.trashBag;
            if (!bag) return;

            var cam = this.camera;

            var forward = new THREE.Vector3();
            cam.getWorldDirection(forward);

            bag.position.copy(cam.position).addScaledVector(forward, 1.5);

            // Приземляем на пол: половина высоты цилиндра (0.7 / 2)
            bag.position.y = 0.35;

            // Не выпускаем мешок за пределы комнаты
            var halfW = window.GameData.world.roomWidth / 2 - 0.3;
            var halfD = window.GameData.world.roomDepth / 2 - 0.3;
            bag.position.x = Math.max(-halfW, Math.min(halfW, bag.position.x));
            bag.position.z = Math.max(-halfD, Math.min(halfD, bag.position.z));

            bag.userData.isCarried = false;
            bag.rotation.set(0, 0, 0);

            // Снова становится целью для прицела
            if (this.interactableObjects.indexOf(bag) === -1) {
                this.interactableObjects.push(bag);
            }

            // Сохраняем позицию в данных
            window.GameData.trashBagPosition = {
                x: bag.position.x,
                y: bag.position.y,
                z: bag.position.z
            };

            this.showHeldItem(null);
        },

        /**
         * Объекты механики мусора: мешок для сбора и зона выноса у выхода.
         * Ставятся у передней стены (z = +D/2), где в полной версии
         * будет дверной проём.
         */
        addTrashInteractables: function () {
            var W = window.GameData.world.roomWidth;
            var D = window.GameData.world.roomDepth;

            // === Мешок для мусора: чёрный цилиндр ===
            var bag = new THREE.Mesh(
                new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12),
                new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
            );
            bag.position.set(W / 2 - 0.5, 0.35, D / 2 - 0.4);
            bag.userData = {
                interactive: true,
                name: "Мешок для мусора",
                type: "trashBag",
                isCarried: false,
                // Исходная точка: сюда мешок возвращается после выноса
                homePosition: bag.position.clone()
            };
            this.scene.add(bag);
            this.interactableObjects.push(bag);
            // Ссылка для game.js (следование за камерой, проверка «в руках»)
            this.trashBag = bag;

            // === Зона выноса: полупрозрачный зелёный объём у «двери» ===
            var exitZone = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 1.8, 0.3),
                new THREE.MeshLambertMaterial({
                    color: 0x2ecc71,
                    transparent: true,
                    opacity: 0.35
                })
            );
            exitZone.position.set(W / 2 - 1.6, 0.9, D / 2 - 0.25);
            exitZone.userData = {
                interactive: true,
                name: "Выход (Вынести мусор)",
                type: "exit"
            };
            this.scene.add(exitZone);
            this.interactableObjects.push(exitZone);
            this.exitZone = exitZone;
        },

        /**
         * Вспомогательный метод: создаёт плоский/объёмный предмет-заготовку
         * с единым userData и регистрирует его как цель прицела.
         * Используется для хозяйственного инвентаря (ведро, канистры,
         * рулоны, нож, рулетка), чтобы не дублировать 10 строк на объект.
         * @param {THREE.Object3D} mesh — уже собранная геометрия
         * @param {object} userData — данные предмета
         * @returns {THREE.Object3D}
         */
        addProp: function (mesh, userData) {
            mesh.userData = userData;
            this.scene.add(mesh);
            this.interactableObjects.push(mesh);
            return mesh;
        },

        /**
         * Собирает умывальник, ведро, канистры, рулоны, нож и рулетку.
         * Всё это — будущие механики (вода, грунтовка, клей, раскрой
         * обоев), поэтому часть объектов пока только лежит в мире.
         */
        addWorkProps: function () {
            var W = window.GameData.world.roomWidth;
            var D = window.GameData.world.roomDepth;

            // ==========================================
            // Умывальник у правой стены: чаша + кран
            // ==========================================
            var sink = new THREE.Group();

            var basin = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.25, 0.4),
                new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })
            );
            basin.position.y = 0.125;
            sink.add(basin);

            var tap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
                new THREE.MeshLambertMaterial({ color: 0xb0b0b0 })
            );
            tap.position.set(0, 0.4, -0.15);
            sink.add(tap);

            var spout = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8),
                new THREE.MeshLambertMaterial({ color: 0xb0b0b0 })
            );
            spout.rotation.x = Math.PI / 2;
            spout.position.set(0, 0.53, -0.07);
            sink.add(spout);

            sink.position.set(W / 2 - 0.4, 0, -0.6);

            this.addProp(sink, {
                interactive: true,
                type: 'sink',
                name: 'Умывальник'
            });

            // ==========================================
            // Ведро: 10 литров, наполняется из умывальника
            // ==========================================
            var bucket = new THREE.Mesh(
                new THREE.CylinderGeometry(0.16, 0.13, 0.3, 12),
                new THREE.MeshLambertMaterial({ color: 0x9a9a9a })
            );
            bucket.position.set(W / 2 - 0.9, 0.15, -0.6);

            this.addProp(bucket, {
                interactive: true,
                type: 'bucket',
                toolName: 'bucket',
                name: 'Ведро',
                volume: 10,
                volumeUsed: 0,
                // Чем наполнено: 'water' | 'primer' | 'glue'
                content: null,
                isHeld: false,
                isFlat: false,
                restY: 0.15
            });

            // ==========================================
            // Две канистры грунтовки
            // ==========================================
            this.addCanister(-1.2, 0.2, 'primer_can', 'Грунтовка', 0xffffff, 0x2c5aa0);
            this.addCanister(-1.2, 0.0, 'primer_can', 'Грунтовка', 0xffffff, 0x2c5aa0);

            // ==========================================
            // Две канистры клея
            // ==========================================
            this.addCanister(-0.9, 0.2, 'glue_can', 'Клей', 0xf5d76e, 0xd4a017);
            this.addCanister(-0.9, 0.0, 'glue_can', 'Клей', 0xf5d76e, 0xd4a017);

            // ==========================================
            // Два рулона обоев (лежат горизонтально)
            // ==========================================
            var rollTexture = this.createWallpaperTexture(0);
            this.addWallpaperRoll(-0.5, 0.3, rollTexture);
            this.addWallpaperRoll(-0.5, 0.0, this.createWallpaperTexture(1));

            // ==========================================
            // Канцелярский нож
            // ==========================================
            var knife = new THREE.Group();

            var knifeBody = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.05, 0.03),
                new THREE.MeshLambertMaterial({ color: 0xffc107 })
            );
            knife.add(knifeBody);

            var blade = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.02, 0.01),
                new THREE.MeshLambertMaterial({ color: 0xd0d0d0 })
            );
            blade.position.set(0.1, 0.01, 0);
            knife.add(blade);

            knife.position.set(-0.7, 0.02, 0.6);
            knife.rotation.x = Math.PI / 2;

            this.addProp(knife, {
                interactive: true,
                type: 'knife',
                toolName: 'knife',
                name: 'Нож',
                isHeld: false,
                isFlat: true,
                restY: 0.02,
                velocity: new THREE.Vector3(0, 0, 0)
            });

            // ==========================================
            // Рулетка
            // ==========================================
            var tape = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.05),
                new THREE.MeshLambertMaterial({ color: 0xf1c40f })
            );
            tape.position.set(0.4, 0.02, 0.8);

            this.addProp(tape, {
                interactive: true,
                type: 'tape_measure',
                toolName: 'tape_measure',
                name: 'Рулетка',
                isHeld: false,
                isFlat: true,
                restY: 0.02,
                velocity: new THREE.Vector3(0, 0, 0)
            });
        },

        /**
         * Создаёт отрезанный кусок обоев: полотно 1 × 2.7 м с тем же
         * узором, что на стене. Кладётся на пол рядом с рулоном.
         * TODO: раскрой по реальным размерам стены.
         * @param {number} x — рядом с рулоном
         * @param {number} z
         * @returns {THREE.Object3D}
         */
        createCutWallpaperPiece: function (x, z) {
            var texture = this.createWallpaperTexture(2);

            var piece = new THREE.Mesh(
                new THREE.PlaneGeometry(1.0, 2.7),
                new THREE.MeshLambertMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                })
            );

            piece.position.set(x + 0.9, 0.02, z);
            // Лежит на полу: плоскость поворачиваем горизонтально
            piece.rotation.set(-Math.PI / 2, 0, 0);

            this.addProp(piece, {
                interactive: true,
                type: 'wallpaper_piece',
                name: 'Кусок обоев',
                isHeld: false,
                isFlat: true,
                restY: 0.02,
                // Заготовка: кусок смазан клеем и готов к поклейке
                ready: false
            });

            return piece;
        },

        /**
         * Канистра: корпус + этикетка. Один метод на грунтовку и клей,
         * отличается только цвет.
         * @param {number} x
         * @param {number} z
         * @param {string} type — 'primer_can' | 'glue_can'
         * @param {string} label
         * @param {number} bodyColor
         * @param {number} labelColor
         */
        addCanister: function (x, z, type, label, bodyColor, labelColor) {
            var can = new THREE.Group();

            var body = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.4, 0.3),
                new THREE.MeshLambertMaterial({ color: bodyColor })
            );
            body.position.y = 0.2;
            can.add(body);

            // Этикетка — плоская наклейка на передней грани
            var labelMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(0.2, 0.2),
                new THREE.MeshLambertMaterial({ color: labelColor })
            );
            labelMesh.position.set(0, 0.22, 0.151);
            can.add(labelMesh);

            can.position.set(x, 0.05, z);
            can.rotation.x = Math.PI / 2;

            this.addProp(can, {
                interactive: true,
                type: type,
                toolName: type === 'glue_can' ? 'glue_can' : null,
                name: label,
                volume: 5,
                isHeld: false,
                isFlat: true,
                restY: 0.05,
                velocity: new THREE.Vector3(0, 0, 0)
            });

            return can;
        },

        /**
         * Рулон обоев: цилиндр, лежащий горизонтально.
         * @param {number} x
         * @param {number} z
         * @param {THREE.Texture} texture — узор как у стены
         */
        addWallpaperRoll: function (x, z, texture) {
            var roll = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 0.8, 16),
                new THREE.MeshLambertMaterial({ map: texture })
            );

            roll.position.set(x, 0.15, z);
            // Кладём на бок: ось цилиндра (Y) становится горизонтальной
            roll.rotation.z = Math.PI / 2;

            this.addProp(roll, {
                interactive: true,
                type: 'wallpaper_roll',
                toolName: 'wallpaper_roll',
                name: 'Рулон обоев',
                length: 10,
                width: 1.0,
                isHeld: false,
                isFlat: true,
                restY: 0.15,
                velocity: new THREE.Vector3(0, 0, 0)
            });

            return roll;
        },

        /**
         * Раскладывает инструменты по полу в начале игры.
         * Каждый инструмент — отдельный меш с единым userData:
         * { type:'tool', toolName, isHeld:false, homePosition }.
         * Дальше его можно взять в руку (attachToolToHand)
         * и снова положить на пол (detachToolToGround).
         */
        addLooseTools: function () {
            var W = window.GameData.world.roomWidth;
            var D = window.GameData.world.roomDepth;

            // Скребок и валик — на полу у левой стены (та, что с обоями)
            this.createToolMesh('scraper', 'Скребок', -W / 2 + 0.7, -0.8);
            this.createToolMesh('roller', 'Валик', -W / 2 + 0.7, -0.2);

            // Веник и совок — рядом с мешком у выхода
            this.createToolMesh('broom', 'Веник', W / 2 - 1.1, D / 2 - 0.7);
            this.createToolMesh('dustpan', 'Совок', W / 2 - 1.35, D / 2 - 0.9);
        },

        /**
         * Создаёт меш инструмента нужной формы и кладёт его в мир.
         * @param {string} toolName — ключ инструмента
         * @param {string} label — подпись для подсказки
         * @param {number} x
         * @param {number} y — высота центра меша
         * @param {number} z
         */
        createToolMesh: function (toolName, label, x, z) {
            var mesh;

            // Плоские предметы лежат плашмя (скребок, совок, валик),
            // высокие стоят вертикально (веник).
            // groundY — высота, на которой предмет лежит на полу.
            var isFlat = (toolName === 'scraper' || toolName === 'dustpan' ||
                toolName === 'roller');
            var groundY = isFlat ? 0.05 : 0;

            if (toolName === 'scraper') {
                // Скребок: ручка + плоское лезвие
                mesh = new THREE.Group();

                var sh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8),
                    new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
                );
                sh.position.y = 0.1;
                mesh.add(sh);

                var blade = new THREE.Mesh(
                    new THREE.BoxGeometry(0.12, 0.02, 0.06),
                    new THREE.MeshLambertMaterial({ color: 0xb0b0b0 })
                );
                mesh.add(blade);

            } else if (toolName === 'roller') {
                // Валик: ручка + валик
                mesh = new THREE.Group();

                var rh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8),
                    new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
                );
                rh.position.y = 0.12;
                mesh.add(rh);

                var roll = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12),
                    new THREE.MeshLambertMaterial({ color: 0x3498db })
                );
                roll.rotation.z = Math.PI / 2;
                roll.position.y = 0.24;
                mesh.add(roll);

            } else if (toolName === 'broom') {
                // Веник: черенок + щётка
                mesh = new THREE.Group();

                var bh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8),
                    new THREE.MeshLambertMaterial({ color: 0xc49a6c })
                );
                bh.position.y = 0.25;
                mesh.add(bh);

                var brush = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.06, 0.05),
                    new THREE.MeshLambertMaterial({ color: 0xd4a017 })
                );
                mesh.add(brush);

            } else if (toolName === 'dustpan') {
                // Совок: ручка + лоток
                mesh = new THREE.Group();

                var dh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8),
                    new THREE.MeshLambertMaterial({ color: 0x2f4f4f })
                );
                dh.position.y = 0.14;
                dh.rotation.z = 0.3;
                mesh.add(dh);

                var tray = new THREE.Mesh(
                    new THREE.BoxGeometry(0.22, 0.025, 0.16),
                    new THREE.MeshLambertMaterial({ color: 0x3a5f5f })
                );
                tray.position.y = 0.02;
                mesh.add(tray);

            } else {
                // Неизвестный инструмент — простой брусок
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.12, 0.06, 0.12),
                    new THREE.MeshLambertMaterial({ color: 0x999999 })
                );
            }

            mesh.position.set(x, groundY, z);

            // Плоские предметы кладём плашмя: поворот вокруг X
            // переводит их «вертикальную» геометрию в горизонталь
            if (isFlat) {
                mesh.rotation.x = Math.PI / 2;
            }

            mesh.userData = {
                interactive: true,
                type: 'tool',
                toolName: toolName,
                name: label,
                isHeld: false,
                isFlat: isFlat,
                // Высота покоя: ниже неё предмет не проваливается
                restY: groundY,
                // Скорость для физики подбрасывания/пинка
                velocity: new THREE.Vector3(0, 0, 0),
                homePosition: mesh.position.clone()
            };

            this.scene.add(mesh);
            this.interactableObjects.push(mesh);

            return mesh;
        },

        /**
         * Прикрепляет меш инструмента к руке: убирает из мира
         * и запоминает как this.heldToolMeshes[side].
         * Позицию каждый кадр выставляет updateHeldTools().
         * @param {THREE.Object3D} mesh
         * @param {string} side — 'right' | 'left'
         */
        attachToolToHand: function (mesh, side) {
            if (!mesh) return;

            mesh.userData.isHeld = true;
            this.heldToolMeshes[side] = mesh;

            // Из мира убираем: инструмент теперь в руке
            this.scene.remove(mesh);

            var idx = this.interactableObjects.indexOf(mesh);
            if (idx !== -1) {
                this.interactableObjects.splice(idx, 1);
            }
        },

        /**
         * Кладёт инструмент из руки на пол перед игроком.
         * @param {string} side — 'right' | 'left'
         * @returns {THREE.Object3D|null} меш, если он был в руке
         */
        detachToolToGround: function (side) {
            var mesh = this.heldToolMeshes[side];
            if (!mesh) return null;

            var cam = this.camera;

            var forward = new THREE.Vector3();
            cam.getWorldDirection(forward);

            // 0.8 м вперёд по направлению взгляда
            mesh.position.copy(cam.position).addScaledVector(forward, 0.8);

            // Не выпускаем за пределы комнаты
            var halfW = window.GameData.world.roomWidth / 2 - 0.3;
            var halfD = window.GameData.world.roomDepth / 2 - 0.3;
            mesh.position.x = Math.max(-halfW, Math.min(halfW, mesh.position.x));
            mesh.position.z = Math.max(-halfD, Math.min(halfD, mesh.position.z));

            // Ищем опору под точкой кладки: пол, крышка куба, верх мешка.
            // Луч стартует ВЫШЕ головы (2.2 м) и идёт строго вниз на 2 м:
            // так предмет корректно садится на куб, но не может «найти»
            // опору выше самого себя и не цепляет потолок.
            // restY — толщина самого предмета (у плоских 0.05, у высоких 0)
            var restY = mesh.userData.restY || 0;
            var support = this.findSupport(mesh.position.x, mesh.position.z,
                cam.position.y + 0.5, mesh, 2.0);

            // Страховка: если вдруг нашли что-то выше уровня глаз
            // (потолок, верх стены) — ставим на пол
            if (support.y > 2.5) {
                mesh.position.y = restY;
            } else {
                mesh.position.y = support.y + restY;
            }

            mesh.userData.isHeld = false;

            // Восстанавливаем ориентацию покоя: плоские — плашмя,
            // высокие — вертикально. updateHeldTools() в руке обнуляет
            // повороты, поэтому без этого скребок встал бы «на попа».
            if (mesh.userData.isFlat) {
                mesh.rotation.set(Math.PI / 2, 0, 0);
            } else {
                mesh.rotation.set(0, 0, 0);
            }

            // Гасим скорость, оставшуюся от пинка
            if (mesh.userData.velocity) {
                mesh.userData.velocity.set(0, 0, 0);
            }

            this.scene.add(mesh);

            if (this.interactableObjects.indexOf(mesh) === -1) {
                this.interactableObjects.push(mesh);
            }

            this.heldToolMeshes[side] = null;

            return mesh;
        },

        /**
         * Физика лежащих инструментов: гравитация, полёт после пинка,
         * трение о пол и остановка.
         * @param {number} delta — секунды с прошлого кадра
         */
        applyGravityToTools: function (delta) {
            var cam = this.camera;

            for (var i = 0; i < this.interactableObjects.length; i++) {
                var tool = this.interactableObjects[i];

                if (!tool.userData || tool.userData.type !== 'tool') continue;
                if (tool.userData.isHeld) continue;

                var vel = tool.userData.velocity;
                if (!vel) continue;

                var restY = tool.userData.restY || 0;

                // Гравитация действует, пока предмет выше опоры
                var support = this.findSupport(tool.position.x, tool.position.z,
                    tool.position.y + 0.1, tool);
                if (tool.position.y > support.y + restY) {
                    vel.y -= 9.8 * delta;
                }

                // Трение (воздух + пол): гасим скорость каждый кадр,
                // иначе после мягкого пинка предмет катился через всю комнату
                vel.multiplyScalar(0.95);

                // Пробуем новую позицию, но сначала проверяем, не упирается
                // ли предмет в другой объект (куб, мешок) по горизонтали
                var nextX = tool.position.x + vel.x * delta;
                var nextY = tool.position.y + vel.y * delta;
                var nextZ = tool.position.z + vel.z * delta;

                // Стена на пути? Короткий луч по направлению хода (0.3 м).
                // Без него инструмент проваливался в геометрию стены.
                var hitWall = this.wallAhead(tool, vel, 0.3);

                if (!hitWall && !this.blocksMove(tool, nextX, nextZ)) {
                    tool.position.x = nextX;
                    tool.position.z = nextZ;
                } else {
                    // Упёрся — гасим ход, но не роняем: опора под ним своя
                    vel.x = 0;
                    vel.z = 0;
                }

                tool.position.y = nextY;

                // Опора под новой позицией: пол, крышка куба, верх мешка
                support = this.findSupport(tool.position.x, tool.position.z,
                    tool.position.y + 0.1, tool);

                // Трение: на опоре гасим скорость быстро, в полёте — слабо
                var onGround = tool.position.y <= support.y + restY + 0.001;
                var damping = onGround ? 6.0 : 0.4;
                var k = Math.max(0, 1 - damping * delta);
                vel.x *= k;
                vel.z *= k;

                // Сильное трение на приподнятой опоре (куб, мешок):
                // иначе предмет медленно съезжал с крышки после пинка
                if (onGround && !support.isFloor) {
                    vel.x *= 0.8;
                    vel.z *= 0.8;
                }

                // Вращение в полёте — чтобы пинок читался визуально
                if (!onGround) {
                    tool.rotation.z += 3 * delta;
                }

                // Не проваливаемся ниже уровня покоя на найденной опоре
                if (tool.position.y <= support.y + restY) {
                    tool.position.y = support.y + restY;
                    if (vel.y < 0) vel.y = 0;
                }

                // Не выпускаем за стены комнаты
                var halfW = window.GameData.world.roomWidth / 2 - 0.25;
                var halfD = window.GameData.world.roomDepth / 2 - 0.25;

                if (tool.position.x < -halfW) {
                    tool.position.x = -halfW;
                    vel.x = Math.abs(vel.x) * 0.3;
                }
                if (tool.position.x > halfW) {
                    tool.position.x = halfW;
                    vel.x = -Math.abs(vel.x) * 0.3;
                }
                if (tool.position.z < -halfD) {
                    tool.position.z = -halfD;
                    vel.z = Math.abs(vel.z) * 0.3;
                }
                if (tool.position.z > halfD) {
                    tool.position.z = halfD;
                    vel.z = -Math.abs(vel.z) * 0.3;
                }

                // Совсем остановился — обнуляем, чтобы не считать вечно
                if (onGround && Math.abs(vel.x) < 0.01 && Math.abs(vel.z) < 0.01) {
                    vel.set(0, 0, 0);
                }

                // Жёсткий ограничитель потолка: предмет выше 2.8 м
                // (при комнате 3 м) принудительно возвращается вниз,
                // даже если луч «нашёл» опору выше (потолок, текстура).
                if (tool.position.y > 2.8) {
                    tool.position.y = 2.8;
                    vel.y = -2.0;
                }
            }
        },

        /**
         * Пинает инструмент, если игрок на него наткнулся.
         * @param {THREE.Vector3} playerVelocity — вектор движения игрока
         * @param {THREE.Object3D} tool — меш инструмента
         */
        kickTool: function (playerVelocity, tool) {
            if (!tool || !tool.userData || tool.userData.isHeld) return;

            var vel = tool.userData.velocity;
            if (!vel) return;

            // Не даём «прилипнуть»: пинаем только если предмет
            // ещё не летит от предыдущего пинка
            if (vel.lengthSq() > 1.0) return;

            // Импульс в сторону движения игрока + подброс.
            // Множитель 0.5: игрок идёт ~4 м/с, значит предмет разгоняется
            // до 2 м/с — заметно, но не улетает через всю комнату.
            vel.x = playerVelocity.x * 0.5;
            vel.z = playerVelocity.z * 0.5;
            vel.y = 1.5;

            // Не даём вытолкнуть предмет за пределы комнаты: если импульс
            // ведёт его в стену, гасим эту ось ещё до начала движения
            var data = window.GameData;
            var margin = 0.1;
            var halfW = data.world.roomWidth / 2 - margin;
            var halfD = data.world.roomDepth / 2 - margin;

            if ((tool.position.x <= -halfW && vel.x < 0) ||
                (tool.position.x >= halfW && vel.x > 0)) {
                vel.x = 0;
            }
            if ((tool.position.z <= -halfD && vel.z < 0) ||
                (tool.position.z >= halfD && vel.z > 0)) {
                vel.z = 0;
            }

            // Отрываем от опоры, иначе гравитация сразу погасит подброс.
            // Луч (0.1 м над предметом, вниз 0.5 м) игнорирует сам предмет
            // через isSelfOrChild, поэтому находит реальную опору:
            // пол или крышку куба, на котором предмет уже лежит.
            var support = this.findSupport(tool.position.x, tool.position.z,
                tool.position.y + 0.1, tool);
            tool.position.y = support.y + (tool.userData.restY || 0) + 0.01;
        },

        /**
         * Есть ли стена на пути движения предмета.
         * Пускаем короткий луч по горизонтали в сторону хода.
         * @param {THREE.Object3D} tool — предмет
         * @param {THREE.Vector3} vel — его скорость
         * @param {number} dist — длина луча
         * @returns {boolean} true — впереди стена
         */
        wallAhead: function (tool, vel, dist) {
            if (!this.wallObjects.length) return false;

            var len = Math.hypot(vel.x, vel.z);
            if (len < 0.001) return false;

            var dir = new THREE.Vector3(vel.x / len, 0, vel.z / len);
            var origin = new THREE.Vector3(
                tool.position.x,
                tool.position.y + (tool.userData.restY || 0) * 0.5 + 0.05,
                tool.position.z
            );

            this.supportRay.set(origin, dir);
            this.supportRay.far = dist;

            var hits = this.supportRay.intersectObjects(this.wallObjects, false);
            return hits.length > 0;
        },

        /**
         * Высота опоры под точкой (XZ): пол или верх стоящего объекта
         * (куб, мешок). Луч идёт вниз от startY.
         * @param {number} x
         * @param {number} z
         * @param {number} startY — откуда пускать луч
         * @param {THREE.Object3D} self — предмет, который нужно игнорировать
         * @param {number} [maxDist] — длина луча; по умолчанию 0.5
         * @returns {{y: number, isFloor: boolean}}
         */
        findSupport: function (x, z, startY, self, maxDist) {
            // Даль строго 0.5: ищем опору только сразу под предметом,
            // чтобы луч не пробивал пол и не цеплял дальние объекты.
            // Для кладки предмета передаём 2.0 — там нужно «найти пол»
            // из руки, где предмета ещё нет.
            var dist = maxDist || 0.5;

            this.supportRay.far = dist;
            this.supportRay.set(
                new THREE.Vector3(x, startY, z),
                new THREE.Vector3(0, -1, 0)
            );

            var hits = this.supportRay.intersectObjects(this.scene.children, true);

            for (var i = 0; i < hits.length; i++) {
                var obj = hits[i].object;

                // Пропускаем сам предмет И его дочерние меши.
                // Веник и совок — это Group: луч из точки внутри них
                // почти всегда попадает в их же геометрию. Без этого
                // предмет считал бы свою ручку «опорой» и полз бы вверх.
                if (this.isSelfOrChild(obj, self)) continue;

                var ud = obj.userData;
                if (ud && (ud.isDebris || ud.type === 'exit' || ud.type === 'tool')) continue;

                // Плоские стены, пол и потолок опорой не считаются
                if (this.isPlane(obj)) continue;

                // Потолок и всё, что выше точки старта, — не опора
                if (hits[i].point.y > startY) continue;

                return { y: hits[i].point.y, isFloor: false };
            }

            // Ничего не нашли — это пол (y = 0)
            return { y: 0, isFloor: true };
        },

        /**
         * Объект является самим предметом или его потомком?
         * Нужно потому, что raycaster с recursive=true возвращает
         * дочерний меш, а данные и ссылка лежат на родительской Group.
         * @param {THREE.Object3D} obj — найденный меш
         * @param {THREE.Object3D} self — предмет-владелец
         * @returns {boolean}
         */
        isSelfOrChild: function (obj, self) {
            if (!self) return false;

            var node = obj;
            while (node) {
                if (node === self) return true;
                node = node.parent;
            }

            return false;
        },

        /**
         * Плоскость ли это (PlaneGeometry): стены, пол, обои.
         * @param {THREE.Object3D} obj
         * @returns {boolean}
         */
        isPlane: function (obj) {
            return !!(obj.geometry &&
                obj.geometry.type === 'PlaneGeometry');
        },

        /**
         * Упирается ли предмет в объёмный объект при переходе в (x, z).
         * Проверяем коротким лучом вперёд по направлению хода.
         * @param {THREE.Object3D} tool
         * @param {number} x — следующая позиция по X
         * @param {number} z — следующая позиция по Z
         * @returns {boolean} true — идти нельзя
         */
        blocksMove: function (tool, x, z) {
            var restY = tool.userData.restY || 0;

            // Если предмет выше вершины препятствия — не цепляем его
            var supportHere = this.findSupport(tool.position.x, tool.position.z,
                tool.position.y + 0.1, tool);
            var supportNext = this.findSupport(x, z, tool.position.y + 0.1, tool);

            // Спуск с опоры разрешаем: иначе предмет «завис» бы на кубе
            if (supportHere.isFloor === false && supportNext.isFloor) return false;

            // Подъём на куб допустим, если он не выше середины предмета
            var step = supportNext.y - supportHere.y;
            if (step > 0.25) return true;

            // Не даём врезаться в бок высокого объекта
            var midY = tool.position.y + restY + 0.05;
            if (!supportNext.isFloor && supportNext.y > midY) return true;

            return false;
        },

        /**
         * Мешок визуально раздувается по мере заполнения:
         * на 5/5 он на 30% выше, чем пустой. Масштабируем только Y,
         * чтобы пятно мешка на полу не менялось.
         */
        updateBagVisual: function () {
            var bag = this.trashBag;
            if (!bag) return;

            var data = window.GameData;
            var fill = data.maxTrash > 0 ? data.trashCount / data.maxTrash : 0;

            // Ограничиваем сверху: защита от рассинхрона данных
            if (fill > 1) fill = 1;
            if (fill < 0) fill = 0;

            bag.scale.y = 1.0 + fill * 0.3;

            // Геометрия цилиндра центрирована по Y (высота 0.7 → низ на -0.35).
            // При масштабировании низ ушёл бы под пол, поэтому поднимаем
            // мешок на половину новой высоты. В руках позицию каждый кадр
            // задаёт updateCarriedBag() — там компенсация не нужна.
            if (!bag.userData.isCarried) {
                bag.position.y = 0.35 * bag.scale.y;
            }
        },

        /**
         * Каждый кадр ставит инструменты в руках перед камерой.
         */
        updateHeldTools: function () {
            var cam = this.camera;

            for (var side in this.heldToolMeshes) {
                if (!this.heldToolMeshes.hasOwnProperty(side)) continue;

                var mesh = this.heldToolMeshes[side];
                if (!mesh) continue;

                var offset = this.handOffsets[side];

                // Смещение в локальных осях камеры → мировые координаты
                var world = offset.clone();
                world.applyQuaternion(cam.quaternion);

                mesh.position.copy(cam.position).add(world);
                mesh.rotation.set(0, cam.rotation.y, 0);
            }
        },

        /**
         * Отрывает кусок обоев: прожигает дыру в canvas-текстуре полосы
         * и рождает падающий обрывок.
         * @param {THREE.Mesh} strip - полоса обоев
         * @param {THREE.Vector3} hitPoint - точка попадания в мировых координатах
         * @param {THREE.Vector2} uv - UV-координаты точки попадания
         */
        tearWallpaper: function (strip, hitPoint, uv) {
            var map = strip.material.map;
            if (!map || !map.image) return;

            var canvas = map.image;
            var ctx = canvas.getContext('2d');
            var SIZE = canvas.width;

            // UV → пиксели canvas. Ось Y инвертирована: в UV 0 — снизу,
            // а в canvas 0 — сверху.
            var px = uv.x * SIZE;
            var py = (1 - uv.y) * SIZE;

            // destination-out «стирает» пиксели с альфой, оставляя дыру
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(px, py, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // Говорим Three.js, что текстуру нужно перезагрузить на GPU
            map.needsUpdate = true;

            // === Обрывок обоев ===
            // Делаем КОПИЮ canvas на момент отрыва, иначе последующие дыры
            // на стене проступали бы и на лежащем на полу мусоре.
            var pieceCanvas = document.createElement('canvas');
            pieceCanvas.width = SIZE;
            pieceCanvas.height = SIZE;
            pieceCanvas.getContext('2d').drawImage(canvas, 0, 0);
            var pieceTexture = new THREE.CanvasTexture(pieceCanvas);

            var piece = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 0.4),
                new THREE.MeshLambertMaterial({
                    map: pieceTexture,
                    side: THREE.DoubleSide,
                    transparent: true,
                    alphaTest: 0.5
                })
            );

            // Стартуем чуть в стороне от стены (нормаль стены — +X),
            // иначе обрывок будет мерцать с обоями (z-fighting)
            piece.position.copy(hitPoint);
            piece.position.x += 0.03;
            piece.rotation.set(0, Math.PI / 2, 0);

            // Физика полёта: тянем обрывок в комнату и вниз
            piece.userData = {
                isDebris: true,
                velocity: new THREE.Vector3(
                    1.0 + Math.random() * 0.8, // от стены, в комнату
                    0.5 + Math.random() * 0.7, // лёгкий подскок
                    (Math.random() - 0.5) * 1.2
                ),
                rotSpeed: (Math.random() - 0.5) * 4
            };

            this.scene.add(piece);
            this.debrisObjects.push(piece);
            // В цели прицела обрывок добавляем НЕ здесь, а в updateDebris()
            // при приземлении. Иначе летящий кусок появляется ровно в точке
            // попадания луча (у стены, перед самым прицелом) и перекрывает
            // обои: подсказка «E - Оторвать» в тот же кадр сменяется на
            // «Мешок полон» — отсюда и моргание при каждом отрыве.

            window.GameData.addHistory("Оторван кусок обоев");
        },

        /**
         * Простейшая физика мусора: гравитация и падение на пол.
         * Упавшие куски остаются в сцене (их потом надо собирать),
         * но убираются из списка, чтобы не считать их каждый кадр.
         * @param {number} delta - секунды с прошлого кадра
         */
        updateDebris: function (delta) {
            for (var i = this.debrisObjects.length - 1; i >= 0; i--) {
                var piece = this.debrisObjects[i];
                var vel = piece.userData.velocity;

                // Гравитация
                vel.y -= 9.8 * delta;

                piece.position.x += vel.x * delta;
                piece.position.y += vel.y * delta;
                piece.position.z += vel.z * delta;

                // Кувыркаемся в полёте вокруг вертикальной оси стены
                piece.rotation.y += piece.userData.rotSpeed * delta;

                // Пол: y = 0. Кладём кусок плашмя с микрозазором,
                // чтобы не было z-fighting с геометрией пола
                if (piece.position.y <= 0.02) {
                    piece.position.y = 0.02;
                    piece.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
                    piece.userData.velocity.set(0, 0, 0);
                    piece.userData.rotSpeed = 0;
                    // Упал — больше не физика, но теперь доступен для прицела:
                    // обрывок лежит на полу и должен собираться руками/совком.
                    // Регистрируем его как цель raycaster'а.
                    if (this.interactableObjects.indexOf(piece) === -1) {
                        this.interactableObjects.push(piece);
                    }
                    this.debrisObjects.splice(i, 1);
                }
            }
        },

        /**
         * Рисует синий круг на обоях (имитация покраски валиком).
         * Круг рисуется в UV-координатах попадания.
         * @param {THREE.Mesh} strip - полоса обоев
         * @param {THREE.Vector3} hitPoint - точка попадания в мировых координатах
         * @param {THREE.Vector2} uv - UV-координаты точки попадания
         */
        /**
         * Грунтовка бетона: светло-серое пятно поверх снятых обоев.
         * @param {THREE.Mesh} strip
         * @param {THREE.Vector3} hitPoint
         * @param {THREE.Vector2} uv
         */
        primerWall: function (strip, hitPoint, uv) {
            this.paintArea(strip, uv, '#cccccc', 46, 'Загрунтован участок стены');
        },

        /**
         * Клей по полотну: готовит участок к поклейке.
         * @param {THREE.Mesh} strip
         * @param {THREE.Vector3} hitPoint
         * @param {THREE.Vector2} uv
         */
        glueWall: function (strip, hitPoint, uv) {
            this.paintArea(strip, uv, 'rgba(255, 235, 150, 0.55)', 40, 'Нанесён клей на полотно');
            strip.userData.glued = true;
        },

        /**
         * Общая заливка участка текстуры круглым пятном.
         * @param {THREE.Mesh} strip
         * @param {THREE.Vector2} uv
         * @param {string} color — CSS-цвет
         * @param {number} radius — радиус в пикселях canvas
         * @param {string} logText — запись в историю
         */
        paintArea: function (strip, uv, color, radius, logText) {
            var map = strip.material.map;
            if (!map || !map.image) return;

            var canvas = map.image;
            var ctx = canvas.getContext('2d');
            var SIZE = canvas.width;

            // UV → пиксели canvas (ось Y инвертирована)
            var px = uv.x * SIZE;
            var py = (1 - uv.y) * SIZE;

            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();

            map.needsUpdate = true;

            window.GameData.addHistory(logText);
        },

        /**
         * Покраска валиком (базовый синий цвет).
         * @param {THREE.Mesh} strip
         * @param {THREE.Vector3} hitPoint
         * @param {THREE.Vector2} uv
         */
        paintWall: function (strip, hitPoint, uv) {
            this.paintArea(strip, uv, '#3498db', 40, 'Покрашен участок обоев');
        },

        /**
         * Тестовый интерактивный куб.
         * Доказательство работоспособности системы взаимодействия:
         * при наведении появляется подсказка, по 'E' куб меняет цвет.
         */
        addTestCube: function () {
            var geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            var material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
            var cube = new THREE.Mesh(geometry, material);

            // Ставим на пол по центру комнаты
            cube.position.set(0, 0.25, 0);

            // interact получает сам меш аргументом (mesh).
            // Так объект взаимодействия не зависит от того,
            // в каком контексте его вызовут.
            cube.userData = {
                interactive: true,
                name: "Осмотреть",
                interact: function (mesh) {
                    mesh.material.color.setHex(Math.floor(Math.random() * 0xffffff));
                    window.GameData.addHistory("Осмотр куба: цвет изменён");
                }
            };

            this.scene.add(cube);
            this.interactableObjects.push(cube);
        },

        /**
      * Переносимые материалы (рулоны, канистры) следуют за камерой,
      * когда игрок держит их в руках.
      */
     updateCarriedMaterials: function () {
         var data = window.GameData;
         var cam = this.camera;
         
         // Проверяем правую и левую руку
         ['right', 'left'].forEach(function (side) {
             var handItem = data[side + 'Hand'];
             if (!handItem) return;
             
             // Ищем объект в сцене
             for (var i = 0; i < this.interactableObjects.length; i++) {
                 var obj = this.interactableObjects[i];
                 if (obj.userData && obj.userData.type === handItem && obj.userData.isCarried) {
                     // Позиция перед камерой
                     var forward = new THREE.Vector3();
                     cam.getWorldDirection(forward);
                     var right = new THREE.Vector3();
                     right.crossVectors(forward, cam.up).normalize();
                     
                     var offset = side === 'right' ? 0.35 : -0.35;
                     obj.position.copy(cam.position)
                         .addScaledVector(forward, 0.75)
                         .addScaledVector(right, offset);
                     obj.position.y -= 0.4;
                     
                     // Медленное вращение для читаемости
                     obj.rotation.y += 0.01;
                 }
             }
         }.bind(this));
     },
     /** Кадр отрисовки. */
        render: function () {
            this.renderer.render(this.scene, this.camera);
        },

        /** Пересчёт камеры и canvas при изменении размера окна. */
        onWindowResize: function () {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    };

    // Запуск графики. GameData к этому моменту уже определён,
    // потому что data.js подключён в index.html раньше renderer.js.
    window.GameRenderer.init();

})();
