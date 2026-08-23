// ==UserScript==
// @name         YouTube NGフィルター（コメント＋動画＋Shorts）
// @namespace    youtube-ng-all-in-one
// @version      4.0.1
// @description  NGワード・NG投稿者のコメント、NG投稿者の動画/Shorts、NGタイトルの動画/Shortsを自動で非表示にします
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* =========================================================
       保存設定
       既存v3のキーをそのまま使うので登録内容を引き継ぎます
    ========================================================= */

    const COMMENT_WORD_STORAGE_KEY = 'youtube_comment_ng_words';
    const USER_STORAGE_KEY = 'youtube_comment_ng_users_v1';
    const VIDEO_TITLE_WORD_STORAGE_KEY = 'youtube_video_ng_title_words_v1';

    const COMMENT_USER_BUTTON_CLASS = 'youtube-user-ng-button';
    const VIDEO_USER_BUTTON_CLASS = 'youtube-video-user-ng-button';
    const CONTROL_ID = 'youtube-ng-unified-controls';

    /* =========================================================
       セレクタ
    ========================================================= */

    const COMMENT_SELECTOR = [
        'ytd-comment-view-model',
        'ytd-comment-renderer'
    ].join(',');

    const COMMENT_CONTENT_SELECTOR = [
        '#content-text',
        'yt-attributed-string#content-text',
        'yt-formatted-string#content-text'
    ].join(',');

    // YouTubeはDOMが頻繁に変わるため、新旧の動画カードを広めに拾います。
    const VIDEO_CARD_SELECTOR = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-compact-video-renderer',
        'yt-lockup-view-model',
        'ytm-shorts-lockup-view-model',
        'ytm-shorts-lockup-view-model-v2'
    ].join(',');

    const VIDEO_TITLE_SELECTOR = [
        '#video-title',
        '#video-title-link',
        'a#video-title',
        'h3',
        '.shortsLockupViewModelHostMetadataTitle',
        '.yt-lockup-metadata-view-model__title',
        '[class*="metadata"] [class*="title"]'
    ].join(',');

    const CHANNEL_LINK_SELECTOR = [
        'ytd-channel-name a[href]',
        '#channel-name a[href]',
        '#channel-info a[href]',
        '#metadata a[href^="/@"]',
        '#metadata a[href^="/channel/"]',
        '#metadata a[href^="/user/"]',
        '#metadata a[href^="/c/"]',
        '.yt-content-metadata-view-model__metadata-row a[href]',
        'a.yt-simple-endpoint[href^="/@"]',
        'a.yt-simple-endpoint[href^="/channel/"]',
        'a.yt-simple-endpoint[href^="/user/"]',
        'a.yt-simple-endpoint[href^="/c/"]',
        'a[href^="/@"]',
        'a[href^="/channel/"]',
        'a[href^="/user/"]',
        'a[href^="/c/"]'
    ].join(',');

    /* =========================================================
       共通
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
            const normalized = normalize(value);

            if (
                !normalized ||
                seen.has(normalized)
            ) {
                continue;
            }

            seen.add(normalized);

            result.push(
                String(value).trim()
            );
        }

        return result;
    }

    function loadArray(key) {
        try {
            const saved =
                JSON.parse(
                    localStorage.getItem(key) || '[]'
                );

            return Array.isArray(saved)
                ? saved
                : [];

        } catch (error) {

            console.error(
                '[YouTube NG] 読み込み失敗:',
                key,
                error
            );

            return [];
        }
    }

    function saveArray(key, values) {
        try {

            localStorage.setItem(
                key,
                JSON.stringify(values)
            );

        } catch (error) {

            console.error(
                '[YouTube NG] 保存失敗:',
                key,
                error
            );
        }
    }

    function getMatchedWord(text, words) {
        const normalizedText =
            normalize(text);

        if (!normalizedText) {
            return '';
        }

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
       コメントNGワード
    ========================================================= */

    function loadCommentNGWords() {
        return loadArray(
            COMMENT_WORD_STORAGE_KEY
        );
    }

    function saveCommentNGWords(words) {
        saveArray(
            COMMENT_WORD_STORAGE_KEY,
            uniqueByNormalizedValue(words)
        );
    }

    function addCommentNGWord() {

        const input =
            prompt(
                'コメントから非表示にしたいNGワードを入力してください。\n\n' +
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
            loadCommentNGWords();

        if (
            words.some(
                saved =>
                    normalize(saved) ===
                    normalize(word)
            )
        ) {

            alert(
                `「${word}」はすでに登録されています。`
            );

            return;
        }

        words.push(word);

        saveCommentNGWords(words);

        fullScan();

        alert(
            `「${word}」をコメントNGワードに追加しました。`
        );
    }

    function manageCommentNGWords() {

        manageWordList({
            title: 'コメントNGワード',
            words: loadCommentNGWords(),
            save: saveCommentNGWords
        });
    }

    /* =========================================================
       動画タイトルNGワード
    ========================================================= */

    function loadVideoTitleNGWords() {

        return loadArray(
            VIDEO_TITLE_WORD_STORAGE_KEY
        );
    }

    function saveVideoTitleNGWords(words) {

        saveArray(
            VIDEO_TITLE_WORD_STORAGE_KEY,
            uniqueByNormalizedValue(words)
        );
    }

    function addVideoTitleNGWord() {

        const input =
            prompt(
                '動画タイトルから非表示にしたいNGワードを入力してください。\n\n' +
                'その言葉をタイトルに含む通常動画・Shortsが一覧から消えます。'
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
            loadVideoTitleNGWords();

        if (
            words.some(
                saved =>
                    normalize(saved) ===
                    normalize(word)
            )
        ) {

            alert(
                `「${word}」はすでに登録されています。`
            );

            return;
        }

        words.push(word);

        saveVideoTitleNGWords(words);

        fullScan();

        alert(
            `「${word}」を動画タイトルNGに追加しました。`
        );
    }

    function manageVideoTitleNGWords() {

        manageWordList({
            title: '動画タイトルNG',
            words: loadVideoTitleNGWords(),
            save: saveVideoTitleNGWords
        });
    }

    function manageWordList({
        title,
        words,
        save
    }) {

        if (words.length === 0) {

            alert(
                `${title}は登録されていません。`
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
                `現在の${title}一覧：\n\n${list}\n\n` +
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
                    `${title}をすべて削除しますか？`
                )
            ) {
                return;
            }

            save([]);

            restoreHiddenVideos();

            fullScan();

            alert(
                `${title}をすべて削除しました。`
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

        save(words);

        restoreHiddenVideos();

        fullScan();

        alert(
            `「${removed}」を${title}から削除しました。`
        );
    }

    /* =========================================================
       NGユーザー
       v3と同じ保存キーを利用
    ========================================================= */

    function loadNGUsers() {

        return loadArray(
            USER_STORAGE_KEY
        );
    }

    function saveNGUsers(users) {

        saveArray(
            USER_STORAGE_KEY,
            users
        );
    }

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

            if (
                parsed.hostname !==
                    'www.youtube.com' &&
                parsed.hostname !==
                    'youtube.com'
            ) {
                return '';
            }

            const path =
                parsed.pathname.replace(
                    /\/+$/,
                    ''
                );

            /*
             * 動画URLなどを
             * 投稿者URLとして誤認しない
             */
            if (
                !path.startsWith('/@') &&
                !path.startsWith('/channel/') &&
                !path.startsWith('/user/') &&
                !path.startsWith('/c/')
            ) {
                return '';
            }

            return (
                `https://www.youtube.com${path}`
            );

        } catch {

            return '';
        }
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

    function addBlockedUser(
        name,
        channelUrl
    ) {

        const normalizedUrl =
            normalizeChannelUrl(
                channelUrl
            );

        if (!normalizedUrl) {

            alert(
                'この投稿者のチャンネル情報を取得できませんでした。'
            );

            return false;
        }

        const users =
            loadNGUsers();

        if (
            users.some(
                user =>
                    normalizeChannelUrl(
                        user.channelUrl
                    ) === normalizedUrl
            )
        ) {

            alert(
                `「${name}」はすでにNG登録されています。`
            );

            return false;
        }

        if (
            !confirm(
                `「${name}」をNGユーザーに登録しますか？\n\n` +
                'この投稿者のコメント・通常動画・Shortsが自動的に非表示になります。'
            )
        ) {
            return false;
        }

        users.push({

            name:
                name ||
                '名前不明',

            channelUrl:
                normalizedUrl,

            addedAt:
                new Date()
                    .toISOString()
        });

        saveNGUsers(users);

        restoreHiddenVideos();

        fullScan();

        alert(
            `「${name}」をNGユーザーに登録しました。\n\n` +
            'この投稿者のコメント・動画・Shortsを非表示にします。'
        );

        return true;
    }

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

            restoreHiddenComments();
            restoreHiddenVideos();

            fullScan();

            alert(
                'NGユーザーを全員解除しました。'
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

        restoreHiddenComments();
        restoreHiddenVideos();

        fullScan();

        alert(
            `「${removed.name}」のNGを解除しました。`
        );
    }

    /* =========================================================
       コメント処理
    ========================================================= */

    function getComments(
        root = document
    ) {

        const result =
            new Set();

        if (
            root instanceof Element &&
            root.matches(
                COMMENT_SELECTOR
            )
        ) {

            result.add(root);
        }

        if (
            root.querySelectorAll
        ) {

            root
                .querySelectorAll(
                    COMMENT_SELECTOR
                )
                .forEach(
                    element => {

                        if (
                            element.matches(
                                'ytd-comment-renderer'
                            ) &&
                            element.closest(
                                'ytd-comment-view-model'
                            )
                        ) {
                            return;
                        }

                        result.add(
                            element
                        );
                    }
                );
        }

        return [
            ...result
        ];
    }

    function getCommentAuthorLink(
        comment
    ) {

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

    function getCommentAuthorName(
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

    function getCommentText(
        comment
    ) {

        const node =
            comment.querySelector(
                COMMENT_CONTENT_SELECTOR
            );

        if (node) {

            return (
                node.innerText ||
                node.textContent ||
                ''
            );
        }

        const fallback =
            comment.querySelector(
                '#content'
            );

        return (
            fallback?.innerText ||
            fallback?.textContent ||
            ''
        );
    }

    function hideComment(
        comment,
        reason = ''
    ) {

        comment.style.setProperty(
            'display',
            'none',
            'important'
        );

        comment.dataset.youtubeNgHidden =
            '1';

        comment.dataset.youtubeNgKind =
            'comment';

        if (reason) {

            comment.dataset.youtubeNgReason =
                reason;
        }
    }

    function restoreHiddenComments() {

        document
            .querySelectorAll(
                '[data-youtube-ng-kind="comment"]'
            )
            .forEach(
                comment => {

                    comment.style.removeProperty(
                        'display'
                    );

                    delete comment.dataset
                        .youtubeNgHidden;

                    delete comment.dataset
                        .youtubeNgKind;

                    delete comment.dataset
                        .youtubeNgReason;
                }
            );
    }

    function filterComment(
        comment
    ) {

        const authorLink =
            getCommentAuthorLink(
                comment
            );

        const channelUrl =
            normalizeChannelUrl(
                authorLink?.href ||
                authorLink?.getAttribute(
                    'href'
                )
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

        const text =
            getCommentText(
                comment
            );

        if (!text) {
            return;
        }

        const matched =
            getMatchedWord(
                text,
                loadCommentNGWords()
            );

        if (matched) {

            hideComment(
                comment,
                `コメントNGワード：${matched}`
            );
        }
    }

    function createCommentNGButton(
        comment
    ) {

        if (
            comment.querySelector(
                `.${COMMENT_USER_BUTTON_CLASS}`
            )
        ) {
            return;
        }

        const authorLink =
            getCommentAuthorLink(
                comment
            );

        if (!authorLink) {
            return;
        }

        const channelUrl =
            normalizeChannelUrl(
                authorLink.href ||
                authorLink.getAttribute(
                    'href'
                )
            );

        if (!channelUrl) {
            return;
        }

        const authorName =
            getCommentAuthorName(
                comment,
                authorLink
            );

        const button =
            makeTinyNGButton(
                'この投稿者をNG登録（コメント・動画・Shortsすべて非表示）',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        addBlockedUser(
                            authorName,
                            channelUrl
                        )
                    ) {

                        hideComment(
                            comment,
                            'NGユーザー'
                        );
                    }
                }
            );

        button.classList.add(
            COMMENT_USER_BUTTON_CLASS
        );

        const authorContainer =
            comment.querySelector(
                '#header-author'
            ) ||
            comment.querySelector(
                '#author-text'
            )?.parentElement ||
            authorLink.parentElement;

        authorContainer?.appendChild(
            button
        );
    }

    /* =========================================================
       動画 / Shorts 処理
    ========================================================= */

    function getVideoCards(
        root = document
    ) {

        const result =
            new Set();

        if (
            root instanceof Element &&
            root.matches(
                VIDEO_CARD_SELECTOR
            )
        ) {

            result.add(root);
        }

        if (
            root.querySelectorAll
        ) {

            root
                .querySelectorAll(
                    VIDEO_CARD_SELECTOR
                )
                .forEach(
                    card => {

                        /*
                         * rich-item内のlockupを
                         * 二重処理しない
                         */
                        if (
                            card.matches(
                                'yt-lockup-view-model'
                            ) &&
                            card.closest(
                                'ytd-rich-item-renderer'
                            )
                        ) {
                            return;
                        }

                        result.add(
                            card
                        );
                    }
                );
        }

        return [
            ...result
        ];
    }

    function getVideoTitle(
        card
    ) {

        /*
         * Shorts専用タイトル
         */
        const shortsTitle =
            card.querySelector(
                '.shortsLockupViewModelHostMetadataTitle'
            );

        if (shortsTitle) {

            return (
                shortsTitle.getAttribute(
                    'title'
                ) ||
                shortsTitle.innerText ||
                shortsTitle.textContent ||
                ''
            ).trim();
        }

        const candidates =
            card.querySelectorAll(
                VIDEO_TITLE_SELECTOR
            );

        for (
            const node
            of candidates
        ) {

            const text =
                node.getAttribute?.(
                    'title'
                ) ||
                node.innerText ||
                node.textContent ||
                '';

            const cleaned =
                text.trim();

            if (cleaned) {

                return cleaned;
            }
        }

        return '';
    }

    function getVideoChannelLink(
        card
    ) {

        const links =
            card.querySelectorAll(
                CHANNEL_LINK_SELECTOR
            );

        for (
            const link
            of links
        ) {

            const url =
                normalizeChannelUrl(
                    link.href ||
                    link.getAttribute(
                        'href'
                    )
                );

            if (url) {

                return link;
            }
        }

        return null;
    }

    function getVideoChannelName(
        card,
        channelLink
    ) {

        const direct =
            card.querySelector(
                'ytd-channel-name #text'
            ) ||
            card.querySelector(
                '#channel-name #text'
            ) ||
            card.querySelector(
                'ytd-channel-name'
            ) ||
            card.querySelector(
                '#channel-name'
            );

        const text =
            direct?.textContent?.trim() ||
            channelLink
                ?.textContent
                ?.trim() ||
            channelLink
                ?.getAttribute?.(
                    'aria-label'
                )
                ?.trim() ||
            '';

        return (
            text ||
            '名前不明'
        );
    }

    function hideVideoCard(
        card,
        reason = ''
    ) {

        card.style.setProperty(
            'display',
            'none',
            'important'
        );

        card.dataset.youtubeNgHidden =
            '1';

        card.dataset.youtubeNgKind =
            'video';

        if (reason) {

            card.dataset.youtubeNgReason =
                reason;
        }
    }

    function restoreHiddenVideos() {

        document
            .querySelectorAll(
                '[data-youtube-ng-kind="video"]'
            )
            .forEach(
                card => {

                    card.style.removeProperty(
                        'display'
                    );

                    delete card.dataset
                        .youtubeNgHidden;

                    delete card.dataset
                        .youtubeNgKind;

                    delete card.dataset
                        .youtubeNgReason;
                }
            );
    }

    function filterVideoCard(
        card
    ) {

        /*
         * 広告枠は触らない
         */
        if (
            card.matches(
                'ytd-ad-slot-renderer'
            ) ||
            card.querySelector(
                'ytd-ad-slot-renderer, .ad-created'
            )
        ) {
            return;
        }

        const channelLink =
            getVideoChannelLink(
                card
            );

        const channelUrl =
            normalizeChannelUrl(
                channelLink?.href ||
                channelLink?.getAttribute(
                    'href'
                )
            );

        if (
            channelUrl &&
            isBlockedUser(
                channelUrl
            )
        ) {

            hideVideoCard(
                card,
                'NGユーザー'
            );

            return;
        }

        const title =
            getVideoTitle(
                card
            );

        if (!title) {
            return;
        }

        const matched =
            getMatchedWord(
                title,
                loadVideoTitleNGWords()
            );

        if (matched) {

            hideVideoCard(
                card,
                `動画タイトルNG：${matched}`
            );
        }
    }

    function createVideoNGButton(
        card
    ) {

        if (
            card.querySelector(
                `.${VIDEO_USER_BUTTON_CLASS}`
            )
        ) {
            return;
        }

        if (
            card.dataset.youtubeNgHidden ===
            '1'
        ) {
            return;
        }

        const channelLink =
            getVideoChannelLink(
                card
            );

        if (!channelLink) {
            return;
        }

        const channelUrl =
            normalizeChannelUrl(
                channelLink.href ||
                channelLink.getAttribute(
                    'href'
                )
            );

        if (!channelUrl) {
            return;
        }

        const channelName =
            getVideoChannelName(
                card,
                channelLink
            );

        const button =
            makeTinyNGButton(
                'この投稿者をNG登録（通常動画・Shorts・コメントを非表示）',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        addBlockedUser(
                            channelName,
                            channelUrl
                        )
                    ) {

                        hideVideoCard(
                            card,
                            'NGユーザー'
                        );
                    }
                }
            );

        button.classList.add(
            VIDEO_USER_BUTTON_CLASS
        );

        /*
         * なるべくチャンネル名付近に置く
         */
        const target =
            card.querySelector(
                'ytd-channel-name'
            ) ||
            card.querySelector(
                '#channel-name'
            ) ||
            channelLink.parentElement ||
            card.querySelector(
                '#metadata'
            ) ||
            card;

        target.appendChild(
            button
        );
    }

    /* =========================================================
       小さいNGボタン
    ========================================================= */

    function makeTinyNGButton(
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
            'NG';

        button.title =
            title;

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
                    'middle',

                position:
                    'relative',

                zIndex:
                    '50'
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
                    '#fff';
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
            onClick
        );

        return button;
    }

    /* =========================================================
       全画面表示中は右下NGメニューを隠す
    ========================================================= */

    function isFullscreen() {

        return Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement
        );
    }

    function updateControlsVisibility() {

        const controls =
            document.getElementById(
                CONTROL_ID
            );

        if (!controls) {
            return;
        }

        controls.style.display =
            isFullscreen()
                ? 'none'
                : 'flex';
    }

    /* =========================================================
       右下NG設定
    ========================================================= */

    function createControls() {

        if (
            document.getElementById(
                CONTROL_ID
            ) ||
            !document.body
        ) {
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
                    '6px',

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
                        '150px',

                    padding:
                        '6px 8px',

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
                        'nowrap',

                    textAlign:
                        'left'
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
                '＋ コメントNGワード',
                'コメント本文のNGワードを追加',
                addCommentNGWord
            )
        );

        menu.appendChild(
            makeMenuButton(
                'コメントNG一覧',
                'コメントNGワードの確認・削除',
                manageCommentNGWords
            )
        );

        menu.appendChild(
            makeMenuButton(
                '＋ 動画タイトルNG',
                '動画・ShortsのタイトルNGワードを追加',
                addVideoTitleNGWord
            )
        );

        menu.appendChild(
            makeMenuButton(
                '動画タイトルNG一覧',
                '動画タイトルNGワードの確認・削除',
                manageVideoTitleNGWords
            )
        );

        menu.appendChild(
            makeMenuButton(
                'NG投稿者一覧',
                'コメント・動画共通のNG投稿者を確認・解除',
                manageNGUsers
            )
        );

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

        updateControlsVisibility();
    }

    /* =========================================================
       全体スキャン
    ========================================================= */

    function scanComments(
        root = document
    ) {

        getComments(root)
            .forEach(
                comment => {

                    filterComment(
                        comment
                    );

                    if (
                        comment.dataset
                            .youtubeNgHidden !==
                        '1'
                    ) {

                        createCommentNGButton(
                            comment
                        );
                    }
                }
            );
    }

    function scanVideos(
        root = document
    ) {

        getVideoCards(root)
            .forEach(
                card => {

                    filterVideoCard(
                        card
                    );

                    if (
                        card.dataset
                            .youtubeNgHidden !==
                        '1'
                    ) {

                        createVideoNGButton(
                            card
                        );
                    }
                }
            );
    }

    function fullScan() {

        scanComments(
            document
        );

        scanVideos(
            document
        );

        createControls();

        updateControlsVisibility();
    }

    /* =========================================================
       MutationObserver / SPA遷移
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

        /*
         * YouTube内で
         * 別動画・別ページへ移動したとき
         */
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

        /*
         * 全画面になった瞬間に
         * 右下NGメニューを消す
         */
        document.addEventListener(
            'fullscreenchange',
            updateControlsVisibility
        );

        /*
         * Safari系などの保険
         */
        document.addEventListener(
            'webkitfullscreenchange',
            updateControlsVisibility
        );

        /*
         * 遅延読み込み対策
         */
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
