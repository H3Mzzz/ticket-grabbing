// ================================================
//         猫眼抢票 v2
// ================================================


// 1. 开售时间
const SellTime = "2024-05-20 12:00:00";

// 2. 提前多少毫秒开始盲点（2000 = 提前2秒）
const AdvanceMs = 2000;

// 3. "立即购票"按钮的点击坐标（第一阶段盲点位置）
const BuyBtnX = 1200;
const BuyBtnY = 3050;

// 4. "确认/立即支付"按钮的坐标
// 票档界面的"确认" 和 确认购票界面的"立即支付" 坐标基本一致，用同一个坐标猛点即可
const ConfirmX = 1200;
const ConfirmY = 3050;

// 5. 调试模式：true = 不会真的点支付按钮（测试用），false = 正式抢票
var isDebug = false;

// =================================================


auto.waitFor();
app.launchApp("猫眼");
openConsole();
console.setTitle("猫眼抢票 v2", "#ff11ee00", 30);

main();

function main() {
    console.log("脚本已启动！");

    // -----------------------------------------------
    // 第一步：检查预约信息
    // -----------------------------------------------
    var preBook  = text("已 预 约").findOne(2000);
    var preBook2 = className("android.widget.TextView").text("已填写").findOne(2000);

    if (preBook == null && preBook2 == null && !isDebug) {
        console.log("❌ 未检测到预约信息，请提前填写观演人后再运行！");
        return;
    }
    console.log("✅ 预约信息确认，准备抢票");

    // -----------------------------------------------
    // 第二步：后台刷新线程（一直跑到脚本结束）
    // 用 waitFor() 事件驱动，比轮询更及时
    // -----------------------------------------------
    threads.start(function () {
        log("刷新监控线程已启动");
        while (true) {
            textContains("刷新").waitFor();
            textContains("刷新").findOne().click();
            log("已点击刷新按钮");
            sleep(Math.random() * 50 + 25);
        }
    });

    // -----------------------------------------------
    // 第三步：卡点等待，到时间前什么都不做
    // -----------------------------------------------
    var targetTimeMs   = new Date(SellTime.replace(/-/g, '/')).getTime();
    var preStartTimeMs = targetTimeMs - AdvanceMs;

    if (Date.now() >= targetTimeMs) {
        console.log("⚠️ 当前时间已超过开售时间，直接开始！");
    } else {
        console.log("⏳ 等待开售中，将提前 " + AdvanceMs + "ms 开始盲点...");
        while (Date.now() < preStartTimeMs) {
            // 空转等待
        }
        console.log(">>> 时间到！开始盲点 >>>");
    }

    // -----------------------------------------------
    // 第四步：盲点"立即购票"
    // 一直点，直到页面跳转成功（出现"确认"或"¥"字样）
    // -----------------------------------------------
    while (true) {
        // 坐标盲点（快）
        click(BuyBtnX, BuyBtnY);

        // 文字识别兜底（防止坐标偏移）
        if (text("立即预订").exists()) text("立即预订").findOne().click();
        if (text("立即购票").exists()) text("立即购票").findOne().click();
        if (text("特惠购票").exists()) text("特惠购票").findOne().click();

        // 检测到"确认"或"¥" → 说明已成功跳转到票档界面或确认购票界面
        if (text("确认").exists() || textContains("¥").exists()) {
            console.log(">>> 成功进入下一页！>>>");
            break;
        }

        sleep(Math.random() * 50 + 25);
    }

    // -----------------------------------------------
    // 第五步：猛点右下角
    // 两个界面坐标基本一致，不需要分开处理，一直点到出现支付按钮为止
    // -----------------------------------------------
    console.log("① 猛点确认/立即支付...");
    for (let cnt = 0; cnt >= 0; cnt++) {
        // 绝对坐标点击
        click(ConfirmX, ConfirmY);
        // 文字识别兜底
        if (text("确认").exists()) text("确认").findOne().click();

        sleep(Math.random() * 40 + 25);

        // 出现 android.widget.Button 说明到了最终支付页
        if (className("android.widget.Button").exists()) {
            console.log(">>> 到达支付页面！>>>");
            break;
        }

        if (cnt % 20 == 0) log("已点击次数：" + cnt);
    }

    // -----------------------------------------------
    // 第六步：猛点支付按钮
    // -----------------------------------------------
    if (!isDebug) {
        console.log("② 猛点立即支付...");
        while (className("android.widget.Button").exists()) {
            className("android.widget.Button").findOne().click();
            sleep(Math.random() * 50 + 25);
        }
        ringingBell();
    } else {
        console.log("调试模式：跳过支付");
    }

    console.log("✅ 抢票流程结束！");
}

// -----------------------------------------------
// 抢到票后响铃提醒
// -----------------------------------------------
function ringingBell() {
    try {
        var mp = new android.media.MediaPlayer();
        mp.setDataSource(context, android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM));
        mp.setLooping(true);
        mp.prepare();
        mp.start();
        log("！！！抢到票了，快去付款！！！");
        events.on("exit", function () {
            if (mp.isPlaying()) mp.stop();
        });
    } catch (e) {
        log("铃声播放失败：" + e);
    }
}
