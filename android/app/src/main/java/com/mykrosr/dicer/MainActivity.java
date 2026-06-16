package com.mykrosr.dicer;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * On Android 15+ apps are forced edge-to-edge: the WebView draws under the
 * status and navigation bars, and Android does NOT populate CSS
 * env(safe-area-inset-*) like iOS does. We bridge the real system-bar insets
 * into CSS custom properties (--android-sa{t,b,l,r}) so the web layout can keep
 * its controls clear of the system bars.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    final WebView webView = getBridge().getWebView();
    final float density = getResources().getDisplayMetrics().density;

    ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
      Insets bars = windowInsets.getInsets(
          WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      String js =
          "document.documentElement.style.setProperty('--android-sat','" + px(bars.top, density) + "');" +
          "document.documentElement.style.setProperty('--android-sab','" + px(bars.bottom, density) + "');" +
          "document.documentElement.style.setProperty('--android-sal','" + px(bars.left, density) + "');" +
          "document.documentElement.style.setProperty('--android-sar','" + px(bars.right, density) + "');";
      view.post(() -> webView.evaluateJavascript(js, null));
      return windowInsets;
    });
    // Ensure the listener fires once the WebView is attached.
    ViewCompat.requestApplyInsets(webView);
  }

  private static String px(int rawPx, float density) {
    return Math.round(rawPx / density) + "px";
  }
}
