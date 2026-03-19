// Pake 底层就是 Tauri，所以 window.__TAURI__ 可用

document.addEventListener('DOMContentLoaded', function () {

    // 尝试拿到 Tauri 窗口 API
    var appWindow = null;

    try {
        // Tauri v2
        if (window.__TAURI__ && window.__TAURI__.window) {
            appWindow = window.__TAURI__.window.getCurrentWindow();
        }
    } catch (e) {
        console.warn('Tauri API 不可用，用 fallback', e);
    }

    // ====== 最小化 ======
    document.getElementById('btn-min').addEventListener('click', function () {
        if (appWindow && appWindow.minimize) {
            appWindow.minimize();
        }
    });

    // ====== 最大化 / 还原 ======
    document.getElementById('btn-max').addEventListener('click', function () {
        if (appWindow && appWindow.toggleMaximize) {
            appWindow.toggleMaximize();
        }
    });

    // ====== 关闭 ======
    document.getElementById('btn-close').addEventListener('click', function () {
        if (appWindow && appWindow.close) {
            appWindow.close();
        } else {
            window.close(); // fallback
        }
    });

    // ====== 双击标题栏 → 最大化/还原 ======
    document.querySelector('.titlebar-left').addEventListener('dblclick', function () {
        if (appWindow && appWindow.toggleMaximize) {
            appWindow.toggleMaximize();
        }
    });

    // ====== 监听最大化状态，切换图标 ======
    if (appWindow && appWindow.onResized) {
        appWindow.onResized(function () {
            appWindow.isMaximized().then(function (isMax) {
                var icon = document.getElementById('max-icon');
                if (isMax) {
                    // 还原图标（两个叠起来的方块）
                    icon.innerHTML =
                        '<rect x="7" y="3" width="12" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>' +
                        '<rect x="3" y="7" width="12" height="12" rx="1" fill="#f6f6f6" stroke="currentColor" stroke-width="2"/>';
                } else {
                    // 最大化图标（一个方块）
                    icon.innerHTML =
                        '<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>';
                }
            });
        });
    }

    console.log('✅ 自定义标题栏初始化完成');
});