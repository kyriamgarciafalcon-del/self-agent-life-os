import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore/keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
val hasSigningMaterial = keystorePropertiesFile.exists() &&
    !keystoreProperties.getProperty("storeFile").isNullOrBlank()

android {
    namespace = "app.selfagent.v2"
    compileSdk = 35

    buildFeatures {
        compose = true
        buildConfig = true
    }

    if (hasSigningMaterial) {
        signingConfigs {
            create("update") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeType = keystoreProperties.getProperty("storeType") ?: "PKCS12"
            }
        }
    }

    defaultConfig {
        applicationId = "app.selfagent.v2"
        minSdk = 26
        targetSdk = 35
        versionCode = providers.gradleProperty("versionCode").orElse("2000").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("2.0.0-shell").get()
    }

    buildTypes {
        debug {
            isDebuggable = true
            if (hasSigningMaterial) {
                signingConfig = signingConfigs.getByName("update")
            }
        }
        release {
            isMinifyEnabled = false
            if (hasSigningMaterial) {
                signingConfig = signingConfigs.getByName("update")
            }
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
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
