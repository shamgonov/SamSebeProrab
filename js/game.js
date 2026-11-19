/* ==========================================
js/game.js
Игровая логика: движение, обзор мышью,
коллизии и система взаимодействия (Raycaster).
========================================== */
(function () {
    "use strict";
    window.GameLogic = {
        keys: { w: false, a: false, s: false, d: false },
        isLocked: false,
        sweeping: false,
        broomCooldown: 0,
        dustpanCooldown: 0,
        yaw: 0,
        pitch: 0,
        pitchLimit: Math.PI / 2 - 0.05,
        mouseSensitivity: 0.002,
        playerRadius: 0.35,
        preferredHand: 'right',
        raycaster: null,
        rayCenter: null,
        lastHit: null,
        interactDistance: 2.5,
        rayFar: 6,
        tools: {
            scraper: { hotkey: '1', label: 'Скребок', speed: 1.0, staminaCost: 5, actions: { wallpaper: function (obj, hit) { var passes = obj.userData.wet ? 3 : 1; for (var i = 0; i < passes; i++) { window.GameRenderer.tearWallpaper(obj, hit.point, hit.uv); } if (obj.userData.wet) window.GameData.addHistory("Мокрые обои сошли быстрее"); } }, hints: { wallpaper: 'E - Оторвать' } },
            roller: { hotkey: '2', label: 'Валик', speed: 1.0, staminaCost: 2, actions: { wallpaper: function (obj, hit) { var data = window.GameData; if (data.rollerState === 'water') { obj.userData.wet = true; window.GameData.addHistory("Обои размочены валиком"); return; } if (data.rollerState === 'primer') { window.GameRenderer.primerWall(obj, hit.point, hit.uv); return; } if (data.rollerState === 'glue') { window.GameRenderer.glueWall(obj, hit.point, hit.uv); return; } window.GameRenderer.paintWall(obj, hit.point, hit.uv); } }, hints: { wallpaper: 'E - Покрасить' } },
            hands: { hotkey: '3', label: 'Руки', icon: '✋', speed: 1.0, staminaCost: 10, actions: { wallpaper: function (obj, hit) { window.GameRenderer.tearWallpaper(obj, hit.point, hit.uv); } }, hints: { wallpaper: 'E - Отрывать руками' } },
            broom: { hotkey: '4', label: 'Веник', icon: '🧹', speed: 1.0, staminaCost: 1, actions: {}, hints: {} },
            dustpan: { hotkey: '5', label: 'Совок', icon: '🥄', speed: 1.0, staminaCost: 2, actions: {}, hints: {} },
            bucket: { label: 'Ведро', icon: '🪣', speed: 1.0, staminaCost: 0, actions: {}, hints: {} },
            primer_roller: { label: 'Валик с грунтовкой', icon: '🎨', speed: 1.0, staminaCost: 2, actions: {}, hints: {} },
            wallpaper_roll: { label: 'Рулон обоев', icon: '🧻', speed: 1.0, staminaCost: 0, actions: {}, hints: {} },
            knife: { label: 'Нож', icon: '🔪', speed: 1.0, staminaCost: 1, actions: {}, hints: {} },
            glue_can: { label: 'Клей', icon: '🟡', speed: 1.0, staminaCost: 0, actions: {}, hints: {} },
            tape_measure: { label: 'Рулетка', icon: '📏', speed: 1.0, staminaCost: 0, actions: {}, hints: {} }
        },
        staminaMinToWork: 10,
        staminaRegenPerSec: 12,
        lastRenderedStamina: 100,
        toolsPanelEl: null,
        staminaFillEl: null,
        staminaTextEl: null,
        trashEl: null,
        bagStatusEl: null,
        hintEl: null,

        init: function () {
            this.raycaster = new THREE.Raycaster();
            this.raycaster.far = this.rayFar;
            this.rayCenter = new THREE.Vector2(0, 0);
            this.hintEl = document.getElementById('action-hint');
            this.toolsPanelEl = document.getElementById('tools-panel');
            this.staminaFillEl = document.getElementById('stamina-fill');
            this.staminaTextEl = document.getElementById('stamina-text');
            this.trashEl = document.getElementById('trash-count');
            this.bagStatusEl = document.getElementById('bag-status');
            this.updateHandsUI();
            this.renderStamina();
            this.renderTrash();
            this.setupInput();
            this.loop();
        },

        setupInput: function () {
            var self = this;
            document.addEventListener('keydown', function (e) {
                switch (e.code) {
                    case 'KeyW': self.keys.w = true; break;
                    case 'KeyA': self.keys.a = true; break;
                    case 'KeyS': self.keys.s = true; break;
                    case 'KeyD': self.keys.d = true; break;
                    case 'KeyE': self.handleInteraction(); break;
                    case 'KeyQ': self.dropFromHands(); break;
                    case 'Tab': e.preventDefault(); self.togglePreferredHand(); break;
                }
            });
            document.addEventListener('keyup', function (e) {
                switch (e.code) {
                    case 'KeyW': self.keys.w = false; break;
                    case 'KeyA': self.keys.a = false; break;
                    case 'KeyS': self.keys.s = false; break;
                    case 'KeyD': self.keys.d = false; break;
                }
            });
            var canvas = window.GameRenderer.renderer.domElement;
            document.addEventListener('click', function () { if (!self.isLocked) canvas.requestPointerLock(); });
            document.addEventListener('mousedown', function (e) { if (e.button !== 0 || !self.isLocked) return; self.sweeping = true; });
            document.addEventListener('mouseup', function (e) { if (e.button !== 0) return; self.sweeping = false; });
            document.addEventListener('pointerlockchange', function () { self.isLocked = (document.pointerLockElement === canvas); });
            document.addEventListener('mousemove', function (e) {
                if (!self.isLocked) return;
                self.yaw -= e.movementX * self.mouseSensitivity;
                self.pitch -= e.movementY * self.mouseSensitivity;
                self.pitch = Math.max(-self.pitchLimit, Math.min(self.pitchLimit, self.pitch));
            });
        },

        pickTool: function (toolKey) { console.warn("[GAME] pickTool устарел"); },
        togglePreferredHand: function () { this.preferredHand = this.preferredHand === 'right' ? 'left' : 'right'; window.GameData.addHistory("Предпочитаемая рука: " + this.handLabel(this.preferredHand)); this.renderHeldItems(); },
        handLabel: function (side) { return side === 'left' ? 'левую' : 'правую'; },
        getTool: function () { var name = window.GameData.rightHand; return name ? (this.tools[name] || null) : null; },
        getLeftTool: function () { var name = window.GameData.leftHand; return name ? (this.tools[name] || null) : null; },

        buildHint: function (userData) {
            var tool = this.getTool();
            var data = window.GameData;
            var hasDustpan = (data.leftHand === 'dustpan' || data.rightHand === 'dustpan');

            // УМЫВАЛЬНИК: если в руке ведро, предлагаем наполнить
            if (userData.type === 'sink') {
                if (data.handWith('bucket')) return "E - Наполнить ведро";
                return "E: " + userData.name;
            }

            if (userData.type === 'tool' && !userData.isHeld) {
                if (!data.rightHand || !data.leftHand) return "E - Взять " + userData.name.toLowerCase() + " (Tab — " + this.handLabel(this.preferredHand) + ")";
                return "Руки заняты, сначала освободи";
            }
            if (userData.type === 'trashBag') {
                if (userData.isCarried) {
                    if (hasDustpan && data.dustpanFill > 0) {
                        if (data.trashCount >= data.maxTrash) return "Мешок полон! Сначала вынеси мусор к выходу (зелёный куб)";
                        return "E - Вытряхнуть совок в мешок";
                    }
                    return this.isNearExit() && data.trashCount > 0 ? "E - Вынести мусор" : "E - Поставить мешок";
                }
                if (hasDustpan && data.dustpanFill > 0) {
                    if (data.trashCount >= data.maxTrash) return "Мешок полон! Сначала вынеси мусор к выходу (зелёный куб)";
                    return "E - Вытряхнуть совок в мешок";
                }
                return "E - Взять мешок";
            }
            if (userData.isDebris) {
                if (hasDustpan) {
                    if (data.dustpanFill >= data.dustpanMax) return "Совок полон, вытряхни в мешок";
                    return "Зажми ЛКМ — собрать в совок";
                }
                if (data.handWith('broom')) return "Зажми ЛКМ — смести кучу";
                if (data.trashCount >= data.maxTrash) return "Мешок полон — вынеси к выходу";
                return "E — подобрать рукой";
            }
            if (userData.type === 'exit') return data.trashCount === 0 ? "Мусора нет — можно идти" : "E - Вынести мусор";
            if (userData.type === 'wallpaper') {
                if (this.isCarryingBag()) return "Сначала поставь мешок";
                if (!tool || !tool.actions || !tool.actions.wallpaper) return "Возьми в руку скребок или валик";
                if (data.stamina < this.staminaMinToWork) return "Нет сил! Отдохни";
                return tool.label + ": " + tool.hints.wallpaper;
            }
            if (userData.name) return "E: " + userData.name;
            return "";
        },

        handleInteraction: function () {
            var data = window.GameData;
            if (!this.lastHit) return;
            if (this.lastHit.distance > this.interactDistance) {
                window.GameData.ui.currentHint = "Подойди ближе";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }
            var obj = this.lastHit.object;
            obj = this.resolveInteractable(obj);
            var userData = obj.userData || {};
            var tool = this.getTool();

            if (!userData.isHeld && userData.toolName) { this.takeToolToHand(obj, userData); return; }
            if (userData.type === 'trashBag') {
                var hasDustpan = (data.leftHand === 'dustpan' || data.rightHand === 'dustpan');
                if (hasDustpan && data.dustpanFill > 0) { this.emptyDustpanIntoBag(); return; }
                if (!userData.isCarried) { this.pickUpBag(); }
                else { if (this.isNearExit() && data.trashCount > 0) this.emptyBagAtExit(); this.dropBagHere(); }
                return;
            }
            if (userData.type === 'sink') { this.fillBucketAtSink(obj); return; }
            if (userData.type === 'primer_can' || userData.type === 'glue_can') { this.pourCanisterIntoBucket(obj, userData); return; }
            if (userData.type === 'wallpaper_roll') { this.cutWallpaperPiece(obj); return; }
            if (this.isCarryingBag()) {
                window.GameData.ui.currentHint = "Сначала поставь мешок";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }
            if (userData.isDebris) {
                if (data.handWith('dustpan')) { window.GameData.ui.currentHint = "Зажми ЛКМ — собрать в совок"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
                if (data.handWith('broom')) { window.GameData.ui.currentHint = "Зажми ЛКМ — смести кучу"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
                if (data.trashCount >= data.maxTrash) { window.GameData.ui.currentHint = "Мешок полон — вынеси мусор!"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
                this.removeDebris(obj);
                data.trashCount++;
                data.addHistory("Подобран мусор. Мешок: " + data.trashCount + "/" + data.maxTrash);
                this.renderTrash();
                return;
            }
            if (userData.type === 'exit') {
                if (data.trashCount > 0) {
                    window.GameData.ui.currentHint = "Мусор вынесен!"; window.GameData.ui.hintVisible = true; this.renderHint();
                    data.trashCount = 0; data.addHistory("Мусор вынесен к выходу"); this.renderTrash();
                }
                return;
            }
            if (tool && userData.type && tool.actions && tool.actions[userData.type]) {
                if (data.stamina < this.staminaMinToWork) { window.GameData.ui.currentHint = "Нет сил! Отдохни"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
                data.stamina = Math.max(0, data.stamina - (tool.staminaCost || 0));
                this.renderStamina();
                tool.actions[userData.type](obj, this.lastHit);
                return;
            }
            if (typeof userData.interact === 'function') obj.userData.interact(obj, this.lastHit);
        },

        takeToolToHand: function (obj, userData) {
            var data = window.GameData;
            var side = data.giveItemToHand(userData.toolName, this.preferredHand);
            if (!side) { window.GameData.ui.currentHint = "Руки заняты, сначала освободи"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
            window.GameRenderer.attachToolToHand(obj, side);
            data.addHistory("Взято в " + this.handLabel(side) + " руку: " + userData.name);
            this.renderHeldItems();
        },

        dropFromHands: function () {
            var data = window.GameData;
            if (this.isCarryingBag()) { this.dropBagHere(); return; }
            var side = data.rightHand ? 'right' : (data.leftHand ? 'left' : null);
            if (!side) return;
            var mesh = window.GameRenderer.detachToolToGround(side);
            if (!mesh) { data.freeHand(side); this.renderHeldItems(); return; }
            data.freeHand(side);
            data.addHistory("Положено на пол: " + mesh.userData.name);
            this.renderHeldItems();
        },

        fillBucketAtSink: function (sink) {
            var data = window.GameData;
            var bucket = this.getBucketMesh();
            if (!bucket) { this.showHintText("Возьми ведро в руки"); return; }
            var ud = bucket.userData;
            if (ud.volumeUsed >= ud.volume) { this.showHintText("Ведро уже полно"); return; }
            ud.volumeUsed = ud.volume;
            ud.content = 'water';
            this.showHintText("Ведро наполнено (" + ud.volume + "л)");
            data.addHistory("Ведро наполнено водой: " + ud.volume + " л");
            this.renderHeldItems();
        },

        pourCanisterIntoBucket: function (can, userData) {
            var data = window.GameData;
            var bucket = this.getBucketMesh();
            if (!bucket) { this.showHintText("Возьми ведро в руки"); return; }
            var bud = bucket.userData;
            var kind = userData.type === 'glue_can' ? 'glue' : 'primer';
            if (bud.content && bud.content !== kind) { this.showHintText("В ведре уже другое содержимое"); return; }
            var room = bud.volume - bud.volumeUsed;
            var amount = Math.min(userData.volume || 5, room);
            if (amount <= 0) { this.showHintText("Ведро полно"); return; }
            bud.volumeUsed += amount; bud.content = kind; userData.volume -= amount;
            if (userData.volume <= 0) {
                window.GameRenderer.scene.remove(can);
                var idx = window.GameRenderer.interactableObjects.indexOf(can);
                if (idx !== -1) window.GameRenderer.interactableObjects.splice(idx, 1);
            }
            this.showHintText(kind === 'glue' ? "Клей перелит в ведро" : "Грунтовка перелита в ведро");
            data.addHistory("Перелито в ведро: " + amount + " л (" + kind + ")");
            this.renderHeldItems();
        },

        cutWallpaperPiece: function (roll) {
            var data = window.GameData;
            if (!data.handWith('knife')) { this.showHintText("Нужен нож"); return; }
            var piece = window.GameRenderer.createCutWallpaperPiece(roll.position.x, roll.position.z);
            if (!piece) return;
            data.addHistory("Отрезан кусок обоев");
            this.showHintText("Кусок обоев отрезан (1 × 2.7 м)");
        },

        getBucketMesh: function () { var side = window.GameData.handWith('bucket'); return side ? window.GameRenderer.heldToolMeshes[side] : null; },
        showHintText: function (text) { window.GameData.ui.currentHint = text; window.GameData.ui.hintVisible = true; this.renderHint(); },

        chargeRollerFromBucket: function (bucket) {
            var data = window.GameData;
            var ud = bucket.userData;
            if (!ud.content || ud.volumeUsed <= 0) { this.showHintText("Ведро пустое"); return; }
            data.rollerState = ud.content;
            ud.volumeUsed = Math.max(0, ud.volumeUsed - 0.5);
            this.showHintText("Валик заряжен: " + ud.content);
            data.addHistory("Валик заряжен из ведра: " + ud.content);
            this.renderHeldItems();
        },

        measureWall: function () {
            if (!this.lastHit) { this.showHintText("Наведи на стену"); return; }
            var dist = this.lastHit.distance.toFixed(2);
            this.showHintText("Расстояние до стены: " + dist + " м");
            window.GameData.addHistory("Замер рулеткой: " + dist + " м");
        },

        emptyDustpanIntoBag: function () {
            var data = window.GameData;
            if (data.trashCount >= data.maxTrash) { window.GameData.ui.currentHint = "Мешок полон! Вынеси сначала"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
            var transfer = Math.min(data.dustpanFill, data.maxTrash - data.trashCount);
            if (transfer <= 0) { window.GameData.ui.currentHint = "Мешок полон! Вынеси сначала"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
            data.trashCount += transfer; data.dustpanFill -= transfer;
            window.GameData.ui.currentHint = "Высыпано в мешок: " + transfer; window.GameData.ui.hintVisible = true; this.renderHint();
            data.addHistory("Совок высыпан в мешок: " + transfer + " кусков");
            this.renderTrash(); this.renderHeldItems();
        },

        removeDebris: function (obj) {
            var renderer = window.GameRenderer;
            renderer.scene.remove(obj);
            var idx = renderer.debrisObjects.indexOf(obj); if (idx !== -1) renderer.debrisObjects.splice(idx, 1);
            var iIdx = renderer.interactableObjects.indexOf(obj); if (iIdx !== -1) renderer.interactableObjects.splice(iIdx, 1);
        },

        resolveInteractable: function (obj) {
            var node = obj;
            while (node) { if (node.userData && (node.userData.interactive || node.userData.isDebris)) return node; node = node.parent; }
            return obj;
        },

        isCarryingBag: function () { var bag = window.GameRenderer.trashBag; return !!(bag && bag.userData.isCarried); },
        
        pickUpBag: function () {
            var bag = window.GameRenderer.trashBag; if (!bag) return;
            var data = window.GameData;
            var side = data.giveItemToHand('trashBag');
            if (!side) { window.GameData.ui.currentHint = "Руки заняты, сначала освободи"; window.GameData.ui.hintVisible = true; this.renderHint(); return; }
            bag.userData.isCarried = true; bag.userData.carriedSide = side; data.trashBagPosition = null;
            this.removeFromInteractables(bag);
            data.addHistory("Мешок взят в " + (side === 'right' ? 'правую' : 'левую') + " руку");
            this.updateHandsUI();
        },

        dropBagHere: function () {
            var bag = window.GameRenderer.trashBag;
            if (bag && bag.userData.carriedSide) { window.GameData.freeHand(bag.userData.carriedSide); bag.userData.carriedSide = null; }
            window.GameRenderer.dropTrashBag();
            window.GameData.addHistory("Мешок поставлен на пол");
            this.updateHandsUI();
        },

        emptyBagAtExit: function () {
            var data = window.GameData;
            data.trashCount = 0; data.addHistory("Мусор вынесен в мешке"); this.renderTrash();
            window.GameData.ui.currentHint = "Мусор вынесен!"; window.GameData.ui.hintVisible = true; this.renderHint();
        },

        removeFromInteractables: function (obj) { var list = window.GameRenderer.interactableObjects; var idx = list.indexOf(obj); if (idx !== -1) list.splice(idx, 1); },
        isNearExit: function () { var exit = window.GameRenderer.exitZone; if (!exit) return false; var cam = window.GameRenderer.camera; return Math.hypot(cam.position.x - exit.position.x, cam.position.z - exit.position.z) <= 1.5; },

        sweepDustpanAtAim: function (delta) {
            this.dustpanCooldown -= delta || 0; if (this.dustpanCooldown > 0) return;
            var data = window.GameData;
            if (data.stamina < this.staminaMinToWork) return;
            if (!this.lastHit || !this.lastHit.object.userData.isDebris) return;
            if (this.lastHit.distance > this.interactDistance) return;
            if (this.sweepWithDustpan(this.lastHit.object.position)) this.dustpanCooldown = 0.35;
        },

        sweepWithDustpan: function (point) {
            var renderer = window.GameRenderer; var data = window.GameData; var found = [], seen = [];
            function collectNear(list, point) {
                for (var i = list.length - 1; i >= 0; i--) {
                    var piece = list[i];
                    if (!piece.userData || !piece.userData.isDebris) continue;
                    if (seen.indexOf(piece) !== -1) continue;
                    if (piece.position.distanceTo(point) <= 1.0) { seen.push(piece); found.push(piece); }
                }
            }
            collectNear(renderer.debrisObjects, point); collectNear(renderer.interactableObjects, point);
            if (found.length < 3) return false;
            if (data.dustpanFill >= data.dustpanMax) { window.GameData.ui.currentHint = "Совок полон, вытряхни в мешок"; window.GameData.ui.hintVisible = true; this.renderHint(); return true; }
            var spaceInDustpan = data.dustpanMax - data.dustpanFill;
            var take = Math.min(spaceInDustpan, found.length);
            for (var j = 0; j < take; j++) {
                var piece = found[j]; renderer.scene.remove(piece);
                var dIdx = renderer.debrisObjects.indexOf(piece); if (dIdx !== -1) renderer.debrisObjects.splice(dIdx, 1);
                var iIdx = renderer.interactableObjects.indexOf(piece); if (iIdx !== -1) renderer.interactableObjects.splice(iIdx, 1);
            }
            data.dustpanFill += take;
            var dustpanTool = this.tools.dustpan; var cost = dustpanTool ? (dustpanTool.staminaCost || 0) : 0;
            data.stamina = Math.max(0, data.stamina - cost);
            data.addHistory("Совком собрано кусков: " + take + ". Совок: " + data.dustpanFill + "/" + data.dustpanMax);
            this.renderTrash(); this.renderStamina(); this.renderHeldItems();
            return true;
        },

        sweepWithBroom: function (delta) {
            if (!window.GameData.handWith('broom')) return;
            this.broomCooldown -= delta || 0; if (this.broomCooldown > 0) return;
            var renderer = window.GameRenderer; var data = window.GameData; var cam = renderer.camera;
            if (data.stamina < this.staminaMinToWork) return;
            if (!this.lastHit || !this.lastHit.object.userData.isDebris) return;
            if (this.lastHit.distance > this.interactDistance) return;
            var piece = this.lastHit.object; var vel = piece.userData.velocity; if (!vel) return;
            var dx = piece.position.x - cam.position.x; var dz = piece.position.z - cam.position.z;
            var len = Math.hypot(dx, dz); if (len < 0.001) return;
            vel.x += (dx / len) * 1.2; vel.z += (dz / len) * 1.2; vel.y += 0.4;
            if (renderer.debrisObjects.indexOf(piece) === -1) renderer.debrisObjects.push(piece);
            data.stamina = Math.max(0, data.stamina - 1); this.renderStamina(); this.broomCooldown = 0.25;
        },

        renderHeldItems: function () {
            var data = window.GameData;
            function label(name) {
                if (!name) return 'пусто';
                var icon = { scraper: '🖌️', roller: '🎨', broom: '🧹', dustpan: '🥄' }[name] || '';
                var titles = { scraper: 'скребок', roller: 'валик', broom: 'веник', dustpan: 'совок' }[name] || name;
                return (icon ? icon + ' ' : '') + titles;
            }
            var bagCarried = this.isCarryingBag();
            var rightText = bagCarried ? '🗑️ мешок' : label(data.rightHand);
            var leftText = bagCarried ? 'пусто' : label(data.leftHand);
            var text = 'Правая: ' + rightText + '\nЛевая: ' + leftText;
            if (data.handWith('dustpan')) text += '\n🥄 Совок: ' + data.dustpanFill + '/' + data.dustpanMax;
            window.GameRenderer.showHeldItem(text);
        },

        updateCarriedBag: function () {
            var bag = window.GameRenderer.trashBag; if (!bag || !bag.userData.isCarried) return;
            var cam = window.GameRenderer.camera;
            var forward = new THREE.Vector3(); cam.getWorldDirection(forward);
            var right = new THREE.Vector3(); right.crossVectors(forward, cam.up).normalize();
            bag.position.copy(cam.position).addScaledVector(forward, 0.75).addScaledVector(right, 0.35);
            bag.position.y -= 0.55; bag.rotation.y += 0.01;
        },

        kickNearbyTools: function (playerVelocity) {
            var cam = window.GameRenderer.camera; var list = window.GameRenderer.interactableObjects;
            for (var i = 0; i < list.length; i++) {
                var tool = list[i];
                if (!tool.userData || tool.userData.type !== 'tool' || tool.userData.isHeld) continue;
                var dx = cam.position.x - tool.position.x; var dz = cam.position.z - tool.position.z;
                if (Math.hypot(dx, dz) < 0.6) window.GameRenderer.kickTool(playerVelocity, tool);
            }
        },

        updateMovement: function (delta) {
            var cam = window.GameRenderer.camera; var data = window.GameData;
            var forwardX = -Math.sin(this.yaw), forwardZ = -Math.cos(this.yaw);
            var rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
            var mx = 0, mz = 0;
            if (this.keys.w) { mx += forwardX; mz += forwardZ; }
            if (this.keys.s) { mx -= forwardX; mz -= forwardZ; }
            if (this.keys.d) { mx += rightX; mz += rightZ; }
            if (this.keys.a) { mx -= rightX; mz -= rightZ; }
            var len = Math.hypot(mx, mz);
            if (len > 0) {
                var step = data.player.speed * delta; mx = (mx / len) * step; mz = (mz / len) * step;
                var newX = cam.position.x + mx, newZ = cam.position.z + mz;
                var halfW = data.world.roomWidth / 2 - this.playerRadius;
                var halfD = data.world.roomDepth / 2 - this.playerRadius;
                if (newX < -halfW) newX = -halfW; if (newX > halfW) newX = halfW;
                if (newZ < -halfD) newZ = -halfD; if (newZ > halfD) newZ = halfD;
                cam.position.x = newX; cam.position.z = newZ;
                var playerVel = new THREE.Vector3(mx / delta, 0, mz / delta);
                this.kickNearbyTools(playerVel);
            }
            cam.position.y = data.player.position.y;
            data.player.position.x = cam.position.x; data.player.position.z = cam.position.z;
        },

        updateRaycast: function () {
            var cam = window.GameRenderer.camera;
            this.raycaster.setFromCamera(this.rayCenter, cam);
            var intersects = this.raycaster.intersectObjects(window.GameRenderer.interactableObjects, true);
            if (intersects.length > 0) {
                this.lastHit = intersects[0];
                var userData = this.lastHit.object.userData || {};
                var resolved = this.resolveInteractable(this.lastHit.object);
                userData = resolved.userData || {};
                var hint = this.buildHint(userData);
                if (hint) {
                    window.GameData.ui.currentHint = this.lastHit.distance > this.interactDistance ? "Подойди ближе" : hint;
                    window.GameData.ui.hintVisible = true;
                } else { window.GameData.ui.currentHint = ""; window.GameData.ui.hintVisible = false; }
            } else { this.lastHit = null; window.GameData.ui.currentHint = ""; window.GameData.ui.hintVisible = false; }
            this.renderHint();
        },

        renderHint: function () {
            if (!this.hintEl) return;
            var ui = window.GameData.ui;
            if (ui.hintVisible && ui.currentHint) { this.hintEl.textContent = ui.currentHint; this.hintEl.classList.add('visible'); }
            else { this.hintEl.classList.remove('visible'); }
        },

        formatTool: function (tool) { return tool.icon ? tool.icon + " " + tool.label : tool.label; },
        updateHandsUI: function () { this.renderToolsPanel(); this.renderBagStatus(); this.renderHeldItems(); },
        
        renderBagStatus: function () {
            if (!this.bagStatusEl) return;
            var data = window.GameData; var full = data.trashCount >= data.maxTrash;
            this.bagStatusEl.textContent = 'Мешок: ' + data.trashCount + '/' + data.maxTrash + (full ? ' (ПОЛОН)' : '');
            if (full) this.bagStatusEl.classList.add('bag-full'); else this.bagStatusEl.classList.remove('bag-full');
        },

        renderStamina: function () {
            var data = window.GameData; var pct = Math.round((data.stamina / data.maxStamina) * 100);
            if (this.staminaFillEl) {
                this.staminaFillEl.style.width = pct + '%';
                if (pct > 60) this.staminaFillEl.style.background = '#4caf50';
                else if (pct > 25) this.staminaFillEl.style.background = '#ffc107';
                else this.staminaFillEl.style.background = '#f44336';
            }
            if (this.staminaTextEl) this.staminaTextEl.textContent = Math.round(data.stamina) + '/' + data.maxStamina;
        },

        renderTrash: function () {
            var data = window.GameData;
            if (this.trashEl) this.trashEl.textContent = 'Мусор: ' + data.trashCount + '/' + data.maxTrash;
            this.renderBagStatus();
        },

        renderToolsPanel: function () {
            if (!this.toolsPanelEl) return;
            var data = window.GameData; var parts = [];
            for (var key in this.tools) {
                if (!this.tools.hasOwnProperty(key)) continue;
                var text = this.formatTool(this.tools[key]);
                var inHands = (data.rightHand === key || data.leftHand === key);
                parts.push(inHands ? '<span class="tool-active">' + text + '</span>' : '<span class="tool-inactive">' + text + '</span>');
            }
            this.toolsPanelEl.innerHTML = parts.join(" | ") + '<br>E — взять/положить | Q — положить предмет';
        },

        updateStamina: function (delta) {
            var data = window.GameData;
            var moving = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
            if (moving || this.sweeping) return;
            if (data.stamina >= data.maxStamina) return;
            data.stamina = Math.min(data.maxStamina, data.stamina + this.staminaRegenPerSec * delta);
            var rounded = Math.round(data.stamina);
            if (rounded !== this.lastRenderedStamina) { this.lastRenderedStamina = rounded; this.renderStamina(); }
        },

        loop: function () {
            requestAnimationFrame(function () { window.GameLogic.loop(); });
            var delta = window.GameRenderer.clock.getDelta();
            if (delta > 0.1) delta = 0.1;
            this.updateMovement(delta); this.updateStamina(delta);
            window.GameRenderer.camera.rotation.y = this.yaw;
            window.GameRenderer.camera.rotation.x = this.pitch;
            window.GameRenderer.updateHeldTools();
            this.updateCarriedBag();
            if (this.sweeping) {
                this.sweepWithBroom(delta);
                if (window.GameData.handWith('dustpan')) this.sweepDustpanAtAim(delta);
            }
            window.GameRenderer.updateDebris(delta);
            window.GameRenderer.applyGravityToTools(delta);
            window.GameRenderer.updateBagVisual();
            this.updateRaycast();
            window.GameRenderer.render();
        }
    };
    window.GameLogic.init();
})();