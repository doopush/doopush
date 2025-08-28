pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // 为 DooPushSDK 模块添加 flatDir
        flatDir {
            dirs("../DooPushSDK/libs") // 指向 DooPushSDK 模块下的 libs 文件夹
        }
    }
}

rootProject.name = "DooPushSDKExample"
include(":app")
include(":DooPushSDK")
project(":DooPushSDK").projectDir = file("../DooPushSDK")
