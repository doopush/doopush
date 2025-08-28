# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# DooPush SDK 保护规则
-keep class com.doopush.sdk.** { *; }
-keep interface com.doopush.sdk.** { *; }
-keep enum com.doopush.sdk.** { *; }

# 小米推送保护规则
-keep class com.xiaomi.** { *; }
-dontwarn com.xiaomi.**

# 华为推送保护规则 (预留)
# -keep class com.huawei.** { *; }
# -dontwarn com.huawei.**

# OPPO推送保护规则 (预留)
# -keep class com.heytap.** { *; }
# -dontwarn com.heytap.**

# VIVO推送保护规则 (预留)
# -keep class com.vivo.** { *; }
# -dontwarn com.vivo.**

# 魅族推送保护规则 (预留)
# -keep class com.meizu.** { *; }
# -dontwarn com.meizu.**

# 网络库保护规则
-keep class okhttp3.** { *; }
-keep class retrofit2.** { *; }
-keep class com.google.gson.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**

# 保持注解
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions