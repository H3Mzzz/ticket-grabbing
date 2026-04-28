// ================================================
//     猫眼 余票监控
// ================================================

// --- 核心配置 ---
const minTicketPrice = 500;  // 最低票价
const maxTicketPrice = 718;  // 最高票价
const viewers        = "xx"; // 观演人，逗号分隔
const playEtcStr     = "05-01,05-02,05-03";  // 场次关键字
const monitorIntervalSecs  = 0.8;     // 刷新间隔（秒）

// --- 坐标配置  ---
const ConfirmX   = 1955;
const ConfirmY   = 3075;

// --- 通用 ---
var isDebug = false; // true = 不点最后一步支付（测试用）

// =================================================

auto.waitFor();
openConsole();
console.setTitle("猫眼余票捡漏", "#ff00aaff", 30);

main();

function main() {
    console.log("脚本已启动，正在寻找票档界面...");
    var playEtcArr = playEtcStr.split(',');

    while (true) {
        // --- 0. 界面检测 ---
        // 检查屏幕上是否有我们设定的场次日期，如果没有，说明还没进到正确的页面
        var onPage = false;
        for (let date of playEtcArr) {
            if (textContains(date).exists()) {
                onPage = true;
                break;
            }
        }
        
        if (!onPage) {
            log("⏳ 尚未检测到设定的场次，请手动进入票档界面...");
            sleep(1500);
            continue; // 跳过这一轮，继续检测
        }

        // --- 1. 循环点击设定的场次刷新余票 ---
        for (let playEtc of playEtcArr) {
            var sessionBtn = textContains(playEtc).findOne(500);
            if (!sessionBtn) continue;
            
            // 获取该文字控件在屏幕上的物理边框范围
            var bounds = sessionBtn.bounds();
            click(bounds.centerX(), bounds.centerY());
            log("🔄 刷新场次：" + playEtc);
            sleep(monitorIntervalSecs * 1000); // 极短暂停等待票档渲染

            // --- 2. 扫描有效余票 ---
            var targetTickets = getAvailableTickets();
            if (targetTickets.length > 0) {
                log("🎯 发现余票！场次：" + playEtc + " | 票价：" + targetTickets);
                
                // 遍历可买的票价去抢
                for (let amount of targetTickets) {
                    var success = grabTicket(amount);
                    if (success) {
                        console.log("🎉 捡漏成功，脚本结束运行！");
                        return; 
                    }
                }
            }
        }
    }
}

// ================================================
//   抢票核心动作：选票 -> 第五步确认 -> 选人 -> 第六步支付
// ================================================
function grabTicket(amount) {
    var viewersArr = viewers.split(',');
    log("⚡ 开始抢：¥" + amount);

    // 点击对应票档
    let ticketBtn = textContains("¥" + amount).findOne(1000);
    if (!ticketBtn) return false;
    var tb = ticketBtn.bounds();
    click(tb.centerX(), tb.centerY());
    
    // 等待数量选择出现
    textContains("数量").waitFor();

    // --- 调整购票数量 ---
    if (textMatches("\\d+份").exists()) {
        var curCount = parseInt(textMatches("\\d+份").findOne().text().replace("份", ""));
        if (curCount < viewersArr.length) {
            var ticketNumParent = textMatches("\\d+份").findOne().parent();
            var plusBtn = ticketNumParent.children()[ticketNumParent.childCount() - 1];
            for (let i = curCount; i < viewersArr.length; i++) {
                plusBtn.click();
            }
        }
    }

    textMatches("\\d+份").waitFor();
    if (!text(viewersArr.length + "份").exists()) {
        console.log("⚠️ 余票份数不足以满足观演人数，放弃此票档");
        return false;
    }

    //猛点确认
    console.log("① 猛点确认（最多20次）...");
    var reachedPayment = false;
    for (let cnt = 0; cnt < 20; cnt++) {
        click(ConfirmX, ConfirmY);
        if (text("确认").exists()) text("确认").findOne().click();
        sleep(Math.random() * 40 + 25);

        if (className("android.widget.Button").exists()) {
            console.log(">>> 成功挤入支付页！>>>");
            reachedPayment = true;
            break;
        }
        if (cnt % 5 == 0 && cnt > 0) log("已点击确认 " + cnt + " 次...");
    }

    if (!reachedPayment) {
        console.log("❌ 挤入支付页失败，退回监控模式");
        return false; // 退回外层循环，继续监控
    }

    // --- 勾选观演人 ---
    if (!(viewersArr.length == 1 && viewers == "默认人")) {
        selectViewers(viewersArr);
    }

    //猛点支付
    if (!isDebug) {
        console.log("② 猛点支付提交...");
        while (className("android.widget.Button").exists()) {
            className("android.widget.Button").findOne().click();
            sleep(Math.random() * 50 + 25);
        }
    } else {
        console.log("🛑 调试模式：已跳过最终支付点击");
        return false;
    }

    // 验证结果
    sleep(1500);
    if (textContains("微信支付").exists() || descContains("微信支付").exists()) {
        ringingBell();
        return true;
    }

    console.log("❌ 最终支付唤起失败，退回监控模式");
    return false;
}

// ================================================
// 辅助函数区
// ================================================

function getAvailableTickets() {
    var targetTickets = [];
    textContains("¥").find().forEach(function (btn) {
        var isOutOfStock = btn.text().includes("缺货");
        if (!isOutOfStock && btn.parent()) {
            isOutOfStock = nodeContainsText(btn.parent(), "缺货");
        }
        if (!isOutOfStock) {
            var match = btn.text().match(/¥(\d+)/);
            if (match) {
                var amount = parseInt(match[1]);
                if (amount >= minTicketPrice && amount <= maxTicketPrice) {
                    targetTickets.push(amount);
                }
            }
        }
    });
    targetTickets.sort(function (a, b) { return a - b; });
    return targetTickets;
}

function nodeContainsText(node, str) {
    if ((node.text() != null && node.text().includes(str)) ||
        (node.desc() != null && node.desc().includes(str))) {
        return true;
    }
    for (let i = 0; i < node.childCount(); i++) {
        if (nodeContainsText(node.children()[i], str)) return true;
    }
    return false;
}

function selectViewers(viewersArr) {
    for (let viewer of viewersArr) {
        var viewerObj = className("android.widget.TextView").text(viewer).findOne(2000);
        if (viewerObj == null) continue;
        viewerObj.parent().parent().children().forEach(function (child) {
            if (child.className() == "android.widget.Image" &&
                child.text() == "wc0GRRGh2f2pQAAAABJRU5ErkJggg==") {
                child.click();
            }
        });
    }
}

function ringingBell() {
    try {
        var mp = new android.media.MediaPlayer();
        mp.setDataSource(context, android.media.RingtoneManager.getDefaultUri(
            android.media.RingtoneManager.TYPE_RINGTONE));
        mp.setLooping(true);
        mp.prepare();
        mp.start();
        log("！！！成功锁票，快去付款！！！");
        events.on("exit", function () {
            if (mp.isPlaying()) mp.stop();
        });
    } catch (e) {
        log("铃声播放失败：" + e);
    }
}