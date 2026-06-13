// ==UserScript==
// @name         O OLX
// @namespace    http://tampermonkey.net/
// @version      13062026
// @description  Убирает ТОП объявления и позволяет фильтровать по ключевым фразам (белый/чёрный список)
// @author       Ovolya
// @match        https://olx.ua/*
// @match        https://www.olx.ua/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @updateURL    https://github.com/Ovolsan/O-OLX/raw/refs/heads/main/O%20OLX-17052026.user.js
// @downloadURL  https://github.com/Ovolsan/O-OLX/raw/refs/heads/main/O%20OLX-17052026.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Загрузка настроек
    let savedSettings = JSON.parse(localStorage.getItem('olx_filters')) || {};
    let settings = {
        hideTop: savedSettings.hideTop !== undefined ? savedSettings.hideTop : true,
        useWhitelist: savedSettings.useWhitelist !== undefined ? savedSettings.useWhitelist : true,
        whitelist: savedSettings.whitelist || '',
        useBlacklist: savedSettings.useBlacklist !== undefined ? savedSettings.useBlacklist : true,
        blacklist: savedSettings.blacklist || '',
        templates: savedSettings.templates || {}
    };

    let isOpen = false;

    function createUI() {
        if (document.getElementById('olx-filter-ui')) return;

        const uiContainer = document.createElement('div');
        uiContainer.id = 'olx-filter-ui';
        uiContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        `;

        // Окно с контентом (строго над кнопкой, скрыто по умолчанию)
        const content = document.createElement('div');
        content.id = 'olx-content-panel';
        content.style.cssText = `
            display: none;
            background: #1b1d1d;
            border: 1px solid #00a49f;
            border-radius: 6px;
            padding: 10px;
            color: #cdcbc8;
            width: 240px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            margin-bottom: 8px; /* Небольшой отступ от кнопки "O olx" */
            box-sizing: border-box;
        `;

        content.innerHTML = `
            <div style="margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                    <select id="olx-tpl-select" style="flex-grow: 1; background: #222425; color: #fff; border: 1px solid #4e5457; border-radius: 3px; padding: 4px; font-size: 11px; outline: none; cursor: pointer;">
                        <option value="">-- Выбрать шаблон --</option>
                    </select>
                    <button id="olx-tpl-del" style="background: #da2828; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 0 6px; font-size: 11px;" title="Удалить">✖</button>
                </div>
                <div style="display: flex; gap: 4px;">
                    <input type="text" id="olx-tpl-name" placeholder="Имя шаблона" style="flex-grow: 1; box-sizing: border-box; background: #222425; color: #fff; border: 1px solid #4e5457; padding: 4px; border-radius: 3px; font-size: 11px; outline: none;">
                    <button id="olx-tpl-save" style="background: #00a49f; color: #02282c; border: none; border-radius: 3px; cursor: pointer; padding: 0 8px; font-weight: bold; font-size: 13px;" title="Сохранить">+</button>
                </div>
            </div>

            <label style="display: flex; align-items: center; margin-bottom: 10px; font-size: 12px; cursor: pointer; color: #fff;">
                <input type="checkbox" id="olx-hide-top" ${settings.hideTop ? 'checked' : ''} style="margin: 0 6px 0 0;">
                Скрывать "ТОП"
            </label>

            <div style="margin-bottom: 8px;">
                <label style="display: flex; align-items: center; margin-bottom: 4px; font-size: 11px; cursor: pointer; color: #fff;">
                    <input type="checkbox" id="olx-use-wl" ${settings.useWhitelist ? 'checked' : ''} style="margin: 0 6px 0 0;">
                    Белый список
                </label>
                <textarea id="olx-whitelist" rows="2" placeholder="Слова через запятую..." style="width: 100%; box-sizing: border-box; background: #222425; color: #fff; border: 1px solid #4e5457; padding: 5px; border-radius: 3px; font-size: 11px; resize: vertical; min-height: 35px; outline: none;">${settings.whitelist}</textarea>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; margin-bottom: 4px; font-size: 11px; cursor: pointer; color: #fff;">
                    <input type="checkbox" id="olx-use-bl" ${settings.useBlacklist ? 'checked' : ''} style="margin: 0 6px 0 0;">
                    Черный список
                </label>
                <textarea id="olx-blacklist" rows="2" placeholder="Слова через запятую..." style="width: 100%; box-sizing: border-box; background: #222425; color: #fff; border: 1px solid #4e5457; padding: 5px; border-radius: 3px; font-size: 11px; resize: vertical; min-height: 35px; outline: none;">${settings.blacklist}</textarea>
            </div>

            <button id="olx-save-btn" style="width: 100%; padding: 6px; background: #00a49f; color: #02282c; border: none; font-weight: bold; cursor: pointer; border-radius: 3px; font-size: 12px; transition: background 0.2s;">Применить</button>
        `;

        // Кнопка переключения видимости интерфейса
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'olx-toggle-btn';
        toggleBtn.innerHTML = 'O olx';
        toggleBtn.style.cssText = `
            background: #00a49f;
            color: #02282c;
            font-size: 13px;
            font-weight: bold;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            user-select: none;
            text-align: center;
            transition: background 0.2s;
        `;

        uiContainer.appendChild(content);
        uiContainer.appendChild(toggleBtn);
        document.body.appendChild(uiContainer);

        // --- Логика интерфейса ---

        // 1. Открытие/закрытие по клику (только панель, кнопка на месте)
        toggleBtn.addEventListener('click', () => {
            isOpen = !isOpen;
            content.style.display = isOpen ? 'block' : 'none';
            // Немного затемняем кнопку, когда окно открыто
            toggleBtn.style.background = isOpen ? '#008b87' : '#00a49f';
        });

        // 2. Обновление выпадающего списка шаблонов
        function updateTplSelect() {
            const select = document.getElementById('olx-tpl-select');
            select.innerHTML = '<option value="">-- Выбрать шаблон --</option>';
            for (let name in settings.templates) {
                let opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            }
        }
        updateTplSelect();

        // 3. Выбор шаблона из списка
        document.getElementById('olx-tpl-select').addEventListener('change', (e) => {
            const name = e.target.value;
            if (name && settings.templates[name]) {
                document.getElementById('olx-whitelist').value = settings.templates[name].whitelist;
                document.getElementById('olx-blacklist').value = settings.templates[name].blacklist;
                document.getElementById('olx-tpl-name').value = name;
            }
        });

        // 4. Сохранение нового шаблона
        document.getElementById('olx-tpl-save').addEventListener('click', () => {
            const name = document.getElementById('olx-tpl-name').value.trim();
            if (!name) return alert('Введите имя шаблона!');

            settings.templates[name] = {
                whitelist: document.getElementById('olx-whitelist').value.toLowerCase(),
                blacklist: document.getElementById('olx-blacklist').value.toLowerCase()
            };
            localStorage.setItem('olx_filters', JSON.stringify(settings));
            updateTplSelect();
            document.getElementById('olx-tpl-select').value = name;

            const btn = document.getElementById('olx-tpl-save');
            btn.style.background = "#4caf50";
            setTimeout(() => btn.style.background = "#00a49f", 1000);
        });

        // 5. Удаление шаблона
        document.getElementById('olx-tpl-del').addEventListener('click', () => {
            const select = document.getElementById('olx-tpl-select');
            const name = select.value;
            if (!name) return;

            if (confirm(`Удалить шаблон "${name}"?`)) {
                delete settings.templates[name];
                localStorage.setItem('olx_filters', JSON.stringify(settings));
                updateTplSelect();
                document.getElementById('olx-tpl-name').value = '';
            }
        });

        // 6. Главная кнопка применения настроек
        document.getElementById('olx-save-btn').addEventListener('click', () => {
            settings.hideTop = document.getElementById('olx-hide-top').checked;
            settings.useWhitelist = document.getElementById('olx-use-wl').checked;
            settings.useBlacklist = document.getElementById('olx-use-bl').checked;

            settings.whitelist = document.getElementById('olx-whitelist').value.toLowerCase();
            settings.blacklist = document.getElementById('olx-blacklist').value.toLowerCase();

            localStorage.setItem('olx_filters', JSON.stringify(settings));

            applyFilters();

            const btn = document.getElementById('olx-save-btn');
            btn.textContent = "✔ Готово";
            btn.style.background = "#4caf50";
            setTimeout(() => {
                btn.textContent = "Применить";
                btn.style.background = "#00a49f";
            }, 1500);
        });
    }

    function parseList(str) {
        return str.split(',')
                  .map(s => s.trim())
                  .filter(s => s.length > 0);
    }

    function applyFilters() {
        const ads = document.querySelectorAll('[data-cy="l-card"]');

        const whiteArr = parseList(settings.whitelist);
        const blackArr = parseList(settings.blacklist);

        ads.forEach(ad => {
            const titleEl = ad.querySelector('h6') || ad.querySelector('h4');
            const adText = titleEl ? titleEl.textContent.toLowerCase() : ad.textContent.toLowerCase();

            const hasTopAttr = ad.querySelector('[data-testid="adCard-featured"]');
            const hasTopBadgeText = Array.from(ad.querySelectorAll('div, span')).some(el => {
                const text = el.textContent.trim().toUpperCase();
                return text === 'ТОП' || text === 'TOP';
            });
            const isTop = !!hasTopAttr || hasTopBadgeText;

            let shouldHide = false;

            if (settings.hideTop && isTop) {
                shouldHide = true;
            }

            if (!shouldHide && settings.useBlacklist && blackArr.length > 0) {
                if (blackArr.some(word => adText.includes(word))) {
                    shouldHide = true;
                }
            }

            if (!shouldHide && settings.useWhitelist && whiteArr.length > 0) {
                if (!whiteArr.some(word => adText.includes(word))) {
                    shouldHide = true;
                }
            }

            if (shouldHide) {
                ad.style.setProperty('display', 'none', 'important');
            } else {
                ad.style.removeProperty('display');
            }
        });
    }

    window.addEventListener('load', () => {
        createUI();
        setTimeout(applyFilters, 1000);

        const observer = new MutationObserver((mutations) => {
            let DOMChanged = false;
            for (let mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    DOMChanged = true;
                    break;
                }
            }
            if (DOMChanged) {
                clearTimeout(window.olxFilterTimeout);
                window.olxFilterTimeout = setTimeout(applyFilters, 300);
            }
        });

        const container = document.querySelector('#root') || document.body;
        observer.observe(container, { childList: true, subtree: true });
    });
})();
