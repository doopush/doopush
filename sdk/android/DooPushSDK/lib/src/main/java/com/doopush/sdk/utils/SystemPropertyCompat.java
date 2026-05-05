package com.doopush.sdk.utils;

import android.annotation.SuppressLint;
import android.os.Environment;

import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Properties;

/**
 *    author : Android 轮子哥
 *    github : https://github.com/getActivity/XXPermissions
 *    time   : 2025/08/13
 *    desc   : 系统属性兼容类
 */
public final class SystemPropertyCompat {

    private SystemPropertyCompat() {
        // 私有化构造方法，禁止外部实例化
    }

    /**
     * 获取单个系统属性值
     */
    @NonNull
    public static String getSystemPropertyValue(@Nullable String key) {
        if (key == null || key.isEmpty()) {
            return "";
        }

        String propertyValue = null;
        try {
            propertyValue = getSystemPropertyByReflect(key);
        } catch (Exception ignored) {
            // default implementation ignored
        }

        if (propertyValue != null && !propertyValue.isEmpty()) {
            return propertyValue;
        }

        try {
            propertyValue = getSystemPropertyByShell(key);
        } catch (IOException ignored) {
            // default implementation ignored
        }

        if (propertyValue != null && !propertyValue.isEmpty()) {
            return propertyValue;
        }

        try {
            propertyValue = getSystemPropertyByStream(key);
        } catch (IOException ignored) {
            // default implementation ignored
        }

        if (propertyValue != null && !propertyValue.isEmpty()) {
            return propertyValue;
        }

        return "";
    }

    /**
     * 获取多个系统属性值
     */
    @NonNull
    public static String[] getSystemPropertyValues(@Nullable String[] keys) {
        if (keys == null) {
            return new String[0];
        }

        String[] propertyValues = new String[keys.length];

        for (int i = 0; i < keys.length; i++) {
            propertyValues[i] = getSystemPropertyValue(keys[i]);
        }
        return propertyValues;
    }

    /**
     * 获取多个系统属性中的任一一个值
     */
    @NonNull
    public static String getSystemPropertyAnyOneValue(@Nullable String[] keys) {
        if (keys == null) {
            return "";
        }

        for (String key : keys) {
            String propertyValue = getSystemPropertyValue(key);
            if (!propertyValue.isEmpty()) {
                return propertyValue;
            }
        }
        return "";
    }

    /**
     * 判断某个系统属性是否存在
     */
    public static boolean isSystemPropertyExist(@Nullable String key) {
        return !TextUtils.isEmpty(getSystemPropertyValue(key));
    }

    /**
     * 判断多个系统属性是否有任一一个存在
     */
    public static boolean isSystemPropertyAnyOneExist(@Nullable String[] keys) {
        if (keys == null) {
            return false;
        }
        for (String key : keys) {
            if (isSystemPropertyExist(key)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取系统属性值（通过反射系统类）
     */
    @SuppressLint("PrivateApi")
    private static String getSystemPropertyByReflect(@NonNull String key) throws ClassNotFoundException, InvocationTargetException,
                                                                        NoSuchMethodException, IllegalAccessException  {
        Class<?> clz = Class.forName("android.os.SystemProperties");
        Method getMethod = clz.getMethod("get", String.class, String.class);
        return (String) getMethod.invoke(clz, key, "");
    }

    /**
     * 获取系统属性值（通过 shell 命令）
     */
    private static String getSystemPropertyByShell(@NonNull String key) throws IOException {
        BufferedReader input = null;
        try {
            Process p = Runtime.getRuntime().exec("getprop " + key);
            input = new BufferedReader(new InputStreamReader(p.getInputStream()), 1024);
            String firstLine = input.readLine();
            if (firstLine != null) {
                return firstLine;
            }
        } finally {
            if (input != null) {
                try {
                    input.close();
                } catch (IOException ignored) {
                    // default implementation ignored
                }
            }
        }
        return null;
    }

    /**
     * 获取系统属性值（通过读取系统文件）
     */
    private static String getSystemPropertyByStream(@NonNull String key) throws IOException {
        FileInputStream inputStream = null;
        try {
            Properties prop = new Properties();
            File file = new File(Environment.getRootDirectory(), "build.prop");
            inputStream = new FileInputStream(file);
            prop.load(inputStream);
            return prop.getProperty(key, "");
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException ignored) {
                    // default implementation ignored
                }
            }
        }
    }
}