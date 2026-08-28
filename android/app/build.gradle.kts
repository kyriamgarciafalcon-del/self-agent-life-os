import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val configuredWebAppUrl = providers.gradleProperty("webAppUrl")
    .orElse("https://self-agent-life-os.kyriamgarciafalcon.chatgpt.site/")
    .get()

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore/keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
    namespace = "app.selfagent"
    compileSdk = 35

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("update") {
            storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storeType = keystoreProperties.getProperty("storeType") ?: "PKCS12"
        }
    }

    defaultConfig {
        applicationId = "app.selfagent"
        minSdk = 26
        targetSdk = 35
        versionCode = providers.gradleProperty("versionCode").orElse("100").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("1.1.0").get()

        buildConfigField("String", "WEB_APP_URL", "\"${configuredWebAppUrl.replace("\"", "\\\"")}\"")
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("update")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("update")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.health.connect:connect-client:1.1.0-alpha07")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
