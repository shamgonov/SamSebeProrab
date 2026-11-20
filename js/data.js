/* ==========================================
js/data.js
Глобальное состояние игры (GameState).
========================================== */
(function () {
    "use strict";
    window.GameData = {
        world: { roomWidth: 5, roomHeight: 3, roomDepth: 4 },
        player: { position: { x: 0, y: 1.7, z: 1.5 }, speed: 4.0 },
        ui: { currentHint: "", hintVisible: false },
        inventory: [],
        stamina: 100, maxStamina: 100,
        trashCount: 0, maxTrash: 1000,
        trashBagPosition: null,
        rightHand: null, leftHand: null,
        dustpanFill: 0, dustpanMax: 50,
        rollerState: null,

        wallpaperRollMeters: 10,
        glueLiters: 5,
        primerLiters: 5,

        toolWetUntil: 0,
        wetItems: {},
        rustLevel: 0,

        giveItemToHand: function (itemName, preferredSide) {
            var first = preferredSide === 'left' ? 'left' : 'right';
            var second = first === 'right' ? 'left' : 'right';
            if (this[first + 'Hand'] === null) { this[first + 'Hand'] = itemName; return first; }
            if (this[second + 'Hand'] === null) { this[second + 'Hand'] = itemName; return second; }
            return null;
        },
        freeHand: function (side) {
            if (side === 'right') this.rightHand = null;
            else if (side === 'left') this.leftHand = null;
        },
        handWith: function (itemName) {
            if (this.rightHand === itemName) return 'right';
            if (this.leftHand === itemName) return 'left';
            return null;
        },
        currentTool: 'scraper',
        switchTool: function (toolName) { this.currentTool = toolName; },
        history: [],
        addHistory: function (action) {
            this.history.push({ time: Date.now(), action: action });
            console.log("[DATA]", action);
        }
    };
})();