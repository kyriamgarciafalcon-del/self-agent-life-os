package app.selfagent.v2

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.selfagent.v2.inbox.InboxDraft
import app.selfagent.v2.life.LifeTasks
import app.selfagent.v2.ledger.DayToDayBooks
import app.selfagent.v2.ledger.LedgerBooks
import app.selfagent.v2.ledger.LedgerException
import app.selfagent.v2.ledger.LedgerQueries
import app.selfagent.v2.ledger.PostJournal
import app.selfagent.v2.ledger.RecordExpense
import app.selfagent.v2.money.Currency
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.UUID

private val Canvas = Color(0xFFF2F2F7)
private val Surface = Color(0xFFFFFFFF)
private val Ink = Color(0xFF1C1C1E)
private val Muted = Color(0xFF8E8E93)
private val Mint = Color(0xFFA8E6CF)

private enum class ShellTab(val label: String) {
    Today("今天"),
    Ledger("账本"),
    Life("生活"),
    Assistant("助手"),
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }
        val books = AndroidLedgerBooks(this).also { it.ensureCashAndExpenseAccounts() }
        val tasks = AndroidTaskBoard(this)
        val calendar = AndroidCalendar(this).also { it.rescheduleAlarms() }
        val expense = RecordExpense(PostJournal(books), books)
        val dayBooks = DayToDayBooks(PostJournal(books), expense)
        val inbox = AndroidInbox(this, expense)
        enableEdgeToEdge()
        setContent { ShellApp(expense, tasks, inbox, calendar, dayBooks) }
    }
}

