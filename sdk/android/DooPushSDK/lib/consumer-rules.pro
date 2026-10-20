# Keep DooPush SDK public API for consumers
-keep public class com.doopush.sdk.DooPushManager { public *; }
-keep public class com.doopush.sdk.DooPushConfig { public *; }
-keep public interface com.doopush.sdk.DooPushCallback { *; }
-keep public class com.doopush.sdk.models.** { public *; }

# 网络层用 Gson 反射序列化请求/响应（Gson 2.10 不自带混淆规则）：
# 不保留时宿主 Release 混淆会剔除字段，设备注册请求变成空对象（HTTP 400）
-keep class com.doopush.sdk.DooPushNetworking$* { *; }
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod
-keep class * extends com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
