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

# Keep DooPush SDK
-keep class com.doopush.sdk.** { *; }

# Keep Firebase
# Firebase - 最小化规则
-keep class com.google.firebase.FirebaseApp { *; }
-keep class com.google.firebase.messaging.FirebaseMessaging { *; }
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-keep class com.google.firebase.messaging.RemoteMessage { *; }

# Google Play Services 核心
-keep class com.google.android.gms.tasks.Task { *; }
-keep class com.google.android.gms.tasks.OnCompleteListener { *; }

-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Keep Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class * implements com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Keep example app models
-keep class com.doopush.DooPushSDKExample.** { *; }

# Keep Android components
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# Keep View constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# 小米推送
-keep class com.xiaomi.mipush.sdk.** { *; }
-dontwarn com.xiaomi.**

# OPPO推送
-keep public class * extends android.app.Service
-keep class com.heytap.msp.** { *;}
-keep class com.heytap.mcssdk.** { *; }
-dontwarn com.heytap.msp.**
-dontwarn com.heytap.mcssdk.**