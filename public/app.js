/* ─────────────────────────────────────
   Local File Gallery — Client App
   ───────────────────────────────────── */

(() => {
    'use strict';

    // ─── State ───
    let authToken = sessionStorage.getItem('gallery-token') || '';
    let currentPath = '';
    let files = [];
    let viewableFiles = []; // only files that can be viewed in lightbox (images/videos/pdf)
    let currentViewIndex = -1;
    let isListView = false;
    let zoomMode = 'fit'; // 'fit' or 'full'
    let favoriteSet = new Set(); // set of favorite file paths
    let showFavoritesOnly = false;

    // ─── DOM Elements ───
    const $ = (sel) => document.querySelector(sel);
    const loginScreen = $('#login-screen');
    const loginForm = $('#login-form');
    const loginPassword = $('#login-password');
    const loginError = $('#login-error');

    const header = $('#header');
    const galleryContainer = $('#gallery-container');
    const grid = $('#gallery-grid');
    const loading = $('#loading');
    const emptyState = $('#empty-state');
    const breadcrumb = $('#breadcrumb');
    const fileCount = $('#file-count');
    const lightbox = $('#lightbox');
    const lightboxContent = $('#lightbox-content');
    const lightboxInfo = $('#lightbox-info');
    const lightboxCounter = $('#lightbox-counter');


    // ─── Initialize ───
    init();

    function init() {
        loadTheme();
        setupLoginForm();

        // If we have a saved token, try to use it
        if (authToken) {
            verifyToken();
        }
    }

    // ─── Login ───
    function setupLoginForm() {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = loginPassword.value.trim();
            if (!password) return;

            loginError.textContent = '';

            try {
                const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                });
                const data = await res.json();

                if (res.ok && data.token) {
                    authToken = data.token;
                    sessionStorage.setItem('gallery-token', authToken);
                    showGallery();
                } else {
                    loginError.textContent = '패스워드가 올바르지 않습니다';
                    loginPassword.value = '';
                    loginPassword.focus();
                }
            } catch (err) {
                loginError.textContent = '서버 연결에 실패했습니다';
            }
        });
    }

    async function verifyToken() {
        try {
            const res = await fetch(`/api/files?path=&token=${encodeURIComponent(authToken)}`);
            if (res.ok) {
                showGallery();
            } else {
                // Token invalid — show login
                authToken = '';
                sessionStorage.removeItem('gallery-token');
            }
        } catch {
            // Server not available
        }
    }

    function showGallery() {
        loginScreen.classList.add('hidden');
        setTimeout(() => {
            loginScreen.style.display = 'none';
        }, 300);

        header.style.display = 'flex';
        galleryContainer.style.display = 'block';

        // Parse initial path from URL hash
        currentPath = decodeURIComponent(window.location.hash.slice(1) || '');
        loadFiles(currentPath);
        setupEventListeners();
    }

    // ─── Auth helper ───
    function authHeaders() {
        return { 'X-Auth-Token': authToken };
    }

    function authQuery(url) {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}token=${encodeURIComponent(authToken)}`;
    }

    // ─── Event Listeners ───
    function setupEventListeners() {
        // Back button
        $('#btn-back').addEventListener('click', goUp);

        // View toggle
        $('#btn-view-toggle').addEventListener('click', toggleView);

        // Theme toggle
        $('#btn-theme').addEventListener('click', toggleTheme);

        // Favorites filter
        $('#btn-favorites-filter').addEventListener('click', toggleFavoritesFilter);

        // Card view
        $('#btn-card-view').addEventListener('click', openCardView);
        $('#btn-card-close').addEventListener('click', closeCardView);
        $('#btn-card-favorite').addEventListener('click', toggleCardFavorite);
        $('#btn-card-slideshow').addEventListener('click', toggleSlideshow);

        // Lightbox controls
        $('#lightbox-backdrop').addEventListener('click', closeLightbox);
        $('#btn-close').addEventListener('click', closeLightbox);
        $('#btn-prev').addEventListener('click', () => navigateLightbox(-1));
        $('#btn-next').addEventListener('click', () => navigateLightbox(1));
        $('#btn-download').addEventListener('click', downloadCurrent);
        $('#btn-fullscreen').addEventListener('click', toggleBrowserFullscreen);
        $('#btn-favorite').addEventListener('click', () => toggleFavorite());

        // Fullscreen API 상태 변화 감지
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyboard);

        // Hash change
        window.addEventListener('hashchange', () => {
            currentPath = decodeURIComponent(window.location.hash.slice(1) || '');
            loadFiles(currentPath);
        });

        // Gesture controls (swipe, tap-zoom, double-tap fullscreen)
        setupGestures();
    }

    // ─── Load Files ───
    async function loadFiles(dirPath) {
        grid.innerHTML = '';
        loading.style.display = 'flex';
        emptyState.style.display = 'none';

        try {
            const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`, {
                headers: authHeaders(),
            });

            if (res.status === 401) {
                // Token expired
                authToken = '';
                sessionStorage.removeItem('gallery-token');
                location.reload();
                return;
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            files = data.files;

            // Update favorite set from server response
            favoriteSet.clear();
            for (const f of files) {
                if (f.isFavorite) favoriteSet.add(f.path);
            }

            viewableFiles = files.filter(f => ['image', 'video', 'pdf'].includes(f.category));

            renderBreadcrumb(data.currentPath, data.rootName);
            renderGrid(showFavoritesOnly ? files.filter(f => f.isFavorite) : files);
            updateFileCount(files);
        } catch (err) {
            console.error('Failed to load files:', err);
            grid.innerHTML = `<div class="empty-state"><p>오류: ${err.message}</p></div>`;
        } finally {
            loading.style.display = 'none';
        }
    }

    // ─── Render Breadcrumb ───
    function renderBreadcrumb(currentPathStr, rootName) {
        breadcrumb.innerHTML = '';

        const parts = currentPathStr ? currentPathStr.split('/') : [];

        // Root
        const rootEl = document.createElement('span');
        rootEl.className = 'breadcrumb-item' + (parts.length === 0 ? ' active' : '');
        rootEl.textContent = `📁 ${rootName}`;
        rootEl.addEventListener('click', () => navigateTo(''));
        breadcrumb.appendChild(rootEl);

        // Sub-paths
        let accumulated = '';
        parts.forEach((part, i) => {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-sep';
            sep.textContent = '›';
            breadcrumb.appendChild(sep);

            accumulated += (i > 0 ? '/' : '') + part;
            const partPath = accumulated;

            const el = document.createElement('span');
            el.className = 'breadcrumb-item' + (i === parts.length - 1 ? ' active' : '');
            el.textContent = part;
            el.addEventListener('click', () => navigateTo(partPath));
            breadcrumb.appendChild(el);
        });
    }

    // ─── Render Grid ───
    function renderGrid(fileList) {
        grid.innerHTML = '';

        if (fileList.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        emptyState.style.display = 'none';

        fileList.forEach((file, index) => {
            const card = createCard(file, index);
            grid.appendChild(card);
        });
    }

    // ─── Create Card ───
    function createCard(file, index) {
        const card = document.createElement('div');
        card.className = `file-card ${file.category}`;
        card.setAttribute('data-index', index);

        const preview = document.createElement('div');
        preview.className = 'card-preview';

        if (file.category === 'image') {
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.alt = file.name;
            img.src = authQuery(`/api/thumbnail?path=${encodeURIComponent(file.path)}&size=400`);
            img.onerror = () => {
                img.style.display = 'none';
                preview.innerHTML += getIconSvg('image');
            };
            preview.appendChild(img);
        } else if (file.category === 'video') {
            const videoThumb = document.createElement('div');
            videoThumb.className = 'card-icon';
            videoThumb.innerHTML = getIconSvg('video');
            preview.appendChild(videoThumb);

            const badge = document.createElement('div');
            badge.className = 'video-badge';
            badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            preview.appendChild(badge);
        } else if (file.category === 'folder') {
            preview.innerHTML = `<div class="card-icon">${getIconSvg('folder')}</div>`;
        } else if (file.category === 'pdf') {
            preview.innerHTML = `<div class="card-icon">${getIconSvg('pdf')}</div>`;
        } else if (file.category === 'audio') {
            preview.innerHTML = `<div class="card-icon">${getIconSvg('audio')}</div>`;
        } else {
            preview.innerHTML = `<div class="card-icon">${getIconSvg('file')}</div>`;
        }

        // Favorite badge
        if (favoriteSet.has(file.path)) {
            const favBadge = document.createElement('div');
            favBadge.className = 'card-favorite-badge';
            favBadge.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            preview.appendChild(favBadge);
        }


        const info = document.createElement('div');
        info.className = 'card-info';

        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = file.name;
        name.title = file.name;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = file.isDirectory ? '' : formatSize(file.size);

        info.appendChild(name);
        info.appendChild(meta);

        card.appendChild(preview);
        card.appendChild(info);

        // Click handler
        card.addEventListener('click', () => handleCardClick(file));

        return card;
    }

    // ─── Card Click ───
    function handleCardClick(file) {
        if (file.isDirectory) {
            navigateTo(file.path);
        } else if (['image', 'video', 'pdf'].includes(file.category)) {
            const viewIndex = viewableFiles.findIndex(f => f.path === file.path);
            openLightbox(viewIndex);
        } else {
            downloadFile(file.path, file.name);
        }
    }

    // ─── Navigation ───
    function navigateTo(dirPath) {
        currentPath = dirPath;
        window.location.hash = encodeURIComponent(dirPath);
    }

    function goUp() {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        navigateTo(parts.join('/'));
    }

    // ─── Lightbox ───
    function openLightbox(viewIndex) {
        if (viewIndex < 0 || viewIndex >= viewableFiles.length) return;

        currentViewIndex = viewIndex;
        zoomMode = 'fit';
        lightbox.classList.add('active');
        lightbox.classList.add('viewport-fill');
        document.body.style.overflow = 'hidden';

        renderLightboxContent();
    }

    function closeLightbox() {
        // 브라우저 전체화면 해제
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        }

        // Reset zoom
        if (window._galleryResetZoom) window._galleryResetZoom();

        lightbox.classList.remove('active', 'viewport-fill');
        document.body.style.overflow = '';
        currentViewIndex = -1;

        // Stop any playing video
        const video = lightboxContent.querySelector('video');
        if (video) video.pause();
    }

    function navigateLightbox(direction) {
        const newIndex = currentViewIndex + direction;
        if (newIndex < 0 || newIndex >= viewableFiles.length) return;

        // Stop current video if playing
        const video = lightboxContent.querySelector('video');
        if (video) video.pause();

        currentViewIndex = newIndex;
        zoomMode = 'fit';
        if (window._galleryResetZoom) window._galleryResetZoom();
        renderLightboxContent();
    }

    function renderLightboxContent() {
        const file = viewableFiles[currentViewIndex];
        lightboxContent.innerHTML = '';
        lightboxContent.className = 'lightbox-content fit-mode';

        const fileUrl = authQuery(`/api/file?path=${encodeURIComponent(file.path)}`);

        if (file.category === 'image') {
            const img = document.createElement('img');
            img.src = fileUrl;
            img.alt = file.name;
            img.draggable = false;
            img.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            lightboxContent.appendChild(img);
        } else if (file.category === 'video') {
            const video = document.createElement('video');
            video.src = fileUrl;
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            lightboxContent.appendChild(video);
        } else if (file.category === 'pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = fileUrl;
            lightboxContent.appendChild(iframe);
        }

        // Update info
        lightboxInfo.textContent = file.name;
        lightboxCounter.textContent = `${currentViewIndex + 1} / ${viewableFiles.length}`;

        // Update favorite star button
        updateFavoriteButton(file.path);

        // Show/hide nav buttons
        $('#btn-prev').style.visibility = currentViewIndex > 0 ? 'visible' : 'hidden';
        $('#btn-next').style.visibility = currentViewIndex < viewableFiles.length - 1 ? 'visible' : 'hidden';
    }

    function setZoom(mode) {
        zoomMode = mode;
        lightboxContent.className = `lightbox-content ${mode === 'fit' ? 'fit-mode' : 'full-mode'}`;

        if (mode === 'full') {
            const img = lightboxContent.querySelector('img');
            if (img) {
                setTimeout(() => {
                    lightboxContent.scrollLeft = (img.naturalWidth - lightboxContent.clientWidth) / 2;
                    lightboxContent.scrollTop = (img.naturalHeight - lightboxContent.clientHeight) / 2;
                }, 50);
            }
        }
    }

    let _fsToggleLock = false;
    function toggleBrowserFullscreen() {
        // Prevent double-firing (enter then immediately exit)
        if (_fsToggleLock) {
            console.log('[Gallery] toggleBrowserFullscreen blocked (cooldown)');
            return;
        }
        _fsToggleLock = true;
        setTimeout(() => { _fsToggleLock = false; }, 500);

        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        console.log('[Gallery] toggleBrowserFullscreen called, fsEl:', !!fsEl);

        if (fsEl) {
            console.log('[Gallery] exiting fullscreen');
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
            try {
                if (lightbox.requestFullscreen) {
                    console.log('[Gallery] calling lightbox.requestFullscreen()');
                    lightbox.requestFullscreen().catch(function (err) {
                        console.error('[Gallery] fullscreen error:', err);
                    });
                } else if (lightbox.webkitRequestFullscreen) {
                    console.log('[Gallery] calling webkitRequestFullscreen()');
                    lightbox.webkitRequestFullscreen();
                } else {
                    console.log('[Gallery] No fullscreen API available');
                }
            } catch (e) {
                console.error('[Gallery] fullscreen exception:', e);
            }
        }
    }

    function handleFullscreenChange() {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        $('#icon-fullscreen-enter').style.display = isFs ? 'none' : 'block';
        $('#icon-fullscreen-exit').style.display = isFs ? 'block' : 'none';
    }

    // ─── Keyboard Navigation ───
    function handleKeyboard(e) {
        if (!lightbox.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape': {
                const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
                if (fsEl) {
                    // 브라우저 전체화면이면 전체화면만 해제 (라이트박스는 유지)
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                } else {
                    closeLightbox();
                }
                break;
            }
            case 'ArrowLeft':
                e.preventDefault();
                navigateLightbox(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigateLightbox(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateLightbox(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigateLightbox(1);
                break;
            case 'f':
            case 'F':
                toggleBrowserFullscreen();
                break;
            case ' ':
                e.preventDefault();
                const video = lightboxContent.querySelector('video');
                if (video) {
                    video.paused ? video.play() : video.pause();
                }
                break;
        }
    }

    // ─── Gesture System (PointerEvents) ───
    // Supports: swipe L/R (prev/next with slide animation),
    //           swipe down (close lightbox),
    //           swipe up (toggle favorite),
    //           double-tap (fullscreen toggle),
    //           triple-tap (zoom toggle),
    //           drag-to-pan when zoomed
    function setupGestures() {
        let pointerDown = false;
        let startX = 0, startY = 0;
        let startTime = 0;
        let tapCount = 0;
        let lastTapTime = 0;
        let lastTapX = 0, lastTapY = 0;
        let multiTapTimer = null;
        const MULTI_TAP_DELAY = 400;  // ms window for multi-tap
        const SWIPE_THRESHOLD = 50;   // px
        const TAP_THRESHOLD = 15;     // px (max move to count as tap)
        const SWIPE_DOWN_THRESHOLD = 80; // px

        // Zoom state
        let isZoomed = false;
        let zoomOriginX = 0, zoomOriginY = 0;
        let panX = 0, panY = 0;
        let panStartX = 0, panStartY = 0;
        let isPanning = false;
        let isDraggingHorizontal = false;
        let isDraggingVertical = false;




        // --- Lightbox gestures ---
        lightbox.addEventListener('pointerdown', (e) => {
            // Ignore if target is a button or control
            if (e.target.closest('.lightbox-toolbar, .lightbox-nav, .lightbox-counter, video, iframe')) return;

            pointerDown = true;
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();

            if (isZoomed) {
                isPanning = true;
                panStartX = panX;
                panStartY = panY;
                lightboxContent.style.cursor = 'grabbing';
            }
        }, { passive: true });

        lightbox.addEventListener('pointermove', (e) => {
            if (!pointerDown) return;

            if (isZoomed && isPanning) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                panX = panStartX + dx;
                panY = panStartY + dy;
                applyZoomTransform();
                e.preventDefault();
                return;
            }

            // --- Drag feedback (not zoomed) ---
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Determine drag direction once past a small threshold
            if (!isDraggingHorizontal && !isDraggingVertical && (absDx > 10 || absDy > 10)) {
                if (absDx > absDy * 1.2) {
                    isDraggingHorizontal = true;
                } else if (absDy > absDx * 1.2) {
                    isDraggingVertical = true;
                }
            }

            // Horizontal drag → image follows finger
            if (isDraggingHorizontal) {
                const content = lightboxContent.querySelector('img, video, iframe');
                if (content) {
                    const resistance = 0.6;
                    content.style.transition = 'none';
                    content.style.transform = `translateX(${dx * resistance}px)`;
                    content.style.opacity = Math.max(0.4, 1 - Math.abs(dx) / 600);
                }
                e.preventDefault();
            }

            // Vertical drag (down) → image follows finger downward with fade
            if (isDraggingVertical && dy > 0) {
                const content = lightboxContent.querySelector('img, video, iframe');
                const backdrop = $('#lightbox-backdrop');
                if (content) {
                    content.style.transition = 'none';
                    content.style.transform = `translateY(${dy * 0.6}px) scale(${Math.max(0.85, 1 - dy / 800)})`;
                }
                if (backdrop) {
                    backdrop.style.transition = 'none';
                    backdrop.style.opacity = Math.max(0.3, 1 - dy / 400);
                }
                e.preventDefault();
            }


        });

        lightbox.addEventListener('pointerup', (e) => {
            if (!pointerDown) return;
            pointerDown = false;
            isPanning = false;
            const wasDraggingH = isDraggingHorizontal;
            const wasDraggingV = isDraggingVertical;
            isDraggingHorizontal = false;
            isDraggingVertical = false;
            if (isZoomed) lightboxContent.style.cursor = 'grab';

            // Ignore if target is a button or control
            if (e.target.closest('.lightbox-toolbar, .lightbox-nav, .lightbox-counter, video, iframe')) {
                resetDragStyles();
                return;
            }

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const dt = Date.now() - startTime;
            const now = Date.now();

            // --- HORIZONTAL SWIPE with slide animation ---
            if (!isZoomed && wasDraggingH && Math.abs(dx) > SWIPE_THRESHOLD && dt < 500) {
                const direction = dx > 0 ? -1 : 1;
                const newIndex = currentViewIndex + direction;

                // Check bounds
                if (newIndex < 0 || newIndex >= viewableFiles.length) {
                    // Bounce back — no next/prev file
                    animateSnapBack();
                    return;
                }

                // Slide out in swipe direction, then navigate
                const content = lightboxContent.querySelector('img, video, iframe');
                if (content) {
                    const slideOut = dx > 0 ? '100vw' : '-100vw';
                    content.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
                    content.style.transform = `translateX(${slideOut})`;
                    content.style.opacity = '0';

                    setTimeout(() => {
                        resetDragStyles();
                        navigateLightbox(direction);
                        // Slide in from opposite side
                        requestAnimationFrame(() => {
                            const newContent = lightboxContent.querySelector('img, video, iframe');
                            if (newContent) {
                                const slideIn = dx > 0 ? '-60px' : '60px';
                                newContent.style.transition = 'none';
                                newContent.style.transform = `translateX(${slideIn})`;
                                newContent.style.opacity = '0.5';
                                requestAnimationFrame(() => {
                                    newContent.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
                                    newContent.style.transform = 'translateX(0)';
                                    newContent.style.opacity = '1';
                                    setTimeout(() => {
                                        newContent.style.transition = '';
                                        newContent.style.transform = '';
                                        newContent.style.opacity = '';
                                    }, 220);
                                });
                            }
                        });
                    }, 180);
                } else {
                    navigateLightbox(direction);
                }
                return;
            }

            // --- VERTICAL SWIPE DOWN → close lightbox ---
            if (!isZoomed && wasDraggingV && dy > SWIPE_DOWN_THRESHOLD && dt < 600) {
                // Animate dismiss
                const content = lightboxContent.querySelector('img, video, iframe');
                const backdrop = $('#lightbox-backdrop');
                if (content) {
                    content.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
                    content.style.transform = 'translateY(100vh) scale(0.8)';
                    content.style.opacity = '0';
                }
                if (backdrop) {
                    backdrop.style.transition = 'opacity 0.25s ease-out';
                    backdrop.style.opacity = '0';
                }
                setTimeout(() => {
                    resetDragStyles();
                    closeLightbox();
                    if (backdrop) {
                        backdrop.style.transition = '';
                        backdrop.style.opacity = '';
                    }
                }, 260);
                return;
            }

            // --- VERTICAL SWIPE UP → toggle favorite ---
            if (!isZoomed && wasDraggingV && dy < -SWIPE_DOWN_THRESHOLD && dt < 600) {
                // Animate image briefly upward then reset
                const content = lightboxContent.querySelector('img, video, iframe');
                if (content) {
                    content.style.transition = 'transform 0.2s ease-out';
                    content.style.transform = 'translateY(-30px)';
                    setTimeout(() => {
                        content.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        content.style.transform = '';
                        setTimeout(() => { content.style.transition = ''; }, 320);
                    }, 150);
                }
                toggleFavorite();
                resetDragStyles();
                return;
            }

            // Reset any drag styles if no swipe was triggered
            resetDragStyles();

            // --- TAP DETECTION (multi-tap: double=fullscreen, triple=zoom) ---
            if (dist < TAP_THRESHOLD && dt < 400) {
                const timeSinceLastTap = now - lastTapTime;
                const tapDist = Math.sqrt(
                    (e.clientX - lastTapX) ** 2 + (e.clientY - lastTapY) ** 2
                );

                if (timeSinceLastTap < MULTI_TAP_DELAY && tapDist < 50) {
                    tapCount++;
                } else {
                    tapCount = 1;
                }

                lastTapTime = now;
                lastTapX = e.clientX;
                lastTapY = e.clientY;

                // Clear previous timer and wait for more taps
                clearTimeout(multiTapTimer);

                if (tapCount >= 3) {
                    // === TRIPLE TAP → zoom toggle (instant) ===
                    tapCount = 0;
                    handleTripleTap(e);
                } else {
                    // Wait to see if more taps are coming
                    multiTapTimer = setTimeout(() => {
                        if (tapCount === 2) {
                            // === DOUBLE TAP → fullscreen ===
                            handleDoubleTap(e);
                        }
                        // Single tap = no action
                        tapCount = 0;
                    }, MULTI_TAP_DELAY);
                }
            }
        });

        lightbox.addEventListener('pointercancel', () => {
            pointerDown = false;
            isPanning = false;
            isDraggingHorizontal = false;
            isDraggingVertical = false;
            tapCount = 0;
            clearTimeout(multiTapTimer);
            resetDragStyles();
        }, { passive: true });

        // Prevent default touch behaviors in lightbox (pull-to-refresh etc.)
        lightbox.addEventListener('touchmove', (e) => {
            if (lightbox.classList.contains('active')) {
                e.preventDefault();
            }
        }, { passive: false });

        // --- Handlers ---
        function handleDoubleTap(e) {
            const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            if (fsEl) {
                // In browser fullscreen → exit fullscreen
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            } else {
                // Not in fullscreen → toggle fullscreen
                toggleBrowserFullscreen();
            }
        }

        function handleTripleTap(e) {
            // Only zoom images
            const img = lightboxContent.querySelector('img');
            if (!img) return;

            if (!isZoomed) {
                // Zoom IN at tap position
                const rect = lightboxContent.getBoundingClientRect();
                zoomOriginX = e.clientX - rect.left - rect.width / 2;
                zoomOriginY = e.clientY - rect.top - rect.height / 2;
                panX = -zoomOriginX;
                panY = -zoomOriginY;
                isZoomed = true;
                lightboxContent.classList.add('gesture-zoomed');
                lightboxContent.style.cursor = 'grab';
                applyZoomTransform();
            } else {
                // Zoom OUT
                resetZoom();
            }
        }

        function applyZoomTransform() {
            const img = lightboxContent.querySelector('img');
            if (!img) return;
            img.style.transformOrigin = 'center center';
            img.style.transform = `translate(${panX}px, ${panY}px) scale(2)`;
        }

        // Expose resetZoom for use when navigating
        window._galleryResetZoom = function () {
            resetZoom();
        };

        function resetZoom() {
            isZoomed = false;
            panX = 0;
            panY = 0;
            lightboxContent.classList.remove('gesture-zoomed');
            lightboxContent.style.cursor = '';
            const img = lightboxContent.querySelector('img');
            if (img) {
                img.style.transform = '';
                img.style.transformOrigin = '';
            }
        }

        // Reset inline drag styles applied during pointermove
        function resetDragStyles() {
            const content = lightboxContent.querySelector('img, video, iframe');
            if (content) {
                content.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
                content.style.transform = '';
                content.style.opacity = '';
                setTimeout(() => {
                    content.style.transition = '';
                }, 220);
            }
            const backdrop = $('#lightbox-backdrop');
            if (backdrop) {
                backdrop.style.transition = 'opacity 0.2s ease-out';
                backdrop.style.opacity = '';
                setTimeout(() => {
                    backdrop.style.transition = '';
                }, 220);
            }
        }

        // Bounce-back animation when swiping past first/last item
        function animateSnapBack() {
            const content = lightboxContent.querySelector('img, video, iframe');
            if (content) {
                content.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out';
                content.style.transform = 'translateX(0)';
                content.style.opacity = '1';
                setTimeout(() => {
                    content.style.transition = '';
                    content.style.transform = '';
                    content.style.opacity = '';
                }, 320);
            }
        }
    }

    // ─── Favorites ───
    async function toggleFavorite() {
        if (currentViewIndex < 0) return;
        const file = viewableFiles[currentViewIndex];
        const isFav = favoriteSet.has(file.path);

        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: file.path }),
            });
            const data = await res.json();
            if (data.isFavorite) {
                favoriteSet.add(file.path);
            } else {
                favoriteSet.delete(file.path);
            }
            updateFavoriteButton(file.path);
            showStarAnimation(data.isFavorite);
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    }

    function updateFavoriteButton(filePath) {
        const btn = $('#btn-favorite');
        if (favoriteSet.has(filePath)) {
            btn.classList.add('favorited');
        } else {
            btn.classList.remove('favorited');
        }
    }

    function showStarAnimation(isFavorite) {
        // Remove any existing animation
        const existing = document.querySelector('.star-pop-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = `star-pop-overlay${isFavorite ? '' : ' unfavorite'}`;
        if (isFavorite) {
            overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        } else {
            overlay.innerHTML = `<svg viewBox="0 0 24 24" fill="rgba(250,204,21,0.3)" stroke="#facc15" stroke-width="0.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        }
        document.body.appendChild(overlay);

        // Auto-remove after animation
        setTimeout(() => overlay.remove(), 1000);
    }

    function toggleFavoritesFilter() {
        showFavoritesOnly = !showFavoritesOnly;
        const btn = $('#btn-favorites-filter');
        btn.classList.toggle('active', showFavoritesOnly);

        if (showFavoritesOnly) {
            const favFiles = files.filter(f => f.isFavorite || favoriteSet.has(f.path));
            renderGrid(favFiles);
        } else {
            renderGrid(files);
        }
    }

    // ─── Immersive Card View ───
    // Performance: only images near the viewport are loaded (Intersection Observer).
    // Far-away images have their src cleared to free GPU/memory.
    const CARD_LOAD_MARGIN = '200%'; // load images 2 screens ahead
    const SLIDESHOW_INTERVAL_MS = 3000; // ← 슬라이드쇼 간격 (ms). 여기서 조정
    let cardViewImages = [];         // image file objects for card view
    let cardViewIndex = 0;           // current visible card index
    let cardObserver = null;         // IntersectionObserver instance
    let slideshowTimer = null;       // slideshow interval ID
    let isSlideshowPlaying = false;

    function openCardView() {
        // Collect all images in current folder
        cardViewImages = files.filter(f => f.category === 'image');
        if (cardViewImages.length === 0) return;

        const cardView = $('#card-view');
        const scrollEl = $('#card-view-scroll');
        scrollEl.innerHTML = '';

        // Render card slots (lightweight — no images loaded yet)
        cardViewImages.forEach((file, i) => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.setAttribute('data-card-index', i);

            // Placeholder spinner
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            card.appendChild(placeholder);

            // Favorite indicator
            if (favoriteSet.has(file.path)) {
                const fav = document.createElement('div');
                fav.className = 'card-fav-indicator';
                fav.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                card.appendChild(fav);
            }

            scrollEl.appendChild(card);
        });

        // Setup lazy loading observer
        setupCardObserver(scrollEl);

        // Show card view
        cardView.classList.add('active');
        document.body.style.overflow = 'hidden';
        cardViewIndex = 0;
        updateCardViewUI();

        // Enter browser fullscreen
        try {
            if (cardView.requestFullscreen) {
                cardView.requestFullscreen().catch(() => { });
            } else if (cardView.webkitRequestFullscreen) {
                cardView.webkitRequestFullscreen();
            }
        } catch (e) { /* ignore */ }

        // Track scroll for counter updates
        scrollEl.addEventListener('scroll', onCardScroll, { passive: true });

        // Keyboard
        document.addEventListener('keydown', handleCardKeyboard);
    }

    function closeCardView() {
        const cardView = $('#card-view');
        const scrollEl = $('#card-view-scroll');

        // Exit fullscreen first
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }

        // Stop slideshow if running
        stopSlideshow();

        cardView.classList.remove('active');
        document.body.style.overflow = '';

        // Cleanup observer
        if (cardObserver) {
            cardObserver.disconnect();
            cardObserver = null;
        }

        // Remove listeners
        scrollEl.removeEventListener('scroll', onCardScroll);
        document.removeEventListener('keydown', handleCardKeyboard);

        // Clear DOM to free memory
        scrollEl.innerHTML = '';
        cardViewImages = [];
    }

    function setupCardObserver(scrollEl) {
        if (cardObserver) cardObserver.disconnect();

        cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const card = entry.target;
                const idx = parseInt(card.getAttribute('data-card-index'));
                const file = cardViewImages[idx];
                if (!file) return;

                if (entry.isIntersecting) {
                    // Load image if not already loaded
                    if (!card.querySelector('img')) {
                        const img = document.createElement('img');
                        img.src = authQuery(`/api/file?path=${encodeURIComponent(file.path)}`);
                        img.alt = file.name;
                        img.draggable = false;
                        img.onload = () => {
                            const spinner = card.querySelector('.card-placeholder');
                            if (spinner) spinner.remove();
                        };
                        img.onerror = () => {
                            const spinner = card.querySelector('.card-placeholder');
                            if (spinner) spinner.remove();
                            card.innerHTML = `<div style="color: rgba(255,255,255,0.4); font-size: 14px;">이미지를 불러올 수 없습니다</div>`;
                        };
                        // Insert before placeholder
                        card.insertBefore(img, card.firstChild);
                    }
                } else {
                    // Unload far-away images to free memory
                    const img = card.querySelector('img');
                    if (img) {
                        img.src = '';
                        img.remove();
                        // Re-add placeholder if needed
                        if (!card.querySelector('.card-placeholder')) {
                            const ph = document.createElement('div');
                            ph.className = 'card-placeholder';
                            card.insertBefore(ph, card.firstChild);
                        }
                    }
                }
            });
        }, {
            root: scrollEl,
            rootMargin: CARD_LOAD_MARGIN,  // preload 2 screens ahead/behind
            threshold: 0
        });

        // Observe all card slots
        scrollEl.querySelectorAll('.card-item').forEach(card => {
            cardObserver.observe(card);
        });
    }

    let _cardScrollRaf = 0;
    function onCardScroll() {
        cancelAnimationFrame(_cardScrollRaf);
        _cardScrollRaf = requestAnimationFrame(() => {
            const scrollEl = $('#card-view-scroll');
            const scrollTop = scrollEl.scrollTop;
            const viewH = scrollEl.clientHeight;
            const newIndex = Math.round(scrollTop / viewH);
            if (newIndex !== cardViewIndex && newIndex >= 0 && newIndex < cardViewImages.length) {
                cardViewIndex = newIndex;
                updateCardViewUI();
            }
        });
    }

    function updateCardViewUI() {
        const file = cardViewImages[cardViewIndex];
        if (!file) return;

        $('#card-view-info').textContent = file.name;
        $('#card-view-counter').textContent = `${cardViewIndex + 1} / ${cardViewImages.length}`;

        // Update favorite button
        const favBtn = $('#btn-card-favorite');
        if (favoriteSet.has(file.path)) {
            favBtn.classList.add('favorited');
        } else {
            favBtn.classList.remove('favorited');
        }
    }

    async function toggleCardFavorite() {
        const file = cardViewImages[cardViewIndex];
        if (!file) return;

        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: file.path }),
            });
            const data = await res.json();
            if (data.isFavorite) {
                favoriteSet.add(file.path);
            } else {
                favoriteSet.delete(file.path);
            }
            updateCardViewUI();

            // Update fav indicator on card
            const scrollEl = $('#card-view-scroll');
            const card = scrollEl.children[cardViewIndex];
            if (card) {
                const existing = card.querySelector('.card-fav-indicator');
                if (data.isFavorite && !existing) {
                    const fav = document.createElement('div');
                    fav.className = 'card-fav-indicator';
                    fav.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                    card.appendChild(fav);
                } else if (!data.isFavorite && existing) {
                    existing.remove();
                }
            }

            showStarAnimation(data.isFavorite);
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    }

    function handleCardKeyboard(e) {
        switch (e.key) {
            case 'Escape':
                closeCardView();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                scrollToCard(cardViewIndex + 1);
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                scrollToCard(cardViewIndex - 1);
                break;
        }
    }

    function scrollToCard(index) {
        if (index < 0 || index >= cardViewImages.length) return;
        const scrollEl = $('#card-view-scroll');
        const card = scrollEl.children[index];
        if (card) {
            card.scrollIntoView({ behavior: 'smooth' });
        }
    }
    // ─── Slideshow ───
    function toggleSlideshow() {
        if (isSlideshowPlaying) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    }

    function startSlideshow() {
        if (isSlideshowPlaying) return;
        isSlideshowPlaying = true;
        updateSlideshowIcon();
        $('#card-view').classList.add('slideshow-active');
        $('#btn-card-slideshow').classList.add('playing');

        const frontImg = $('#crossfade-front');
        const backImg = $('#crossfade-back');

        // Disable transitions for initial setup
        frontImg.style.transition = 'none';
        backImg.style.transition = 'none';

        // Show current image on front
        const file = cardViewImages[cardViewIndex];
        if (file) {
            frontImg.src = authQuery(`/api/file?path=${encodeURIComponent(file.path)}`);
            frontImg.style.opacity = '1';
        }

        // Preload next into back (hidden)
        const nextFile = cardViewImages[cardViewIndex + 1];
        if (nextFile) {
            backImg.src = authQuery(`/api/file?path=${encodeURIComponent(nextFile.path)}`);
        }
        backImg.style.opacity = '0';

        // Re-enable transitions after a frame
        requestAnimationFrame(() => {
            frontImg.style.transition = '';
            backImg.style.transition = '';
        });

        scheduleSlideshowNext();
    }

    function scheduleSlideshowNext() {
        slideshowTimer = setTimeout(() => {
            if (!isSlideshowPlaying) return;
            if (cardViewIndex >= cardViewImages.length - 1) {
                stopSlideshow();
                return;
            }
            slideshowAdvance();
        }, SLIDESHOW_INTERVAL_MS);
    }

    function slideshowAdvance() {
        const frontImg = $('#crossfade-front');
        const backImg = $('#crossfade-back');

        // True crossfade: front fades out, back fades in simultaneously
        frontImg.style.opacity = '0';
        backImg.style.opacity = '1';

        // After transition completes, swap and prepare next
        setTimeout(() => {
            if (!isSlideshowPlaying) return;

            cardViewIndex++;
            updateCardViewUI();

            // Sync scroll position for when slideshow stops
            const scrollEl = $('#card-view-scroll');
            const card = scrollEl.children[cardViewIndex];
            if (card) card.scrollIntoView({ behavior: 'instant' });

            // Disable transitions for the swap
            frontImg.style.transition = 'none';
            backImg.style.transition = 'none';

            // Swap: front takes the current (was back) image
            frontImg.src = backImg.src;
            frontImg.style.opacity = '1';

            // Load next image into back (hidden)
            const nextFile = cardViewImages[cardViewIndex + 1];
            if (nextFile) {
                backImg.src = authQuery(`/api/file?path=${encodeURIComponent(nextFile.path)}`);
            }
            backImg.style.opacity = '0';

            // Re-enable transitions after browser applies the changes
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    frontImg.style.transition = '';
                    backImg.style.transition = '';

                    // Schedule next
                    if (isSlideshowPlaying) scheduleSlideshowNext();
                });
            });
        }, 850); // slightly longer than CSS transition (0.8s)
    }

    function stopSlideshow() {
        if (!isSlideshowPlaying && !slideshowTimer) return;
        isSlideshowPlaying = false;
        clearTimeout(slideshowTimer);
        slideshowTimer = null;
        updateSlideshowIcon();
        $('#card-view').classList.remove('slideshow-active');
        $('#btn-card-slideshow').classList.remove('playing');

        // Clean up crossfade images to free memory
        $('#crossfade-front').src = '';
        $('#crossfade-back').src = '';
    }

    function updateSlideshowIcon() {
        const playIcon = $('#icon-slideshow-play');
        const pauseIcon = $('#icon-slideshow-pause');
        if (isSlideshowPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
        } else {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
        }
    }

    // ─── View Toggle ───
    function toggleView() {
        isListView = !isListView;
        grid.classList.toggle('list-view', isListView);

        $('#icon-grid').style.display = isListView ? 'block' : 'none';
        $('#icon-list').style.display = isListView ? 'none' : 'block';
    }

    // ─── Theme ───
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('gallery-theme', next);
        updateThemeIcons(next);
    }

    function loadTheme() {
        const saved = localStorage.getItem('gallery-theme');
        const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (preferDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeIcons(theme);
    }

    function updateThemeIcons(theme) {
        $('#icon-moon').style.display = theme === 'dark' ? 'none' : 'block';
        $('#icon-sun').style.display = theme === 'dark' ? 'block' : 'none';
    }

    // ─── Download ───
    function downloadCurrent() {
        if (currentViewIndex < 0) return;
        const file = viewableFiles[currentViewIndex];
        downloadFile(file.path, file.name);
    }

    function downloadFile(filePath, fileName) {
        const a = document.createElement('a');
        a.href = authQuery(`/api/file?path=${encodeURIComponent(filePath)}`);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // ─── File Count ───
    function updateFileCount(fileList) {
        const folders = fileList.filter(f => f.isDirectory).length;
        const filesOnly = fileList.length - folders;
        const parts = [];
        if (folders) parts.push(`폴더 ${folders}`);
        if (filesOnly) parts.push(`파일 ${filesOnly}`);
        fileCount.textContent = parts.join(' · ') || '비어있음';
    }

    // ─── Helpers ───
    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    function getIconSvg(type) {
        const icons = {
            folder: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
            image: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
            video: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
            audio: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            pdf: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
            file: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        };
        return icons[type] || icons.file;
    }
})();
