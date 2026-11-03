# Methods called from JavaScript must keep their names.
-keepclassmembers class com.gara.rajgarludo.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
