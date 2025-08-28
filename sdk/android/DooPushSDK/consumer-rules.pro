# DooPush SDK Consumer ProGuard Rules
# 这些规则会自动应用到使用此SDK的应用中

# 保持DooPush SDK的公共API
-keep public class com.doopush.sdk.DooPushManager { *; }
-keep public class com.doopush.sdk.DooPushConfig { *; }
-keep public interface com.doopush.sdk.DooPushListener { *; }
-keep public class com.doopush.sdk.DooPushError { *; }
-keep public class com.doopush.sdk.model.** { *; }

# 保持推送厂商相关类
-keep class com.doopush.sdk.vendor.** { *; }
-keep class com.doopush.sdk.receiver.** { *; }

# 小米推送必需的保护规则
-keep class com.xiaomi.mipush.sdk.** { *; }
-keep class com.xiaomi.push.** { *; }
-dontwarn com.xiaomi.**

# 保持网络相关类
-keep class com.doopush.sdk.network.** { *; }
-keep class com.doopush.sdk.tcp.** { *; }

# 保持数据模型类
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# 保持枚举类
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}