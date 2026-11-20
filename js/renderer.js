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
            this.furnitureColliders.push({ x: window.GameData.world.roomWidth / 2 - 0.4, z: -0.6, r: 0.4 });
            // Динамические препятствия: куб и мешок. Координаты каждый кадр
            // подставляет updateDynamicColliders, r=0 = «коллайдер выключен»
            this.furnitureColliders.push({ x: 0, z: 0, r: 0, dyn: 'testCube' });
            this.furnitureColliders.push({ x: 0, z: 0, r: 0, dyn: 'trashBag' });

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
                restY: 0.35,
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
            this.addTray(-0.9, -0.35);
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
        createCutWallpaperPiece: function (x, z, len) {
            var texture = this.createWallpaperTexture(2);

            var piece = new THREE.Mesh(
                new THREE.PlaneGeometry(1.0, len || 2.7),
                new THREE.MeshLambertMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                })
            );

            piece.position.set(x + 0.9, 0.02, z);
            // Лежит на полу: плоскость поворачиваем горизонтально
            piece.rotation.set(-Math.PI / 2, 0, 0);

            var backMat = new THREE.MeshLambertMaterial({ color: 0xbfb5a3, side: THREE.DoubleSide });
            this.addProp(piece, {
                interactive: true,
                type: 'wallpaper_piece',
                name: 'Кусок обоев',
                isHeld: false,
                isFlat: true,
                restY: 0.02,
                // Заготовка: кусок смазан клеем и готов к поклейке
                ready: false,
                flipped: false,
                faceMat: piece.material,
                backMat: backMat,
                velocity: new THREE.Vector3(0, 0, 0)
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
        addTray: function (x, z) {
            var tray = new THREE.Group();
            var trayColor = 0x2b6cb0;
            var base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.35), new THREE.MeshLambertMaterial({ color: trayColor }));
            base.position.y = 0.025; tray.add(base);
            var w1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.03), new THREE.MeshLambertMaterial({ color: trayColor }));
            w1.position.set(0, 0.075, 0.16); tray.add(w1);
            var w2 = w1.clone(); w2.position.z = -0.16; tray.add(w2);
            var w3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.29), new THREE.MeshLambertMaterial({ color: trayColor }));
            w3.position.set(0.235, 0.075, 0); tray.add(w3);
            var w4 = w3.clone(); w4.position.x = -0.235; tray.add(w4);
            var liquid = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.29), new THREE.MeshLambertMaterial({ color: 0xf5d76e, transparent: true, opacity: 0 }));
            liquid.rotation.x = -Math.PI / 2; liquid.position.y = 0.056; tray.add(liquid);
            tray.position.set(x, 0, z);
            this.addProp(tray, {
                interactive: true,
                type: 'tray',
                name: 'Ванночка',
                fill: 0,
                liquidType: null,
                liquidName: null,
                capacity: 2,
                isHeld: false,
                isCarried: false,
                isFlat: true,
                restY: 0,
                velocity: new THREE.Vector3(0, 0, 0)
            });
            tray.userData._liquidMesh = liquid;
            return tray;
        },

        updateTrayVisual: function (tray) {
            if (!tray || !tray.userData) return;
            var ud = tray.userData;
            var liq = ud._liquidMesh;
            if (!liq) return;
            if (!(ud.fill > 0)) { liq.material.opacity = 0; return; }
            var colors = { glue: 0xf5d76e, primer: 0x9fc9e8 };
            liq.material.color.setHex(colors[ud.liquidType] || 0xcccccc);
            liq.material.opacity = Math.min(0.85, 0.25 + 0.3 * (ud.fill / (ud.capacity || 2)));
        },

        spillCanister: function (can, ud) {
            var type = ud.type === 'primer_can' ? 'primer' : 'glue';
            ud.volume = 0;
            if (type === 'glue') window.GameData.glueLiters = 0; else window.GameData.primerLiters = 0;
            var colors = { glue: 0xd4a017, primer: 0x9fc9e8 };
            var decal = new THREE.Mesh(
                new THREE.CircleGeometry(0.35 + Math.random() * 0.15, 20),
                new THREE.MeshLambertMaterial({ color: colors[type] || 0xcccccc, transparent: true, opacity: 0.7 })
            );
            decal.rotation.x = -Math.PI / 2;
            decal.position.set(can.position.x, 0.012, can.position.z);
            this.scene.add(decal);
            if (this.spillDecals === undefined) this.spillDecals = [];
            this.spillDecals.push(decal);
            this.interactableObjects.push(decal);
            decal.userData = { type: 'spill', spillLiquid: type, spillName: type === 'glue' ? 'клей' : 'грунтовка', dried: false };
        },

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

            can.position.set(x, 0.15, z);
            can.rotation.x = Math.PI / 2;

            this.addProp(can, {
                interactive: true,
                type: type,
             toolName: type === 'glue_can' ? 'glue_can' : null,
             name: label,
             volume: 5,
             isHeld: false,
             isCarried: false,
             isFlat: true,
             restY: 0.15,
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
             isCarried: false,
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
            this.createToolMesh('rag', 'Тряпка', -W / 2 + 0.7, 0.4);

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
                toolName === 'roller' || toolName === 'rag');
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

            } else if (toolName === 'rag') {
                // Тряпка: смятая ткань
                mesh = new THREE.Group();
                var rc1 = new THREE.Mesh(
                    new THREE.BoxGeometry(0.16, 0.04, 0.12),
                    new THREE.MeshLambertMaterial({ color: 0xd8d4c8 })
                );
                mesh.add(rc1);
                var rc2 = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.035, 0.1),
                    new THREE.MeshLambertMaterial({ color: 0xcfcabc })
                );
                rc2.position.set(0.05, 0.025, 0.03); rc2.rotation.y = 0.5;
                mesh.add(rc2);
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

                if (!tool.userData || !this.isPhysicalType(tool.userData.type)) continue;
                if (tool.userData.isHeld || tool.userData.isCarried) continue;
                if (tool.userData.type === 'wallpaper_roll' || tool.userData.type === 'wallpaper_piece') {
                    this.updatePlankPhysics(tool, delta);
                    continue;
                }

                var vel = tool.userData.velocity;
                if (!vel) vel = tool.userData.velocity = new THREE.Vector3(0, 0, 0);

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
                if (!onGround && tool.userData.type === 'tool') {
                    tool.rotation.z += 3 * delta;
                }

                // Не проваливаемся ниже уровня покоя на найденной опоре
                if (tool.position.y <= support.y + restY) {
                    tool.position.y = support.y + restY;
                    if (vel.y < 0) vel.y = 0;
                }

                // Не выпускаем за стены комнаты
                var mWall = Math.max(0.25, this.getGeom(tool.userData.type).radius + 0.05);
                var halfW = window.GameData.world.roomWidth / 2 - mWall;
                var halfD = window.GameData.world.roomDepth / 2 - mWall;

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
        updateUprightRoll: function (tool, delta) {
                    var p = tool.position;
                    var ud = tool.userData;
        
                    // Опрокидывание уже идёт: анимируем наклон и смещение центра
                    if (ud.topple) {
                        var tp = ud.topple;
                        tp.t += delta * 2.2;
                        var k = Math.min(1, tp.t);
                        var cur = k * Math.PI / 2;
                        var s = Math.sin(cur);
                        tool.quaternion.setFromAxisAngle(new THREE.Vector3(tp.dir.z, 0, -tp.dir.x), cur);
                        p.x = tp.ox + tp.dir.x * 0.3 * s;
                        p.z = tp.oz + tp.dir.z * 0.3 * s;
                        p.y = tp.oy + 0.4 - 0.25 * s;
                        if (k >= 1) {
                            ud.upright = false;
                            ud.tilt = 0;
                            delete ud.topple;
                            p.y = ud.restY || 0.15;
                            if (!ud.velocity) ud.velocity = new THREE.Vector3();
                            ud.velocity.set(tp.dir.x * 0.4, 0, tp.dir.z * 0.4);
                        }
                        return;
                    }
        
                    // Опора под торцом есть — стоим ровно
                    var sup = this.findSupport(p.x, p.z, p.y + 0.2, tool).y;
                    if (sup < p.y - 0.48) {
                        var dir = new THREE.Vector3(1, 0, 0);
                        if (ud.velocity && (Math.abs(ud.velocity.x) + Math.abs(ud.velocity.z)) > 0.05) {
                            dir.set(ud.velocity.x, 0, ud.velocity.z).normalize();
                        }
                        ud.topple = { t: 0, dir: dir, ox: p.x, oy: sup, oz: p.z };
                        return;
                    }
        
                    tool.rotation.set(0, ud.yaw || 0, 0);
                },
        updateFlatPiecePhysics: function (tool, delta) {
            // Кусок обоев лежит плашмя: ориентацию не трогаем,
            // только гравитация, трение и посадка на опору
            var vel = tool.userData.velocity;
            if (!vel) vel = tool.userData.velocity = new THREE.Vector3(0, 0, 0);
            var restY = tool.userData.restY || 0;
            var sup = this.findSupport(tool.position.x, tool.position.z, tool.position.y + 0.1, tool);
            if (tool.position.y > sup.y + restY + 0.001) vel.y -= 9.8 * delta;
            var damp = Math.max(0, 1 - 5 * delta);
            vel.x *= damp;
            vel.z *= damp;
            var nx = tool.position.x + vel.x * delta, nz = tool.position.z + vel.z * delta;
            if (!this.wallAhead(tool, vel, 0.3) && !this.blocksMove(tool, nx, nz)) {
                tool.position.x = nx;
                tool.position.z = nz;
            } else {
                vel.x = 0;
                vel.z = 0;
            }
            sup = this.findSupport(tool.position.x, tool.position.z, tool.position.y + 0.1, tool);
            tool.position.y += vel.y * delta;
            if (tool.position.y <= sup.y + restY) {
                tool.position.y = sup.y + restY;
                if (vel.y < 0) vel.y = 0;
            }
        },

                updatePlankPhysics: function (tool, delta) {
            if (tool.userData.type === "wallpaper_piece") { this.updateFlatPiecePhysics(tool, delta); return; }
            if (tool.userData.upright) { this.updateUprightRoll(tool, delta); return; }
                    var vel = tool.userData.velocity;
                    if (!vel) vel = tool.userData.velocity = new THREE.Vector3(0, 0, 0);
                    var restY = tool.userData.restY || 0;
                    var L = tool.userData.type === 'wallpaper_roll' ? 0.8 :
                        ((tool.geometry && tool.geometry.parameters && tool.geometry.parameters.height) || 2.7);
                    var halfL = L / 2;
                    var p = tool.position;
        
                    var axis3 = new THREE.Vector3(0, 1, 0).applyQuaternion(tool.quaternion);
                    var dir = new THREE.Vector3(axis3.x, 0, axis3.z);
                    if (dir.lengthSq() < 0.04) dir.set(1, 0, 0);
                    dir.normalize();
        
                    var e1x = p.x + dir.x * halfL, e1z = p.z + dir.z * halfL, e1y = p.y + axis3.y * halfL;
                    var e2x = p.x - dir.x * halfL, e2z = p.z - dir.z * halfL, e2y = p.y - axis3.y * halfL;
        
                    var h1 = this.findSupport(e1x, e1z, e1y + 0.3, tool).y;
                    var h2 = this.findSupport(e2x, e2z, e2y + 0.3, tool).y;
                    var hc = this.findSupport(p.x, p.z, p.y + 0.3, tool).y;
        
                    var air1 = (e1y - restY) - h1 > 0.15;
                    var air2 = (e2y - restY) - h2 > 0.15;
        
                    var yT, tiltT = 0, slide = 0;
        
                    if (air1 || air2) {
                        var s1 = this.findSupport(p.x + dir.x * 0.12, p.z + dir.z * 0.12, p.y + 0.3, tool).y;
                        var s2 = this.findSupport(p.x - dir.x * 0.12, p.z - dir.z * 0.12, p.y + 0.3, tool).y;
                        var narrow = (hc - s1 > 0.1) && (hc - s2 > 0.1);
                        if ((p.y - restY) - hc < 0.15 && hc > 0.05 && !narrow) {
                            yT = hc + restY;
                            tiltT = 0;
                            if (air1 !== air2 && L < 0.5) { slide = air1 ? 1 : -1; tiltT = slide * 0.3; }
                        } else {
                            var lowDir = air1 ? 1 : -1;
                            slide = lowDir;
                            yT = restY;
                            tiltT = lowDir * 0.6;
                        }
                    } else if (hc > (h1 + h2) / 2 + 0.02) {
                        var hLow = Math.min(h1, h2);
                        yT = (hc + hLow) / 2 + restY;
                        tiltT = (h1 < h2 ? 1 : -1) * Math.min(0.6, Math.atan2(hc - hLow, halfL));
                    } else {
                        yT = (h1 + h2) / 2 + restY;
                        tiltT = Math.atan2(h2 - h1, L);
                        if (Math.abs(h2 - h1) > 0.15) slide = (h2 < h1) ? -1 : 1;
                    }
        
                    if (p.y > yT + 0.03) {
                        vel.y -= 9.8 * delta;
                        p.y += vel.y * delta;
                        if (p.y <= yT) { p.y = yT; if (vel.y < 0) vel.y = 0; }
                    } else {
                        p.y = yT;
                        if (vel.y < 0) vel.y = 0;
                    }
        
                    // Рулон не скользит сам по себе: «съезд с горки»
                    // для него выключен — призрачные наклоны опор у стен
                    // разгоняли его вдоль оси до упора в обои. Горизонталь
                    // меняется только от пинка и столкновений
                    if (tool.userData.type === 'wallpaper_roll') slide = 0;
                    if (slide !== 0) {
                        vel.x += dir.x * slide * 2.0 * delta;
                        vel.z += dir.z * slide * 2.0 * delta;
                    }
                    var k = Math.max(0, 1 - 4 * delta);
                    vel.x *= k;
                    vel.z *= k;
                    var nx = p.x + vel.x * delta, nz = p.z + vel.z * delta;
                    if (!this.wallAhead(tool, vel, 0.3) && !this.blocksMove(tool, nx, nz)) {
                        p.x = nx;
                        p.z = nz;
                    } else {
                        vel.x = 0;
                        vel.z = 0;
                    }
        
                    var cur = tool.userData.tilt || 0;
                    cur += (tiltT - cur) * Math.min(1, 8 * delta);
                    tool.userData.tilt = cur;
        
                    var up = new THREE.Vector3(0, 1, 0);
                    var xA = new THREE.Vector3().crossVectors(dir, up).normalize();
                    var m = new THREE.Matrix4().makeBasis(xA, dir, up);
                    var qBase = new THREE.Quaternion().setFromRotationMatrix(m);
                    var qTilt = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(dir.z, 0, -dir.x), cur
                    );
                    tool.quaternion.copy(qTilt.multiply(qBase));
                },
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

            this.supportRay.params.Line = { threshold: 0 };
            var hits = this.supportRay.intersectObjects(this.scene.children, true);

            for (var i = 0; i < hits.length; i++) {
                var obj = hits[i].object;

                // Пропускаем сам предмет И его дочерние меши.
                // Веник и совок — это Group: луч из точки внутри них
                // почти всегда попадает в их же геометрию. Без этого
                // предмет считал бы свою ручку «опорой» и полз бы вверх.
                if (this.isSelfOrChild(obj, self)) continue;

                var ud = obj.userData;
                if (ud && (ud.isGhost || ud.isDebris || ud.type === 'exit' || ud.tmLine)) continue; if (obj.isLine) continue;
                if (ud && (ud.isCarried || ud.isHeld)) continue;

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
                type: 'testCube',
                restY: 0.25,
                velocity: new THREE.Vector3(0, 0, 0),
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
                     
                    // Автоповорот в руках убран: предмет держит взятую позу
                 }
             }
         }.bind(this));
     },
     /**
     * Переносимые материалы (рулоны, канистры) следуют за камерой
     */
    updateCarriedMaterials: function () {
        var data = window.GameData;
        var cam = this.camera;
        ['right', 'left'].forEach(function (side) {
            var handItem = data[side + 'Hand'];
            if (handItem === 'wallpaper_piece') return;
            if (!handItem) return;
            for (var i = 0; i < this.interactableObjects.length; i++) {
                var obj = this.interactableObjects[i];
                if (obj.userData && obj.userData.type === handItem && obj.userData.isCarried) {
                    var forward = new THREE.Vector3();
                    cam.getWorldDirection(forward);
                    var right = new THREE.Vector3();
                    right.crossVectors(forward, cam.up).normalize();
                    var offset = side === 'right' ? 0.35 : -0.35;
                    obj.position.copy(cam.position)
                        .addScaledVector(forward, 0.75)
                        .addScaledVector(right, offset);
                    obj.position.y -= 0.4;
                    // Автоповорот в руках убран: предмет держит взятую позу
                }
            }
        }.bind(this));
    },

    /** Кадр отрисовки. */
        // ==========================================================
        // ФИЗИКА 2.0: габариты, расталкивание, стек, фантом
        // ==========================================================
        physicalTypes: ['tool', 'bucket', 'wallpaper_roll', 'glue_can', 'primer_can', 'wallpaper_piece', 'tray'],
        stackableTypes: ['testCube', 'trashBag', 'wallpaper_roll', 'glue_can', 'primer_can'],
        geoms: {
            tool: { radius: 0.26, topY: 0.3 },
            bucket: { radius: 0.18, topY: 0.3 },
            wallpaper_roll: { radius: 0.45, topY: 0.3 },
            glue_can: { radius: 0.27, topY: 0.3 },
            primer_can: { radius: 0.27, topY: 0.3 },
            tray: { radius: 0.3, topY: 0.12 },
            wallpaper_piece: { radius: 0.15, topY: 0.03 },
            trashBag: { radius: 0.3, topY: 0.7 },
            testCube: { radius: 0.44, topY: 0.5 }
        },
        furnitureColliders: [],
        ghost: { active: false, side: null, mesh: null, angle: 0, valid: false, pos: null },

        /**
         * Последнее слово физики: держит все подвижные предметы внутри
         * стен. Вызывается ПОСЛЕ расталкивания, чтобы никакой толчок
         * от других предметов не продавил предмет в стену или обои.
         * Зажим идёт по фактическому AABB меша текущего кадра: круг
         * радиуса r не покрывает повёрнутую геометрию, а вот рамка
         * покрывает всегда — ни один угол не пересекает плоскость стены.
         */
        clampAllItems: function () {
            var listAll = this.interactableObjects;
            var halfW = window.GameData.world.roomWidth / 2;
            var halfD = window.GameData.world.roomDepth / 2;
            for (var ci = 0; ci < listAll.length; ci++) {
                var co = listAll[ci];
                if (!co || !co.userData || co.userData.isGhost) continue;
                // Статика (полосы обоев, зона выхода, умывальник) не двигается.
                // Held-предметы НЕ исключение: в руке у стены предмет тоже
                // останавливается на границе — продавить слой нельзя
                var st = co.userData.type;
                if (st === 'wallpaper' || st === 'exit' || st === 'sink') continue;
                co.updateMatrixWorld();
                var box = new THREE.Box3().setFromObject(co);
                var px = co.position.x, pz = co.position.z;
                // Допуск на центр предмета = граница минус вылет меша от центра
                var minX = -halfW + (px - box.min.x), maxX = halfW - (box.max.x - px);
                var minZ = -halfD + (pz - box.min.z), maxZ = halfD - (box.max.z - pz);
                // Если предмет шире комнаты (не должно быть, но страховка)
                if (minX > maxX) { minX = maxX = (minX + maxX) / 2; }
                if (minZ > maxZ) { minZ = maxZ = (minZ + maxZ) / 2; }
                co.position.x = Math.max(minX, Math.min(maxX, co.position.x));
                co.position.z = Math.max(minZ, Math.min(maxZ, co.position.z));
                // Пол и опоры — та же граница, что и стены: нижняя точка
                // геометрии ставится НА опору. restY не покрывает наклон,
                // рамка покрывает всегда. Гравитацию гасим, чтобы не дрожал
                var sup = this.findSupport(px, pz, box.max.y + 0.1, co, 1.0);
                if (box.min.y < sup.y) {
                    co.position.y += sup.y - box.min.y;
                    var v = co.userData.velocity;
                    if (v && v.y < 0) v.y = 0;
                }
            }
        },

        /**
         * Вращение колесом с ограничителем: если после поворота геометрия
         * вышла за плоскость комнаты — поворот откатывается. Предмет
         * упирается ребром в стену/крайний слой и дальше не крутится.
         */
        rotateObjectYClamped: function (obj, dir) {
            if (!obj) return;
            var oldRot = obj.rotation.y;
            this.rotateObjectY(obj, dir);
            obj.updateMatrixWorld();
            var W = window.GameData.world;
            var halfW = W.roomWidth / 2, halfD = W.roomDepth / 2;
            var box = new THREE.Box3().setFromObject(obj);
            if (box.min.x < -halfW || box.max.x > halfW || box.min.z < -halfD || box.max.z > halfD) {
                obj.rotation.y = oldRot;
                obj.updateMatrixWorld();
            }
            // Колесо узаконивает новую позу: страж ориентации
            // принимает её как эталон, а не откатывает к старой
            if (obj.userData && obj.userData._watchQ) {
                obj.userData._watchQ = obj.quaternion.clone();
                obj.userData._watchT = performance.now();
            }
        },

        /**
         * Расталкивание по фактическим рамкам: предметы не проходят
         * друг сквозь друга. resolveCollisionsXZ держит круги по табличным
         * радиусам — повёрнутая геометрия вылезала за круг и срасталась.
         * Здесь рамки: пересеклись по XZ и по высоте — раздвигаем по
         * меньшей оси. Предмет в руке не двигается сам, но как
         * препятствие работает: его обходят, в него не проваливаются.
         */
        separateItems: function () {
            var list = this.interactableObjects;
            var items = [];
            for (var i = 0; i < list.length; i++) {
                var o = list[i];
                if (!o || !o.userData || o.userData.isGhost || o.userData.isCarried || o.userData.isHeld) continue;
                o.updateMatrixWorld();
                items.push({
                    o: o,
                    box: new THREE.Box3().setFromObject(o),
                    movable: !o.userData.isCarried && !o.userData.isHeld &&
                             o.userData.type !== 'wallpaper' &&
                             o.userData.type !== 'exit' &&
                             o.userData.type !== 'sink'
                });
            }
            for (var pass = 0; pass < 2; pass++) {
                for (var a = 0; a < items.length; a++) {
                    for (var b = a + 1; b < items.length; b++) {
                        var A = items[a], B = items[b];
                        // Разделяем только при перекрытии по высоте:
                        // предметы, стоящие друг на друге, не трогаем
                        if (A.box.max.y <= B.box.min.y + 0.02) continue;
                        if (B.box.max.y <= A.box.min.y + 0.02) continue;
                        var ox = Math.min(A.box.max.x, B.box.max.x) - Math.max(A.box.min.x, B.box.min.x);
                        var oz = Math.min(A.box.max.z, B.box.max.z) - Math.max(A.box.min.z, B.box.min.z);
                        if (ox <= 0 || oz <= 0) continue;
                        if (!A.movable && !B.movable) continue;
                        var shareA = A.movable ? (B.movable ? 0.5 : 1) : 0;
                        var shareB = B.movable ? (A.movable ? 0.5 : 1) : 0;
                        var sx = (B.o.position.x >= A.o.position.x) ? 1 : -1;
                        var sz = (B.o.position.z >= A.o.position.z) ? 1 : -1;
                        var ax, bx;
                        if (ox < oz) {
                            ax = -sx * ox * shareA; bx = sx * ox * shareB;
                            A.o.position.x += ax; B.o.position.x += bx;
                            A.box.min.x += ax; A.box.max.x += ax;
                            B.box.min.x += bx; B.box.max.x += bx;
                        } else {
                            ax = -sz * oz * shareA; bx = sz * oz * shareB;
                            A.o.position.z += ax; B.o.position.z += bx;
                            A.box.min.z += ax; A.box.max.z += ax;
                            B.box.min.z += bx; B.box.max.z += bx;
                        }
                    }
                }
            }
        },

        /**
         * Баланс: сила тяжести, которая умеет валить. Переводим только
         * по вертикали — предмет на ребре висел вечно. Устойчивая поза —
         * ось вдоль вертикали (стоит или лежит плашмя). Наклон
         * устойчив только с опорой: прислонился к стене или лежит на
         * другом предмете. Иначе заваливается до ближайшей устойчивой позы.
         */
        /**
         * Визуальный верх предмета — по геометрии, а не по кватерниону.
         * Диагностика: корень куба ровный (up.y=1.00), а куб на экране
         * стоит на ребре — наклон спрятан во вложенном меше или прямо
         * в вершинах геометрии. Берём верхнюю грань самого крупного меша
         * и считаем её нормаль в мире: это настоящий верх при любом
         * способе записи наклона. baked=true — геометрия сама наклонена.
         */
        getEffectiveUp: function (o) {
            var best = null, bestVol = 0;
            o.traverse(function (n) {
                if (!n.isMesh || !n.geometry || !n.geometry.attributes ||
                    !n.geometry.attributes.position) return;
                if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
                var sz = new THREE.Vector3();
                n.geometry.boundingBox.getSize(sz);
                var vol = sz.x * sz.y * sz.z;
                if (vol > bestVol) { bestVol = vol; best = n; }
            });
            var out = { up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), baked: false };
            var q = o.getWorldQuaternion(new THREE.Quaternion());
            if (!best) { out.q.copy(q); return out; }
            var qm = best.getWorldQuaternion(new THREE.Quaternion());
            out.q.copy(qm);
            var pos = best.geometry.attributes.position;
            if (!best.geometry.boundingBox) best.geometry.computeBoundingBox();
            var maxY = best.geometry.boundingBox.max.y;
            var minY = best.geometry.boundingBox.min.y;
            var eps = (maxY - minY) * 0.02 + 1e-4;
            var a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
            var e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
            var nrm = new THREE.Vector3(), tmp = new THREE.Vector3();
            var cnt = 0, t, i0, i1, i2;
            if (best.geometry.index) {
                var idx = best.geometry.index;
                for (t = 0; t + 2 < idx.count; t += 3) {
                    i0 = idx.getX(t); i1 = idx.getX(t + 1); i2 = idx.getX(t + 2);
                    a.fromBufferAttribute(pos, i0);
                    b.fromBufferAttribute(pos, i1);
                    c3.fromBufferAttribute(pos, i2);
                    if (a.y >= maxY - eps && b.y >= maxY - eps && c3.y >= maxY - eps) {
                        e1.subVectors(b, a); e2.subVectors(c3, a);
                        tmp.crossVectors(e1, e2); nrm.add(tmp); cnt++;
                    }
                }
            } else {
                for (t = 0; t + 2 < pos.count; t += 3) {
                    a.fromBufferAttribute(pos, t);
                    b.fromBufferAttribute(pos, t + 1);
                    c3.fromBufferAttribute(pos, t + 2);
                    if (a.y >= maxY - eps && b.y >= maxY - eps && c3.y >= maxY - eps) {
                        e1.subVectors(b, a); e2.subVectors(c3, a);
                        tmp.crossVectors(e1, e2); nrm.add(tmp); cnt++;
                    }
                }
            }
            if (cnt > 0 && nrm.lengthSq() > 1e-10) {
                nrm.normalize();
                // Наклон, зашитый в вершинах: локальная нормаль верхней грани
                // не совпадает с локальной вертикалью
                out.baked = nrm.y < 0.978;
                out.up.copy(nrm).applyQuaternion(qm);
            } else {
                out.up.set(0, 1, 0).applyQuaternion(qm);
            }
            return out;
        },

                // === Вес и центр масс: настоящая статика ===
        MASS_TABLE: {
            testCube: 4.0,
            trashBag: 8.0,
            bucket: 10.0,
            primer_can: 15.0,
            glue_can: 14.0,
            knife: 0.2,
            tape_measure: 0.4,
            tool: 1.0,
            wallpaper_roll: 9.0,
            wallpaper_piece: 2.0,
            wallpaper: 3.0
        },

        getMass: function (o) {
            var t = o.userData && o.userData.type;
            return (t && this.MASS_TABLE[t]) || 2.0;
        },

        // Центр масс в мире: центр рамки; o.userData.comOffset — локальный
        // сдвиг, если у предмета вес несимметричен (ведро пустое/полное)
        getCOM: function (o) {
            var box = new THREE.Box3().setFromObject(o);
            var c = box.getCenter(new THREE.Vector3());
            if (o.userData && o.userData.comOffset) {
                c.add(o.userData.comOffset.clone().applyQuaternion(o.quaternion));
            }
            return c;
        },

        // Опорные точки: вершины «тела» в 5 см над опорой
        getFootPoints: function (o, supportY) {
            var body = null, bestVol = 0;
            o.traverse(function (n) {
                if (!n.isMesh || !n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
                if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
                var sz = new THREE.Vector3(); n.geometry.boundingBox.getSize(sz);
                var vol = sz.x * sz.y * sz.z;
                if (vol > bestVol) { bestVol = vol; body = n; }
            });
            if (!body) return [];
            var g = body.geometry;
            var pos = g.attributes.position;
            var idx = g.index;
            var total = idx ? idx.count : pos.count;
            var step = total > 4000 ? Math.ceil(total / 4000) : 1;
            var mw = body.matrixWorld;
            var a = new THREE.Vector3();
            var minY = Infinity, lowX = 0, lowZ = 0, k;
            for (k = 0; k < total; k += step) {
                a.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mw);
                if (a.y < minY) { minY = a.y; lowX = a.x; lowZ = a.z; }
            }
            var band = supportY + 0.05;
            if (minY > band) {
                // Предмет стоит не на полу под центром (краем на кубе,
                // полке), а на чём-то ниже себя. Ищем опору прямо под
                // самыми нижними вершинами: есть контакт — считаем полосу
                // по нему. Нет — предмет висит в воздухе, не трогаем
                var fv = o.userData.velocity;
                var calm = !fv || (fv.x * fv.x + fv.y * fv.y + fv.z * fv.z) < 0.01;
                var probed = false;
                if (calm) {
                    var s2 = this.findSupport(lowX, lowZ, minY + 0.5, o, 0.6);
                    if (Math.abs(s2.y - minY) < 0.09) {
                        band = minY + 0.05;
                        probed = true;
                    }
                }
                if (!probed) return [];
            }
            if (minY > band) return [];
            var pts = [];
            for (k = 0; k < total; k += step) {
                a.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mw);
                if (a.y <= band) pts.push({ x: a.x, z: a.z, y: a.y });
            }
            return pts;
        },

        convexHull2D: function (pts) {
            if (pts.length < 3) return pts.slice();
            var s = pts.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
            var cr = function (o, a, b) { return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x); };
            var lo = [], hi = [], i;
            for (i = 0; i < s.length; i++) {
                while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], s[i]) <= 0) lo.pop();
                lo.push(s[i]);
            }
            for (i = s.length - 1; i >= 0; i--) {
                while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], s[i]) <= 0) hi.pop();
                hi.push(s[i]);
            }
            lo.pop(); hi.pop();
            return lo.concat(hi);
        },

        // ЦМ внутри опорного контура? Узкие опоры (ребро, точка) —
        // неустойчивое равновесие: падают всегда, как карандаш на острие
        pointInHull: function (px, pz, hull) {
            var i, j, cross, len;
            if (hull.length < 3) {
                var d = Infinity;
                if (hull.length === 2) {
                    var ax = hull[0].x, az = hull[0].z, bx = hull[1].x, bz = hull[1].z;
                    var abx = bx - ax, abz = bz - az;
                    var t = ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1);
                    t = Math.max(0, Math.min(1, t));
                    d = Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
                } else if (hull.length === 1) {
                    d = Math.hypot(px - hull[0].x, pz - hull[0].z);
                }
                return d <= 0.05;
            }
            for (i = 0, j = hull.length - 1; i < hull.length; j = i++) {
                var p1 = hull[j], p2 = hull[i];
                cross = (p2.x - p1.x) * (pz - p1.z) - (p2.z - p1.z) * (px - p1.x);
                len = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z)) || 1;
                if (cross / len < -0.03) return false;
            }
            return true;
        },

        nearestHullPoint: function (px, pz, hull) {
            var best = hull[0], bd = Infinity;
            for (var i = 0; i < hull.length; i++) {
                var d = (hull[i].x - px) * (hull[i].x - px) + (hull[i].z - pz) * (hull[i].z - pz);
                if (d < bd) { bd = d; best = hull[i]; }
            }
            return best;
        },

        /**
         * Статика: устойчивость — проекция центра масс внутри опорного
         * контура (выпуклая оболочка нижних вершин на опоре). ЦМ вышел —
         * опрокидывание вокруг ближайшей точки контура в сторону ЦМ,
         * скорость крена растёт с массой. Стена держит прислонённое:
         * контакт рамки со стеной в направлении падения.
         */
        applyTipping: function () {
            var now = performance.now();
            var dt = Math.min(0.05, (now - (this._tipTime || now)) / 1000);
            this._tipTime = now;
            var halfW = window.GameData.world.roomWidth / 2;
            var halfD = window.GameData.world.roomDepth / 2;
            var list = this.interactableObjects;
            for (var i = 0; i < list.length; i++) {
                var o = list[i];
                if (!o || !o.userData) continue;
                // Активное заваливание: один плавный поворот от стартовой
                // позы к устойчивой. Раньше вращение накапливалось по
                // кадрам вокруг «плавающей» точки касания — предмет
                // раскручивался и отрывался от пола. Теперь поворот
                // анимируется от и до, а повтор запрещён на время
                // после приземления
                var tip = o.userData._tip;
                if (tip) {
                    if (o.userData.isGhost || o.userData.isCarried || o.userData.isHeld) { o.userData._tip = null; continue; }
                    var k = Math.min(1, (now - tip.t0) / tip.dur);
                    o.quaternion.copy(tip.q0).slerp(tip.q1, k);
                    if (tip.p0 && tip.p1) o.position.copy(tip.p0).lerp(tip.p1, k);
                    if (k >= 1) {
                        o.userData._tip = null;
                        o.userData._tipCool = now + 800;
                        o.updateMatrixWorld();
                    }
                    continue;
                }
                if ((o.userData._tipCool || 0) > now) continue;
                if (o.userData.isGhost || o.userData.isCarried || o.userData.isHeld) continue;
                var st = o.userData.type;
                if (st === 'wallpaper_roll' || st === 'wallpaper' || st === 'exit' || st === 'sink' || st === 'tool') {
                    // Страж ориентации: этим предметам вращаться нельзя
                    // ни одной системой. Пока в руках — запоминаем
                    // ориентацию; после отпускания любое стороннее
                    // вращение каждый кадр откатывается к запомненному.
                    // Позицию не трогаем: пинок сдвигает предмет как
                    // раньше, только без кувырков
                    // Вертикальный рулон ведёт updateUprightRoll:
                    // стражу ориентации он не указ
                    if (o.userData.upright) continue;
                    if (o.userData.isCarried || o.userData.isHeld) {
                        o.userData._watchQ = o.quaternion.clone();
                        o.userData._watchT = now;
                    } else {
                        if (!o.userData._watchQ) o.userData._watchQ = o.quaternion.clone();
                        var wt = o.userData._watchT || 0;
                        if (now - wt > 500) {
                            var wq = o.userData._watchQ;
                            if (Math.abs(o.quaternion.x - wq.x) > 1e-4 || Math.abs(o.quaternion.y - wq.y) > 1e-4 ||
                                Math.abs(o.quaternion.z - wq.z) > 1e-4 || Math.abs(o.quaternion.w - wq.w) > 1e-4) {
                                o.quaternion.copy(wq);
                                o.updateMatrixWorld();
                            }
                        }
                    }
                    continue;
                }
                o.updateMatrixWorld();
                var box = new THREE.Box3().setFromObject(o);
                // Под предметом всегда должна быть опора. Если под самой
                // нижней точкой пусто — предмет висит в воздухе: плавно
                // опускаем до ближайшей поверхности под ним. Стоящий на
                // кубе/канистре держится (контакт есть), оторвавшийся
                // от пола — садится на пол, как отпущенный
                var vel = o.userData.velocity;
                var calm2 = !vel || (vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) < 0.01;
                if (calm2) {
                    var below = this.findSupport(o.position.x, o.position.z, box.min.y + 0.01, o, 2.5);
                    var gap = box.min.y - below.y;
                    if (gap > 0.06) {
                        o.position.y -= Math.min(2.5 * dt, gap);
                        o.updateMatrixWorld();
                        continue;
                    }
                }
                var supportY = this.findSupport(o.position.x, o.position.z, box.max.y, o, 2.0).y;
                var pts = this.getFootPoints(o, supportY);
                if (!pts.length) continue;
                var hull = this.convexHull2D(pts);
                var cm = this.getCOM(o);
                // Площадь опорного контура: узкая опора (ребро, точка,
                // тонкая полоска) — неустойчивое равновесие. Куб на ребре
                // и карандаш на острие падают всегда, даже когда ЦМ
                // проекцией попадает на линию опоры: идеальная симметрия
                // в жизни — мгновенное падение, а не вечный баланс
                var area = 0;
                if (hull.length >= 3) {
                    for (var k = 0; k < hull.length; k++) {
                        var p1 = hull[k], p2 = hull[(k + 1) % hull.length];
                        area += p1.x * p2.z - p2.x * p1.z;
                    }
                    area = Math.abs(area) / 2;
                }
                                if (!o.userData._dbgT || now - o.userData._dbgT > 1000) {
                    o.userData._dbgT = now;
                    var inH = this.pointInHull(cm.x, cm.z, hull);
                    console.log('[tip]', st,
                        'pts:', pts.length,
                        'hull:', hull.length,
                        'area:', area.toFixed(4),
                        'inHull:', inH,
                        'cool:', Math.max(0, ((o.userData._tipCool || 0) - now)).toFixed(0));
                }
var narrow = hull.length < 3 || area < 0.002;
                if (!narrow && this.pointInHull(cm.x, cm.z, hull)) continue;
                // Падаем туда, куда вышел ЦМ за контур
                var np = this.nearestHullPoint(cm.x, cm.z, hull);
                var dx = cm.x - np.x, dz = cm.z - np.z;
                var dl = Math.sqrt(dx * dx + dz * dz);
                if (dl < 0.02) {
                    // ЦМ над узкой опорой: направление подсказывает наклон
                    // самого предмета — куда смотрит его «верх», туда и валится
                    var u = this.getEffectiveUp(o).up;
                    dx = u.x; dz = u.z;
                    dl = Math.sqrt(dx * dx + dz * dz);
                }
                if (dl < 1e-4) { dx = 1; dz = 0; dl = 1; }
                dx /= dl; dz /= dl;
                // Стена держит: рамка касается стены в направлении падения
                var leanWall =
                    (dx > 0.3 && box.max.x > halfW - 0.02) ||
                    (dx < -0.3 && box.min.x < -halfW + 0.02) ||
                    (dz > 0.3 && box.max.z > halfD - 0.02) ||
                    (dz < -0.3 && box.min.z < -halfD + 0.02);
                if (leanWall) continue;
                var up = this.getEffectiveUp(o).up;
                // Старт заваливания: ось вращения — всегда горизонтальная,
                // перпендикуляр направлению падения, угол — ровно до
                // «лежит плашмя». Раньше ось бралась как кратчайший
                // поворот «верха» к цели: у лежащего предмета верх смотрит
                // вбок, и такой поворот оказывался вращением вокруг
                // вертикали — предмет крутился на месте по полу.
                // Вертикальной составляющей оси больше нет: кручение
                // невозможно. Уже лежащий по направлению падения
                // предмет отсекается по углу и не трогается
                var w = this.getMass(o);
                var uA = up.x * dx + up.z * dz;
                var uV = up.y;
                var phi = Math.atan2(uV, uA);
                if (phi < 0.05 || phi > Math.PI - 0.05) continue;
                var axis = new THREE.Vector3(dz, 0, -dx);
                var qd = new THREE.Quaternion().setFromAxisAngle(axis, phi);
                var q1 = o.quaternion.clone().premultiply(qd);
                var piv = new THREE.Vector3(np.x, np.y !== undefined ? np.y : supportY, np.z);
                var rel0 = o.position.clone().sub(piv);
                var p1 = piv.clone().add(rel0.clone().applyQuaternion(qd));
                o.userData._tip = {
                    q0: o.quaternion.clone(),
                    q1: q1,
                    p0: o.position.clone(),
                    p1: p1,
                    t0: now,
                    dur: 450 + Math.min(500, w * 25)
                };
            }
        },

        getGeom: function (type) { return this.geoms[type] || { radius: 0.2, topY: 0.3 }; },
        isPhysicalType: function (type) { return this.physicalTypes.indexOf(type) !== -1; },
        isStackableType: function (type) { return this.stackableTypes.indexOf(type) !== -1; },

        clampToRoom: function (o) {
            var W = window.GameData.world.roomWidth, D = window.GameData.world.roomDepth;
            var r = (o.userData && o.userData.type) ? this.getGeom(o.userData.type).radius : 0.2;
            var m = Math.max(0.27, r + 0.01);
            var hw = W / 2 - m, hd = D / 2 - m;
            o.position.x = Math.max(-hw, Math.min(hw, o.position.x));
            o.position.z = Math.max(-hd, Math.min(hd, o.position.z));
        },

        /**
         * Синхронизирует динамические коллайдеры (куб, мешок) с их
         * живыми позициями в interactableObjects. У носимого мешка
         * радиус обнуляется — в руках он ничего не расталкивает.
         */
        updateDynamicColliders: function () {
            var list = this.interactableObjects;
            for (var f = 0; f < this.furnitureColliders.length; f++) {
                var fc = this.furnitureColliders[f];
                if (!fc.dyn) continue;
                fc.r = 0;
                for (var i = 0; i < list.length; i++) {
                    var m = list[i];
                    if (!m.userData || m.userData.type !== fc.dyn) continue;
                    if (m.userData.isCarried || m.userData.isHeld) continue;
                    // Сам куб/мешок тоже не врастает в стены и обои:
                    // клампим по габариту, как обычные физические предметы
                    this.clampToRoom(m);
                    fc.x = m.position.x;
                    fc.z = m.position.z;
                    fc.r = this.getGeom(fc.dyn).radius;
                    break;
                }
            }
        },

        isFloorBody: function (o) {
            if (!o || !o.userData) return false;
            var ud = o.userData;
            if (ud.isHeld || ud.isCarried || ud.isDebris || ud.isGhost) return false;
            if (!this.isPhysicalType(ud.type)) return false;
            return o.position.y <= (ud.restY || 0) + 0.02;
        },

                resolveCollisionsXZ: function () {
            var list = this.interactableObjects;
            var stack = [];
            for (var s = 0; s < list.length; s++) {
                var so = list[s];
                if (so && so.userData && this.isStackableType(so.userData.type) && !this.isPhysicalType(so.userData.type) && !so.userData.isCarried && !so.userData.isHeld) stack.push(so);
            }
            for (var i = 0; i < list.length; i++) {
                var a = list[i];
                var aMoves = this.isFloorBody(a);
                if (!aMoves && stack.indexOf(a) === -1) continue;
                for (var j = i + 1; j < list.length; j++) {
                    var b = list[j];
                    var bMoves = this.isFloorBody(b);
                    if (!bMoves && stack.indexOf(b) === -1) continue;
                    if (!aMoves && !bMoves) continue;
                    var ra = this.getGeom(a.userData.type).radius;
                    var rb = this.getGeom(b.userData.type).radius;
                    var dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
                    var rr = ra + rb, d2 = dx * dx + dz * dz;
                    if (d2 >= rr * rr || d2 < 1e-6) continue;
                    var d = Math.sqrt(d2);
                    var nx = dx / d, nz = dz / d;
                    if (aMoves && bMoves) {
                        var push = (rr - d) / 2 + 0.002;
                        a.position.x -= nx * push; a.position.z -= nz * push;
                        b.position.x += nx * push; b.position.z += nz * push;
                    } else {
                        var push2 = rr - d + 0.002;
                        if (aMoves) { a.position.x -= nx * push2; a.position.z -= nz * push2; }
                        else { b.position.x += nx * push2; b.position.z += nz * push2; }
                    }
                    this.clampToRoom(a); this.clampToRoom(b);
                }
            }
        },

        resolveFurnitureXZ: function () {
            this.updateDynamicColliders();
            // Универсальный зажим: любой предмет мира держится внутри стен
            // независимо от ориентации и «на полу» ли он — предметы на боку
            // и на ребре больше не выпадают из-под зажима
            this.clampAllItems();
            var list = this.interactableObjects;
            for (var i = 0; i < list.length; i++) {
                var o = list[i];
                if (!this.isFloorBody(o)) continue;
                var r = this.getGeom(o.userData.type).radius;
                for (var f = 0; f < this.furnitureColliders.length; f++) {
                    var fc = this.furnitureColliders[f];
                    var dx = o.position.x - fc.x, dz = o.position.z - fc.z;
                    var rr = r + fc.r, d2 = dx * dx + dz * dz;
                    if (d2 >= rr * rr || d2 < 1e-6) continue;
                    var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
                    o.position.x = fc.x + nx * (rr + 0.002);
                    o.position.z = fc.z + nz * (rr + 0.002);
                    this.clampToRoom(o);
                }
            }
        },

