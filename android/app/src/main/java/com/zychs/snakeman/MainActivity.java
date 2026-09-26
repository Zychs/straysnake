package com.zychs.snakeman;

import android.app.Activity;
import android.hardware.input.InputManager;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A full-screen landscape WebView around snake-man.html (copied in as assets/index.html at build
 * time). The page switches to its touch layout when it sees ?app=1.
 *
 * Controllers (built-in ones like the AYN Thor's, or Bluetooth/USB pads) are read here, natively,
 * and forwarded to the page's padInput(): D-pad / left stick steer, A B X Y, L1 R1, START, SELECT.
 * The page is told whether a controller is present so it can swap its touch buttons (the
 * Archero-style floating joystick and COAT / PAUSE) for a controller legend.
 */
public class MainActivity extends Activity implements InputManager.InputDeviceListener {
    private WebView web;
    private InputManager inputManager;
    private String stickDir = null;   // last direction sent from the analog stick / hat

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
        s.setUserAgentString(s.getUserAgentString() + " SnakeManApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pushInputMode();
            }
        });
        setContentView(web);
        hideSystemBars();

        inputManager = (InputManager) getSystemService(INPUT_SERVICE);
        inputManager.registerInputDeviceListener(this, null);

        if (saved != null) web.restoreState(saved);
        else web.loadUrl("file:///android_asset/index.html?app=1");
    }

    // --- controllers ---

    private void js(String code) {
        web.evaluateJavascript(code, null);
    }

    private void send(String action) {
        js("window.padInput && padInput('" + action + "')");
    }

    private static boolean isPadSource(int source) {
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                || (source & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD;
    }

    private static boolean hasGamepad() {
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (d == null || d.isVirtual()) continue;
            int s = d.getSources();
            if ((s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                    || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK) return true;
        }
        return false;
    }

    private void pushInputMode() {
        js("window.setInputMode && setInputMode('" + (hasGamepad() ? "gamepad" : "touch") + "')");
    }

    private static String keyAction(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_DPAD_CENTER: return "a";
            case KeyEvent.KEYCODE_BUTTON_B: return "b";
            case KeyEvent.KEYCODE_BUTTON_X: return "x";
            case KeyEvent.KEYCODE_BUTTON_Y: return "y";
            case KeyEvent.KEYCODE_BUTTON_L1: return "l1";
            case KeyEvent.KEYCODE_BUTTON_R1: return "r1";
            case KeyEvent.KEYCODE_BUTTON_START: return "start";
            case KeyEvent.KEYCODE_BUTTON_SELECT: return "select";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String action = isPadSource(e.getSource()) ? keyAction(e.getKeyCode()) : null;
        if (action == null) return super.dispatchKeyEvent(e);   // keyboards etc. go to the page as usual
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) send(action);
        return true;   // consumed, so B never turns into a system Back
    }

    // Left stick and hat-style D-pads arrive as joystick motion: snap to four directions.
    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                && e.getAction() == MotionEvent.ACTION_MOVE) {
            float x = e.getAxisValue(MotionEvent.AXIS_HAT_X), y = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
            if (Math.abs(x) < 0.5f && Math.abs(y) < 0.5f) {
                x = e.getAxisValue(MotionEvent.AXIS_X);
                y = e.getAxisValue(MotionEvent.AXIS_Y);
            }
            String d = null;
            if (Math.max(Math.abs(x), Math.abs(y)) >= 0.5f) {
                d = Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : (y > 0 ? "down" : "up");
            }
            if (d != null && !d.equals(stickDir)) send(d);
            stickDir = d;
            return true;
        }
        return super.dispatchGenericMotionEvent(e);
    }

    @Override public void onInputDeviceAdded(int deviceId) { pushInputMode(); }
    @Override public void onInputDeviceRemoved(int deviceId) { pushInputMode(); }
    @Override public void onInputDeviceChanged(int deviceId) { pushInputMode(); }

    // --- window / lifecycle ---

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
        js("window.onAppHidden && onAppHidden()");
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        pushInputMode();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        inputManager.unregisterInputDeviceListener(this);
        web.destroy();
        super.onDestroy();
    }
}