@Composable
fun ShellApp(
    record: RecordExpense,
    tasks: LifeTasks,
    inbox: AndroidInbox,
    calendar: AndroidCalendar,
    dayBooks: DayToDayBooks,
) {
    var tab by rememberSaveable { mutableStateOf(ShellTab.Today.name) }
    var composing by rememberSaveable { mutableStateOf(false) }
    var amount by rememberSaveable { mutableStateOf("") }
    var newTitle by rememberSaveable { mutableStateOf("") }
    var eventTitle by rememberSaveable { mutableStateOf("") }
    var eventHour by rememberSaveable { mutableStateOf("15:00") }
    var error by rememberSaveable { mutableStateOf("") }
    var saving by rememberSaveable { mutableStateOf(false) }
    var commandId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    var showInbox by rememberSaveable { mutableStateOf(false) }
    var draftAmount by rememberSaveable { mutableStateOf("") }
    var stamp by remember { mutableStateOf(0) }
    val current = ShellTab.valueOf(tab)
    val books: LedgerBooks = record.books
    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .statusBarsPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Self Agent V2", color = Ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            TextButton(
                onClick = { showInbox = !showInbox },
                modifier = Modifier.height(48.dp),
            ) {
                stamp
                Text("收件箱 ${inbox.pending().size}", color = Ink, fontSize = 16.sp)
            }
        }
        Column(
            Modifier
                .padding(horizontal = 16.dp)
                .background(Mint.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                .padding(16.dp)
                .fillMaxWidth(),
        ) {
            Text("内测可记账", color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text("草稿确认后才入账。忽略不记账。过期版本不能确认。", color = Ink, fontSize = 16.sp)
        }
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            if (showInbox) {
                stamp
                Text("收件箱", color = Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Text("确认才调用 PostJournal。草稿不在账本里。", color = Muted, fontSize = 16.sp)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = draftAmount,
                    onValueChange = { draftAmount = it },
                    placeholder = { Text("30.00") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        val text = draftAmount.trim()
                        if (text.isEmpty()) return@Button
                        inbox.offer(InboxDraft(UUID.randomUUID().toString(), text, version = 1))
                        draftAmount = ""
                        stamp += 1
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
                ) { Text("放入草稿", fontSize = 16.sp) }
                Spacer(Modifier.height(16.dp))
                val pending = inbox.pending()
                if (pending.isEmpty()) {
                    Text("没有待确认草稿", color = Muted, fontSize = 16.sp)
                } else {
                    pending.forEach { item ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("餐饮 ¥${item.amount}", color = Ink, fontSize = 16.sp, modifier = Modifier.weight(1f))
                            TextButton(
                                onClick = {
                                    inbox.confirm(item.id, item.version)
                                    stamp += 1
                                },
                                modifier = Modifier.height(48.dp),
                            ) { Text("确认", color = Ink, fontSize = 16.sp) }
                            TextButton(
                                onClick = {
                                    inbox.ignore(item.id, item.version)
                                    stamp += 1
                                },
                                modifier = Modifier.height(48.dp),
                            ) { Text("忽略", color = Muted, fontSize = 16.sp) }
                        }
                    }
                }
            } else if (current == ShellTab.Today) {
                stamp
                val day = LocalDate.now()
                val items = tasks.today(day)
                val events = calendar.on(day)
                Text("今天", color = Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Text("日程按本地日历日；完成任务只记今天这一次。", color = Muted, fontSize = 16.sp)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = eventTitle,
                    onValueChange = { eventTitle = it },
                    placeholder = { Text("日程标题") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = eventHour,
                    onValueChange = { eventHour = it },
                    placeholder = { Text("15:00") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        val title = eventTitle.trim()
                        val time = runCatching { LocalTime.parse(eventHour.trim()) }.getOrNull()
                        if (title.isEmpty() || time == null) return@Button
                        val scheduled = calendar.add(UUID.randomUUID().toString(), title, LocalDateTime.of(day, time))
                        eventTitle = ""
                        stamp += 1
                        error = if (scheduled == 0) "时间已过，没有设置提醒" else "已安排 ${scheduled} 个提醒（提前10分钟和到点）"
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
                ) { Text("添加今天的日程", fontSize = 16.sp) }
                if (error.isNotEmpty()) Text(error, color = Ink, fontSize = 16.sp)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = newTitle,
                    onValueChange = { newTitle = it },
                    placeholder = { Text("下一件事") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        val title = newTitle.trim()
                        if (title.isEmpty()) return@Button
                        tasks.addDailyRule(UUID.randomUUID().toString(), title)
                        newTitle = ""
                        stamp += 1
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
                ) { Text("添加每天", fontSize = 16.sp) }
                Spacer(Modifier.height(16.dp))
                if (events.isNotEmpty()) {
                    Text("日程", color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    events.forEach { event ->
                        Text(
                            "${event.start.toLocalTime()}  ${event.title}",
                            color = Ink,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(vertical = 8.dp),
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                }
                if (items.isEmpty() && events.isEmpty()) {
                    Text("今天还没有下一件事", color = Muted, fontSize = 16.sp)
                } else if (items.isEmpty()) {
                    Text("今天没有未完成任务", color = Muted, fontSize = 16.sp)
                } else {
                    items.forEach { item ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(item.title, color = Ink, fontSize = 16.sp, modifier = Modifier.weight(1f))
                            if (item.completed) {
                                Text("已完成", color = Muted, fontSize = 16.sp)
                            } else {
                                TextButton(
                                    onClick = {
                                        tasks.complete(item.ruleId, day)
                                        stamp += 1
                                    },
                                    modifier = Modifier.height(48.dp),
                                ) { Text("完成", fontSize = 16.sp, color = Ink) }
                            }
                        }
                    }
                }
            } else if (current == ShellTab.Ledger) {
                stamp
                val consumption = LedgerQueries(books).personalConsumption(Currency.CNY)
                val cash = books.balance("cash", Currency.CNY)
                Text("个人消费 ${formatCny(consumption)}", color = Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Text("现金 ${formatCny(cash)}  微信 ${formatCny(books.balance("wechat", Currency.CNY))}", color = Muted, fontSize = 16.sp)
                Text("待收回 ${formatCny(books.balance("receivable", Currency.CNY))}  信用卡 ${formatCny(books.balance("card", Currency.CNY))}", color = Muted, fontSize = 16.sp)
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        composing = true
                        error = ""
                        amount = ""
                        commandId = UUID.randomUUID().toString()
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
                    shape = RoundedCornerShape(14.dp),
                ) { Text("记一笔", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.transfer(UUID.randomUUID().toString(), amount.ifBlank { "40.00" }, "cash", "wechat")
                            stamp += 1
                            error = ""
                        } catch (_: LedgerException) {
                            error = "转账失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("转到微信（默认40）", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.pad(UUID.randomUUID().toString(), "100.00", "200.00")
                            stamp += 1
                            error = ""
                        } catch (_: LedgerException) {
                            error = "垫付失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("垫付 100+应收200", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.collect(UUID.randomUUID().toString(), amount.ifBlank { "120.00" })
                            stamp += 1
                            error = ""
                        } catch (e: LedgerException) {
                            error = if (e.code.name == "OVER_SETTLE") "不能超额收回" else "收回失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("收回（默认120）", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.cardSpend(UUID.randomUUID().toString(), amount.ifBlank { "30.00" })
                            stamp += 1
                            error = ""
                        } catch (_: LedgerException) {
                            error = "信用卡记账失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("信用卡消费（默认30）", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.cardPay(UUID.randomUUID().toString(), amount.ifBlank { "30.00" })
                            stamp += 1
                            error = ""
                        } catch (_: LedgerException) {
                            error = "还款失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("还信用卡（不算消费）", fontSize = 16.sp) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        try {
                            dayBooks.reverseLast()
                            stamp += 1
                            error = ""
                        } catch (e: LedgerException) {
                            error = if (e.code.name == "ALREADY_REVERSED") "已经冲销过" else "冲销失败"
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Surface, contentColor = Ink),
                ) { Text("冲销上一笔", fontSize = 16.sp) }
                if (error.isNotEmpty()) Text(error, color = Color(0xFFB00020), fontSize = 16.sp)
                Spacer(Modifier.height(16.dp))
                val rows = books.recentExpenseMinors()
                if (rows.isEmpty()) {
                    Text("还没有入账记录", color = Muted, fontSize = 16.sp)
                } else {
                    rows.forEach { minor ->
                        Text("餐饮  ${formatCny(minor)}", color = Ink, fontSize = 16.sp, modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
                if (composing) {
                    Spacer(Modifier.height(16.dp))
                    Text("金额（CNY）", color = Ink, fontSize = 16.sp)
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { amount = it; error = "" },
                        placeholder = { Text("30.00") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error.isNotEmpty()) Text(error, color = Color(0xFFB00020), fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            if (saving) return@Button
                            if (amount.trim().isEmpty()) {
                                error = "金额不能为空"
                                return@Button
                            }
                            saving = true
                            try {
                                record.execute(commandId, amount)
                                composing = false
                                stamp += 1
                            } catch (_: LedgerException) {
                                error = "无法入账"
                            } finally {
                                saving = false
                            }
                        },
                        enabled = !saving,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Mint, contentColor = Ink),
                    ) { Text(if (saving) "保存中" else "保存", fontSize = 16.sp) }
                    TextButton(
                        onClick = { composing = false },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                    ) { Text("取消", fontSize = 16.sp, color = Muted) }
                }
            } else {
                Text(emptyTitle(current), color = Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Text(emptyBody(current), color = Muted, fontSize = 16.sp)
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .background(Surface)
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            ShellTab.entries.forEach { item ->
                val selected = item == current
                TextButton(
                    onClick = { tab = item.name },
                    modifier = Modifier
                        .height(48.dp)
                        .widthIn(min = 48.dp)
                        .semantics { contentDescription = item.label },
                    colors = ButtonDefaults.textButtonColors(contentColor = if (selected) Ink else Muted),
                ) {
                    Text(item.label, fontSize = 16.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                }
            }
        }
    }
}

private fun formatCny(minor: Long): String {
    val sign = if (minor < 0) "-" else ""
    val abs = kotlin.math.abs(minor)
    return sign + "¥" + (abs / 100) + "." + (abs % 100).toString().padStart(2, '0')
}

private fun emptyTitle(tab: ShellTab): String = when (tab) {
    ShellTab.Today -> "今天还没有下一件事"
    ShellTab.Ledger -> "还没有入账记录"
    ShellTab.Life -> "还没有生活记录"
    ShellTab.Assistant -> "助手未连接"
}

private fun emptyBody(tab: ShellTab): String = when (tab) {
    ShellTab.Today -> "空状态来自真实任务。完成前不会假装有日程。"
    ShellTab.Ledger -> "省略币种时默认人民币 CNY。"
    ShellTab.Life -> "健康趋势只基于真实数据，缺日不补零。"
    ShellTab.Assistant -> "断网或未授权时显示不可用，不编造答案。"
}