resolveHit: function (obj) {
            var node = obj;
            while (node) {
                if (node.userData && node.userData.interactive) return node;
                node = node.parent;
            }
            return null;
        },

        findCarriedMesh: function (side) {
            var data = window.GameData;
            var name = data[side + 'Hand'];
            var found = null;
            this.scene.traverse(function (node) {
                if (found || !node.userData || !node.userData.isCarried) return;
                if (node.userData.carriedSide === side && node.userData.type === name) found = node;
            });
            return found;
        },

        startGhost: function (side, target) {
            if (this.ghost.active) return;
            var mesh = this.findCarriedMesh(side);
            if (!mesh) return;
            var isRoll = mesh.userData.type === 'wallpaper_roll';
            var geo = isRoll ? new THREE.CylinderGeometry(0.15, 0.15, 0.8, 12) : new THREE.BoxGeometry(0.3, 0.4, 0.3);
            this.ghost = {
                active: true, side: side, angle: 0, valid: false, upright: false,
                mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4, depthWrite: false })),
                pos: new THREE.Vector3()
            };
            this.ghost.mesh.userData = { isGhost: true };
            if (isRoll) this.ghost.mesh.rotation.z = Math.PI / 2;
            this.ghost.mesh.visible = false;
            this.scene.add(this.ghost.mesh);
        },

        updateGhost: function () {
            var g = this.ghost;
            if (!g.active || !g.mesh) return;
            var carried = this.findCarriedMesh(g.side);
            if (!carried) { this.cancelGhost(); return; }
            if (!this.ghostRay) this.ghostRay = new THREE.Raycaster();
            this.ghostRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            this.ghostRay.far = 2.8;
            var hits = this.ghostRay.intersectObjects(this.interactableObjects, false);
            var target = null;
            for (var i = 0; i < hits.length; i++) {
                var o = this.resolveHit(hits[i].object);
                if (o && o.userData && this.isStackableType(o.userData.type) && o !== carried) { target = o; break; }
            }
            if (!target) { g.mesh.visible = false; return; }
            g.mesh.visible = true;

            var isRollG = carried.userData.type === 'wallpaper_roll';
            if (isRollG) {
                if (g.upright) {
                    g.mesh.rotation.set(0, g.angle, 0);
                } else {
                    g.mesh.rotation.set(0, g.angle, Math.PI / 2);
                }
            }

            var rUnder = this.getGeom(target.userData.type).radius;
            var rOver = this.getGeom(carried.userData.type).radius;
            // Широкая опора — ставим поверх (в пределах её габарита),
            // узкая — предмет встанет рядом, но без пересечения кругов
            var dist = Math.max(0, rUnder - rOver);
            var px = target.position.x + Math.cos(g.angle) * dist;
            var pz = target.position.z + Math.sin(g.angle) * dist;
            var W = window.GameData.world.roomWidth, D = window.GameData.world.roomDepth;
            px = Math.max(-W / 2 + 0.3, Math.min(W / 2 - 0.3, px));
            pz = Math.max(-D / 2 + 0.3, Math.min(D / 2 - 0.3, pz));

            var support = this.findSupport(px, pz, this.camera.position.y + 0.3, carried, 2.5);
            var restG = (g.upright && isRollG) ? 0.4 : (carried.userData.restY || 0.05);
            g.pos.set(px, support.y + restG, pz);
            g.mesh.position.copy(g.pos);

            var valid = true;
            var list = this.interactableObjects;
            for (var k = 0; k < list.length && valid; k++) {
                var o2 = list[k];
                if (o2 === carried || o2 === target) continue;
                if (!this.isFloorBody(o2)) continue;
                var dx2 = o2.position.x - px, dz2 = o2.position.z - pz;
                var rr2 = rOver + this.getGeom(o2.userData.type).radius;
                if (dx2 * dx2 + dz2 * dz2 < rr2 * rr2) valid = false;
            }
            for (var f = 0; f < this.furnitureColliders.length && valid; f++) {
                var fc = this.furnitureColliders[f];
                var fx = fc.x - px, fz = fc.z - pz;
                var fr = rOver + fc.r;
                if (fx * fx + fz * fz < fr * fr) valid = false;
            }
            g.valid = valid;
            g.mesh.material.color.setHex(valid ? 0x00ff88 : 0xff3344);
        },

        commitGhost: function () {
            var g = this.ghost;
            if (!g.active) return;
            var carried = this.findCarriedMesh(g.side);
            if (!carried) { this.cancelGhost(); return; }
            if (!g.valid || !g.mesh.visible) {
                window.GameLogic.showHintText("Не помещается — покрути колесо мыши");
                this.cancelGhost();
                return;
            }
            if (carried.userData.type === 'wallpaper_roll') {
                carried.userData.upright = !!g.upright;
                carried.userData.yaw = g.angle;
                carried.userData.tilt = 0;
                delete carried.userData.topple;
                if (carried.userData.velocity) carried.userData.velocity.set(0, 0, 0);
                carried.rotation.set(0, g.angle, g.upright ? 0 : Math.PI / 2);
            }
            window.GameLogic.placeMaterialAt(carried, g.pos.x, g.pos.y, g.pos.z);
            this.cancelGhost();
        },

        cancelGhost: function () {
            var g = this.ghost;
            if (g && g.mesh) { this.scene.remove(g.mesh); g.mesh = null; }
            this.ghost = { active: false, side: null, mesh: null, angle: 0, valid: false, pos: null };
        },

        toggleGhostUpright: function () {
                    if (!this.ghost.active) return;
                    var carried = this.findCarriedMesh(this.ghost.side);
                    if (!carried || carried.userData.type !== 'wallpaper_roll') {
                        window.GameLogic.showHintText('На торец ставится только рулон');
                        return;
                    }
                    this.ghost.upright = !this.ghost.upright;
                    window.GameLogic.showHintText(this.ghost.upright ? 'Поставить: стоя' : 'Поставить: лёжа');
                },
                toggleRollOrientation: function (target) {
                            var roll = target || null;
                            if (!roll) {
                                var ray = this.ghostRay || (this.ghostRay = new THREE.Raycaster());
                                ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
                                ray.far = 3.0;
                                var hits = ray.intersectObjects(this.interactableObjects, false);
                                for (var i = 0; i < hits.length; i++) {
                                    var o = this.resolveHit(hits[i].object);
                                    if (o && o.userData && o.userData.type === 'wallpaper_roll' && !o.userData.isCarried) { roll = o; break; }
                                }
                                if (!roll) { window.GameLogic.showHintText('Наведись на рулон обоев и нажми F'); return; }
                            }
                            var ud = roll.userData;
                            var sup = this.findSupport(roll.position.x, roll.position.z, roll.position.y + 1.2, roll).y;
                            if (ud.upright) {
                                ud.upright = false;
                    if ((ud.type === 'glue_can' || ud.type === 'primer_can') && ud.open && (ud.volume || 0) > 0 && Math.random() < 0.4) { this.spillCanister(roll, ud); ud._justSpilled = true; }
                                ud.tilt = 0;
                                delete ud.topple;
                                roll.rotation.set(0, ud.yaw || 0, Math.PI / 2);
                                roll.position.y = sup + (ud.restY || 0.15);
                                if (ud.velocity) ud.velocity.set(0, 0, 0);
                                window.GameLogic.showHintText('Рулон: лёжа');
                            } else {
                                var axis3 = new THREE.Vector3(0, 1, 0).applyQuaternion(roll.quaternion);
                                var dir = new THREE.Vector3(axis3.x, 0, axis3.z);
                                if (dir.lengthSq() < 0.04) dir.set(1, 0, 0);
            if (ud.type === "wallpaper_piece" && ud.crumpled) { window.GameLogic.showHintText("Комок не переворачивается"); return; }
            if (ud.type === "wallpaper_piece") {
                if (ud.velocity) ud.velocity.set(0, 0, 0);
                ud.flipped = !ud.flipped;
                if (!ud.isCarried) roll.rotation.set(ud.flipped ? Math.PI / 2 : -Math.PI / 2, 0, 0);
                if (!ud.faceMat || !ud.backMat) { ud.faceMat = ud.faceMat || roll.material; ud.backMat = ud.backMat || new THREE.MeshLambertMaterial({ color: 0xbfb5a3, side: THREE.DoubleSide }); }
                if (ud.faceMat && ud.backMat) roll.material = ud.flipped ? ud.backMat : ud.faceMat;
                window.GameLogic.showHintText(ud.flipped ? "Кусок обоев: подложкой вверх — это сторона для клея" : "Кусок обоев: лицевой стороной вверх");
                return;
            }

                                dir.normalize();
                                ud.yaw = Math.atan2(dir.x, dir.z);
                                ud.upright = true;
                                ud.tilt = 0;
                                delete ud.topple;
                                roll.rotation.set(0, ud.yaw, 0);
                                roll.position.y = sup + 0.4;
                                if (ud.velocity) ud.velocity.set(0, 0, 0);
                                window.GameLogic.showHintText('Рулон: стоя');
                            }
                        },
                                        rotateObjectY: function (obj, dir) {
            if (obj.userData.upright) { obj.userData.yaw = (obj.userData.yaw || 0) + dir * Math.PI / 12; return; }
            var q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dir * Math.PI / 12);
            obj.quaternion.premultiply(q);
        },

        toggleRestPose: function (obj) {
            if (!obj || !obj.userData) return;
            var ud = obj.userData;
            if (ud.type === 'wallpaper_roll') {
                // Перезапуск стража: чистим запомненную позу и даём
                // анимации смены позы 0.5 секунды, потом страж
                // запоминает новую ориентацию как эталон
                ud._watchQ = null;
                ud._watchT = performance.now();
                this.toggleRollOrientation(obj); return;
            }
            if (ud.type === 'bucket' || ud.type === 'glue_can' || ud.type === 'primer_can') {
                var sup = this.findSupport(obj.position.x, obj.position.z, obj.position.y + 1.2, obj).y;
                if (ud.velocity) ud.velocity.set(0, 0, 0);
                if (ud.upright) {
                    if ((ud.type === 'glue_can' || ud.type === 'primer_can') && ud.open && (ud.volume || 0) > 0 && Math.random() < 0.4) { this.spillCanister(obj, ud); ud._justSpilled = true; }
                    ud.upright = false; ud.tilt = 0;
                    if (ud.type === 'bucket') { obj.rotation.set(0, 0, Math.PI / 2); obj.position.y = sup + 0.16; ud.restY = 0.16; window.GameLogic.showHintText('Ведро: на боку'); }
                    else { obj.rotation.set(Math.PI / 2, 0, 0); obj.position.y = sup + 0.15; ud.restY = 0.15; window.GameLogic.showHintText(ud.name + ': на боку'); }
                } else {
                    ud.upright = true; ud.tilt = 0;
                    if (ud.type === 'bucket') { obj.rotation.set(0, 0, 0); obj.position.y = sup + 0.15; ud.restY = 0.15; window.GameLogic.showHintText('Ведро: стоит'); }
                    else { obj.rotation.set(0, 0, 0); obj.position.y = sup; ud.restY = 0; window.GameLogic.showHintText(ud.name + ': на дне'); }
                }
                return;
            }
            window.GameLogic.showHintText('Этот предмет крутится колесом мыши');
        },
