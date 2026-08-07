// ==UserScript==
// @name         YouTube: コメントNGフィルター（ワード＋投稿者）
// @namespace    youtube-comment-ng-filter
// @version      1.0.0
// @description  YouTubeのコメントをNGワード・NG投稿者で非表示にします
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* ==================================================
       保存先
    ================================================== */

    const WORD_STORAGE_KEY = 'youtube_comment_ng_words';
    const USER_STORAGE_KEY = 'youtube_comment_ng_users_v1';

    const USER_NG_BUTTON_CLASS = 'youtube-user-ng-button';
    const CONTROL_ID = 'youtube-ng-unified-controls';


    /* ==================================================
       固定NG正規表現

       初期状態では空です。
       必要ならここに正規表現を追加できます。

       例：
       /荒らしコメント/i,
       /スパム.*広告/i,
    ================================================== */

    const NG_REGEX = [
    ];


    /* ==================================================
       共通
    ================================================== */

    const COMMENT_SELECTOR = [
        'ytd-comment-view-model',
        'ytd-comment-renderer'
    ].join(',');


    function normalize(text) {
        return (text || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }


    /* ==================================================
       NGワード
    ================================================== */

    function loadNGWords() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(WORD_STORAGE_KEY) || '[]'
            );

            return Array.isArray(saved) ? saved : [];

        } catch (error) {
            console.error(
                '[YouTube NG] NGワードの読み込みに失敗しました。',
                error
            );

            return [];
        }
    }


    function saveNGWords(words) {
        try {
            localStorage.setItem(
                WORD_STORAGE_KEY,
                JSON.stringify(words)
            );

        } catch (error) {
            console.error(
                '[YouTube NG] NGワードの保存に失敗しました。',
                error
            );
        }
    }


    function isNGWord(text) {
        const normalizedText = normalize(text);

        if (!normalizedText) {
            return false;
        }

        const savedWords = loadNGWords();

        const wordMatched = savedWords.some(word =>
            normalizedText.includes(
                normalize(word)
            )
        );

        const regexMatched = NG_REGEX.some(regex =>
            regex.test(normalizedText)
        );

        return wordMatched || regexMatched;
    }


    function addNGWord() {
        const input = prompt(
            '非表示にしたいNGワードを入力してください。\n\n' +
            'その言葉を含むコメントが非表示になります。'
        );

        if (input === null) {
            return;
        }

        const word = input.trim();

        if (!word) {
            alert('NGワードが入力されていません。');
            return;
        }

        const words = loadNGWords();

        const exists = words.some(savedWord =>
            normalize(savedWord) === normalize(word)
        );

        if (exists) {
            alert(
                `「${word}」はすでに登録されています。`
            );
            return;
        }

        words.push(word);

        saveNGWords(words);

        filterAllComments(document);

        alert(
            `「${word}」をNGワードに追加しました。`
        );
    }


    function manageNGWords() {
        const words = loadNGWords();

        if (words.length === 0) {
            alert(
                '登録されているNGワードはありません。'
            );
            return;
        }

        const list = words
            .map(
                (word, index) =>
                    `${index + 1}. ${word}`
            )
            .join('\n');

        const answer = prompt(
            `現在のNGワード一覧：\n\n${list}\n\n` +
            '削除したいワードの番号を入力してください。\n' +
            '全部削除する場合は「all」と入力してください。'
        );

        if (answer === null) {
            return;
        }

        const input =
            answer.trim().toLowerCase();


        /* 全削除 */

        if (input === 'all') {
            const confirmed = confirm(
                'NGワードをすべて削除しますか？'
            );

            if (!confirmed) {
                return;
            }

            saveNGWords([]);

            alert(
                'NGワードをすべて削除しました。\n\n' +
                '非表示コメントを戻すにはページを再読み込みしてください。'
            );

            return;
        }


        /* 個別削除 */

        const index = Number(input) - 1;

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

        const removedWord = words[index];

        words.splice(index, 1);

        saveNGWords(words);

        alert(
            `「${removedWord}」をNGワードから削除しました。\n\n` +
            '非表示コメントを戻すにはページを再読み込みしてください。'
        );
    }


    /* ==================================================
       NGユーザー
    ================================================== */

    function loadNGUsers() {
        try {
            const data = JSON.parse(
                localStorage.getItem(
                    USER_STORAGE_KEY
                ) || '[]'
            );

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {
            console.error(
                '[YouTube NG] NGユーザー一覧の読み込みに失敗しました。',
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
                '[YouTube NG] NGユーザーの保存に失敗しました。',
                error
            );
        }
    }


    function normalizeChannelUrl(url) {
        if (!url) {
            return '';
        }

        try {
            const parsed = new URL(
                url,
                location.origin
            );

            return (
                parsed.origin +
                parsed.pathname.replace(/\/+$/, '')
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


    function getAuthorName(comment, authorLink) {
        const nameNode =
            comment.querySelector('#author-text span') ||
            comment.querySelector('#author-text') ||
            authorLink;

        return (
            nameNode?.textContent?.trim() ||
            '名前不明'
        );
    }


    function getChannelUrl(authorLink) {
        if (!authorLink) {
            return '';
        }

        const rawUrl =
            authorLink.href ||
            authorLink.getAttribute('href') ||
            '';

        return normalizeChannelUrl(rawUrl);
    }


    function isBlockedUser(channelUrl) {
        const normalizedUrl =
            normalizeChannelUrl(channelUrl);

        if (!normalizedUrl) {
            return false;
        }

        return loadNGUsers().some(user =>
            normalizeChannelUrl(
                user.channelUrl
            ) === normalizedUrl
        );
    }


    function blockUser(comment) {
        const authorLink =
            getAuthorLink(comment);

        const channelUrl =
            getChannelUrl(authorLink);

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

        const users = loadNGUsers();

        const normalizedUrl =
            normalizeChannelUrl(channelUrl);

        const alreadyBlocked =
            users.some(user =>
                normalizeChannelUrl(
                    user.channelUrl
                ) === normalizedUrl
            );

        if (alreadyBlocked) {
            alert(
                `「${authorName}」はすでにNG登録されています。`
            );

            hideComment(comment);

            return;
        }

        const confirmed = confirm(
            `「${authorName}」をNGユーザーに登録しますか？\n\n` +
            'このユーザーのコメントは別の動画でも自動的に非表示になります。'
        );

        if (!confirmed) {
            return;
        }

        users.push({
            name: authorName,
            channelUrl: normalizedUrl,
            addedAt: new Date().toISOString()
        });

        saveNGUsers(users);

        filterAllComments(document);

        alert(
            `「${authorName}」をNGユーザーに登録しました。`
        );
    }


    function manageNGUsers() {
        const users = loadNGUsers();

        if (users.length === 0) {
            alert(
                'NG登録されているユーザーはいません。'
            );

            return;
        }

        const list = users
            .map(
                (user, index) =>
                    `${index + 1}. ${user.name}`
            )
            .join('\n');

        const answer = prompt(
            `現在のNGユーザー一覧：\n\n${list}\n\n` +
            '解除したいユーザーの番号を入力してください。\n' +
            '全員解除する場合は「all」と入力してください。'
        );

        if (answer === null) {
            return;
        }

        const input =
            answer.trim().toLowerCase();


        /* 全解除 */

        if (input === 'all') {
            const confirmed = confirm(
                'NGユーザーを全員解除しますか？'
            );

            if (!confirmed) {
                return;
            }

            saveNGUsers([]);

            alert(
                'NGユーザーを全員解除しました。\n\n' +
                '非表示コメントを戻すにはページを再読み込みしてください。'
            );

            return;
        }


        /* 個別解除 */

        const index = Number(input) - 1;

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

        const removedUser = users[index];

        users.splice(index, 1);

        saveNGUsers(users);

        alert(
            `「${removedUser.name}」のNGを解除しました。\n\n` +
            'コメントを戻すにはページを再読み込みしてください。'
        );
    }


    /* ==================================================
       コメント取得
    ================================================== */

    function getComments(root = document) {
        const comments = [];

        if (
            root instanceof Element &&
            root.matches(COMMENT_SELECTOR)
        ) {
            comments.push(root);
        }

        if (
            root instanceof Document ||
            root instanceof Element
        ) {
            comments.push(
                ...root.querySelectorAll(
                    COMMENT_SELECTOR
                )
            );
        }

        /*
         * 同じコメントが複数の要素として取得された場合の
         * 二重処理を防止します。
         */

        return comments.filter(comment => {
            const parentComment =
                comment.parentElement
                    ?.closest(COMMENT_SELECTOR);

            return !parentComment;
        });
    }


    /* ==================================================
       コメント非表示判定
    ================================================== */

    function hideComment(comment) {
        if (!comment) {
            return;
        }

        comment.style.setProperty(
            'display',
            'none',
            'important'
        );

        comment.dataset.youtubeNgHidden = '1';
    }


    function filterComment(comment) {
        if (!comment) {
            return;
        }


        /* NGユーザー判定 */

        const authorLink =
            getAuthorLink(comment);

        const channelUrl =
            getChannelUrl(authorLink);

        if (
            channelUrl &&
            isBlockedUser(channelUrl)
        ) {
            hideComment(comment);

            return;
        }


        /* NGワード判定 */

        const contentNode =
            comment.querySelector(
                '#content-text'
            );

        if (!contentNode) {
            return;
        }

        const text =
            contentNode.textContent || '';

        if (isNGWord(text)) {
            hideComment(comment);
        }
    }


    function filterAllComments(root = document) {
        getComments(root)
            .forEach(filterComment);
    }


    /* ==================================================
       コメント投稿者横の「NG」ボタン
    ================================================== */

    function createUserNGButton(comment) {
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
            getAuthorLink(comment);

        const channelUrl =
            getChannelUrl(authorLink);

        if (
            !authorLink ||
            !channelUrl
        ) {
            return;
        }

        const button =
            document.createElement('button');

        button.type = 'button';

        button.className =
            USER_NG_BUTTON_CLASS;

        button.textContent = 'NG';

        button.title =
            'この投稿者をNGユーザーに登録';

        Object.assign(
            button.style,
            {
                marginLeft: '6px',
                padding: '0 5px',
                border: '1px solid #777',
                borderRadius: '8px',
                background: 'transparent',
                color: '#777',
                fontSize: '10px',
                lineHeight: '16px',
                fontFamily: 'sans-serif',
                cursor: 'pointer',
                verticalAlign: 'middle'
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

                blockUser(comment);
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

        authorContainer.appendChild(button);
    }


    function addUserNGButtons(root = document) {
        getComments(root)
            .forEach(createUserNGButton);
    }


    /* ==================================================
       右下の折り畳みメニュー
    ================================================== */

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
            document.createElement('div');

        container.id =
            CONTROL_ID;

        Object.assign(
            container.style,
            {
                position: 'fixed',
                right: '12px',
                bottom: '12px',
                zIndex: '999999',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '5px',
                fontFamily: 'Arial, sans-serif'
            }
        );


        /* 展開メニュー */

        const menu =
            document.createElement('div');

        Object.assign(
            menu.style,
            {
                display: 'none',
                flexDirection: 'column',
                gap: '4px',
                padding: '5px',
                background:
                    'rgba(32,32,32,0.96)',
                border: '1px solid #555',
                borderRadius: '8px',
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
                document.createElement('button');

            button.type = 'button';
            button.textContent = text;
            button.title = title;

            Object.assign(
                button.style,
                {
                    minWidth: '100px',
                    padding: '5px 7px',
                    border: '1px solid #666',
                    borderRadius: '5px',
                    background: '#303030',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
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


        /* 普段表示する小型ボタン */

        const toggle =
            document.createElement('button');

        toggle.type = 'button';
        toggle.textContent = 'NG';
        toggle.title = 'NG設定';

        Object.assign(
            toggle.style,
            {
                width: '36px',
                height: '28px',
                padding: '0',
                border: '1px solid #666',
                borderRadius: '7px',
                background:
                    'rgba(32,32,32,0.92)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 2px 6px rgba(0,0,0,0.35)'
            }
        );

        let open = false;

        toggle.addEventListener(
            'click',
            () => {
                open = !open;

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

        container.appendChild(menu);
        container.appendChild(toggle);

        document.body.appendChild(
            container
        );
    }


    /* ==================================================
       実行
    ================================================== */

    function run(root = document) {
        filterAllComments(root);
        addUserNGButtons(root);
        createControls();
    }


    function start() {
        if (!document.body) {
            setTimeout(start, 500);
            return;
        }

        run(document);

        const observer =
            new MutationObserver(
                mutations => {
                    for (
                        const mutation
                        of mutations
                    ) {
                        for (
                            const node
                            of mutation.addedNodes
                        ) {
                            if (
                                node.nodeType !==
                                Node.ELEMENT_NODE
                            ) {
                                continue;
                            }

                            run(node);
                        }
                    }

                    createControls();
                }
            );

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );


        /* YouTube内で別動画へ移動した場合 */

        document.addEventListener(
            'yt-navigate-finish',
            () => {
                setTimeout(
                    () => run(document),
                    400
                );

                setTimeout(
                    () => run(document),
                    1500
                );

                setTimeout(
                    () => run(document),
                    4000
                );
            }
        );


        /* コメントの遅延読み込み対策 */

        setTimeout(
            () => run(document),
            1500
        );

        setTimeout(
            () => run(document),
            4000
        );
    }


    start();

})();
