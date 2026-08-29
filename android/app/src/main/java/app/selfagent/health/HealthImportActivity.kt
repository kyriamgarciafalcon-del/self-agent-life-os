package app.selfagent.health

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
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
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
    )

    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        if (granted.isEmpty()) {
            Toast.makeText(this, "未授权健康数据，无法导入", Toast.LENGTH_LONG).show()
            finish()
        } else readAndFinish()
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
                val start = end.minus(7, ChronoUnit.DAYS)
                val range = TimeRangeFilter.between(start, end)
                val zone = ZoneId.systemDefault()
                val days = linkedMapOf<String, JSONObject>()
                fun day(date: String): JSONObject = days.getOrPut(date) {
                    JSONObject().put("date", date).put("source", "health-connect")
                }
                fun dateOf(instant: Instant): String = instant.atZone(zone).toLocalDate().toString()

                runCatching {
                    client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records.forEach {
                        val row = day(dateOf(it.startTime))
                        row.put("steps", row.optLong("steps") + it.count)
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records.forEach {
                        val row = day(dateOf(it.startTime))
                        row.put("sleepHours", row.optDouble("sleepHours") + Duration.between(it.startTime, it.endTime).toMinutes() / 60.0)
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range)).records.forEach {
                        val row = day(dateOf(it.startTime))
                        row.put("exerciseMin", row.optLong("exerciseMin") + Duration.between(it.startTime, it.endTime).toMinutes())
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range)).records.forEach { record ->
                        record.samples.forEach { sample ->
                            val row = day(dateOf(sample.time))
                            val count = row.optInt("heartCount") + 1
                            val sum = row.optDouble("heartSum") + sample.beatsPerMinute
                            row.put("heartCount", count)
                            row.put("heartSum", sum)
                            row.put("heartRate", kotlin.math.round(sum / count).toLong())
                        }
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, range)).records.forEach {
                        val row = day(dateOf(it.time))
                        if (!row.has("heartRate")) row.put("heartRate", it.beatsPerMinute)
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(HeightRecord::class, range)).records.maxByOrNull { it.time }?.let {
                        day(dateOf(it.time)).put("heightCm", kotlin.math.round(it.height.inMeters * 1000) / 10.0)
                    }
                }
                runCatching {
                    client.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records.maxByOrNull { it.time }?.let {
                        day(dateOf(it.time)).put("weightKg", kotlin.math.round(it.weight.inKilograms * 10) / 10.0)
                    }
                }

                val records = JSONArray()
                days.toSortedMap().forEach { (_, row) ->
                    row.remove("heartCount")
                    row.remove("heartSum")
                    records.put(row)
                }
                HealthBus.post(JSONObject().put("records", records).put("source", "health-connect"))
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(this@HealthImportActivity, "读取健康平台失败，请先在运动健康中打开 Health Connect", Toast.LENGTH_LONG).show()
                }
            } finally {
                runOnUiThread { finish() }
            }
        }
    }
}