tapeMeasure: { a: null, b: null, aWall: false, line: null, marks: [] },

tapeHintText: function () {
    var tmPre = this.tapeMeasure;
    if (tmPre.a && !tmPre.b) {
        var hPre = this.tmCast();
        if (hPre && this.tmSegmentBlocked(tmPre.a, hPre.point)) return 'Рулетка: путь замера пересекает предмет — отодвините его или измените угол';
    }

    var tm = this.tapeMeasure;
    var hit = this.tmCast();
    if (tm.a && tm.b) return 'Замер: ' + tm.a.distanceTo(tm.b).toFixed(2) + ' м · ЛКМ — новый замер';
    if (tm.a && hit) return 'Рулетка: от точки А ' + tm.a.distanceTo(hit.point).toFixed(2) + ' м · ЛКМ — зафиксировать · ПКМ — сброс';
    return 'Рулетка: до цели ' + (hit ? hit.distance.toFixed(2) + ' м' : '—') + ' · ЛКМ — точка А · ПКМ — сброс';
},

tmCast: function () {
    if (!this.tmRay) { this.tmRay = new THREE.Raycaster(); this.tmRay.far = 6; }
    this.tmRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    var hits = this.tmRay.intersectObjects(this.scene.children, true);
    for (var i = 0; i < hits.length; i++) {
        if (hits[i].distance < 0.15) continue;
        var skip = false;
        for (var n = hits[i].object; n; n = n.parent) {
            if (n === this.heldToolMeshes.left || n === this.heldToolMeshes.right) { skip = true; break; }
            if (n.userData && (n.userData.isHeld || n.userData.isCarried || n.userData.tmMark || n.userData.tmLine)) { skip = true; break; }
        }
        if (!skip) return hits[i];
    }
    return null;
},

        tmSegmentBlocked: function (from, to) {
            var dir = new THREE.Vector3().subVectors(to, from);
            var dist = dir.length();
            if (dist < 0.05) return false;
            dir.normalize();
            if (!this.tmBlockRay) {
                this.tmBlockRay = new THREE.Raycaster();
                this.tmBlockRay.params.Line = { threshold: 0 };
            }
            this.tmBlockRay.set(from, dir);
            this.tmBlockRay.far = dist - 0.05;
            var hits = this.tmBlockRay.intersectObjects(this.interactableObjects, true);
            for (var i = 0; i < hits.length; i++) {
                var node = this.resolveHit(hits[i].object);
                if (!node || node === this.tapeMeasure.aObj) continue;
                var ud = node.userData;
                if (!ud) continue;
                if (ud.tmMark || ud.isHeld || ud.isCarried || ud.isGhost || ud.isDebris) continue;
                if (ud.type === 'wallpaper' || ud.type === 'wallpaper_piece') continue;
                return true;
            }
            return false;
        },

