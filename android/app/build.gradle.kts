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

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "app.selfagent"
        minSdk = 26
        targetSdk = 35
        versionCode = providers.gradleProperty("versionCode").orElse("1").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("1.0.1").get()

        buildConfigField("String", "WEB_APP_URL", "\"${configuredWebAppUrl.replace("\"", "\\\"")}\"")
    }

    val storePath = providers.gradleProperty("storeFile")
    signingConfigs {
        create("stable") {
            if (storePath.isPresent) {
                storeFile = file(storePath.get())
                storePassword = providers.gradleProperty("storePassword").get()
                keyAlias = providers.gradleProperty("keyAlias").get()
                keyPassword = providers.gradleProperty("keyPassword").get()
            }
        }
    }

    buildTypes {
        debug {
            if (storePath.isPresent) {
                signingConfig = signingConfigs.getByName("stable")
            }
        }
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
