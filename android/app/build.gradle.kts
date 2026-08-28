plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val configuredWebAppUrl = providers.gradleProperty("webAppUrl")
    .orElse("https://self-agent-life-os.kyriamgarciafalcon.chatgpt.site/")
    .get()

android {
    namespace = "app.selfagent"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.selfagent"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "WEB_APP_URL", "\"${configuredWebAppUrl.replace("\"", "\\\"")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