addTapeMark: function (p, color) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: color }));
    m.position.copy(p);
    m.userData = { tmMark: true };
    this.scene.add(m);
    this.tapeMeasure.marks.push(m);
},

tapMeasureClick: function () {
    var hit = this.tmCast();
    if (!hit) { window.GameLogic.showHintText('Рулетка: наведись на поверхность'); return; }
    var tm = this.tapeMeasure;
    var p = hit.point.clone();
    if (!tm.a || tm.b) {
        this.clearTapeMeasure();
        tm.a = p;
        tm.aObj = this.resolveHit(hit.object);
        tm.aWall = !!(hit.object.userData && hit.object.userData.type === 'wallpaper');
        this.addTapeMark(p, 0xe74c3c);
    } else {
        if (this.tmSegmentBlocked(tm.a, p)) { window.GameLogic.showHintText('Рулетка: путь замера пересекает предмет — отодвините его или измените угол'); return; }
        tm.b = p;
        this.addTapeMark(p, 0x2ecc71);
        if (tm.line) { this.scene.remove(tm.line); tm.line.geometry.dispose(); }
        tm.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([tm.a, tm.b]), new THREE.LineBasicMaterial({ color: 0xf1c40f }));
        tm.line.userData = { tmLine: true };
        this.scene.add(tm.line);
        var d = tm.a.distanceTo(tm.b);
        var msg = 'Замер: ' + d.toFixed(2) + ' м';
        if (tm.aWall && hit.object.userData && hit.object.userData.type === 'wallpaper') msg += ' ≈ ' + Math.max(1, Math.ceil(d / 1.0)) + ' рул. (ширина 1 м)';
        window.GameLogic.showHintText(msg);
        if (window.GameData.addHistory) window.GameData.addHistory('Замер рулеткой: ' + d.toFixed(2) + ' м');
    }
},

updateTapeMeasure: function () {
    var data = window.GameData;
    if (!data.handWith || !data.handWith('tape_measure')) { this.clearTapeMeasure(); return; }
    var tm = this.tapeMeasure;
    if (!tm.a || tm.b) return;
    var hit = this.tmCast();
    if (!hit) return;
    if (tm.line) { this.scene.remove(tm.line); tm.line.geometry.dispose(); }
    tm.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([tm.a.clone(), hit.point.clone()]), new THREE.LineBasicMaterial({ color: this.tmSegmentBlocked(tm.a, hit.point) ? 0xe74c3c : 0xf1c40f }));
    tm.line.userData = { tmLine: true };
    this.scene.add(tm.line);
},

clearTapeMeasure: function () {
    var tm = this.tapeMeasure;
    if (tm.line) { this.scene.remove(tm.line); tm.line.geometry.dispose(); tm.line = null; }
    for (var i = 0; i < tm.marks.length; i++) this.scene.remove(tm.marks[i]);
    tm.marks = [];
    tm.a = null; tm.b = null; tm.aWall = false; tm.aObj = null;
},
rotateGhost: function (dir) {
            if (!this.ghost.active) return;
            this.ghost.angle += dir * 0.35;
        },

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
