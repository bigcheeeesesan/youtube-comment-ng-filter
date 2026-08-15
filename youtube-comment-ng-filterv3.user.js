// ==UserScript==
// @name         YouTube コメントNGフィルター（ワード＋投稿者）
// @namespace    youtube-comment-ng-all-in-one
// @version      3.0.0
// @description  NGワード・NG投稿者に一致するYouTubeコメントを自動で非表示にします
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* =========================================================
       保存設定

       旧バージョンと同じキーを使用するため、
       登録済みのNGワード・NGユーザーを引き継ぎます。
    ========================================================= */

    const WORD_STORAGE_KEY =
        'youtube_comment_ng_words';

    const USER_STORAGE_KEY =
        'youtube_comment_ng_users_v1';

    const USER_NG_BUTTON_CLASS =
        'youtube-user-ng-button';

    const CONTROL_ID =
        'youtube-ng-unified-controls';


    /* =========================================================
       コメント関連セレクタ
    ========================================================= */

    const COMMENT_SELECTOR = [
        'ytd-comment-view-model',
        'ytd-comment-renderer'
    ].join(',');

    const CONTENT_SELECTOR = [
        '#content-text',
        'yt-attributed-string#content-text',
        'yt-formatted-string#content-text'
    ].join(',');


    /* =========================================================
       共通処理
    ========================================================= */

    function normalize(text) {

        return String(text || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/\u200b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }


    function uniqueByNormalizedValue(list) {

        const result = [];
        const seen = new Set();

        for (const value of list) {

            const normalized =
                normalize(value);

            if (!normalized) {
                continue;
            }

            if (seen.has(normalized)) {
                continue;
            }

            seen.add(normalized);

            result.push(
                String(value).trim()
            );
        }

        return result;
    }


    /* =========================================================
       NGワード保存
    ========================================================= */

    function loadNGWords() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        WORD_STORAGE_KEY
                    ) || '[]'
                );

            return Array.isArray(saved)
                ? saved
                : [];

        } catch (error) {

            console.error(
                '[YouTube NG] NGワード読み込み失敗',
                error
            );

            return [];
        }
    }


    function saveNGWords(words) {

        try {

            const cleaned =
                uniqueByNormalizedValue(
                    words
                );

            localStorage.setItem(
                WORD_STORAGE_KEY,
                JSON.stringify(cleaned)
            );

        } catch (error) {

            console.error(
                '[YouTube NG] NGワード保存失敗',
                error
            );
        }
    }


    /* =========================================================
       NGワード判定
    ========================================================= */

    function getMatchedNGWord(text) {

        const normalizedText =
            normalize(text);

        if (!normalizedText) {
            return '';
        }

        const words =
            loadNGWords();

        for (const word of words) {

            const normalizedWord =
                normalize(word);

            if (
                normalizedWord &&
                normalizedText.includes(
                    normalizedWord
                )
            ) {
                return word;
            }
        }

        return '';
    }


    /* =========================================================
       NGワード追加
    ========================================================= */

    function addNGWord() {

        const input =
            prompt(
                '非表示にしたいNGワードを入力してください。\n\n' +
                'その言葉を含むコメントが非表示になります。'
            );

        if (input === null) {
            return;
        }

        const word =
            input.trim();

        if (!word) {

            alert(
                'NGワードが入力されていません。'
            );

            return;
        }

        const words =
            loadNGWords();

        const exists =
            words.some(
                savedWord =>
                    normalize(savedWord) ===
                    normalize(word)
            );

        if (exists) {

            alert(
                `「${word}」はすでに登録されています。`
            );

            return;
        }

        words.push(word);

        saveNGWords(words);

        fullScan();

        alert(
            `「${word}」をNGワードに追加しました。`
        );
    }


    /* =========================================================
       NGワード管理
    ========================================================= */

    function manageNGWords() {

        const words =
            loadNGWords();

        if (words.length === 0) {

            alert(
                '追加登録されたNGワードはありません。'
            );

            return;
        }

        const list =
            words
                .map(
                    (word, index) =>
                        `${index + 1}. ${word}`
                )
                .join('\n');

        const answer =
            prompt(
                `現在のNGワード一覧：\n\n${list}\n\n` +
                '削除したいワードの番号を入力してください。\n' +
                '全部削除する場合は「all」と入力してください。'
            );

        if (answer === null) {
            return;
        }

        const input =
            answer
                .trim()
                .toLowerCase();

        if (input === 'all') {

            if (
                !confirm(
                    '追加したNGワードをすべて削除しますか？'
                )
            ) {
                return;
            }

            saveNGWords([]);

            alert(
                'NGワードをすべて削除しました。\n\n' +
                '非表示コメントを戻すにはページを再読み込みしてください。'
            );

            return;
        }

        const index =
            Number(input) - 1;

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= words.length
        ) {

            alert(
                '正しい番号を入力してください。'
            );

            return;
        }

        const removed =
            words[index];

        words.splice(
            index,
            1
        );

        saveNGWords(words);

        alert(
            `「${removed}」をNGワードから削除しました。\n\n` +
            'コメントを戻すにはページを再読み込みしてください。'
        );
    }


    /* =========================================================
       NGユーザー保存
    ========================================================= */

    function loadNGUsers() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        USER_STORAGE_KEY
                    ) || '[]'
                );

            return Array.isArray(saved)
                ? saved
                : [];

        } catch (error) {

            console.error(
                '[YouTube NG] NGユーザー読み込み失敗',
                error
            );

            return [];
        }
    }


    function saveNGUsers(users) {

        try {

            localStorage.setItem(
                USER_STORAGE_KEY,
                JSON.stringify(users)
            );

        } catch (error) {

            console.error(
                '[YouTube NG] NGユーザー保存失敗',
                error
            );
        }
    }


    /* =========================================================
       チャンネルURL処理
    ========================================================= */

    function normalizeChannelUrl(url) {

        if (!url) {
            return '';
        }

        try {

            const parsed =
                new URL(
                    url,
                    location.origin
                );

            return (
                parsed.origin +
                parsed.pathname.replace(
                    /\/+$/,
                    ''
                )
            );

        } catch {

            return String(url)
                .trim()
                .replace(/[?#].*$/, '')
                .replace(/\/+$/, '');
        }
    }


    function getAuthorLink(comment) {

        if (!comment) {
            return null;
        }

        return comment.querySelector(
            [
                'a#author-text[href]',
                '#author-text a[href]',
                'a[href^="/@"]',
                'a[href^="/channel/"]',
                'a[href^="/user/"]',
                'a[href^="/c/"]'
            ].join(',')
        );
    }


    function getAuthorName(
        comment,
        authorLink
    ) {

        const node =
            comment.querySelector(
                '#author-text span'
            ) ||
            comment.querySelector(
                '#author-text'
            ) ||
            authorLink;

        return (
            node?.textContent?.trim() ||
            '名前不明'
        );
    }


    function getChannelUrl(
        authorLink
    ) {

        if (!authorLink) {
            return '';
        }

        const url =
            authorLink.href ||
            authorLink.getAttribute(
                'href'
            ) ||
            '';

        return normalizeChannelUrl(
            url
        );
    }


    function isBlockedUser(
        channelUrl
    ) {

        const normalized =
            normalizeChannelUrl(
                channelUrl
            );

        if (!normalized) {
            return false;
        }

        return loadNGUsers().some(
            user =>
                normalizeChannelUrl(
                    user.channelUrl
                ) === normalized
        );
    }


    /* =========================================================
       NGユーザー追加
    ========================================================= */

    function blockUser(
        comment
    ) {

        const authorLink =
            getAuthorLink(comment);

        const channelUrl =
            getChannelUrl(
                authorLink
            );

        const authorName =
            getAuthorName(
                comment,
                authorLink
            );

        if (!channelUrl) {

            alert(
                'このコメント投稿者のチャンネル情報を取得できませんでした。'
            );

            return;
        }

        const users =
            loadNGUsers();

        const normalizedUrl =
            normalizeChannelUrl(
                channelUrl
            );

        const exists =
            users.some(
                user =>
                    normalizeChannelUrl(
                        user.channelUrl
                    ) === normalizedUrl
            );

        if (exists) {

            alert(
                `「${authorName}」はすでにNG登録されています。`
            );

            hideComment(
                comment,
                'NGユーザー'
            );

            return;
        }

        if (
            !confirm(
                `「${authorName}」をNGユーザーに登録しますか？\n\n` +
                'このユーザーのコメントは別の動画でも自動的に非表示になります。'
            )
        ) {
            return;
        }

        users.push({
            name:
                authorName,

            channelUrl:
                normalizedUrl,

            addedAt:
                new Date().toISOString()
        });

        saveNGUsers(users);

        fullScan();

        alert(
            `「${authorName}」をNGユーザーに登録しました。`
        );
    }


    /* =========================================================
       NGユーザー管理
    ========================================================= */

    function manageNGUsers() {

        const users =
            loadNGUsers();

        if (users.length === 0) {

            alert(
                'NG登録されているユーザーはいません。'
            );

            return;
        }

        const list =
            users
                .map(
                    (user, index) =>
                        `${index + 1}. ${user.name}`
                )
                .join('\n');

        const answer =
            prompt(
                `現在のNGユーザー一覧：\n\n${list}\n\n` +
                '解除したいユーザーの番号を入力してください。\n' +
                '全員解除する場合は「all」と入力してください。'
            );

        if (answer === null) {
            return;
        }

        const input =
            answer
                .trim()
                .toLowerCase();

        if (input === 'all') {

            if (
                !confirm(
                    'NGユーザーを全員解除しますか？'
                )
            ) {
                return;
            }

            saveNGUsers([]);

            alert(
                'NGユーザーを全員解除しました。\n\n' +
                '非表示コメントを戻すにはページを再読み込みしてください。'
            );

            return;
        }

        const index =
            Number(input) - 1;

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= users.length
        ) {

            alert(
                '正しい番号を入力してください。'
            );

            return;
        }

        const removed =
            users[index];

        users.splice(
            index,
            1
        );

        saveNGUsers(users);

        alert(
            `「${removed.name}」のNGを解除しました。\n\n` +
            'コメントを戻すにはページを再読み込みしてください。'
        );
    }


    /* =========================================================
       コメント取得
    ========================================================= */

    function getComments(
        root = document
    ) {

        const result =
            new Set();

        function addElement(
            element
        ) {

            if (
                !(element instanceof Element)
            ) {
                return;
            }

            if (
                element.matches(
                    'ytd-comment-view-model'
                )
            ) {

                result.add(element);

                return;
            }

            if (
                element.matches(
                    'ytd-comment-renderer'
                ) &&
                !element.closest(
                    'ytd-comment-view-model'
                )
            ) {

                result.add(element);
            }
        }


        if (
            root instanceof Element
        ) {

            addElement(root);

            root
                .querySelectorAll(
                    'ytd-comment-view-model'
                )
                .forEach(
                    element =>
                        result.add(element)
                );

            root
                .querySelectorAll(
                    'ytd-comment-renderer'
                )
                .forEach(
                    element => {

                        if (
                            !element.closest(
                                'ytd-comment-view-model'
                            )
                        ) {

                            result.add(element);
                        }
                    }
                );
        }


        if (
            root instanceof Document
        ) {

            root
                .querySelectorAll(
                    'ytd-comment-view-model'
                )
                .forEach(
                    element =>
                        result.add(element)
                );

            root
                .querySelectorAll(
                    'ytd-comment-renderer'
                )
                .forEach(
                    element => {

                        if (
                            !element.closest(
                                'ytd-comment-view-model'
                            )
                        ) {

                            result.add(element);
                        }
                    }
                );
        }


        return [
            ...result
        ];
    }


    /* =========================================================
       コメント本文取得
    ========================================================= */

    function getCommentText(
        comment
    ) {

        if (!comment) {
            return '';
        }

        const node =
            comment.querySelector(
                CONTENT_SELECTOR
            );

        if (node) {

            return (
                node.innerText ||
                node.textContent ||
                ''
            );
        }


        /*
         * YouTube側の描画変更で
         * #content-textが存在しない場合の保険
         */

        const fallback =
            comment.querySelector(
                '#content'
            );

        if (fallback) {

            return (
                fallback.innerText ||
                fallback.textContent ||
                ''
            );
        }

        return '';
    }


    /* =========================================================
       コメント非表示
    ========================================================= */

    function hideComment(
        comment,
        reason = ''
    ) {

        if (!comment) {
            return;
        }

        comment.style.setProperty(
            'display',
            'none',
            'important'
        );

        comment.dataset.youtubeNgHidden =
            '1';

        if (reason) {

            comment.dataset.youtubeNgReason =
                reason;
        }
    }


    /* =========================================================
       コメント判定
    ========================================================= */

    function filterComment(
        comment
    ) {

        if (!comment) {
            return;
        }


        /* ---------- NGユーザー ---------- */

        const authorLink =
            getAuthorLink(
                comment
            );

        const channelUrl =
            getChannelUrl(
                authorLink
            );

        if (
            channelUrl &&
            isBlockedUser(
                channelUrl
            )
        ) {

            hideComment(
                comment,
                'NGユーザー'
            );

            return;
        }


        /* ---------- NGワード ---------- */

        const text =
            getCommentText(
                comment
            );

        /*
         * 本文がまだ描画されていない場合は何もしません。
         *
         * MutationObserverによる再スキャンで、
         * 本文描画後にもう一度判定します。
         */

        if (!text) {
            return;
        }

        const matchedWord =
            getMatchedNGWord(
                text
            );

        if (matchedWord) {

            hideComment(
                comment,
                `NGワード：${matchedWord}`
            );
        }
    }


    function filterAllComments(
        root = document
    ) {

        getComments(root)
            .forEach(
                filterComment
            );
    }


    /* =========================================================
       コメント横の投稿者NGボタン
    ========================================================= */

    function createUserNGButton(
        comment
    ) {

        if (!comment) {
            return;
        }

        if (
            comment.querySelector(
                `.${USER_NG_BUTTON_CLASS}`
            )
        ) {
            return;
        }

        const authorLink =
            getAuthorLink(
                comment
            );

        const channelUrl =
            getChannelUrl(
                authorLink
            );

        if (
            !authorLink ||
            !channelUrl
        ) {
            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.type =
            'button';

        button.className =
            USER_NG_BUTTON_CLASS;

        button.textContent =
            'NG';

        button.title =
            'この投稿者をNGユーザーに登録';

        Object.assign(
            button.style,
            {
                marginLeft:
                    '6px',

                padding:
                    '0 5px',

                border:
                    '1px solid #777',

                borderRadius:
                    '8px',

                background:
                    'transparent',

                color:
                    '#777',

                fontSize:
                    '10px',

                lineHeight:
                    '16px',

                fontFamily:
                    'sans-serif',

                cursor:
                    'pointer',

                verticalAlign:
                    'middle'
            }
        );

        button.addEventListener(
            'mouseenter',
            () => {

                button.style.background =
                    '#cc0000';

                button.style.borderColor =
                    '#cc0000';

                button.style.color =
                    '#ffffff';
            }
        );

        button.addEventListener(
            'mouseleave',
            () => {

                button.style.background =
                    'transparent';

                button.style.borderColor =
                    '#777';

                button.style.color =
                    '#777';
            }
        );

        button.addEventListener(
            'click',
            event => {

                event.preventDefault();
                event.stopPropagation();

                blockUser(
                    comment
                );
            }
        );

        const authorContainer =
            comment.querySelector(
                '#header-author'
            ) ||
            comment.querySelector(
                '#author-text'
            )?.parentElement ||
            authorLink.parentElement;

        if (!authorContainer) {
            return;
        }

        if (
            authorContainer.querySelector(
                `.${USER_NG_BUTTON_CLASS}`
            )
        ) {
            return;
        }

        authorContainer.appendChild(
            button
        );
    }


    function addUserNGButtons(
        root = document
    ) {

        getComments(root)
            .forEach(
                createUserNGButton
            );
    }


    /* =========================================================
       右下NG設定メニュー
    ========================================================= */

    function createControls() {

        if (
            document.getElementById(
                CONTROL_ID
            )
        ) {
            return;
        }

        if (!document.body) {
            return;
        }

        const container =
            document.createElement(
                'div'
            );

        container.id =
            CONTROL_ID;

        Object.assign(
            container.style,
            {
                position:
                    'fixed',

                right:
                    '12px',

                bottom:
                    '12px',

                zIndex:
                    '999999',

                display:
                    'flex',

                flexDirection:
                    'column',

                alignItems:
                    'flex-end',

                gap:
                    '5px',

                fontFamily:
                    'Arial, sans-serif'
            }
        );


        /* ---------- 展開メニュー ---------- */

        const menu =
            document.createElement(
                'div'
            );

        Object.assign(
            menu.style,
            {
                display:
                    'none',

                flexDirection:
                    'column',

                gap:
                    '4px',

                padding:
                    '5px',

                background:
                    'rgba(32,32,32,0.96)',

                border:
                    '1px solid #555',

                borderRadius:
                    '8px',

                boxShadow:
                    '0 2px 8px rgba(0,0,0,0.4)'
            }
        );


        function makeMenuButton(
            text,
            title,
            onClick
        ) {

            const button =
                document.createElement(
                    'button'
                );

            button.type =
                'button';

            button.textContent =
                text;

            button.title =
                title;

            Object.assign(
                button.style,
                {
                    minWidth:
                        '100px',

                    padding:
                        '5px 7px',

                    border:
                        '1px solid #666',

                    borderRadius:
                        '5px',

                    background:
                        '#303030',

                    color:
                        '#fff',

                    fontSize:
                        '11px',

                    fontWeight:
                        'bold',

                    cursor:
                        'pointer',

                    whiteSpace:
                        'nowrap'
                }
            );

            button.addEventListener(
                'mouseenter',
                () => {

                    button.style.background =
                        '#444';
                }
            );

            button.addEventListener(
                'mouseleave',
                () => {

                    button.style.background =
                        '#303030';
                }
            );

            button.addEventListener(
                'click',
                onClick
            );

            return button;
        }


        menu.appendChild(
            makeMenuButton(
                '＋ NGワード',
                'NGワードを追加',
                addNGWord
            )
        );

        menu.appendChild(
            makeMenuButton(
                'ワード一覧',
                'NGワードの確認・削除',
                manageNGWords
            )
        );

        menu.appendChild(
            makeMenuButton(
                'ユーザー一覧',
                'NGユーザーの確認・解除',
                manageNGUsers
            )
        );


        /* ---------- 開閉ボタン ---------- */

        const toggle =
            document.createElement(
                'button'
            );

        toggle.type =
            'button';

        toggle.textContent =
            'NG';

        toggle.title =
            'NG設定';

        Object.assign(
            toggle.style,
            {
                width:
                    '36px',

                height:
                    '28px',

                padding:
                    '0',

                border:
                    '1px solid #666',

                borderRadius:
                    '7px',

                background:
                    'rgba(32,32,32,0.92)',

                color:
                    '#fff',

                fontSize:
                    '10px',

                fontWeight:
                    'bold',

                cursor:
                    'pointer',

                boxShadow:
                    '0 2px 6px rgba(0,0,0,0.35)'
            }
        );

        let open =
            false;

        toggle.addEventListener(
            'click',
            () => {

                open =
                    !open;

                menu.style.display =
                    open
                        ? 'flex'
                        : 'none';

                toggle.textContent =
                    open
                        ? '×'
                        : 'NG';
            }
        );

        container.appendChild(
            menu
        );

        container.appendChild(
            toggle
        );

        document.body.appendChild(
            container
        );
    }


    /* =========================================================
       全体スキャン
    ========================================================= */

    function fullScan() {

        filterAllComments(
            document
        );

        addUserNGButtons(
            document
        );

        createControls();
    }


    /* =========================================================
       MutationObserver

       YouTubeではコメントの枠が表示された後に、
       コメント本文などが遅れて描画される場合があります。

       DOMが変更されたら少し待ってから、
       現在表示されているコメント全体を再チェックします。
    ========================================================= */

    let mutationTimer =
        null;


    function scheduleFullScan(
        delay = 180
    ) {

        clearTimeout(
            mutationTimer
        );

        mutationTimer =
            setTimeout(
                fullScan,
                delay
            );
    }


    /* =========================================================
       起動
    ========================================================= */

    function start() {

        if (!document.body) {

            setTimeout(
                start,
                500
            );

            return;
        }


        fullScan();


        const observer =
            new MutationObserver(
                () => {

                    scheduleFullScan(
                        180
                    );
                }
            );


        observer.observe(
            document.body,
            {
                childList:
                    true,

                subtree:
                    true,

                characterData:
                    true
            }
        );


        /* =====================================================
           YouTube内で別動画へ移動したとき
        ===================================================== */

        document.addEventListener(
            'yt-navigate-finish',
            () => {

                scheduleFullScan(
                    100
                );

                setTimeout(
                    fullScan,
                    500
                );

                setTimeout(
                    fullScan,
                    1500
                );

                setTimeout(
                    fullScan,
                    3500
                );
            }
        );


        /* =====================================================
           遅延読み込み対策
        ===================================================== */

        setTimeout(
            fullScan,
            1000
        );

        setTimeout(
            fullScan,
            2500
        );

        setTimeout(
            fullScan,
            5000
        );
    }


    start();

})();
