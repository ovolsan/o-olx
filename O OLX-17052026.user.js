// ==UserScript==
// @name         O OLX
// @namespace    http://tampermonkey.net/
// @version      17052026
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

    // Загрузка настроек (с защитой от старых версий без новых полей)
    let savedSettings = JSON.parse(localStorage.getItem('olx_filters')) || {};
    let settings = {
        hideTop: savedSettings.hideTop !== undefined ? savedSettings.hideTop : true,
        useWhitelist: savedSettings.useWhitelist !== undefined ? savedSettings.useWhitelist : true,
        whitelist: savedSettings.whitelist || '',
        useBlacklist: savedSettings.useBlacklist !== undefined ? savedSettings.useBlacklist : true,
        blacklist: savedSettings.blacklist || ''
    };

    function createUI() {
        if (document.getElementById('olx-filter-ui')) return;

        const uiContainer = document.createElement('div');
        uiContainer.id = 'olx-filter-ui';
        // Основные стили контейнера со сворачиванием
        uiContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1b1d1d;
            border: 2px solid #00a49f;
            border-radius: 8px;
            z-index: 999999;
            color: #cdcbc8;
            font-family: sans-serif;
            width: 280px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            overflow: hidden;
            max-height: 42px; /* Высота свернутого окна */
            transition: max-height 0.4s ease-in-out;
            display: flex;
            flex-direction: column;
        `;

        // Шапка (видна всегда)
        const header = document.createElement('div');
        header.innerHTML = '⚙️ Настройки OLX Фильтра';
        header.style.cssText = `
            padding: 12px 15px;
            margin: 0;
            color: #fff;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            background: #00a49f22;
            text-align: center;
            user-select: none;
            flex-shrink: 0;
        `;

        // Контент с настройками (виден при разворачивании)
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 15px;
            overflow-y: auto;
        `;

        content.innerHTML = `
            <label style="display: block; margin-bottom: 15px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #333; padding-bottom: 10px;">
                <input type="checkbox" id="olx-hide-top" ${settings.hideTop ? 'checked' : ''}>
                Скрывать "ТОП" объявления
            </label>

            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; margin-bottom: 5px; font-size: 12px; cursor: pointer; color: #fff;">
                    <input type="checkbox" id="olx-use-wl" ${settings.useWhitelist ? 'checked' : ''} style="margin-right: 8px;">
                    Включить Белый список
                </label>
                <textarea id="olx-whitelist" rows="3" placeholder="Слова через запятую..." style="width: 100%; box-sizing: border-box; background: #222425; color: #fff; border: 1px solid #4e5457; padding: 6px; border-radius: 4px; font-size: 12px; resize: vertical; min-height: 60px;">${settings.whitelist}</textarea>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; margin-bottom: 5px; font-size: 12px; cursor: pointer; color: #fff;">
                    <input type="checkbox" id="olx-use-bl" ${settings.useBlacklist ? 'checked' : ''} style="margin-right: 8px;">
                    Включить Черный список
                </label>
                <textarea id="olx-blacklist" rows="3" placeholder="Слова через запятую..." style="width: 100%; box-sizing: border-box; background: #222425; color: #fff; border: 1px solid #4e5457; padding: 6px; border-radius: 4px; font-size: 12px; resize: vertical; min-height: 60px;">${settings.blacklist}</textarea>
            </div>

            <button id="olx-save-btn" style="width: 100%; padding: 10px; background: #00a49f; color: #02282c; border: none; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 13px; transition: background 0.2s;">Сохранить настройки</button>
        `;

        uiContainer.appendChild(header);
        uiContainer.appendChild(content);
        document.body.appendChild(uiContainer);

        // Логика сворачивания/разворачивания при наведении
        uiContainer.addEventListener('mouseenter', () => {
            uiContainer.style.maxHeight = '800px'; // Разворачиваем (с запасом для растягивания полей)
            header.style.background = '#00a49f55';
        });
        uiContainer.addEventListener('mouseleave', () => {
            uiContainer.style.maxHeight = '42px'; // Сворачиваем обратно до высоты шапки
            header.style.background = '#00a49f22';
        });

        // Сохранение настроек
        document.getElementById('olx-save-btn').addEventListener('click', () => {
            settings.hideTop = document.getElementById('olx-hide-top').checked;
            settings.useWhitelist = document.getElementById('olx-use-wl').checked;
            settings.useBlacklist = document.getElementById('olx-use-bl').checked;

            settings.whitelist = document.getElementById('olx-whitelist').value.toLowerCase();
            settings.blacklist = document.getElementById('olx-blacklist').value.toLowerCase();

            localStorage.setItem('olx_filters', JSON.stringify(settings));

            applyFilters();

            const btn = document.getElementById('olx-save-btn');
            btn.textContent = "✔ Сохранено";
            btn.style.background = "#4caf50";
            setTimeout(() => {
                btn.textContent = "Сохранить настройки";
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

            // 1. Проверка на ТОП
            if (settings.hideTop && isTop) {
                shouldHide = true;
            }

            // 2. Проверка черного списка (ТОЛЬКО если тумблер включен)
            if (!shouldHide && settings.useBlacklist && blackArr.length > 0) {
                if (blackArr.some(word => adText.includes(word))) {
                    shouldHide = true;
                }
            }

            // 3. Проверка белого списка (ТОЛЬКО если тумблер включен)
            if (!shouldHide && settings.useWhitelist && whiteArr.length > 0) {
                if (!whiteArr.some(word => adText.includes(word))) {
                    shouldHide = true;
                }
            }

            // Применяем скрытие или показ
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
