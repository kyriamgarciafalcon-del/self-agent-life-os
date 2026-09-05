package app.selfagent.v2

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
        enableEdgeToEdge()
        setContent { ShellApp() }
    }
}

@Composable
fun ShellApp() {
    var tab by rememberSaveable { mutableStateOf(ShellTab.Today.name) }
    val current = ShellTab.valueOf(tab)
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
            Text("收件箱 0", color = Muted, fontSize = 14.sp)
        }
        Column(
            Modifier
                .padding(horizontal = 16.dp)
                .background(Mint.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                .padding(16.dp)
                .fillMaxWidth(),
        ) {
            Text("空壳内测", color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text(
                "包名 app.selfagent.v2，可与旧版并行安装。不能记账，不写入账本。",
                color = Ink,
                fontSize = 16.sp,
            )
        }
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.Start,
        ) {
            Text(emptyTitle(current), color = Ink, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(emptyBody(current), color = Muted, fontSize = 16.sp)
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
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = if (selected) Ink else Muted,
                    ),
                ) {
                    Text(item.label, fontSize = 16.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                }
            }
        }
    }
}

private fun emptyTitle(tab: ShellTab): String = when (tab) {
    ShellTab.Today -> "今天还没有下一件事"
    ShellTab.Ledger -> "还没有入账记录"
    ShellTab.Life -> "还没有生活记录"
    ShellTab.Assistant -> "助手未连接"
}

private fun emptyBody(tab: ShellTab): String = when (tab) {
    ShellTab.Today -> "空状态来自真实任务。完成前不会假装有日程。"
    ShellTab.Ledger -> "省略币种时默认人民币 CNY。本空壳不会调用 PostJournal。"
    ShellTab.Life -> "健康趋势只基于真实数据，缺日不补零。"
    ShellTab.Assistant -> "断网或未授权时显示不可用，不编造答案。"
}
