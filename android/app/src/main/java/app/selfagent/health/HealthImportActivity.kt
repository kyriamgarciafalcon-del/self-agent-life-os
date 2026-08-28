package app.selfagent.health

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit

class HealthImportActivity : ComponentActivity() {

    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        if (granted.containsAll(permissions)) readAndFinish() else {
            Toast.makeText(this, "未授权健康数据，无法从小米手环导入", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = HealthConnectClient.getSdkStatus(this)
        if (status == HealthConnectClient.SDK_UNAVAILABLE) {
            Toast.makeText(this, "这台手机不支持健康平台", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        if (status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
            startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            Toast.makeText(this, "请先安装或更新「健康平台 / Health Connect」", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        requestPermissions.launch(permissions)
    }

    private fun readAndFinish() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = HealthConnectClient.getOrCreate(this@HealthImportActivity)
                val end = Instant.now()
                val start = end.minus(2, ChronoUnit.DAYS)
                val range = TimeRangeFilter.between(start, end)
                val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records.sumOf { it.count }
                val sleepMin = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records
                    .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                val exerciseMin = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range)).records
                    .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                val today = java.time.LocalDate.now(ZoneId.systemDefault()).toString()
                HealthBus.post(
                    JSONObject()
                        .put("date", today)
                        .put("steps", steps)
                        .put("sleepHours", if (sleepMin > 0) sleepMin / 60.0 else 0)
                        .put("exerciseMin", exerciseMin)
                        .put("source", "health-connect")
                )
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(this@HealthImportActivity, "读取健康平台失败，请先在小米运动健康中打开 Health Connect", Toast.LENGTH_LONG).show()
                }
            } finally {
                runOnUiThread { finish() }
            }
        }
    }
}
