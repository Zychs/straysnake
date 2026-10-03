package com.zychs.snakeman;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A full-screen WebView around snake-man.html (copied in as assets/index.html at build time,
 * with its script modules in assets/snake-man/).
 * The page switches to its touch layout (joystick + DIG / COAT / PAUSE buttons) when it sees ?app=1.
 * Landscape, so it sits in a clip-on controller; gamepads reach the page through the Gamepad API.
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF111111);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // high score and map seed live in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);   // sound starts for gamepad players, who never touch the screen
        s.setUserAgentString(s.getUserAgentString() + " SnakeManApp");
        web.setWebViewClient(new WebViewClient());   // keep any navigation inside the app
        setContentView(web);
        web.requestFocus();                    // controller input goes to the focused view
        hideSystemBars();

        if (saved != null) web.restoreState(saved);
        else web.loadUrl("file:///android_asset/index.html?app=1");
    }

    private void hideSystemBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // Back pauses a running game; from anywhere else it sends the app to the background.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onAppBack ? onAppBack() : false", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.onAppHidden && onAppHidden()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
