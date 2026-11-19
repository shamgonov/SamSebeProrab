/* ==========================================
   js/game.js
   Ð˜Ð³Ñ€Ð¾Ð²Ð°Ñ Ð»Ð¾Ð³Ð¸ÐºÐ°: Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ, Ð¾Ð±Ð·Ð¾Ñ€ Ð¼Ñ‹ÑˆÑŒÑŽ,
   ÐºÐ¾Ð»Ð»Ð¸Ð·Ð¸Ð¸ Ð¸ ÑÐ¸ÑÑ‚ÐµÐ¼Ð° Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ (Raycaster).
   Ð—Ð´ÐµÑÑŒ Ð½ÐµÑ‚ ÐºÐ¾Ð´Ð° Ð¾Ñ‚Ñ€Ð¸ÑÐ¾Ð²ÐºÐ¸ â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÑƒÐ¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ
   ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸ÐµÐ¼ GameData Ð¸ ÐºÐ°Ð¼ÐµÑ€Ð¾Ð¹ GameRenderer.
   ========================================== */

(function () {
    "use strict";

    window.GameLogic = {
        // Ð¡Ð¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ ÐºÐ»Ð°Ð²Ð¸Ñˆ (e.code, Ð° Ð½Ðµ e.key â€” Ð½Ðµ Ð·Ð°Ð²Ð¸ÑÐ¸Ñ‚ Ð¾Ñ‚ Ñ€Ð°ÑÐºÐ»Ð°Ð´ÐºÐ¸)
        keys: { w: false, a: false, s: false, d: false },

        // Ð—Ð°Ñ…Ð²Ð°Ñ‡ÐµÐ½ Ð»Ð¸ ÐºÑƒÑ€ÑÐ¾Ñ€
        isLocked: false,

        // Ð—Ð°Ð¶Ð°Ñ‚Ð° Ð»Ð¸ Ð›ÐšÐœ (Ð´Ð»Ñ Ð¿Ð¾Ð´Ð¼ÐµÑ‚Ð°Ð½Ð¸Ñ Ð²ÐµÐ½Ð¸ÐºÐ¾Ð¼)
        sweeping: false,

        // ÐšÑƒÐ»Ð´Ð°ÑƒÐ½ Ð¼ÐµÑ‚ÐµÐ½Ð¸Ñ: Ð½Ðµ Ð´Ð°Ñ‘Ð¼ Ñ‚Ñ€Ð°Ñ‚Ð¸Ñ‚ÑŒ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñƒ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€
        broomCooldown: 0,

        // ÐšÑƒÐ»Ð´Ð°ÑƒÐ½ ÑÐ±Ð¾Ñ€Ð° ÑÐ¾Ð²ÐºÐ¾Ð¼ Ð¿Ð¾ Ð·Ð°Ð¶Ð°Ñ‚Ð¾Ð¹ Ð›ÐšÐœ
        dustpanCooldown: 0,

        // Ð£Ð³Ð»Ñ‹ Ð¾Ð±Ð·Ð¾Ñ€Ð°
        yaw: 0,     // Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð²Ð¾ÐºÑ€ÑƒÐ³ Y (Ð²Ð»ÐµÐ²Ð¾/Ð²Ð¿Ñ€Ð°Ð²Ð¾)
        pitch: 0,   // Ð½Ð°ÐºÐ»Ð¾Ð½ Ð²Ð²ÐµÑ€Ñ…/Ð²Ð½Ð¸Ð·
        pitchLimit: Math.PI / 2 - 0.05, // Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð½ÐµÐ»ÑŒÐ·Ñ Ð±Ñ‹Ð»Ð¾ Ð·Ð°Ð´Ñ€Ð°Ñ‚ÑŒ Ð³Ð¾Ð»Ð¾Ð²Ñƒ Ð·Ð° Ð²ÐµÑ€Ñ‚Ð¸ÐºÐ°Ð»ÑŒ
        mouseSensitivity: 0.002,

        // ÐŸÐ°Ñ€Ð°Ð¼ÐµÑ‚Ñ€Ñ‹ Ð¸Ð³Ñ€Ð¾ÐºÐ° Ð´Ð»Ñ ÐºÐ¾Ð»Ð»Ð¸Ð·Ð¸Ð¹
        playerRadius: 0.35, // Â«Ñ€Ð°Ð´Ð¸ÑƒÑ Ñ‚ÐµÐ»Ð°Â» â€” Ð¾Ñ‚ÑÑ‚ÑƒÐ¿ Ð¾Ñ‚ ÑÑ‚ÐµÐ½

        // ÐŸÑ€ÐµÐ´Ð¿Ð¾Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼Ð°Ñ Ñ€ÑƒÐºÐ° Ð´Ð»Ñ Ð²Ð·ÑÑ‚Ð¸Ñ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð¾Ð² (Tab Ð¼ÐµÐ½ÑÐµÑ‚)
        preferredHand: 'right',

        // Raycaster Ð¸ ÐµÐ³Ð¾ Ð¿Ð°Ñ€Ð°Ð¼ÐµÑ‚Ñ€Ñ‹
        raycaster: null,
        rayCenter: null,   // Ð²ÐµÐºÑ‚Ð¾Ñ€ (0,0) = Ñ†ÐµÐ½Ñ‚Ñ€ ÑÐºÑ€Ð°Ð½Ð°, Ð¿ÐµÑ€ÐµÐ¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÑ‚ÑÑ Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð½Ðµ Ð°Ð»Ð»Ð¾Ñ†Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€
        lastHit: null,     // Ð¿Ð¾ÑÐ»ÐµÐ´Ð½ÐµÐµ Ð¿ÐµÑ€ÐµÑÐµÑ‡ÐµÐ½Ð¸Ðµ Ñ Ð¸Ð½Ñ‚ÐµÑ€Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¼ Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð¼

        // Ð”Ð°Ð»ÑŒÐ½Ð¾ÑÑ‚ÑŒ, Ñ ÐºÐ¾Ñ‚Ð¾Ñ€Ð¾Ð¹ Ð¸Ð³Ñ€Ð¾Ðº Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾ Ð¼Ð¾Ð¶ÐµÑ‚ Ñ‡Ñ‚Ð¾-Ñ‚Ð¾ ÑÐ´ÐµÐ»Ð°Ñ‚ÑŒ.
        // Ð¡Ð°Ð¼ Ð»ÑƒÑ‡ Ð¿ÑƒÑÐºÐ°ÐµÐ¼ Ð´Ð°Ð»ÑŒÑˆÐµ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÑƒÑÐ¿ÐµÑ‚ÑŒ Ð¿Ð¾ÐºÐ°Ð·Ð°Ñ‚ÑŒ "ÐŸÐ¾Ð´Ð¾Ð¹Ð´Ð¸ Ð±Ð»Ð¸Ð¶Ðµ"
        interactDistance: 2.5,
        rayFar: 6,         // Ð´Ð»Ð¸Ð½Ð° Ð»ÑƒÑ‡Ð°: Ð²Ð¸Ð´Ð¸Ð¼ ÑÑ‚ÐµÐ½Ñƒ Ð¸ Ð¸Ð·Ð´Ð°Ð»ÐµÐºÐ°

        // ==========================================
        // Ð˜Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹
        // actions â€” ÐºÐ°Ñ€Ñ‚Ð° Â«Ñ‚Ð¸Ð¿ Ñ†ÐµÐ»Ð¸ â†’ Ñ‡Ñ‚Ð¾ Ð´ÐµÐ»Ð°ÐµÐ¼Â». Ð”ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Ð·Ð°Ð²Ð¸ÑÐ¸Ñ‚ Ð¾Ñ‚
        // Ð¿Ð°Ñ€Ñ‹ (Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚, Ñ†ÐµÐ»ÑŒ), Ð¿Ð¾ÑÑ‚Ð¾Ð¼Ñƒ Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ð° Ð¶Ð¸Ð²Ñ‘Ñ‚ Ð² Ð»Ð¾Ð³Ð¸ÐºÐµ,
        // Ð° Ð² GameData Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¸Ð¼Ñ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ð¾Ð³Ð¾ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð°.
        // ==========================================
        tools: {
            scraper: {
                hotkey: '1',
                label: 'Ð¡ÐºÑ€ÐµÐ±Ð¾Ðº',
                speed: 1.0, // Ð·Ð°Ð³Ð¾Ñ‚Ð¾Ð²ÐºÐ° â€” Ð±Ð°Ð»Ð°Ð½ÑÐ¸Ñ€Ð¾Ð²ÐºÐ°, ÐºÐ¾Ð³Ð´Ð° Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð¾Ð² ÑÑ‚Ð°Ð½ÐµÑ‚ 5-6
                staminaCost: 5, // ÐµÐ´Ð¸Ð½Ð¸Ñ† ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹ Ð·Ð° Ð¾Ð´Ð½Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ
                actions: {
                    wallpaper: function (obj, hit) {
                        // ÐŸÐ¾ Ñ€Ð°Ð·Ð¼Ð¾Ñ‡ÐµÐ½Ð½Ñ‹Ð¼ Ð¾Ð±Ð¾ÑÐ¼ Ð¿Ð¾Ð»Ð¾Ñ‚Ð½Ð¾ ÑÑ…Ð¾Ð´Ð¸Ñ‚ Ð²Ñ‚Ñ€Ð¾Ðµ Ð±Ñ‹ÑÑ‚Ñ€ÐµÐµ:
                        // Ð¾Ð´Ð½Ð¾ Ð½Ð°Ð¶Ð°Ñ‚Ð¸Ðµ ÑÑ€Ñ‹Ð²Ð°ÐµÑ‚ ÑÑ€Ð°Ð·Ñƒ Ñ‚Ñ€Ð¸ ÑƒÑ‡Ð°ÑÑ‚ÐºÐ°
                        var passes = obj.userData.wet ? 3 : 1;

                        for (var i = 0; i < passes; i++) {
                            window.GameRenderer.tearWallpaper(obj, hit.point, hit.uv);
                        }

                        if (obj.userData.wet) {
                            window.GameData.addHistory("ÐœÐ¾ÐºÑ€Ñ‹Ðµ Ð¾Ð±Ð¾Ð¸ ÑÐ¾ÑˆÐ»Ð¸ Ð±Ñ‹ÑÑ‚Ñ€ÐµÐµ");
                        }
                    }
                },
                // Ð§Ñ‚Ð¾ Ð¿Ð¸ÑˆÐµÐ¼ Ð² Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐµ Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ Ñ‚Ð¸Ð¿Ð° Ñ†ÐµÐ»Ð¸
                hints: { wallpaper: 'E - ÐžÑ‚Ð¾Ñ€Ð²Ð°Ñ‚ÑŒ' }
            },
            roller: {
                hotkey: '2',
                label: 'Ð’Ð°Ð»Ð¸Ðº',
                speed: 1.0, // Ð·Ð°Ð³Ð¾Ñ‚Ð¾Ð²ÐºÐ° â€” Ð±Ð°Ð»Ð°Ð½ÑÐ¸Ñ€Ð¾Ð²ÐºÐ° Ð¿Ð¾Ð·Ð¶Ðµ
                staminaCost: 2,
                actions: {
                    wallpaper: function (obj, hit) {
                        var data = window.GameData;

                        // Ð’Ð°Ð»Ð¸Ðº Ð² Ð²ÐµÐ´Ñ€Ðµ Ñ Ð²Ð¾Ð´Ð¾Ð¹/Ð³Ñ€ÑƒÐ½Ñ‚Ð¾Ð²ÐºÐ¾Ð¹/ÐºÐ»ÐµÐµÐ¼ Ð·Ð°Ñ€ÑÐ¶Ð°ÐµÑ‚ÑÑ
                        // (Ð·Ð°Ñ€ÑÐ´ÐºÐ° â€” Ð² handleInteraction Ð¿Ñ€Ð¸ E Ð½Ð° Ð²ÐµÐ´Ñ€Ðµ).
                        // ÐÐ° ÑÑ‚ÐµÐ½Ðµ: Ð²Ð¾Ð´Ð° Ð¼Ð¾Ñ‡Ð¸Ñ‚ Ð¾Ð±Ð¾Ð¸, Ð³Ñ€ÑƒÐ½Ñ‚Ð¾Ð²ÐºÐ° ÐºÑ€Ð°ÑÐ¸Ñ‚ Ð±ÐµÑ‚Ð¾Ð½,
                        // ÐºÐ»ÐµÐ¹ Ð³Ð¾Ñ‚Ð¾Ð²Ð¸Ñ‚ Ð¿Ð¾Ð»Ð¾Ñ‚Ð½Ð¾ Ðº Ð¿Ð¾ÐºÐ»ÐµÐ¹ÐºÐµ.
                        if (data.rollerState === 'water') {
                            obj.userData.wet = true;
                            window.GameData.addHistory("ÐžÐ±Ð¾Ð¸ Ñ€Ð°Ð·Ð¼Ð¾Ñ‡ÐµÐ½Ñ‹ Ð²Ð°Ð»Ð¸ÐºÐ¾Ð¼");
                            return;
                        }

                        if (data.rollerState === 'primer') {
                            window.GameRenderer.primerWall(obj, hit.point, hit.uv);
                            return;
                        }

                        if (data.rollerState === 'glue') {
                            window.GameRenderer.glueWall(obj, hit.point, hit.uv);
                            return;
                        }

                        window.GameRenderer.paintWall(obj, hit.point, hit.uv);
                    }
                },
                hints: { wallpaper: 'E - ÐŸÐ¾ÐºÑ€Ð°ÑÐ¸Ñ‚ÑŒ' }
            },
            hands: {
                hotkey: '3',
                label: 'Ð ÑƒÐºÐ¸',
                icon: 'âœ‹',
                speed: 1.0, // Ð·Ð°Ð³Ð¾Ñ‚Ð¾Ð²ÐºÐ°: Ñ€ÑƒÐºÐ¸ Ð´Ð¾Ð»Ð¶Ð½Ñ‹ ÑÑ‚Ð°Ñ‚ÑŒ Ð¼ÐµÐ´Ð»ÐµÐ½Ð½ÐµÐµ ÑÐºÑ€ÐµÐ±ÐºÐ°
                staminaCost: 10,
                actions: {
                    // ÐŸÐ¾ÐºÐ° Ñ‚Ð¾ Ð¶Ðµ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ, Ñ‡Ñ‚Ð¾ Ñƒ ÑÐºÑ€ÐµÐ±ÐºÐ°. ÐžÑ‚Ð»Ð¸Ñ‡Ð¸Ñ (Ñ€Ð²Ð°Ð½Ñ‹Ðµ
                    // ÐºÑ€Ð°Ñ, ÑÐºÐ¾Ñ€Ð¾ÑÑ‚ÑŒ) Ð½Ð°Ð²ÐµÑˆÐ¸Ð²Ð°ÐµÐ¼ Ð¿Ð¾ÑÐ»Ðµ Ð¿Ð¾ÑÐ²Ð»ÐµÐ½Ð¸Ñ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹.
                    wallpaper: function (obj, hit) {
                        window.GameRenderer.tearWallpaper(obj, hit.point, hit.uv);
                    }
                },
                hints: { wallpaper: 'E - ÐžÑ‚Ñ€Ñ‹Ð²Ð°Ñ‚ÑŒ Ñ€ÑƒÐºÐ°Ð¼Ð¸' }
            },
            broom: {
                hotkey: '4',
                label: 'Ð’ÐµÐ½Ð¸Ðº',
                icon: 'ðŸ§¹',
                speed: 1.0,
                staminaCost: 1, // Ð¼ÐµÑ‚Ñ‘Ð¼ â€” Ð¿Ð¾Ñ‡Ñ‚Ð¸ Ð½Ðµ ÑƒÑÑ‚Ð°Ñ‘ÑˆÑŒ
                actions: {},    // Ð¿Ð¾Ð´Ð¼ÐµÑ‚Ð°Ð½Ð¸Ðµ Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÐµÑ‚ Ð½Ð° Ð›ÐšÐœ, Ð½Ðµ Ð½Ð° E
                hints: {}
            },
            dustpan: {
                hotkey: '5',
                label: 'Ð¡Ð¾Ð²Ð¾Ðº',
                icon: 'ðŸ¥„',
                speed: 1.0,
                staminaCost: 2,
                actions: {},
                hints: {}
            },
            // ==========================================
            // ÐŸÑ€ÐµÐ´Ð¼ÐµÑ‚Ñ‹ Ð´Ð»Ñ ÑˆÐ¿Ð°ÐºÐ»Ñ‘Ð²Ð¾Ñ‡Ð½Ñ‹Ñ… Ñ€Ð°Ð±Ð¾Ñ‚. ÐšÐ»Ð°Ð²Ð¸Ñˆ Ð½ÐµÑ‚: Ð±ÐµÑ€ÑƒÑ‚ÑÑ Ñ Ð¿Ð¾Ð»Ð° Ð¿Ð¾ E.
            // ==========================================
            bucket: {
                label: 'Ð’ÐµÐ´Ñ€Ð¾',
                icon: 'ðŸª£',
                speed: 1.0,
                staminaCost: 0,
                actions: {},
                hints: {}
            },
            primer_roller: {
                label: 'Ð’Ð°Ð»Ð¸Ðº Ñ Ð³Ñ€ÑƒÐ½Ñ‚Ð¾Ð²ÐºÐ¾Ð¹',
                icon: 'ðŸŽ¨',
                speed: 1.0,
                staminaCost: 2,
                actions: {},
                hints: {}
            },
            wallpaper_roll: {
                label: 'Ð ÑƒÐ»Ð¾Ð½ Ð¾Ð±Ð¾ÐµÐ²',
                icon: 'ðŸ§»',
                speed: 1.0,
                staminaCost: 0,
                actions: {},
                hints: {}
            },
            knife: {
                label: 'ÐÐ¾Ð¶',
                icon: 'ðŸ”ª',
                speed: 1.0,
                staminaCost: 1,
                actions: {},
                hints: {}
            },
            glue_can: {
                label: 'ÐšÐ»ÐµÐ¹',
                icon: 'ðŸŸ¡',
                speed: 1.0,
                staminaCost: 0,
                actions: {},
                hints: {}
            },
            tape_measure: {
                label: 'Ð ÑƒÐ»ÐµÑ‚ÐºÐ°',
                icon: 'ðŸ“',
                speed: 1.0,
                staminaCost: 0,
                actions: {},
                hints: {}
            }
        },

        // ÐŸÐ¾Ñ€Ð¾Ð³ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹, Ð½Ð¸Ð¶Ðµ ÐºÐ¾Ñ‚Ð¾Ñ€Ð¾Ð³Ð¾ Ñ€Ð°Ð±Ð¾Ñ‚Ð° Ð½Ðµ Ð¸Ð´Ñ‘Ñ‚: Ð¸Ð³Ñ€Ð¾Ðº Ð´Ð¾Ð»Ð¶ÐµÐ½ Ð¾Ñ‚Ð´Ð¾Ñ…Ð½ÑƒÑ‚ÑŒ
        staminaMinToWork: 10,

        // Ð¡ÐºÐ¾Ñ€Ð¾ÑÑ‚ÑŒ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ, ÐµÐ´Ð¸Ð½Ð¸Ñ† Ð² ÑÐµÐºÑƒÐ½Ð´Ñƒ.
        // 12/ÑÐµÐº â€” ÑÑ‚Ð¾ Ñ‚Ðµ Ð¶Ðµ 0.2 Ð·Ð° ÐºÐ°Ð´Ñ€ Ð¿Ñ€Ð¸ 60 FPS, Ð½Ð¾ Ð¿Ñ€Ð¸Ð²ÑÐ·ÐºÐ° Ðº delta
        // Ð´ÐµÐ»Ð°ÐµÑ‚ Ñ€ÐµÐ³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸ÑŽ Ð½Ðµ Ð·Ð°Ð²Ð¸ÑÑÑ‰ÐµÐ¹ Ð¾Ñ‚ Ñ‡Ð°ÑÑ‚Ð¾Ñ‚Ñ‹ ÐºÐ°Ð´Ñ€Ð¾Ð².
        staminaRegenPerSec: 12,

        // ÐŸÐ¾ÑÐ»ÐµÐ´Ð½ÐµÐµ Ð²Ñ‹Ð²ÐµÐ´ÐµÐ½Ð½Ð¾Ðµ Ð² HUD Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹ (Ð¾ÐºÑ€ÑƒÐ³Ð»Ñ‘Ð½Ð½Ð¾Ðµ).
        // ÐÑƒÐ¶Ð½Ð¾, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð½Ðµ Ð¿Ð¸ÑÐ°Ñ‚ÑŒ Ð² DOM ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€.
        lastRenderedStamina: 100,

        // ÐšÐ¾Ð½Ñ‚ÐµÐ¹Ð½ÐµÑ€ Ð´Ð¸Ð½Ð°Ð¼Ð¸Ñ‡ÐµÑÐºÐ¾Ð³Ð¾ ÑÐ¿Ð¸ÑÐºÐ° Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð¾Ð² Ð² info-panel
        toolsPanelEl: null,

        // Ð­Ð»ÐµÐ¼ÐµÐ½Ñ‚Ñ‹ HUD: Ð¿Ð¾Ð»Ð¾ÑÐ° ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹ Ð¸ ÑÑ‡Ñ‘Ñ‚Ñ‡Ð¸Ðº Ð¼ÑƒÑÐ¾Ñ€Ð°
        staminaFillEl: null,
        staminaTextEl: null,
        trashEl: null,

        // Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ð¼ÐµÑˆÐºÐ° Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð¼ Ð½Ð¸Ð¶Ð½ÐµÐ¼ ÑƒÐ³Ð»Ñƒ
        bagStatusEl: null,

        // Ð­Ð»ÐµÐ¼ÐµÐ½Ñ‚Ñ‹ DOM Ð´Ð»Ñ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ UI
        hintEl: null,

        /** Ð¢Ð¾Ñ‡ÐºÐ° Ð²Ñ…Ð¾Ð´Ð°. */
        init: function () {
            this.raycaster = new THREE.Raycaster();
            // Ð›ÑƒÑ‡ Ð´Ð»Ð¸Ð½Ð½ÐµÐµ Ð´Ð¸ÑÑ‚Ð°Ð½Ñ†Ð¸Ð¸ Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ: Ð¸Ð½Ð°Ñ‡Ðµ Ð¼Ñ‹ Ð²Ð¾Ð¾Ð±Ñ‰Ðµ Ð½Ðµ
            // ÑƒÐ²Ð¸Ð´Ð¸Ð¼ ÑÑ‚ÐµÐ½Ñƒ Ð¸Ð·Ð´Ð°Ð»ÐµÐºÐ° Ð¸ Ð½Ðµ ÑÐ¼Ð¾Ð¶ÐµÐ¼ Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ð°Ñ‚ÑŒ "ÐŸÐ¾Ð´Ð¾Ð¹Ð´Ð¸ Ð±Ð»Ð¸Ð¶Ðµ"
            this.raycaster.far = this.rayFar;

            this.rayCenter = new THREE.Vector2(0, 0);

            // ÐšÑÑˆ DOM-ÑÐ»ÐµÐ¼ÐµÐ½Ñ‚Ð¾Ð² (Ð¾Ð±Ñ€Ð°Ñ‰Ð°Ñ‚ÑŒÑÑ Ðº Ð½Ð¸Ð¼ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€ Ð´Ð¾Ñ€Ð¾Ð³Ð¾)
            this.hintEl = document.getElementById('action-hint');
            this.toolsPanelEl = document.getElementById('tools-panel');
            this.staminaFillEl = document.getElementById('stamina-fill');
            this.staminaTextEl = document.getElementById('stamina-text');
            this.trashEl = document.getElementById('trash-count');
            this.bagStatusEl = document.getElementById('bag-status');

            // ÐŸÐ¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚, Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ð¿Ð¾ ÑƒÐ¼Ð¾Ð»Ñ‡Ð°Ð½Ð¸ÑŽ
            this.updateHandsUI();
            this.renderStamina();
            this.renderTrash();

            this.setupInput();
            this.loop();
        },

        /**
         * ÐÐ°Ð²ÐµÑˆÐ¸Ð²Ð°ÐµÑ‚ Ð²ÑÐµ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚Ñ‡Ð¸ÐºÐ¸ Ð²Ð²Ð¾Ð´Ð°.
         * ÐžÐ´Ð¸Ð½ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚Ñ‡Ð¸Ðº 'E' Ð½Ð° Ð²ÑÑŽ Ð¸Ð³Ñ€Ñƒ â€” Ð¸Ð¼ÐµÐ½Ð½Ð¾ Ð¾Ð½ Ñ€Ð¾ÑƒÑ‚Ð¸Ñ‚
         * Ð½Ð°Ð¶Ð°Ñ‚Ð¸Ðµ Ðº ÐºÐ¾Ð½ÐºÑ€ÐµÑ‚Ð½Ð¾Ð¼Ñƒ Ð¾Ð±ÑŠÐµÐºÑ‚Ñƒ. ÐÐ¾Ð²Ñ‹Ðµ Ð¼ÐµÑ…Ð°Ð½Ð¸ÐºÐ¸ (Ð¿Ð»Ñ‘Ð½ÐºÐ°,
         * Ð¿Ð»Ð°ÑÑ‚Ð¸Ð½Ñ‹, Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚) Ð´Ð¾Ð±Ð°Ð²Ð»ÑÑŽÑ‚ ÑÐ²Ð¾Ð¹ interact() Ð²
         * userData Ð¸ Ð½Ð¸Ñ‡ÐµÐ³Ð¾ Ð² game.js Ð¼ÐµÐ½ÑÑ‚ÑŒ Ð½Ðµ Ð½ÑƒÐ¶Ð½Ð¾.
         */
        setupInput: function () {
            var self = this;

            // --- ÐšÐ»Ð°Ð²Ð¸Ð°Ñ‚ÑƒÑ€Ð°: Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ, Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ, Ð²Ñ‹Ð±Ð¾Ñ€ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð° ---
            document.addEventListener('keydown', function (e) {
                switch (e.code) {
                    case 'KeyW': self.keys.w = true; break;
                    case 'KeyA': self.keys.a = true; break;
                    case 'KeyS': self.keys.s = true; break;
                    case 'KeyD': self.keys.d = true; break;
                    case 'KeyE': self.handleInteraction(); break;
                    case 'KeyQ': self.dropFromHands(); break;
                    // Tab â€” Ð¿ÐµÑ€ÐµÐºÐ»ÑŽÑ‡Ð¸Ñ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¿Ð¾Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼ÑƒÑŽ Ñ€ÑƒÐºÑƒ
                    case 'Tab':
                        e.preventDefault(); // Ð¸Ð½Ð°Ñ‡Ðµ ÑƒÐ¹Ð´Ñ‘Ñ‚ Ñ„Ð¾ÐºÑƒÑ Ð½Ð° Ð´Ñ€ÑƒÐ³Ð¾Ð¹ ÑÐ»ÐµÐ¼ÐµÐ½Ñ‚
                        self.togglePreferredHand();
                        break;
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

            // --- Ð—Ð°Ñ…Ð²Ð°Ñ‚ ÐºÑƒÑ€ÑÐ¾Ñ€Ð° Ð¿Ð¾ ÐºÐ»Ð¸ÐºÑƒ (Pointer Lock API) ---
            var canvas = window.GameRenderer.renderer.domElement;
            document.addEventListener('click', function () {
                if (!self.isLocked) {
                    canvas.requestPointerLock();
                }
            });

            // --- Ð›ÐšÐœ: Ð¿Ð¾Ð´Ð¼ÐµÑ‚Ð°Ð½Ð¸Ðµ Ð²ÐµÐ½Ð¸ÐºÐ¾Ð¼ ---
            // Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ mousedown/mouseup, Ð° Ð½Ðµ click: click ÑÑ€Ð°Ð±Ð°Ñ‚Ñ‹Ð²Ð°ÐµÑ‚
            // ÑƒÐ¶Ðµ Ð¿Ð¾ÑÐ»Ðµ Ð¾Ñ‚Ð¿ÑƒÑÐºÐ°Ð½Ð¸Ñ, Ð° Ð¼ÐµÑ‚ÐµÐ½Ð¸Ðµ Ð½ÑƒÐ¶Ð½Ð¾ Â«Ð¿Ð¾ÐºÐ° Ð·Ð°Ð¶Ð°Ñ‚Ð¾Â»
            document.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                if (!self.isLocked) return;
                self.sweeping = true;
            });

            document.addEventListener('mouseup', function (e) {
                if (e.button !== 0) return;
                self.sweeping = false;
            });

            document.addEventListener('pointerlockchange', function () {
                self.isLocked = (document.pointerLockElement === canvas);
            });

            // --- ÐžÐ±Ð·Ð¾Ñ€ Ð¼Ñ‹ÑˆÑŒÑŽ: Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÐºÐ° ÐºÑƒÑ€ÑÐ¾Ñ€ Ð·Ð°Ñ…Ð²Ð°Ñ‡ÐµÐ½ ---
            // ESC Ð¾ÑÐ²Ð¾Ð±Ð¾Ð¶Ð´Ð°ÐµÑ‚ ÐºÑƒÑ€ÑÐ¾Ñ€ ÑˆÑ‚Ð°Ñ‚Ð½Ð¾, Ñ‡ÐµÑ€ÐµÐ· Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€
            document.addEventListener('mousemove', function (e) {
                if (!self.isLocked) return;

                self.yaw -= e.movementX * self.mouseSensitivity;
                self.pitch -= e.movementY * self.mouseSensitivity;

                // ÐžÐ³Ñ€Ð°Ð½Ð¸Ñ‡ÐµÐ½Ð¸Ðµ Ð½Ð°ÐºÐ»Ð¾Ð½Ð°, Ð¸Ð½Ð°Ñ‡Ðµ ÐºÐ°Ð¼ÐµÑ€Ð° Â«Ð¿ÐµÑ€ÐµÐ²Ð¾Ñ€Ð°Ñ‡Ð¸Ð²Ð°ÐµÑ‚ÑÑÂ»
                self.pitch = Math.max(-self.pitchLimit, Math.min(self.pitchLimit, self.pitch));
            });
        },

        /**
         * Ð’Ñ‹Ð±Ñ€Ð°Ñ‚ÑŒ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ Ð¿Ð¾ Ð³Ð¾Ñ€ÑÑ‡ÐµÐ¹ ÐºÐ»Ð°Ð²Ð¸ÑˆÐµ.
         * Ð£Ð”ÐÐ›Ð•ÐÐž Ð¸Ð· Ð¸Ð³Ñ€Ñ‹: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ðµ Ð¿ÐµÑ€ÐµÐºÐ»ÑŽÑ‡Ð°ÑŽÑ‚ÑÑ ÐºÐ»Ð°Ð²Ð¸ÑˆÐ°Ð¼Ð¸,
         * Ð¸Ñ… Ð±ÐµÑ€ÑƒÑ‚ Ñ Ð¿Ð¾Ð»Ð°. ÐœÐµÑ‚Ð¾Ð´ Ð¾ÑÑ‚Ð°Ð²Ð»ÐµÐ½ ÐºÐ°Ðº Ð·Ð°Ð³Ð»ÑƒÑˆÐºÐ°, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÑÑ‚Ð°Ñ€Ñ‹Ðµ
         * Ð²Ñ‹Ð·Ð¾Ð²Ñ‹ Ð½Ðµ Ð¿Ð°Ð´Ð°Ð»Ð¸ Ñ TypeError.
         * @param {string} toolKey
         */
        pickTool: function (toolKey) {
            console.warn("[GAME] pickTool ÑƒÑÑ‚Ð°Ñ€ÐµÐ»: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ Ð±ÐµÑ€ÑƒÑ‚ÑÑ Ñ Ð¿Ð¾Ð»Ð° Ð¿Ð¾ E");
        },

        /**
         * ÐŸÐµÑ€ÐµÐºÐ»ÑŽÑ‡Ð¸Ñ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¿Ð¾Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼ÑƒÑŽ Ñ€ÑƒÐºÑƒ (Tab).
         * Ð’Ð»Ð¸ÑÐµÑ‚ Ð½Ð° Ñ‚Ð¾, Ð² ÐºÐ°ÐºÑƒÑŽ Ñ€ÑƒÐºÑƒ Ð¿Ð¾Ð¹Ð´Ñ‘Ñ‚ ÑÐ»ÐµÐ´ÑƒÑŽÑ‰Ð¸Ð¹ Ð¿Ð¾Ð´Ð¾Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚.
         */
        togglePreferredHand: function () {
            this.preferredHand = this.preferredHand === 'right' ? 'left' : 'right';

            window.GameData.addHistory(
                "ÐŸÑ€ÐµÐ´Ð¿Ð¾Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼Ð°Ñ Ñ€ÑƒÐºÐ°: " + this.handLabel(this.preferredHand)
            );
            this.renderHeldItems();
        },

        /**
         * ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ Ñ€ÑƒÐºÐ¸ Ð¿Ð¾ ÐµÑ‘ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ðµ â€” Ð´Ð»Ñ Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ð¾Ðº Ð¸ Ð¸ÑÑ‚Ð¾Ñ€Ð¸Ð¸.
         * @param {string} side â€” 'right' | 'left'
         * @returns {string}
         */
        handLabel: function (side) {
            return side === 'left' ? 'Ð»ÐµÐ²ÑƒÑŽ' : 'Ð¿Ñ€Ð°Ð²ÑƒÑŽ';
        },

        /**
         * ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¹ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ (Ð¾Ð±ÑŠÐµÐºÑ‚ Ð¸Ð· Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ñ‹ tools).
         * @returns {object|null}
         */
        /**
         * ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¹ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ â€” Ñ‚Ð¾Ñ‚, Ñ‡Ñ‚Ð¾ Ð² ÐŸÐ ÐÐ’ÐžÐ™ Ñ€ÑƒÐºÐµ.
         * ÐšÐ»Ð°Ð²Ð¸ÑˆÐ¸ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ðµ Ð²Ñ‹Ð±Ð¸Ñ€Ð°ÑŽÑ‚ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚: ÐµÐ³Ð¾ Ð±ÐµÑ€ÑƒÑ‚ Ñ Ð¿Ð¾Ð»Ð°.
         * @returns {object|null}
         */
        getTool: function () {
            var name = window.GameData.rightHand;
            if (!name) return null;
            return this.tools[name] || null;
        },

        /**
         * Ð˜Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ Ð² Ð»ÐµÐ²Ð¾Ð¹ Ñ€ÑƒÐºÐµ (Ð½Ð°Ð¿Ñ€Ð¸Ð¼ÐµÑ€, ÑÐ¾Ð²Ð¾Ðº).
         * @returns {object|null}
         */
        getLeftTool: function () {
            var name = window.GameData.leftHand;
            if (!name) return null;
            return this.tools[name] || null;
        },

        /**
         * Ð¢ÐµÐºÑÑ‚ ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚Ð½Ð¾Ð¹ Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ¸ Ð´Ð»Ñ Ñ†ÐµÐ»Ð¸ Ñ ÑƒÑ‡Ñ‘Ñ‚Ð¾Ð¼ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð°.
         * @param {object} userData - userData Ð¾Ð±ÑŠÐµÐºÑ‚Ð° Ð¿Ð¾Ð¿Ð°Ð´Ð°Ð½Ð¸Ñ
         * @returns {string}
         */
        buildHint: function (userData) {
            var tool = this.getTool();
            var data = window.GameData;
            var hasDustpan = (data.leftHand === 'dustpan' || data.rightHand === 'dustpan');

            // ÐŸÑ€ÐµÐ´Ð¼ÐµÑ‚ Ð½Ð° Ð¿Ð¾Ð»Ñƒ: Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° Ð²Ð·ÑÑ‚ÑŒ Ð² Ñ€ÑƒÐºÑƒ
            if (userData.type === 'tool' && !userData.isHeld) {
                if (!data.rightHand || !data.leftHand) {
                    return "E - Ð’Ð·ÑÑ‚ÑŒ " + userData.name.toLowerCase() +
                        " (Tab â€” " + this.handLabel(this.preferredHand) + ")";
                }
                return "Ð ÑƒÐºÐ¸ Ð·Ð°Ð½ÑÑ‚Ñ‹, ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ð¾ÑÐ²Ð¾Ð±Ð¾Ð´Ð¸";
            }

            // ÐœÐµÑˆÐ¾Ðº: Ð²Ð·ÑÑ‚ÑŒ/Ð¿Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ
            if (userData.type === 'trashBag') {
                if (userData.isCarried) {
                    if (hasDustpan && data.dustpanFill > 0) {
                        // Ð’Ñ‹Ñ‚Ñ€ÑÑ…Ð¸Ð²Ð°Ñ‚ÑŒ Ð½ÐµÐºÑƒÐ´Ð° â€” Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð²Ñ‹Ð½Ð¾Ñ,
                        // Ð¸Ð½Ð°Ñ‡Ðµ Ð¸Ð³Ñ€Ð¾Ðº Ð² Ñ‚ÑƒÐ¿Ð¸ÐºÐµ: Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° ÐµÑÑ‚ÑŒ, Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ Ð½ÐµÑ‚
                        if (data.trashCount >= data.maxTrash) {
                            return "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½! Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð²Ñ‹Ð½ÐµÑÐ¸ Ð¼ÑƒÑÐ¾Ñ€ Ðº Ð²Ñ‹Ñ…Ð¾Ð´Ñƒ (Ð·ÐµÐ»Ñ‘Ð½Ñ‹Ð¹ ÐºÑƒÐ±)";
                        }
                        return "E - Ð’Ñ‹Ñ‚Ñ€ÑÑ…Ð½ÑƒÑ‚ÑŒ ÑÐ¾Ð²Ð¾Ðº Ð² Ð¼ÐµÑˆÐ¾Ðº";
                    }
                    return this.isNearExit() && data.trashCount > 0
                        ? "E - Ð’Ñ‹Ð½ÐµÑÑ‚Ð¸ Ð¼ÑƒÑÐ¾Ñ€"
                        : "E - ÐŸÐ¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð¼ÐµÑˆÐ¾Ðº";
                }
                if (hasDustpan && data.dustpanFill > 0) {
                    if (data.trashCount >= data.maxTrash) {
                        return "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½! Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð²Ñ‹Ð½ÐµÑÐ¸ Ð¼ÑƒÑÐ¾Ñ€ Ðº Ð²Ñ‹Ñ…Ð¾Ð´Ñƒ (Ð·ÐµÐ»Ñ‘Ð½Ñ‹Ð¹ ÐºÑƒÐ±)";
                    }
                    return "E - Ð’Ñ‹Ñ‚Ñ€ÑÑ…Ð½ÑƒÑ‚ÑŒ ÑÐ¾Ð²Ð¾Ðº Ð² Ð¼ÐµÑˆÐ¾Ðº";
                }
                return "E - Ð’Ð·ÑÑ‚ÑŒ Ð¼ÐµÑˆÐ¾Ðº";
            }

            // ÐœÑƒÑÐ¾Ñ€ Ð½Ð° Ð¿Ð¾Ð»Ñƒ
            if (userData.isDebris) {
                if (hasDustpan) {
                    if (data.dustpanFill >= data.dustpanMax) {
                        return "Ð¡Ð¾Ð²Ð¾Ðº Ð¿Ð¾Ð»Ð¾Ð½, Ð²Ñ‹Ñ‚Ñ€ÑÑ…Ð½Ð¸ Ð² Ð¼ÐµÑˆÐ¾Ðº";
                    }
                    return "Ð—Ð°Ð¶Ð¼Ð¸ Ð›ÐšÐœ â€” ÑÐ¾Ð±Ñ€Ð°Ñ‚ÑŒ Ð² ÑÐ¾Ð²Ð¾Ðº";
                }
                if (data.handWith('broom')) {
                    return "Ð—Ð°Ð¶Ð¼Ð¸ Ð›ÐšÐœ â€” ÑÐ¼ÐµÑÑ‚Ð¸ ÐºÑƒÑ‡Ñƒ";
                }
                if (data.trashCount >= data.maxTrash) {
                    return "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½ â€” Ð²Ñ‹Ð½ÐµÑÐ¸ Ðº Ð²Ñ‹Ñ…Ð¾Ð´Ñƒ";
                }
                return "E â€” Ð¿Ð¾Ð´Ð¾Ð±Ñ€Ð°Ñ‚ÑŒ Ñ€ÑƒÐºÐ¾Ð¹";
            }

            // Ð’Ñ‹Ñ…Ð¾Ð´: Ð²Ñ‹Ð½Ð¾Ñ ÑÐ¾Ð±Ñ€Ð°Ð½Ð½Ð¾Ð³Ð¾ Ð¼ÑƒÑÐ¾Ñ€Ð°
            if (userData.type === 'exit') {
                if (data.trashCount === 0) {
                    return "ÐœÑƒÑÐ¾Ñ€Ð° Ð½ÐµÑ‚ â€” Ð¼Ð¾Ð¶Ð½Ð¾ Ð¸Ð´Ñ‚Ð¸";
                }
                return "E - Ð’Ñ‹Ð½ÐµÑÑ‚Ð¸ Ð¼ÑƒÑÐ¾Ñ€";
            }

            // Ð¡Ñ‚ÐµÐ½Ñ‹/Ð¾Ð±Ð¾Ð¸: Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÐµÐ¼ Ñ‚ÐµÐ¼, Ñ‡Ñ‚Ð¾ Ð² ÐŸÐ ÐÐ’ÐžÐ™ Ñ€ÑƒÐºÐµ
            if (userData.type === 'wallpaper') {
                if (this.isCarryingBag()) {
                    return "Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²ÑŒ Ð¼ÐµÑˆÐ¾Ðº";
                }

                if (!tool || !tool.actions || !tool.actions.wallpaper) {
                    return "Ð’Ð¾Ð·ÑŒÐ¼Ð¸ Ð² Ñ€ÑƒÐºÑƒ ÑÐºÑ€ÐµÐ±Ð¾Ðº Ð¸Ð»Ð¸ Ð²Ð°Ð»Ð¸Ðº";
                }

                if (data.stamina < this.staminaMinToWork) {
                    return "ÐÐµÑ‚ ÑÐ¸Ð»! ÐžÑ‚Ð´Ð¾Ñ…Ð½Ð¸";
                }

                return tool.label + ": " + tool.hints.wallpaper;
            }

            // ÐžÐ±ÑŠÐµÐºÑ‚Ñ‹ Ñ ÑÐ¾Ð±ÑÑ‚Ð²ÐµÐ½Ð½Ñ‹Ð¼ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸ÐµÐ¼ (ÐºÑƒÐ±): Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° ÑƒÐ½Ð¸Ð²ÐµÑ€ÑÐ°Ð»ÑŒÐ½Ð°
            if (userData.name) {
                return "E: " + userData.name;
            }

            return "";
        },

        /**
         * Ð•Ð´Ð¸Ð½Ð°Ñ Ñ‚Ð¾Ñ‡ÐºÐ° Ð²Ñ…Ð¾Ð´Ð° Ð´Ð»Ñ Ð²ÑÐµÑ… Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ð¹ Ð² Ð¸Ð³Ñ€Ðµ.
         * Ð Ð¾ÑƒÑ‚Ð¸Ð½Ð³: Ñ‚Ð¸Ð¿ Ñ†ÐµÐ»Ð¸ + Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¹ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ â†’ ÐºÐ¾Ð½ÐºÑ€ÐµÑ‚Ð½Ð¾Ðµ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ.
         * Ð”Ð¸ÑÑ‚Ð°Ð½Ñ†Ð¸Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÑ‚ÑÑ Ð·Ð´ÐµÑÑŒ: Ð²Ð¸Ð´Ð½Ð¾ Ð´Ð°Ð»ÐµÐºÐ¾, ÑÐ´ÐµÐ»Ð°Ñ‚ÑŒ Ð¼Ð¾Ð¶Ð½Ð¾ Ð²Ð±Ð»Ð¸Ð·Ð¸.
         */
        handleInteraction: function () {
            var data = window.GameData;

            // ÐŸÑ€Ð¸Ñ†ÐµÐ» Ð½Ð¸ Ð½Ð° Ñ‡Ñ‚Ð¾: E Ð½Ð¸Ñ‡ÐµÐ³Ð¾ Ð½Ðµ Ð´ÐµÐ»Ð°ÐµÑ‚.
            // ÐŸÐ¾Ð»Ð¾Ð¶Ð¸Ñ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚ â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÐºÐ»Ð°Ð²Ð¸ÑˆÐ° Q (dropFromHands).
            if (!this.lastHit) return;

            // Ð”Ð°Ð»ÐµÐºÐ¾ â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð¿Ð¾Ð´Ð¾Ð¹Ñ‚Ð¸, Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ Ð½Ðµ ÑÑ€Ð°Ð±Ð°Ñ‚Ñ‹Ð²Ð°ÐµÑ‚
            if (this.lastHit.distance > this.interactDistance) {
                window.GameData.ui.currentHint = "ÐŸÐ¾Ð´Ð¾Ð¹Ð´Ð¸ Ð±Ð»Ð¸Ð¶Ðµ";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            var obj = this.lastHit.object;

            // Ð”Ð»Ñ ÑÐ¾ÑÑ‚Ð°Ð²Ð½Ñ‹Ñ… Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð² (Group) Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð»ÐµÐ¶Ð°Ñ‚ Ð½Ð° Ñ€Ð¾Ð´Ð¸Ñ‚ÐµÐ»Ðµ
            obj = this.resolveInteractable(obj);

            var userData = obj.userData || {};
            var tool = this.getTool();

            // === ÐŸÐ Ð•Ð”ÐœÐ•Ð¢ ÐÐ ÐŸÐžÐ›Ð£: Ð±ÐµÑ€Ñ‘Ð¼ Ð² Ñ€ÑƒÐºÑƒ ===
            // ÐŸÐ¾Ð´Ñ…Ð¾Ð´Ð¸Ñ‚ Ð»ÑŽÐ±Ð¾Ð¹ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚ Ñ toolName: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹, Ð²ÐµÐ´Ñ€Ð¾,
            // Ð½Ð¾Ð¶, Ñ€ÑƒÐ»Ð¾Ð½, Ñ€ÑƒÐ»ÐµÑ‚ÐºÐ°, ÐºÐ°Ð½Ð¸ÑÑ‚Ñ€Ð° ÐºÐ»ÐµÑ.
            if (!userData.isHeld && userData.toolName) {
                this.takeToolToHand(obj, userData);
                return;
            }

            // === ÐœÐ•Ð¨ÐžÐš Ð”Ð›Ð¯ ÐœÐ£Ð¡ÐžÐ Ð ===
            if (userData.type === 'trashBag') {
                // Ð¡Ð¾Ð²Ð¾Ðº Ð² Ñ€ÑƒÐºÐµ Ð¸ Ð² Ð½Ñ‘Ð¼ ÐµÑÑ‚ÑŒ Ð¼ÑƒÑÐ¾Ñ€ â€” Ð²Ñ‹Ñ‚Ñ€ÑÑ…Ð¸Ð²Ð°ÐµÐ¼ Ð² Ð¼ÐµÑˆÐ¾Ðº
                var hasDustpan = (data.leftHand === 'dustpan' || data.rightHand === 'dustpan');
                if (hasDustpan && data.dustpanFill > 0) {
                    this.emptyDustpanIntoBag();
                    return;
                }

                if (!userData.isCarried) {
                    this.pickUpBag();
                } else {
                    if (this.isNearExit() && data.trashCount > 0) {
                        this.emptyBagAtExit();
                    }
                    this.dropBagHere();
                }
                return;
            }

            // === Ð£ÐœÐ«Ð’ÐÐ›Ð¬ÐÐ˜Ðš: Ð½Ð°Ð±Ñ€Ð°Ñ‚ÑŒ Ð²Ð¾Ð´Ñ‹ Ð² Ð²ÐµÐ´Ñ€Ð¾ ===
            if (userData.type === 'sink') {
                this.fillBucketAtSink(obj);
                return;
            }

            // === ÐšÐÐÐ˜Ð¡Ð¢Ð Ð Ð“Ð Ð£ÐÐ¢ÐžÐ’ÐšÐ˜ / ÐšÐ›Ð•Ð¯: Ð¿ÐµÑ€ÐµÐ»Ð¸Ñ‚ÑŒ Ð² Ð²ÐµÐ´Ñ€Ð¾ ===
            if (userData.type === 'primer_can' || userData.type === 'glue_can') {
                this.pourCanisterIntoBucket(obj, userData);
                return;
            }

            // === Ð Ð£Ð›ÐžÐ ÐžÐ‘ÐžÐ•Ð’: Ð¾Ñ‚Ñ€ÐµÐ·Ð°Ñ‚ÑŒ ÐºÑƒÑÐ¾Ðº Ð½Ð¾Ð¶Ð¾Ð¼ ===
            if (userData.type === 'wallpaper_roll') {
                this.cutWallpaperPiece(obj);
                return;
            }

            // === Ð Ð£ÐšÐ˜ Ð—ÐÐÐ¯Ð¢Ð« ÐœÐ•Ð¨ÐšÐžÐœ ===
            if (this.isCarryingBag()) {
                window.GameData.ui.currentHint = "Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ð¾ÑÑ‚Ð°Ð²ÑŒ Ð¼ÐµÑˆÐ¾Ðº";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            // === Ð¡Ð‘ÐžÐ  ÐœÐ£Ð¡ÐžÐ Ð ===
            if (userData.isDebris) {
                // Ð¡Ð¾Ð²ÐºÐ¾Ð¼ Ð¸ Ð²ÐµÐ½Ð¸ÐºÐ¾Ð¼ Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÑŽÑ‚ Ð·Ð°Ð¶Ð°Ñ‚Ð¾Ð¹ Ð›ÐšÐœ (ÑÐ¼. loop),
                // Ð° Ð½Ðµ ÐºÐ»Ð°Ð²Ð¸ÑˆÐµÐ¹ E: E Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð±ÐµÑ€Ñ‘Ñ‚/ÐºÐ»Ð°Ð´Ñ‘Ñ‚ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ñ‹.
                if (data.handWith('dustpan')) {
                    window.GameData.ui.currentHint = "Ð—Ð°Ð¶Ð¼Ð¸ Ð›ÐšÐœ â€” ÑÐ¾Ð±Ñ€Ð°Ñ‚ÑŒ Ð² ÑÐ¾Ð²Ð¾Ðº";
                    window.GameData.ui.hintVisible = true;
                    this.renderHint();
                    return;
                }
                if (data.handWith('broom')) {
                    window.GameData.ui.currentHint = "Ð—Ð°Ð¶Ð¼Ð¸ Ð›ÐšÐœ â€” ÑÐ¼ÐµÑÑ‚Ð¸ ÐºÑƒÑ‡Ñƒ";
                    window.GameData.ui.hintVisible = true;
                    this.renderHint();
                    return;
                }

                if (data.trashCount >= data.maxTrash) {
                    window.GameData.ui.currentHint = "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½ â€” Ð²Ñ‹Ð½ÐµÑÐ¸ Ð¼ÑƒÑÐ¾Ñ€!";
                    window.GameData.ui.hintVisible = true;
                    this.renderHint();
                    return;
                }

                this.removeDebris(obj);

                data.trashCount++;
                data.addHistory("ÐŸÐ¾Ð´Ð¾Ð±Ñ€Ð°Ð½ Ð¼ÑƒÑÐ¾Ñ€. ÐœÐµÑˆÐ¾Ðº: " + data.trashCount + "/" + data.maxTrash);
                this.renderTrash();
                return;
            }

            // === Ð’Ð«ÐÐžÐ¡ ÐœÐ£Ð¡ÐžÐ Ð ===
            if (userData.type === 'exit') {
                if (data.trashCount > 0) {
                    window.GameData.ui.currentHint = "ÐœÑƒÑÐ¾Ñ€ Ð²Ñ‹Ð½ÐµÑÐµÐ½!";
                    window.GameData.ui.hintVisible = true;
                    this.renderHint();
                    data.trashCount = 0;
                    data.addHistory("ÐœÑƒÑÐ¾Ñ€ Ð²Ñ‹Ð½ÐµÑÐµÐ½ Ðº Ð²Ñ‹Ñ…Ð¾Ð´Ñƒ");
                    this.renderTrash();
                }
                return;
            }

            // === Ð ÐÐ‘ÐžÐ¢Ð ÐŸÐž Ð¡Ð¢Ð•ÐÐ• (Ð¾Ð±Ð¾Ð¸) ===
            if (tool && userData.type && tool.actions && tool.actions[userData.type]) {
                if (data.stamina < this.staminaMinToWork) {
                    window.GameData.ui.currentHint = "ÐÐµÑ‚ ÑÐ¸Ð»! ÐžÑ‚Ð´Ð¾Ñ…Ð½Ð¸";
                    window.GameData.ui.hintVisible = true;
                    this.renderHint();
                    return;
                }

                data.stamina = Math.max(0, data.stamina - (tool.staminaCost || 0));
                this.renderStamina();

                tool.actions[userData.type](obj, this.lastHit);
                return;
            }

            // Ð¤Ð¾Ð»Ð±ÑÐº: Ñƒ Ð¾Ð±ÑŠÐµÐºÑ‚Ð° ÐµÑÑ‚ÑŒ ÑÐ²Ð¾Ñ‘ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ (ÐºÑƒÐ± Â«ÐžÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒÂ»)
            if (typeof userData.interact === 'function') {
                obj.userData.interact(obj, this.lastHit);
            }
        },

        /**
         * Ð’Ð·ÑÑ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚ Ñ Ð¿Ð¾Ð»Ð° Ð² ÑÐ²Ð¾Ð±Ð¾Ð´Ð½ÑƒÑŽ Ñ€ÑƒÐºÑƒ.
         * @param {THREE.Object3D} obj â€” Ð¼ÐµÑˆ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð°
         * @param {object} userData â€” ÐµÐ³Ð¾ userData
         */
        takeToolToHand: function (obj, userData) {
            var data = window.GameData;

            // Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ñ‹Ñ‚Ð°ÐµÐ¼ÑÑ Ð·Ð°Ð½ÑÑ‚ÑŒ Ñ€ÑƒÐºÑƒ Ñ‡ÐµÑ€ÐµÐ· Ð´Ð°Ð½Ð½Ñ‹Ðµ
            var side = data.giveItemToHand(userData.toolName, this.preferredHand);

            if (!side) {
                window.GameData.ui.currentHint = "Ð ÑƒÐºÐ¸ Ð·Ð°Ð½ÑÑ‚Ñ‹, ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ð¾ÑÐ²Ð¾Ð±Ð¾Ð´Ð¸";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            window.GameRenderer.attachToolToHand(obj, side);
            data.addHistory("Ð’Ð·ÑÑ‚Ð¾ Ð² " + this.handLabel(side) + " Ñ€ÑƒÐºÑƒ: " + userData.name);

            this.renderHeldItems();
        },

        /**
         * ÐŸÐ¾Ð»Ð¾Ð¶Ð¸Ñ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚ Ð¸Ð· Ñ€ÑƒÐº Ð½Ð° Ð¿Ð¾Ð».
         * ÐŸÑ€Ð°Ð²Ð°Ñ Ñ€ÑƒÐºÐ° Ð² Ð¿Ñ€Ð¸Ð¾Ñ€Ð¸Ñ‚ÐµÑ‚Ðµ; ÐµÑÐ»Ð¸ Ð¾Ð½Ð° Ð¿ÑƒÑÑ‚Ð° â€” Ð»ÐµÐ²Ð°Ñ.
         * ÐœÐµÑˆÐ¾Ðº Ð¾Ð±Ñ€Ð°Ð±Ð°Ñ‚Ñ‹Ð²Ð°ÐµÑ‚ÑÑ Ð¾Ñ‚Ð´ÐµÐ»ÑŒÐ½Ð¾ (Ñƒ Ð½ÐµÐ³Ð¾ ÑÐ²Ð¾Ñ Ð»Ð¾Ð³Ð¸ÐºÐ°).
         */
        dropFromHands: function () {
            var data = window.GameData;

            if (this.isCarryingBag()) {
                this.dropBagHere();
                return;
            }

            var side = data.rightHand ? 'right' : (data.leftHand ? 'left' : null);
            if (!side) return;

            var mesh = window.GameRenderer.detachToolToGround(side);
            if (!mesh) {
                // ÐœÐµÑˆÐ° Ð½ÐµÑ‚ (Ñ€Ð°ÑÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½) â€” Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ð¾ÑÐ²Ð¾Ð±Ð¾Ð¶Ð´Ð°ÐµÐ¼ Ñ€ÑƒÐºÑƒ
                data.freeHand(side);
                this.renderHeldItems();
                return;
            }

            data.freeHand(side);
            data.addHistory("ÐŸÐ¾Ð»Ð¾Ð¶ÐµÐ½Ð¾ Ð½Ð° Ð¿Ð¾Ð»: " + mesh.userData.name);

            this.renderHeldItems();
        },

        /**
         * ÐÐ°Ð±Ñ€Ð°Ñ‚ÑŒ Ð²Ð¾Ð´Ñ‹ Ð¸Ð· ÑƒÐ¼Ñ‹Ð²Ð°Ð»ÑŒÐ½Ð¸ÐºÐ° Ð² Ð²ÐµÐ´Ñ€Ð¾.
         * @param {THREE.Object3D} sink â€” ÑƒÐ¼Ñ‹Ð²Ð°Ð»ÑŒÐ½Ð¸Ðº
         */
        fillBucketAtSink: function (sink) {
            var data = window.GameData;
            var bucket = this.getBucketMesh();

            if (!bucket) {
                this.showHintText("Ð’Ð¾Ð·ÑŒÐ¼Ð¸ Ð²ÐµÐ´Ñ€Ð¾ Ð² Ñ€ÑƒÐºÐ¸");
                return;
            }

            var ud = bucket.userData;

            if (ud.volumeUsed >= ud.volume) {
                this.showHintText("Ð’ÐµÐ´Ñ€Ð¾ ÑƒÐ¶Ðµ Ð¿Ð¾Ð»Ð½Ð¾");
                return;
            }

            ud.volumeUsed = ud.volume;
            ud.content = 'water';

            this.showHintText("Ð’ÐµÐ´Ñ€Ð¾ Ð½Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¾ (" + ud.volume + "Ð»)");
            data.addHistory("Ð’ÐµÐ´Ñ€Ð¾ Ð½Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¾ Ð²Ð¾Ð´Ð¾Ð¹: " + ud.volume + " Ð»");
            this.renderHeldItems();
        },

        /**
         * ÐŸÐµÑ€ÐµÐ»Ð¸Ñ‚ÑŒ Ð³Ñ€ÑƒÐ½Ñ‚Ð¾Ð²ÐºÑƒ Ð¸Ð»Ð¸ ÐºÐ»ÐµÐ¹ Ð¸Ð· ÐºÐ°Ð½Ð¸ÑÑ‚Ñ€Ñ‹ Ð² Ð²ÐµÐ´Ñ€Ð¾.
         * @param {THREE.Object3D} can â€” ÐºÐ°Ð½Ð¸ÑÑ‚Ñ€Ð°
         * @param {object} userData â€” ÐµÑ‘ Ð´Ð°Ð½Ð½Ñ‹Ðµ
         */
        pourCanisterIntoBucket: function (can, userData) {
            var data = window.GameData;
            var bucket = this.getBucketMesh();

            if (!bucket) {
                this.showHintText("Ð’Ð¾Ð·ÑŒÐ¼Ð¸ Ð²ÐµÐ´Ñ€Ð¾ Ð² Ñ€ÑƒÐºÐ¸");
                return;
            }

            var bud = bucket.userData;
            var kind = userData.type === 'glue_can' ? 'glue' : 'primer';

            if (bud.content && bud.content !== kind) {
                this.showHintText("Ð’ Ð²ÐµÐ´Ñ€Ðµ ÑƒÐ¶Ðµ Ð´Ñ€ÑƒÐ³Ð¾Ðµ ÑÐ¾Ð´ÐµÑ€Ð¶Ð¸Ð¼Ð¾Ðµ");
                return;
            }

            // ÐŸÐµÑ€ÐµÐ»Ð¸Ð²Ð°ÐµÐ¼: ÐºÐ°Ð½Ð¸ÑÑ‚Ñ€Ð° Ð¿ÑƒÑÑ‚ÐµÐµÑ‚, Ð²ÐµÐ´Ñ€Ð¾ Ð½Ð°Ð¿Ð¾Ð»Ð½ÑÐµÑ‚ÑÑ
            var room = bud.volume - bud.volumeUsed;
            var amount = Math.min(userData.volume || 5, room);

            if (amount <= 0) {
                this.showHintText("Ð’ÐµÐ´Ñ€Ð¾ Ð¿Ð¾Ð»Ð½Ð¾");
                return;
            }

            bud.volumeUsed += amount;
            bud.content = kind;

            userData.volume -= amount;
            if (userData.volume <= 0) {
                window.GameRenderer.scene.remove(can);
                var idx = window.GameRenderer.interactableObjects.indexOf(can);
                if (idx !== -1) window.GameRenderer.interactableObjects.splice(idx, 1);
            }

            this.showHintText(kind === 'glue'
                ? "ÐšÐ»ÐµÐ¹ Ð¿ÐµÑ€ÐµÐ»Ð¸Ñ‚ Ð² Ð²ÐµÐ´Ñ€Ð¾"
                : "Ð“Ñ€ÑƒÐ½Ñ‚Ð¾Ð²ÐºÐ° Ð¿ÐµÑ€ÐµÐ»Ð¸Ñ‚Ð° Ð² Ð²ÐµÐ´Ñ€Ð¾");
            data.addHistory("ÐŸÐµÑ€ÐµÐ»Ð¸Ñ‚Ð¾ Ð² Ð²ÐµÐ´Ñ€Ð¾: " + amount + " Ð» (" + kind + ")");
            this.renderHeldItems();
        },

        /**
         * ÐžÑ‚Ñ€ÐµÐ·Ð°Ñ‚ÑŒ ÐºÑƒÑÐ¾Ðº Ð¾Ð±Ð¾ÐµÐ² Ð½Ð¾Ð¶Ð¾Ð¼. ÐŸÐ¾ÐºÐ° Ð·Ð°Ð³Ð»ÑƒÑˆÐºÐ°: ÐºÑƒÑÐ¾Ðº ÑÐ¾Ð·Ð´Ð°Ñ‘Ñ‚ÑÑ
         * Ñ„Ð¸ÐºÑÐ¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ð¾Ð³Ð¾ Ñ€Ð°Ð·Ð¼ÐµÑ€Ð° (1 Ã— 2.7 Ð¼) Ð¸ ÐºÐ»Ð°Ð´Ñ‘Ñ‚ÑÑ Ñ€ÑÐ´Ð¾Ð¼ Ñ Ñ€ÑƒÐ»Ð¾Ð½Ð¾Ð¼.
         * TODO: Ñ€Ð°ÑÐºÑ€Ð¾Ð¹ Ð¿Ð¾ Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾Ð¹ ÑˆÐ¸Ñ€Ð¸Ð½Ðµ/Ð´Ð»Ð¸Ð½Ðµ ÑÑ‚ÐµÐ½Ñ‹.
         * @param {THREE.Object3D} roll â€” Ñ€ÑƒÐ»Ð¾Ð½ Ð¾Ð±Ð¾ÐµÐ²
         */
        cutWallpaperPiece: function (roll) {
            var data = window.GameData;

            if (!data.handWith('knife')) {
                this.showHintText("ÐÑƒÐ¶ÐµÐ½ Ð½Ð¾Ð¶");
                return;
            }

            var piece = window.GameRenderer.createCutWallpaperPiece(
                roll.position.x, roll.position.z
            );

            if (!piece) return;

            data.addHistory("ÐžÑ‚Ñ€ÐµÐ·Ð°Ð½ ÐºÑƒÑÐ¾Ðº Ð¾Ð±Ð¾ÐµÐ²");
            this.showHintText("ÐšÑƒÑÐ¾Ðº Ð¾Ð±Ð¾ÐµÐ² Ð¾Ñ‚Ñ€ÐµÐ·Ð°Ð½ (1 Ã— 2.7 Ð¼)");
        },

        /**
         * ÐÐ°Ð¹Ñ‚Ð¸ Ð¼ÐµÑˆ Ð²ÐµÐ´Ñ€Ð°, ÐµÑÐ»Ð¸ Ð¾Ð½Ð¾ Ð² Ñ€ÑƒÐºÐ°Ñ….
         * @returns {THREE.Object3D|null}
         */
        getBucketMesh: function () {
            var side = window.GameData.handWith('bucket');
            if (!side) return null;
            return window.GameRenderer.heldToolMeshes[side];
        },

        /**
         * ÐšÐ¾Ñ€Ð¾Ñ‚ÐºÐ°Ñ Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° Ð² HUD.
         * @param {string} text
         */
        showHintText: function (text) {
            window.GameData.ui.currentHint = text;
            window.GameData.ui.hintVisible = true;
            this.renderHint();
        },

        /**
         * Ð’Ñ‹Ñ‚Ñ€ÑÑ…Ð½ÑƒÑ‚ÑŒ ÑÐ¾Ð²Ð¾Ðº Ð² Ð¼ÐµÑˆÐ¾Ðº.
         */
        emptyDustpanIntoBag: function () {
            var data = window.GameData;

            // ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½ â€” Ð¿ÐµÑ€ÐµÑÑ‹Ð¿Ð°Ñ‚ÑŒ Ð½ÐµÐºÑƒÐ´Ð°
            if (data.trashCount >= data.maxTrash) {
                window.GameData.ui.currentHint = "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½! Ð’Ñ‹Ð½ÐµÑÐ¸ ÑÐ½Ð°Ñ‡Ð°Ð»Ð°";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            var transfer = Math.min(data.dustpanFill, data.maxTrash - data.trashCount);
            if (transfer <= 0) {
                window.GameData.ui.currentHint = "ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾Ð»Ð¾Ð½! Ð’Ñ‹Ð½ÐµÑÐ¸ ÑÐ½Ð°Ñ‡Ð°Ð»Ð°";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            data.trashCount += transfer;
            data.dustpanFill -= transfer;

            window.GameData.ui.currentHint = "Ð’Ñ‹ÑÑ‹Ð¿Ð°Ð½Ð¾ Ð² Ð¼ÐµÑˆÐ¾Ðº: " + transfer;
            window.GameData.ui.hintVisible = true;
            this.renderHint();

            data.addHistory("Ð¡Ð¾Ð²Ð¾Ðº Ð²Ñ‹ÑÑ‹Ð¿Ð°Ð½ Ð² Ð¼ÐµÑˆÐ¾Ðº: " + transfer + " ÐºÑƒÑÐºÐ¾Ð²");

            this.renderTrash();
            this.renderHeldItems();
        },

        /**
         * Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ ÐºÑƒÑÐ¾Ðº Ð¼ÑƒÑÐ¾Ñ€Ð° Ð¸Ð· ÑÑ†ÐµÐ½Ñ‹ Ð¸ Ð²ÑÐµÑ… ÑÐ¿Ð¸ÑÐºÐ¾Ð².
         * @param {THREE.Object3D} obj
         */
        removeDebris: function (obj) {
            var renderer = window.GameRenderer;

            renderer.scene.remove(obj);

            var idx = renderer.debrisObjects.indexOf(obj);
            if (idx !== -1) renderer.debrisObjects.splice(idx, 1);

            var iIdx = renderer.interactableObjects.indexOf(obj);
            if (iIdx !== -1) renderer.interactableObjects.splice(iIdx, 1);
        },

        /**
         * ÐŸÐ¾Ð´Ð½Ð¸Ð¼Ð°ÐµÑ‚ÑÑ Ð¾Ñ‚ Ð¼ÐµÑˆÐ° Ðº Ð¾Ð±ÑŠÐµÐºÑ‚Ñƒ, Ñƒ ÐºÐ¾Ñ‚Ð¾Ñ€Ð¾Ð³Ð¾ ÐµÑÑ‚ÑŒ userData.
         * ÐÑƒÐ¶Ð½Ð¾ Ð´Ð»Ñ ÑÐ¾ÑÑ‚Ð°Ð²Ð½Ñ‹Ñ… Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð² (Group: Ð²ÐµÐ½Ð¸Ðº, ÑÐ¾Ð²Ð¾Ðº): raycaster
         * Ð¿Ð¾Ð¿Ð°Ð´Ð°ÐµÑ‚ Ð² Ð´Ð¾Ñ‡ÐµÑ€Ð½Ð¸Ð¹ Ð¼ÐµÑˆ, Ð° Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð»ÐµÐ¶Ð°Ñ‚ Ð½Ð° Ð³Ñ€ÑƒÐ¿Ð¿Ðµ.
         * @param {THREE.Object3D} obj
         * @returns {THREE.Object3D}
         */
        resolveInteractable: function (obj) {
            var node = obj;

            while (node) {
                if (node.userData && (node.userData.interactive || node.userData.isDebris)) {
                    return node;
                }
                node = node.parent;
            }

            return obj;
        },

        /**
         * ÐœÐµÑˆÐ¾Ðº Ð² Ñ€ÑƒÐºÐ°Ñ…?
         * @returns {boolean}
         */
        isCarryingBag: function () {
            var bag = window.GameRenderer.trashBag;
            return !!(bag && bag.userData.isCarried);
        },

        /**
         * Ð’Ð·ÑÑ‚ÑŒ Ð¼ÐµÑˆÐ¾Ðº Ð² Ñ€ÑƒÐºÐ¸.
         */
        pickUpBag: function () {
            var bag = window.GameRenderer.trashBag;
            if (!bag) return;

            var data = window.GameData;

            // ÐœÐµÑˆÐ¾Ðº Ð·Ð°Ð½Ð¸Ð¼Ð°ÐµÑ‚ Ñ€ÑƒÐºÑƒ Ð¿Ð¾ Ð¾Ð±Ñ‰Ð¸Ð¼ Ð¿Ñ€Ð°Ð²Ð¸Ð»Ð°Ð¼: ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ñ€Ð°Ð²Ð°Ñ, Ð¿Ð¾Ñ‚Ð¾Ð¼ Ð»ÐµÐ²Ð°Ñ
            var side = data.giveItemToHand('trashBag');

            if (!side) {
                window.GameData.ui.currentHint = "Ð ÑƒÐºÐ¸ Ð·Ð°Ð½ÑÑ‚Ñ‹, ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ð¾ÑÐ²Ð¾Ð±Ð¾Ð´Ð¸";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return;
            }

            bag.userData.isCarried = true;
            bag.userData.carriedSide = side;
            data.trashBagPosition = null;

            // ÐœÐµÑˆÐ¾Ðº Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ðµ Ñ†ÐµÐ»ÑŒ Ð´Ð»Ñ Ð¿Ñ€Ð¸Ñ†ÐµÐ»Ð°: Ð¾Ð½ Â«Ð² Ñ€ÑƒÐºÐ°Ñ…Â», Ð° Ð½Ðµ Ð² Ð¼Ð¸Ñ€Ðµ
            this.removeFromInteractables(bag);

            data.addHistory("ÐœÐµÑˆÐ¾Ðº Ð²Ð·ÑÑ‚ Ð² " + (side === 'right' ? 'Ð¿Ñ€Ð°Ð²ÑƒÑŽ' : 'Ð»ÐµÐ²ÑƒÑŽ') + " Ñ€ÑƒÐºÑƒ");
            this.updateHandsUI();
        },

        /**
         * ÐŸÐ¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð¼ÐµÑˆÐ¾Ðº Ð½Ð° Ð¿Ð¾Ð» Ð¿ÐµÑ€ÐµÐ´ Ð¸Ð³Ñ€Ð¾ÐºÐ¾Ð¼.
         * ÐŸÐ¾Ð·Ð¸Ñ†Ð¸Ñ â€” 1.5 Ð¼ Ð¿Ð¾ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸ÑŽ Ð²Ð·Ð³Ð»ÑÐ´Ð°, Ð½Ð° ÑƒÑ€Ð¾Ð²Ð½Ðµ Ð¿Ð¾Ð»Ð°.
         */
        dropBagHere: function () {
            var bag = window.GameRenderer.trashBag;

            // ÐžÑÐ²Ð¾Ð±Ð¾Ð¶Ð´Ð°ÐµÐ¼ Ñ€ÑƒÐºÑƒ, Ð² ÐºÐ¾Ñ‚Ð¾Ñ€Ð¾Ð¹ Ð±Ñ‹Ð» Ð¼ÐµÑˆÐ¾Ðº
            if (bag && bag.userData.carriedSide) {
                window.GameData.freeHand(bag.userData.carriedSide);
                bag.userData.carriedSide = null;
            }

            window.GameRenderer.dropTrashBag();
            window.GameData.addHistory("ÐœÐµÑˆÐ¾Ðº Ð¿Ð¾ÑÑ‚Ð°Ð²Ð»ÐµÐ½ Ð½Ð° Ð¿Ð¾Ð»");

            this.updateHandsUI();
        },

        /**
         * Ð’Ñ‹Ð½ÐµÑÑ‚Ð¸ Ð¼ÑƒÑÐ¾Ñ€ Ñƒ Ð²Ñ‹Ñ…Ð¾Ð´Ð°: Ð¾Ð±Ð½ÑƒÐ»ÑÐµÐ¼ ÑÑ‡Ñ‘Ñ‚Ñ‡Ð¸Ðº, Ð¼ÐµÑˆÐ¾Ðº Ð¾ÑÑ‚Ð°Ñ‘Ñ‚ÑÑ Ð² Ñ€ÑƒÐºÐ°Ñ….
         */
        emptyBagAtExit: function () {
            var data = window.GameData;

            data.trashCount = 0;
            data.addHistory("ÐœÑƒÑÐ¾Ñ€ Ð²Ñ‹Ð½ÐµÑÐµÐ½ Ð² Ð¼ÐµÑˆÐºÐµ");
            this.renderTrash();

            window.GameData.ui.currentHint = "ÐœÑƒÑÐ¾Ñ€ Ð²Ñ‹Ð½ÐµÑÐµÐ½!";
            window.GameData.ui.hintVisible = true;
            this.renderHint();
        },

        /**
         * Ð£Ð±Ñ€Ð°Ñ‚ÑŒ Ð¾Ð±ÑŠÐµÐºÑ‚ Ð¸Ð· ÑÐ¿Ð¸ÑÐºÐ° Ñ†ÐµÐ»ÐµÐ¹ raycaster'Ð°.
         * @param {THREE.Object3D} obj
         */
        removeFromInteractables: function (obj) {
            var list = window.GameRenderer.interactableObjects;
            var idx = list.indexOf(obj);
            if (idx !== -1) {
                list.splice(idx, 1);
            }
        },

        /**
         * Ð¡Ñ‚Ð¾Ð¸Ñ‚ Ð»Ð¸ Ð¸Ð³Ñ€Ð¾Ðº Ñ€ÑÐ´Ð¾Ð¼ Ñ Ð·Ð¾Ð½Ð¾Ð¹ Ð²Ñ‹Ð½Ð¾ÑÐ° Ð¼ÑƒÑÐ¾Ñ€Ð°.
         * @returns {boolean}
         */
        isNearExit: function () {
            var exit = window.GameRenderer.exitZone;
            if (!exit) return false;

            var cam = window.GameRenderer.camera;
            var dx = cam.position.x - exit.position.x;
            var dz = cam.position.z - exit.position.z;

            return Math.hypot(dx, dz) <= 1.5;
        },

        /**
         * Ð¡Ð±Ð¾Ñ€ ÑÐ¾Ð²ÐºÐ¾Ð¼ Ð¿Ð¾ Ð·Ð°Ð¶Ð°Ñ‚Ð¾Ð¹ Ð›ÐšÐœ: Ð±ÐµÑ€Ñ‘Ð¼ Ð¼ÑƒÑÐ¾Ñ€, Ð½Ð° ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ð¹ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚
         * Ð¿Ñ€Ð¸Ñ†ÐµÐ», Ð¸ ÑÐ³Ñ€ÐµÐ±Ð°ÐµÐ¼ Ð²ÑÑŽ ÐºÑƒÑ‡Ñƒ Ñ€ÑÐ´Ð¾Ð¼. ÐšÑƒÐ»Ð´Ð°ÑƒÐ½ â€” Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¾Ð´Ð½Ð¾
         * ÑƒÐ´ÐµÑ€Ð¶Ð°Ð½Ð¸Ðµ Ð½Ðµ ÑÑŠÐµÐ´Ð°Ð»Ð¾ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñƒ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€.
         * @param {number} delta â€” ÑÐµÐºÑƒÐ½Ð´Ñ‹ Ñ Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³Ð¾ ÐºÐ°Ð´Ñ€Ð°
         */
        sweepDustpanAtAim: function (delta) {
            this.dustpanCooldown -= delta || 0;
            if (this.dustpanCooldown > 0) return;

            var data = window.GameData;

            if (data.stamina < this.staminaMinToWork) return;

            if (!this.lastHit || !this.lastHit.object.userData.isDebris) return;
            if (this.lastHit.distance > this.interactDistance) return;

            // sweepWithDustpan Ð²ÐµÑ€Ð½Ñ‘Ñ‚ false, ÐµÑÐ»Ð¸ ÐºÑƒÑ‡Ð° ÑÐ»Ð¸ÑˆÐºÐ¾Ð¼ Ð¼Ð°Ð»Ð°
            if (this.sweepWithDustpan(this.lastHit.object.position)) {
                this.dustpanCooldown = 0.35;
            }
        },

        /**
         * Ð¡Ð¾Ð²Ð¾Ðº: ÑÐ¾Ð±Ð¸Ñ€Ð°ÐµÑ‚ Ð²ÑÑŽ ÐºÑƒÑ‡Ñƒ Ð¼ÑƒÑÐ¾Ñ€Ð° Ð² Ñ€Ð°Ð´Ð¸ÑƒÑÐµ 1 Ð¼ Ð¾Ñ‚ Ñ‚Ð¾Ñ‡ÐºÐ¸.
         * Ð¢Ñ€ÐµÐ±Ð¾Ð²Ð°Ð½Ð¸Ðµ Ð¢Ð— â€” Ð¼Ð¸Ð½Ð¸Ð¼ÑƒÐ¼ 3 ÐºÑƒÑÐºÐ°, Ð¸Ð½Ð°Ñ‡Ðµ ÑÐ¾Ð²ÐºÐ¾Ð¼ Ð½ÐµÑƒÐ´Ð¾Ð±Ð½Ð¾.
         * @param {THREE.Vector3} point â€” Ñ†ÐµÐ½Ñ‚Ñ€ ÐºÑƒÑ‡Ð¸ (Ñ‚Ð¾Ñ‡ÐºÐ° Ð¿Ð¾Ð¿Ð°Ð´Ð°Ð½Ð¸Ñ)
         * @returns {boolean} true, ÐµÑÐ»Ð¸ ÐºÑƒÑ‡Ð° ÑÐ¾Ð±Ñ€Ð°Ð½Ð°
         */
        sweepWithDustpan: function (point) {
            var renderer = window.GameRenderer;
            var data = window.GameData;

            // Ð˜Ñ‰ÐµÐ¼ Ð¾Ð±Ñ€Ñ‹Ð²ÐºÐ¸ Ð² ÐžÐ‘ÐžÐ˜Ð¥ ÑÐ¿Ð¸ÑÐºÐ°Ñ…: Ð»ÐµÑ‚Ð°ÑŽÑ‰Ð¸Ðµ Ð¶Ð¸Ð²ÑƒÑ‚ Ð² debrisObjects,
            // Ð° Ð¿Ñ€Ð¸Ð·ÐµÐ¼Ð»Ð¸Ð²ÑˆÐ¸ÐµÑÑ Ð¾ÑÑ‚Ð°ÑŽÑ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð² interactableObjects
            // (updateDebris ÑÐ½Ð¸Ð¼Ð°ÐµÑ‚ Ð¸Ñ… Ñ Ñ„Ð¸Ð·Ð¸ÐºÐ¸ Ð¿Ñ€Ð¸ Ð¿Ð°Ð´ÐµÐ½Ð¸Ð¸).
            // ÐŸÐ¾Ð¸ÑÐº Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ debrisObjects Ð¸ Ð±Ñ‹Ð» Ð¿Ñ€Ð¸Ñ‡Ð¸Ð½Ð¾Ð¹ Â«ÑÐ¾Ð²Ð¾Ðº Ð½Ðµ
            // Ð½Ð°Ð¿Ð¾Ð»Ð½ÑÐµÑ‚ÑÑÂ»: Ð»ÐµÐ¶Ð°Ñ‰Ð¸Ð¹ Ð¼ÑƒÑÐ¾Ñ€ ÑÐ¾Ð²ÐºÐ¾Ð¼ Ð½Ðµ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ð»ÑÑ.
            var found = [];
            var seen = [];

            function collectNear(list, point) {
                for (var i = list.length - 1; i >= 0; i--) {
                    var piece = list[i];
                    if (!piece.userData || !piece.userData.isDebris) continue;
                    if (seen.indexOf(piece) !== -1) continue;
                    if (piece.position.distanceTo(point) <= 1.0) {
                        seen.push(piece);
                        found.push(piece);
                    }
                }
            }

            collectNear(renderer.debrisObjects, point);
            collectNear(renderer.interactableObjects, point);

            // ÐœÐ°Ð»Ð¾ Ð¼ÑƒÑÐ¾Ñ€Ð° â€” ÑÐ¾Ð²ÐºÐ¾Ð¼ Ð½ÐµÑ‡ÐµÐ³Ð¾ Ð´ÐµÐ»Ð°Ñ‚ÑŒ, ÑÐ¾Ð±Ð¸Ñ€Ð°ÐµÐ¼ ÐºÐ°Ðº Ð¾Ð±Ñ‹Ñ‡Ð½Ð¾
            if (found.length < 3) return false;

            // Ð¡Ð¾Ð²Ð¾Ðº Ð¿Ð¾Ð»Ð¾Ð½?
            if (data.dustpanFill >= data.dustpanMax) {
                window.GameData.ui.currentHint = "Ð¡Ð¾Ð²Ð¾Ðº Ð¿Ð¾Ð»Ð¾Ð½, Ð²Ñ‹Ñ‚Ñ€ÑÑ…Ð½Ð¸ Ð² Ð¼ÐµÑˆÐ¾Ðº";
                window.GameData.ui.hintVisible = true;
                this.renderHint();
                return true;
            }

            // Ð¡ÐºÐ¾Ð»ÑŒÐºÐ¾ Ð²Ð»ÐµÐ·ÐµÑ‚ Ð² ÑÐ¾Ð²Ð¾Ðº
            var spaceInDustpan = data.dustpanMax - data.dustpanFill;
            var take = Math.min(spaceInDustpan, found.length);

            for (var j = 0; j < take; j++) {
                var piece = found[j];
                renderer.scene.remove(piece);

                var dIdx = renderer.debrisObjects.indexOf(piece);
                if (dIdx !== -1) renderer.debrisObjects.splice(dIdx, 1);

                var iIdx = renderer.interactableObjects.indexOf(piece);
                if (iIdx !== -1) renderer.interactableObjects.splice(iIdx, 1);
            }

            // ÐœÑƒÑÐ¾Ñ€ ÐºÐ¾Ð¿Ð¸Ñ‚ÑÑ Ð’ ÑÐ¾Ð²ÐºÐµ: Ð² Ð¼ÐµÑˆÐ¾Ðº Ð¾Ð½ Ð¿Ð¾Ð¿Ð°Ð´Ñ‘Ñ‚, ÐºÐ¾Ð³Ð´Ð° Ð²Ñ‹Ñ‚Ñ€ÑÑ…Ð½ÐµÐ¼
            data.dustpanFill += take;

            // Ð¡Ñ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ð±ÐµÑ€Ñ‘Ð¼ Ð¿Ð¾ Ð¸Ð¼ÐµÐ½Ð¸ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð°, Ð° Ð½Ðµ Ð¿Ð¾ Â«Ð»ÐµÐ²Ð¾Ð¹ Ñ€ÑƒÐºÐµÂ»:
            // Ñ preferredHand ÑÐ¾Ð²Ð¾Ðº Ð¼Ð¾Ð¶ÐµÑ‚ Ð»ÐµÐ¶Ð°Ñ‚ÑŒ Ð² Ð»ÑŽÐ±Ð¾Ð¹ Ñ€ÑƒÐºÐµ
            var dustpanTool = this.tools.dustpan;
            var cost = dustpanTool ? (dustpanTool.staminaCost || 0) : 0;
            data.stamina = Math.max(0, data.stamina - cost);

            data.addHistory("Ð¡Ð¾Ð²ÐºÐ¾Ð¼ ÑÐ¾Ð±Ñ€Ð°Ð½Ð¾ ÐºÑƒÑÐºÐ¾Ð²: " + take + ". Ð¡Ð¾Ð²Ð¾Ðº: " + data.dustpanFill + "/" + data.dustpanMax);

            this.renderTrash();
            this.renderStamina();
            this.renderHeldItems();

            return true;
        },

        /**
         * Ð’ÐµÐ½Ð¸Ðº: Ð¿Ð¾Ð´Ð¼ÐµÑ‚Ð°ÐµÑ‚ Ð±Ð»Ð¸Ð¶Ð°Ð¹ÑˆÐ¸Ð¹ Ð¼ÑƒÑÐ¾Ñ€ Ðº Ñ†ÐµÐ½Ñ‚Ñ€Ñƒ ÐºÐ¾Ð¼Ð½Ð°Ñ‚Ñ‹.
         * Ð’Ñ‹Ð·Ñ‹Ð²Ð°ÐµÑ‚ÑÑ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€, Ð¿Ð¾ÐºÐ° Ð·Ð°Ð¶Ð°Ñ‚Ð° Ð›ÐšÐœ, Ð½Ð¾ Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾ Ð¼ÐµÑ‚Ñ‘Ñ‚
         * Ð½Ðµ Ñ‡Ð°Ñ‰Ðµ, Ñ‡ÐµÐ¼ Ñ€Ð°Ð· Ð² broomCooldown ÑÐµÐºÑƒÐ½Ð´.
         * @param {number} delta â€” ÑÐµÐºÑƒÐ½Ð´Ñ‹ Ñ Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³Ð¾ ÐºÐ°Ð´Ñ€Ð°
         */
        sweepWithBroom: function (delta) {
            // ÐœÐµÑ‚Ñ‘Ñ‚ Ð²ÐµÐ½Ð¸Ðº Ð² Ð›Ð®Ð‘ÐžÐ™ Ñ€ÑƒÐºÐµ: Ð¿Ð¾ÑÐ»Ðµ Ð²Ð²ÐµÐ´ÐµÐ½Ð¸Ñ preferredHand
            // Ð¾Ð½ Ð¼Ð¾Ð¶ÐµÑ‚ Ð»ÐµÐ¶Ð°Ñ‚ÑŒ Ð¸ ÑÐ»ÐµÐ²Ð°, Ð¸ ÑÐ¿Ñ€Ð°Ð²Ð°
            if (!window.GameData.handWith('broom')) return;

            // ÐšÑƒÐ»Ð´Ð°ÑƒÐ½: Ð¸Ð½Ð°Ñ‡Ðµ Ð¾Ð´Ð½Ð¾ ÑƒÐ´ÐµÑ€Ð¶Ð°Ð½Ð¸Ðµ Ð›ÐšÐœ ÑÑŠÐµÐ´Ð°Ð»Ð¾ Ð±Ñ‹ Ð²ÑÑŽ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñƒ
            this.broomCooldown -= delta || 0;
            if (this.broomCooldown > 0) return;

            var renderer = window.GameRenderer;
            var data = window.GameData;
            var cam = renderer.camera;

            if (data.stamina < this.staminaMinToWork) return;

            // Ð˜Ñ‰ÐµÐ¼ Ð¾Ð±Ñ€Ñ‹Ð²Ð¾Ðº, Ð½Ð° ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ð¹ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚ Ð¸Ð³Ñ€Ð¾Ðº (Ð² Ð¿Ñ€ÐµÐ´ÐµÐ»Ð°Ñ… 2.5 Ð¼)
            if (!this.lastHit || !this.lastHit.object.userData.isDebris) return;
            if (this.lastHit.distance > this.interactDistance) return;

            var piece = this.lastHit.object;
            var vel = piece.userData.velocity;
            if (!vel) return;

            // Ð¢Ð¾Ð»ÐºÐ°ÐµÐ¼ Ð¾Ñ‚ Ð¸Ð³Ñ€Ð¾ÐºÐ°: ÑÑ‡Ð¸Ñ‚Ð°ÐµÐ¼ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¾Ñ‚ ÐºÐ°Ð¼ÐµÑ€Ñ‹ Ðº Ð¾Ð±Ñ€Ñ‹Ð²ÐºÑƒ
            var dx = piece.position.x - cam.position.x;
            var dz = piece.position.z - cam.position.z;
            var len = Math.hypot(dx, dz);
            if (len < 0.001) return;

            vel.x += (dx / len) * 1.2;
            vel.z += (dz / len) * 1.2;
            vel.y += 0.4; // Ð¿Ð¾Ð´ÑÐºÐ¾Ðº, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÐºÑƒÑÐ¾Ðº Ð½Ðµ Â«Ð¿Ñ€Ð¸Ð»Ð¸Ð¿Ð°Ð»Â» Ðº Ð¿Ð¾Ð»Ñƒ

            // ÐžÐ±Ñ€Ñ‹Ð²Ð¾Ðº Ð¼Ð¾Ð³ ÑƒÐ¶Ðµ ÑƒÐ¿Ð°ÑÑ‚ÑŒ Ð¸ Ð²Ñ‹Ð¿Ð°ÑÑ‚ÑŒ Ð¸Ð· ÑÐ¿Ð¸ÑÐºÐ° Ñ„Ð¸Ð·Ð¸ÐºÐ¸ â€” Ð²ÐµÑ€Ð½Ñ‘Ð¼
            if (renderer.debrisObjects.indexOf(piece) === -1) {
                renderer.debrisObjects.push(piece);
            }

            data.stamina = Math.max(0, data.stamina - 1);
            this.renderStamina();

            this.broomCooldown = 0.25;
        },

        /**
         * Ð˜Ð½Ð´Ð¸ÐºÐ°Ñ‚Ð¾Ñ€ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð¾Ð² Ð² Ñ€ÑƒÐºÐ°Ñ…: Ð´Ð²Ðµ ÑÑ‚Ñ€Ð¾ÐºÐ¸ â€” Ð¿Ñ€Ð°Ð²Ð°Ñ Ð¸ Ð»ÐµÐ²Ð°Ñ.
         */
        renderHeldItems: function () {
            var data = window.GameData;

            function label(name) {
                if (!name) return 'Ð¿ÑƒÑÑ‚Ð¾';
                var icon = {
                    scraper: 'ðŸ–Œï¸',
                    roller: 'ðŸŽ¨',
                    broom: 'ðŸ§¹',
                    dustpan: 'ðŸ¥„'
                }[name] || '';
                var titles = {
                    scraper: 'ÑÐºÑ€ÐµÐ±Ð¾Ðº',
                    roller: 'Ð²Ð°Ð»Ð¸Ðº',
                    broom: 'Ð²ÐµÐ½Ð¸Ðº',
                    dustpan: 'ÑÐ¾Ð²Ð¾Ðº'
                }[name] || name;
                return (icon ? icon + ' ' : '') + titles;
            }

            var bagCarried = this.isCarryingBag();

            var rightText = bagCarried ? 'ðŸ—‘ï¸ Ð¼ÐµÑˆÐ¾Ðº' : label(data.rightHand);
            var leftText = bagCarried ? 'Ð¿ÑƒÑÑ‚Ð¾' : label(data.leftHand);

            var text = 'ÐŸÑ€Ð°Ð²Ð°Ñ: ' + rightText + '\nÐ›ÐµÐ²Ð°Ñ: ' + leftText;

            // Ð˜Ð½Ð´Ð¸ÐºÐ°Ñ‚Ð¾Ñ€ Ð½Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ ÑÐ¾Ð²ÐºÐ°, ÐµÑÐ»Ð¸ Ð¾Ð½ Ð² Ñ€ÑƒÐºÐµ
            if (data.handWith('dustpan')) {
                text += '\nðŸ¥„ Ð¡Ð¾Ð²Ð¾Ðº: ' + data.dustpanFill + '/' + data.dustpanMax;
            }

            window.GameRenderer.showHeldItem(text);
        },

        /**
         * ÐœÐµÑˆÐ¾Ðº Ð² Ñ€ÑƒÐºÐ°Ñ…: Ð´ÐµÑ€Ð¶Ð¸Ð¼ ÐµÐ³Ð¾ Ð¿ÐµÑ€ÐµÐ´ ÐºÐ°Ð¼ÐµÑ€Ð¾Ð¹.
         * Ð¡Ð¼ÐµÑ‰ÐµÐ½Ð¸Ðµ ÑÑ‡Ð¸Ñ‚Ð°ÐµÑ‚ÑÑ Ð² Ð¼Ð¸Ñ€Ð¾Ð²Ñ‹Ñ… Ð¾ÑÑÑ… Ñ‡ÐµÑ€ÐµÐ· Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð²Ð·Ð³Ð»ÑÐ´Ð°,
         * Ð¿Ð¾ÑÑ‚Ð¾Ð¼Ñƒ Ð¼ÐµÑˆÐ¾Ðº Ð²ÑÐµÐ³Ð´Ð° Ð²Ð¸ÑÐ¸Ñ‚ Ð¿ÐµÑ€ÐµÐ´ Ð¸Ð³Ñ€Ð¾ÐºÐ¾Ð¼, Ð° Ð½Ðµ Â«Ð² Ð³Ð¾Ð»Ð¾Ð²ÐµÂ».
         */
        updateCarriedBag: function () {
            var bag = window.GameRenderer.trashBag;
            if (!bag || !bag.userData.isCarried) return;

            var cam = window.GameRenderer.camera;

            // ÐÐ°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð²Ð·Ð³Ð»ÑÐ´Ð° (Ñ ÑƒÑ‡Ñ‘Ñ‚Ð¾Ð¼ Ð½Ð°ÐºÐ»Ð¾Ð½Ð°)
            var forward = new THREE.Vector3();
            cam.getWorldDirection(forward);

            // Ð§ÑƒÑ‚ÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð¸ Ð½Ð¸Ð¶Ðµ: Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¼ÐµÑˆÐ¾Ðº Ð½Ðµ Ð·Ð°ÐºÑ€Ñ‹Ð²Ð°Ð» Ñ†ÐµÐ½Ñ‚Ñ€ ÑÐºÑ€Ð°Ð½Ð°
            var right = new THREE.Vector3();
            right.crossVectors(forward, cam.up).normalize();

            bag.position.copy(cam.position)
                .addScaledVector(forward, 0.75)
                .addScaledVector(right, 0.35);
            bag.position.y -= 0.55;

            // ÐœÐµÐ´Ð»ÐµÐ½Ð½Ð¾ Ð²Ñ€Ð°Ñ‰Ð°ÐµÐ¼, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¼ÐµÑˆÐ¾Ðº Â«Ñ‡Ð¸Ñ‚Ð°Ð»ÑÑÂ» ÐºÐ°Ðº Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚ Ð² Ñ€ÑƒÐºÐ°Ñ…
            bag.rotation.y += 0.01;
        },

        /**
         * ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÑ‚, Ð½Ðµ Ð½Ð°Ñ‚ÐºÐ½ÑƒÐ»ÑÑ Ð»Ð¸ Ð¸Ð³Ñ€Ð¾Ðº Ð½Ð° Ð»ÐµÐ¶Ð°Ñ‰Ð¸Ð¹ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚,
         * Ð¸ Ð¿Ð¸Ð½Ð°ÐµÑ‚ ÐµÐ³Ð¾.
         * @param {THREE.Vector3} playerVelocity â€” ÑÐºÐ¾Ñ€Ð¾ÑÑ‚ÑŒ Ð¸Ð³Ñ€Ð¾ÐºÐ°, Ð¼/Ñ
         */
        kickNearbyTools: function (playerVelocity) {
            var cam = window.GameRenderer.camera;
            var list = window.GameRenderer.interactableObjects;

            for (var i = 0; i < list.length; i++) {
                var tool = list[i];

                if (!tool.userData || tool.userData.type !== 'tool') continue;
                if (tool.userData.isHeld) continue;

                // Ð¡Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ Ð³Ð¾Ñ€Ð¸Ð·Ð¾Ð½Ñ‚Ð°Ð»Ð¸: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ Ð»ÐµÐ¶Ð¸Ñ‚ Ð½Ð° Ð¿Ð¾Ð»Ñƒ,
                // Ð° ÐºÐ°Ð¼ÐµÑ€Ð° Ð½Ð° Ð²Ñ‹ÑÐ¾Ñ‚Ðµ 1.7 Ð¼ â€” Ð² 3D Ñ€Ð°ÑÑÑ‚Ð¾ÑÐ½Ð¸Ðµ Ð±Ñ‹Ð»Ð¾ Ð±Ñ‹ Ð²ÑÐµÐ³Ð´Ð° > 1
                var dx = cam.position.x - tool.position.x;
                var dz = cam.position.z - tool.position.z;

                if (Math.hypot(dx, dz) < 0.6) {
                    window.GameRenderer.kickTool(playerVelocity, tool);
                }
            }
        },

        /**
         * Ð”Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ WASD + ÐºÐ¾Ð»Ð»Ð¸Ð·Ð¸Ð¸.
         * ÐŸÐ¾Ð·Ð¸Ñ†Ð¸Ñ Ð¿Ð¸ÑˆÐµÑ‚ÑÑ Ð² GameData (Ð´Ð°Ð½Ð½Ñ‹Ðµ), Ð¾Ñ‚Ñ‚ÑƒÐ´Ð° Ð¶Ðµ Ñ‡Ð¸Ñ‚Ð°ÐµÑ‚ÑÑ ÐºÐ°Ð¼ÐµÑ€Ð¾Ð¹.
         * @param {number} delta â€” ÑÐµÐºÑƒÐ½Ð´Ñ‹ Ñ Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³Ð¾ ÐºÐ°Ð´Ñ€Ð°
         */
        updateMovement: function (delta) {
            var cam = window.GameRenderer.camera;
            var data = window.GameData;

            // ÐÐ°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Â«Ð²Ð¿ÐµÑ€Ñ‘Ð´Â» Ð¿Ð¾ yaw (Ð±ÐµÐ· ÑƒÑ‡Ñ‘Ñ‚Ð° Ð½Ð°ÐºÐ»Ð¾Ð½Ð° Ð³Ð¾Ð»Ð¾Ð²Ñ‹,
            // Ð¸Ð½Ð°Ñ‡Ðµ Ð¿Ñ€Ð¸ Ð²Ð·Ð³Ð»ÑÐ´Ðµ Ð²Ð²ÐµÑ€Ñ… Ð¸Ð³Ñ€Ð¾Ðº Ð½Ð°Ñ‡Ð°Ð» Ð±Ñ‹ Ð»ÐµÑ‚Ð°Ñ‚ÑŒ)
            var forwardX = -Math.sin(this.yaw);
            var forwardZ = -Math.cos(this.yaw);

            // ÐÐ°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Â«Ð²Ð¿Ñ€Ð°Ð²Ð¾Â»
            var rightX = Math.cos(this.yaw);
            var rightZ = -Math.sin(this.yaw);

            var mx = 0;
            var mz = 0;

            if (this.keys.w) { mx += forwardX; mz += forwardZ; }
            if (this.keys.s) { mx -= forwardX; mz -= forwardZ; }
            if (this.keys.d) { mx += rightX; mz += rightZ; }
            if (this.keys.a) { mx -= rightX; mz -= rightZ; }

            // ÐÐ¾Ñ€Ð¼Ð°Ð»Ð¸Ð·ÑƒÐµÐ¼ Ð²ÐµÐºÑ‚Ð¾Ñ€: Ð´Ð¸Ð°Ð³Ð¾Ð½Ð°Ð»ÑŒ Ð½Ðµ Ð´Ð¾Ð»Ð¶Ð½Ð° Ð±Ñ‹Ñ‚ÑŒ Ð±Ñ‹ÑÑ‚Ñ€ÐµÐµ Ð¿Ñ€ÑÐ¼Ð¾Ð¹
            var len = Math.hypot(mx, mz);
            if (len > 0) {
                var step = data.player.speed * delta;
                mx = (mx / len) * step;
                mz = (mz / len) * step;

                // ÐŸÑ€ÐµÐ´Ð²Ñ‹Ñ‡Ð¸ÑÐ»ÐµÐ½Ð¸Ðµ Ð½Ð¾Ð²Ð¾Ð¹ Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ð¸
                var newX = cam.position.x + mx;
                var newZ = cam.position.z + mz;

                // ÐšÐ¾Ð»Ð»Ð¸Ð·Ð¸Ñ AABB: Ð½Ðµ Ð²Ñ‹Ð¿ÑƒÑÐºÐ°ÐµÐ¼ Ð¸Ð³Ñ€Ð¾ÐºÐ° Ð·Ð° Ð¿Ñ€ÐµÐ´ÐµÐ»Ñ‹ ÐºÐ¾Ð¼Ð½Ð°Ñ‚Ñ‹
                // Ñ ÑƒÑ‡Ñ‘Ñ‚Ð¾Ð¼ Â«Ñ€Ð°Ð´Ð¸ÑƒÑÐ° Ñ‚ÐµÐ»Ð°Â»
                var halfW = data.world.roomWidth / 2 - this.playerRadius;
                var halfD = data.world.roomDepth / 2 - this.playerRadius;

                if (newX < -halfW) newX = -halfW;
                if (newX > halfW) newX = halfW;
                if (newZ < -halfD) newZ = -halfD;
                if (newZ > halfD) newZ = halfD;

                cam.position.x = newX;
                cam.position.z = newZ;

                // ÐŸÐ¸Ð½Ð°ÐµÐ¼ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹, Ð½Ð° ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ðµ Ð½Ð°Ñ‚ÐºÐ½ÑƒÐ»Ð¸ÑÑŒ Ð¿Ñ€Ð¸ Ñ…Ð¾Ð´ÑŒÐ±Ðµ.
                // ÐÐ°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ ÑƒÐ´Ð°Ñ€Ð° â€” Ð¿Ð¾ Ð²ÐµÐºÑ‚Ð¾Ñ€Ñƒ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ñ Ð¸Ð³Ñ€Ð¾ÐºÐ°,
                // Ð¿Ñ€Ð¸Ð²ÐµÐ´Ñ‘Ð½Ð½Ð¾Ð¼Ñƒ Ðº Ð¼ÐµÑ‚Ñ€Ð°Ð¼ Ð² ÑÐµÐºÑƒÐ½Ð´Ñƒ.
                var playerVel = new THREE.Vector3(mx / delta, 0, mz / delta);
                this.kickNearbyTools(playerVel);
            }

            // ÐšÐ°Ð¼ÐµÑ€Ð° Ð²ÑÐµÐ³Ð´Ð° Ð½Ð° Ð²Ñ‹ÑÐ¾Ñ‚Ðµ Ð³Ð»Ð°Ð·
            cam.position.y = data.player.position.y;

            // Ð¡Ð¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð¸Ñ€ÑƒÐµÐ¼ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ñ Ð³Ñ€Ð°Ñ„Ð¸ÐºÐ¾Ð¹: GameData â€” Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸Ðº Ð¸ÑÑ‚Ð¸Ð½Ñ‹
            data.player.position.x = cam.position.x;
            data.player.position.z = cam.position.z;
        },

        /**
         * ÐŸÑƒÑÐºÐ°ÐµÑ‚ Ð»ÑƒÑ‡ Ð¸Ð· Ñ†ÐµÐ½Ñ‚Ñ€Ð° ÐºÐ°Ð¼ÐµÑ€Ñ‹ Ð¸ Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÐµÑ‚ ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚Ð½ÑƒÑŽ Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÑƒ.
         * Ð’Ñ‹Ð·Ñ‹Ð²Ð°ÐµÑ‚ÑÑ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€, Ð¿Ð¾ÑÑ‚Ð¾Ð¼Ñƒ Ð²Ð°Ð¶Ð½Ð¾ Ð½Ðµ ÑÐ¾Ð·Ð´Ð°Ð²Ð°Ñ‚ÑŒ Ð¾Ð±ÑŠÐµÐºÑ‚Ð¾Ð²
         * Ð²Ð½ÑƒÑ‚Ñ€Ð¸ (Ð²ÐµÐºÑ‚Ð¾Ñ€ rayCenter Ð¿ÐµÑ€ÐµÐ¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÑ‚ÑÑ).
         */
        updateRaycast: function () {
            var cam = window.GameRenderer.camera;

            this.raycaster.setFromCamera(this.rayCenter, cam);

            var intersects = this.raycaster.intersectObjects(
                window.GameRenderer.interactableObjects,
                true // Ñ€ÐµÐºÑƒÑ€ÑÐ¸Ð²Ð½Ð¾: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ â€” ÑÑ‚Ð¾ Group, Ñƒ Ð³Ñ€ÑƒÐ¿Ð¿Ñ‹
                     // Ð½ÐµÑ‚ ÑÐ²Ð¾ÐµÐ¹ Ð³ÐµÐ¾Ð¼ÐµÑ‚Ñ€Ð¸Ð¸, Ð»ÑƒÑ‡ Ð¿Ð¾Ð¿Ð°Ð´Ð°ÐµÑ‚ Ð² Ð´Ð¾Ñ‡ÐµÑ€Ð½Ð¸Ðµ Ð¼ÐµÑˆÐ¸
            );

            if (intersects.length > 0) {
                this.lastHit = intersects[0];

                var userData = this.lastHit.object.userData || {};

                // Ð”Ð»Ñ Group (Ð²ÐµÐ½Ð¸Ðº, ÑÐ¾Ð²Ð¾Ðº) userData Ð»ÐµÐ¶Ð¸Ñ‚ Ð½Ð° Ñ€Ð¾Ð´Ð¸Ñ‚ÐµÐ»Ðµ
                var resolved = this.resolveInteractable(this.lastHit.object);
                userData = resolved.userData || {};

                // Ð¢ÐµÐºÑÑ‚ Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ¸ ÑÑ‚Ñ€Ð¾Ð¸Ð¼ Ñ ÑƒÑ‡Ñ‘Ñ‚Ð¾Ð¼ Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¾Ð³Ð¾ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð°
                var hint = this.buildHint(userData);

                if (hint) {
                    // Ð˜Ð·Ð´Ð°Ð»ÐµÐºÐ° Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð¿Ð¾Ð´Ð¾Ð¹Ñ‚Ð¸, Ð²Ð±Ð»Ð¸Ð·Ð¸ â€” ÑÐ°Ð¼Ð¾ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ
                    if (this.lastHit.distance > this.interactDistance) {
                        window.GameData.ui.currentHint = "ÐŸÐ¾Ð´Ð¾Ð¹Ð´Ð¸ Ð±Ð»Ð¸Ð¶Ðµ";
                    } else {
                        window.GameData.ui.currentHint = hint;
                    }
                    window.GameData.ui.hintVisible = true;
                } else {
                    window.GameData.ui.currentHint = "";
                    window.GameData.ui.hintVisible = false;
                }
            } else {
                this.lastHit = null;
                window.GameData.ui.currentHint = "";
                window.GameData.ui.hintVisible = false;
            }

            // ÐŸÑ€Ð¸Ð¼ÐµÐ½ÑÐµÐ¼ ÑÐ¾ÑÑ‚Ð¾ÑÐ½Ð¸Ðµ UI Ðº DOM
            this.renderHint();
        },

        /**
         * ÐŸÐµÑ€ÐµÐ½Ð¾ÑÐ¸Ñ‚ GameData.ui Ð½Ð° ÑÐºÑ€Ð°Ð½.
         * UI Ñ‡Ð¸Ñ‚Ð°ÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð´Ð°Ð½Ð½Ñ‹Ðµ â€” Ð¿Ñ€ÑÐ¼Ñ‹Ñ… Ð¾Ð±Ñ€Ð°Ñ‰ÐµÐ½Ð¸Ð¹ Ðº Ð¾Ð±ÑŠÐµÐºÑ‚Ð°Ð¼ ÑÑ†ÐµÐ½Ñ‹ Ð·Ð´ÐµÑÑŒ Ð½ÐµÑ‚.
         */
        renderHint: function () {
            if (!this.hintEl) return;

            var ui = window.GameData.ui;

            if (ui.hintVisible && ui.currentHint) {
                this.hintEl.textContent = ui.currentHint;
                this.hintEl.classList.add('visible');
            } else {
                this.hintEl.classList.remove('visible');
            }
        },

        /**
         * Ð•Ð´Ð¸Ð½Ñ‹Ð¹ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ¸ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð°: "ðŸ”§ Ð¡ÐºÑ€ÐµÐ±Ð¾Ðº".
         * ÐšÐ»Ð°Ð²Ð¸Ñˆ Ð²Ñ‹Ð±Ð¾Ñ€Ð° Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½ÐµÑ‚ â€” Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚ Ð±ÐµÑ€ÑƒÑ‚ Ñ Ð¿Ð¾Ð»Ð°.
         * @param {object} tool - Ð·Ð°Ð¿Ð¸ÑÑŒ Ð¸Ð· Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ñ‹ tools
         * @returns {string}
         */
        formatTool: function (tool) {
            return tool.icon
                ? tool.icon + " " + tool.label
                : tool.label;
        },

        /**
         * ÐžÐ±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ Ð²ÑÑ‘, Ñ‡Ñ‚Ð¾ ÐºÐ°ÑÐ°ÐµÑ‚ÑÑ Ñ€ÑƒÐº: Ð»ÐµÐ³ÐµÐ½Ð´Ñƒ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð¾Ð²
         * (Ð¿Ð¾Ð´ÑÐ²ÐµÑ‚ÐºÐ° Ñ‚ÐµÑ…, Ñ‡Ñ‚Ð¾ Ð² Ñ€ÑƒÐºÐ°Ñ…), ÑÑ‚Ð°Ñ‚ÑƒÑ Ð¼ÐµÑˆÐºÐ° Ð¸ Ð¸Ð½Ð´Ð¸ÐºÐ°Ñ‚Ð¾Ñ€
         * Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð¾Ð² Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð¼ Ð½Ð¸Ð¶Ð½ÐµÐ¼ ÑƒÐ³Ð»Ñƒ.
         */
        updateHandsUI: function () {
            this.renderToolsPanel();
            this.renderBagStatus();
            this.renderHeldItems();
        },

        /**
         * Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ð¼ÐµÑˆÐºÐ° Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð¼ Ð½Ð¸Ð¶Ð½ÐµÐ¼ ÑƒÐ³Ð»Ñƒ: "ÐœÐµÑˆÐ¾Ðº: 3/5".
         * ÐŸÑ€Ð¸ Ð·Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ð¸ Ð¿Ð¾Ð´ÑÐ²ÐµÑ‡Ð¸Ð²Ð°ÐµÐ¼ ÑÑ‚Ñ€Ð¾ÐºÑƒ ÐºÑ€Ð°ÑÐ½Ñ‹Ð¼.
         */
        renderBagStatus: function () {
            if (!this.bagStatusEl) return;

            var data = window.GameData;
            var full = data.trashCount >= data.maxTrash;

            this.bagStatusEl.textContent = 'ÐœÐµÑˆÐ¾Ðº: ' + data.trashCount + '/' + data.maxTrash +
                (full ? ' (ÐŸÐžÐ›ÐžÐ)' : '');

            if (full) {
                this.bagStatusEl.classList.add('bag-full');
            } else {
                this.bagStatusEl.classList.remove('bag-full');
            }
        },

        /**
         * ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÑ‚ Ð¿Ð¾Ð»Ð¾ÑÐºÑƒ Ð¸ Ñ‚ÐµÐºÑÑ‚ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹.
         */
        renderStamina: function () {
            var data = window.GameData;
            var pct = Math.round((data.stamina / data.maxStamina) * 100);

            if (this.staminaFillEl) {
                this.staminaFillEl.style.width = pct + '%';
                // Ð¦Ð²ÐµÑ‚ Ð¼ÐµÐ½ÑÐµÑ‚ÑÑ Ð¿Ð¾ Ð¾ÑÑ‚Ð°Ñ‚ÐºÑƒ: Ð·ÐµÐ»Ñ‘Ð½Ñ‹Ð¹ â†’ Ð¶Ñ‘Ð»Ñ‚Ñ‹Ð¹ â†’ ÐºÑ€Ð°ÑÐ½Ñ‹Ð¹
                if (pct > 60) {
                    this.staminaFillEl.style.background = '#4caf50';
                } else if (pct > 25) {
                    this.staminaFillEl.style.background = '#ffc107';
                } else {
                    this.staminaFillEl.style.background = '#f44336';
                }
            }

            if (this.staminaTextEl) {
                this.staminaTextEl.textContent = Math.round(data.stamina) + '/' + data.maxStamina;
            }
        },

        /**
         * ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÑ‚ ÑÑ‡Ñ‘Ñ‚Ñ‡Ð¸Ðº Ð¼ÑƒÑÐ¾Ñ€Ð° Ð² HUD.
         */
        renderTrash: function () {
            var data = window.GameData;
            if (this.trashEl) {
                this.trashEl.textContent = 'ÐœÑƒÑÐ¾Ñ€: ' + data.trashCount + '/' + data.maxTrash;
            }

            // Ð”ÐµÑ€Ð¶Ð¸Ð¼ Ð² ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ðµ Ð¸Ð½Ð´Ð¸ÐºÐ°Ñ‚Ð¾Ñ€ Ð¼ÐµÑˆÐºÐ° Ð² Ð¿Ñ€Ð°Ð²Ð¾Ð¼ ÑƒÐ³Ð»Ñƒ
            this.renderBagStatus();
        },

        /**
         * Ð›ÐµÐ³ÐµÐ½Ð´Ð° Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð¾Ð² Ð² info-panel.
         * ÐšÐ»Ð°Ð²Ð¸Ñˆ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½ÐµÑ‚: Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ Ð±ÐµÑ€ÑƒÑ‚ Ñ Ð¿Ð¾Ð»Ð° Ð¿Ð¾ E.
         */
        renderToolsPanel: function () {
            if (!this.toolsPanelEl) return;

            var data = window.GameData;
            var parts = [];

            for (var key in this.tools) {
                if (!this.tools.hasOwnProperty(key)) continue;

                var text = this.formatTool(this.tools[key]);

                // ÐŸÐ¾Ð´ÑÐ²ÐµÑ‡Ð¸Ð²Ð°ÐµÐ¼ Ñ‚Ðµ, Ñ‡Ñ‚Ð¾ ÑÐµÐ¹Ñ‡Ð°Ñ Ð² Ñ€ÑƒÐºÐ°Ñ…
                var inHands = (data.rightHand === key || data.leftHand === key);

                parts.push(
                    inHands
                        ? '<span class="tool-active">' + text + '</span>'
                        : '<span class="tool-inactive">' + text + '</span>'
                );
            }

            this.toolsPanelEl.innerHTML =
                parts.join(" | ") + '<br>E â€” Ð²Ð·ÑÑ‚ÑŒ/Ð¿Ð¾Ð»Ð¾Ð¶Ð¸Ñ‚ÑŒ | Q â€” Ð¿Ð¾Ð»Ð¾Ð¶Ð¸Ñ‚ÑŒ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚';
        },

        /**
         * Ð ÐµÐ³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ñ ÑÑ‚Ð°Ð¼Ð¸Ð½Ñ‹ Ð² Ð¿Ð¾ÐºÐ¾Ðµ.
         * ÐžÑ‚Ð´Ñ‹Ñ… = Ð½Ðµ Ð½Ð°Ð¶Ð°Ñ‚Ñ‹ ÐºÐ»Ð°Ð²Ð¸ÑˆÐ¸ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ñ. Ð¡ÐºÐ¾Ñ€Ð¾ÑÑ‚ÑŒ Ð¿Ñ€Ð¸Ð²ÑÐ·Ð°Ð½Ð° Ðº delta,
         * Ð¿Ð¾ÑÑ‚Ð¾Ð¼Ñƒ Ð½Ð° 30 Ð¸ 144 FPS Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¸Ð´Ñ‘Ñ‚ Ð¾Ð´Ð¸Ð½Ð°ÐºÐ¾Ð²Ð¾.
         * @param {number} delta â€” ÑÐµÐºÑƒÐ½Ð´Ñ‹ Ñ Ð¿Ñ€Ð¾ÑˆÐ»Ð¾Ð³Ð¾ ÐºÐ°Ð´Ñ€Ð°
         */
        updateStamina: function (delta) {
            var data = window.GameData;

            var moving = this.keys.w || this.keys.a || this.keys.s || this.keys.d;

            // Ð’Ð¾ Ð²Ñ€ÐµÐ¼Ñ Ð¼ÐµÑ‚ÐµÐ½Ð¸Ñ ÑÑ‚Ð°Ð¼Ð¸Ð½Ð° Ð½Ðµ Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÑ‚ÑÑ: ÑÑ‚Ð¾ Ñ€Ð°Ð±Ð¾Ñ‚Ð°,
            // Ð° Ð½Ðµ Ð¾Ñ‚Ð´Ñ‹Ñ…, Ñ…Ð¾Ñ‚ÑŒ Ð¸Ð³Ñ€Ð¾Ðº Ð¸ Ð½Ðµ Ñ…Ð¾Ð´Ð¸Ñ‚
            if (moving || this.sweeping) return;

            if (data.stamina >= data.maxStamina) return;

            data.stamina = Math.min(data.maxStamina, data.stamina + this.staminaRegenPerSec * delta);

            // Ð’ DOM Ð¿Ð¸ÑˆÐµÐ¼ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÐºÐ¾Ð³Ð´Ð° Ñ†ÐµÐ»Ð¾Ðµ Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ð»Ð¾ÑÑŒ â€”
            // Ð¸Ð½Ð°Ñ‡Ðµ ÐºÐ°Ð¶Ð´Ñ‹Ð¹ ÐºÐ°Ð´Ñ€ Ð³Ð¾Ð½ÑÐ»Ð¸ Ð±Ñ‹ Ð¿ÐµÑ€ÐµÑ€Ð°ÑÑ‡Ñ‘Ñ‚ ÑÑ‚Ð¸Ð»ÐµÐ¹
            var rounded = Math.round(data.stamina);
            if (rounded !== this.lastRenderedStamina) {
                this.lastRenderedStamina = rounded;
                this.renderStamina();
            }
        },

        /** Ð“Ð»Ð°Ð²Ð½Ñ‹Ð¹ Ð¸Ð³Ñ€Ð¾Ð²Ð¾Ð¹ Ñ†Ð¸ÐºÐ». */
        loop: function () {
            requestAnimationFrame(function () {
                window.GameLogic.loop();
            });

            var delta = window.GameRenderer.clock.getDelta();

            // ÐžÐ³Ñ€Ð°Ð½Ð¸Ñ‡ÐµÐ½Ð¸Ðµ delta: ÐµÑÐ»Ð¸ Ð¸Ð³Ñ€Ð¾Ðº Ð¿ÐµÑ€ÐµÐºÐ»ÑŽÑ‡Ð¸Ð» Ð²ÐºÐ»Ð°Ð´ÐºÑƒ, getDelta
            // Ð²ÐµÑ€Ð½Ñ‘Ñ‚ Ð±Ð¾Ð»ÑŒÑˆÐ¾Ð¹ Ñ‡Ð¸ÑÐ»Ð¾ Ð¸ ÐºÐ°Ð¼ÐµÑ€Ð° Â«Ñ‚ÐµÐ»ÐµÐ¿Ð¾Ñ€Ñ‚Ð¸Ñ€ÑƒÐµÑ‚ÑÑÂ»
            if (delta > 0.1) delta = 0.1;

            this.updateMovement(delta);

            this.updateStamina(delta);

            // ÐŸÑ€Ð¸Ð¼ÐµÐ½ÑÐµÐ¼ ÑƒÐ³Ð»Ñ‹ Ðº ÐºÐ°Ð¼ÐµÑ€Ðµ Ð”Ðž Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ð¾Ð² Ð² Ñ€ÑƒÐºÐ°Ñ…:
            // Ð¸Ð½Ð°Ñ‡Ðµ Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ Ð¾Ñ‚ÑÑ‚Ð°Ð²Ð°Ð»Ð¸ Ð±Ñ‹ Ð¾Ñ‚ Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚Ð° Ð½Ð° ÐºÐ°Ð´Ñ€
            window.GameRenderer.camera.rotation.y = this.yaw;
            window.GameRenderer.camera.rotation.x = this.pitch;

            // Ð˜Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ñ‹ Ð² Ñ€ÑƒÐºÐ°Ñ… ÑÐ»ÐµÐ´ÑƒÑŽÑ‚ Ð·Ð° ÐºÐ°Ð¼ÐµÑ€Ð¾Ð¹
            window.GameRenderer.updateHeldTools();

            // ÐœÐµÑˆÐ¾Ðº Ð² Ñ€ÑƒÐºÐ°Ñ… ÑÐ»ÐµÐ´ÑƒÐµÑ‚ Ð·Ð° ÐºÐ°Ð¼ÐµÑ€Ð¾Ð¹
            this.updateCarriedBag();

            // Ð¡Ð¾Ð²Ð¾Ðº Ð¸ Ð²ÐµÐ½Ð¸Ðº Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÑŽÑ‚ Ð·Ð°Ð¶Ð°Ñ‚Ð¾Ð¹ Ð›ÐšÐœ (E Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð±ÐµÑ€Ñ‘Ñ‚ Ð¿Ñ€ÐµÐ´Ð¼ÐµÑ‚Ñ‹)
            if (this.sweeping) {
                this.sweepWithBroom(delta);

                // Ð¡Ð¾Ð²Ð¾Ðº ÑÐ¾Ð±Ð¸Ñ€Ð°ÐµÑ‚ ÐºÑƒÑ‡Ñƒ, Ð½Ð° ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚ Ð¿Ñ€Ð¸Ñ†ÐµÐ»
                if (window.GameData.handWith('dustpan')) {
                    this.sweepDustpanAtAim(delta);
                }
            }

            // Ð¤Ð¸Ð·Ð¸ÐºÐ° Ð¼ÑƒÑÐ¾Ñ€Ð° ÑÑ‡Ð¸Ñ‚Ð°ÐµÐ¼ Ð·Ð´ÐµÑÑŒ, Ð° Ð½Ðµ Ð² renderer: delta ÑƒÐ¶Ðµ
            // Ð²Ð·ÑÑ‚Ð° Ð¸Ð· clock.getDelta(), Ð²Ñ‚Ð¾Ñ€Ð¾Ð¹ Ð²Ñ‹Ð·Ð¾Ð² Ð²ÐµÑ€Ð½ÑƒÐ» Ð±Ñ‹ 0
            window.GameRenderer.updateDebris(delta);

            // Ð¤Ð¸Ð·Ð¸ÐºÐ° Ð»ÐµÐ¶Ð°Ñ‰Ð¸Ñ… Ð¸Ð½ÑÑ‚Ñ€ÑƒÐ¼ÐµÐ½Ñ‚Ð¾Ð² (Ð¿Ð°Ð´ÐµÐ½Ð¸Ðµ Ð¿Ð¾ÑÐ»Ðµ Ð¿Ð¸Ð½ÐºÐ°, Ñ‚Ñ€ÐµÐ½Ð¸Ðµ)
            window.GameRenderer.applyGravityToTools(delta);

            // ÐœÐµÑˆÐ¾Ðº Ñ€Ð°ÑÑ‚Ñ‘Ñ‚ Ð¿Ð¾ Ð¼ÐµÑ€Ðµ Ð·Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ
            window.GameRenderer.updateBagVisual();

            this.updateRaycast();

            window.GameRenderer.render();
        }
    };

    /**
     * Ð¡Ñ‚Ð°Ñ€Ñ‚. renderer.js ÑƒÐ¶Ðµ Ð²Ñ‹Ð¿Ð¾Ð»Ð½Ð¸Ð» ÑÐ²Ð¾Ð¹ init Ð¿Ñ€Ð¸ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐµ,
     * Ð¿Ð¾ÑÑ‚Ð¾Ð¼Ñƒ ÑÑ†ÐµÐ½Ð° Ð¸ ÐºÐ°Ð¼ÐµÑ€Ð° Ð³Ð¾Ñ‚Ð¾Ð²Ñ‹.
     */
    /**
 * Зарядить валик из ведра: вода/грунтовка/клей.
 */
chargeRollerFromBucket: function (bucket) {
    var data = window.GameData;
    var ud = bucket.userData;
    if (!ud.content || ud.volumeUsed <= 0) {
        this.showHintText("Ведро пустое");
        return;
    }
    if (data.rightHand !== 'roller' && data.leftHand !== 'roller') {
        this.showHintText("Возьми валик в руку");
        return;
    }
    data.rollerState = ud.content;
    ud.volumeUsed = Math.max(0, ud.volumeUsed - 0.5);
    this.showHintText("Валик заряжен: " + ud.content);
    data.addHistory("Валик заряжен из ведра: " + ud.content);
},
/**
 * Замер стены рулеткой: показывает расстояние до стены под прицелом.
 */
measureWall: function () {
    if (!this.lastHit) {
        this.showHintText("Наведи на стену");
        return;
    }
    var dist = this.lastHit.distance.toFixed(2);
    this.showHintText("Расстояние до стены: " + dist + " м");
    window.GameData.addHistory("Замер рулеткой: " + dist + " м");
},
window.GameLogic.init();

})();




