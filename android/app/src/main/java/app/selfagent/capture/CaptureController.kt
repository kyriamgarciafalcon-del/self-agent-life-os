package app.selfagent.capture

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

class CaptureController(
    private val activity: Activity,
    private val emit: (String) -> Unit,
) {
    private var speech: SpeechRecognizer? = null

    fun startVoice() {
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
            return
        }
        listen()
    }

    fun onPermission(requestCode: Int, granted: Boolean) {
        if (requestCode == REQUEST_MIC && granted) listen()
        else if (requestCode == REQUEST_MIC) emit("")
    }

    fun pickImage() {
        activity.startActivityForResult(Intent(Intent.ACTION_GET_CONTENT).setType("image/*"), REQUEST_IMAGE)
    }

    fun onImage(uri: android.net.Uri?) {
        // Image OCR models are not bundled; they inflated the APK from ~4MB to ~47MB.
    }

    fun destroy() {
        speech?.destroy()
        speech = null
    }

    private fun listen() {
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            emit("")
            return
        }
        if (speech == null) speech = SpeechRecognizer.createSpeechRecognizer(activity)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.CHINA.toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        speech?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) {
                Handler(Looper.getMainLooper()).post { emit("") }
            }
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                Handler(Looper.getMainLooper()).post { emit(text) }
            }
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        speech?.startListening(intent)
    }

    companion object {
        const val REQUEST_MIC = 81
        const val REQUEST_IMAGE = 82
    }
}
