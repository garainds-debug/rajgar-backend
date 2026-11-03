package com.gara.rajgarludo;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * RAJGAR Ludo – native Android shell.
 * The game itself is the bundled web app in assets/www, served from a private https origin
 * (appassets.androidplatform.net) so storage, audio and crypto behave like a secure site.
 */
public class MainActivity extends ComponentActivity {
    private static final String HOST = "https://appassets.androidplatform.net";
    private static final String BASE = HOST + "/assets/www/";
    private static final String SKU_YEARLY = "rajgar_premium_yearly";     // subscription
    private static final String SKU_LIFETIME = "rajgar_premium_lifetime"; // one-time product

    private WebView web;
    private FrameLayout root;
    private volatile boolean ready = false;

    private BillingClient billing;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private String pendingBuyCb = null;
    private String pendingBuySku = null;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> !ready);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        int bg = Color.parseColor("#0D2818");
        root = new FrameLayout(this);
        root.setBackgroundColor(bg);
        web = new WebView(this);
        web.setBackgroundColor(bg);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        root.postDelayed(() -> ready = true, 4000);   // never hold the splash longer than 4 s
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);

        // Edge-to-edge (required from Android 15): keep game content clear of status/navigation bars and notches.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setTextZoom(100);                 // phone font-size setting must not break the board layout
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setUserAgentString(ws.getUserAgentString() + " RajgarApp/" + BuildConfig.VERSION_NAME);

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);   // no "copy / select" pop-ups on long press
        web.addJavascriptInterface(new Bridge(), "RGNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.getUrl().toString().startsWith(HOST)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) { ready = true; }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("(window.RGBack && window.RGBack()) ? 'y' : 'n'", res -> {
                    if (res != null && res.contains("y")) return;          // the page closed a sheet / opened its menu
                    String u = web.getUrl();
                    boolean home = u == null || u.endsWith("/www/") || u.contains("/www/index.html");
                    if (home) finish(); else web.loadUrl(BASE + "index.html");
                });
            }
        });

        // Debug builds accept a start page (used to take store screenshots on an emulator).
        String page = BuildConfig.DEBUG ? getIntent().getStringExtra("page") : null;
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BASE + (page != null && !page.contains("..") ? page : "index.html"));

        setupBilling();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { if (billing != null) billing.endConnection(); super.onDestroy(); }

    /* ======================= JavaScript bridge ======================= */
    private class Bridge {
        @JavascriptInterface
        public void vibrate(long ms) {
            Vibrator vb = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vb == null || !vb.hasVibrator()) return;
            long d = Math.max(1, Math.min(ms, 1000));
            if (Build.VERSION.SDK_INT >= 26) vb.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
            else vb.vibrate(d);
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void setBarColor(String css) {
            runOnUiThread(() -> {
                try { int c = Color.parseColor(css.trim()); root.setBackgroundColor(c); web.setBackgroundColor(c); }
                catch (Exception ignored) { }
            });
        }

        @JavascriptInterface public void billingProducts(String cb) { connect(() -> loadProducts(cb), () -> fail(cb, "Google Play billing is not available")); }
        @JavascriptInterface public void billingBuy(String sku, String cb) { connect(() -> buy(sku, cb), () -> fail(cb, "Google Play billing is not available")); }
        @JavascriptInterface public void billingRestore(String cb) { connect(() -> restore(cb), () -> fail(cb, "Could not reach Google Play")); }
    }

    private void reply(String cb, JSONObject data) {
        if (cb == null) return;
        final String js = "window.__rgCb && window.__rgCb(" + JSONObject.quote(cb) + "," + data.toString() + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private void fail(String cb, String msg) {
        try { reply(cb, new JSONObject().put("ok", false).put("msg", msg)); } catch (Exception ignored) { }
    }

    /* ======================= Google Play Billing ======================= */
    private void setupBilling() {
        billing = BillingClient.newBuilder(this)
                .setListener(this::onPurchasesUpdated)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    private void connect(Runnable ok, Runnable err) {
        if (billing.isReady()) { ok.run(); return; }
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) ok.run(); else err.run();
            }
            @Override public void onBillingServiceDisconnected() { /* reconnects on the next call */ }
        });
    }

    private void queryType(String type, String sku, Runnable done) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku).setProductType(type).build()))
                .build();
        billing.queryProductDetailsAsync(params, (result, details) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && details != null)
                for (ProductDetails pd : details.getProductDetailsList()) products.put(pd.getProductId(), pd);
            done.run();
        });
    }

    private void ensureProducts(Runnable done) {
        if (products.containsKey(SKU_YEARLY) && products.containsKey(SKU_LIFETIME)) { done.run(); return; }
        queryType(BillingClient.ProductType.SUBS, SKU_YEARLY, () -> queryType(BillingClient.ProductType.INAPP, SKU_LIFETIME, done));
    }

    private ProductDetails.SubscriptionOfferDetails baseOffer(ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        for (ProductDetails.SubscriptionOfferDetails o : offers) if (o.getOfferId() == null) return o;
        return offers.get(0);
    }

    private void loadProducts(String cb) {
        ensureProducts(() -> {
            try {
                JSONObject out = new JSONObject().put("ok", true);
                ProductDetails y = products.get(SKU_YEARLY);
                if (y != null) {
                    ProductDetails.SubscriptionOfferDetails o = baseOffer(y);
                    if (o != null) {
                        List<ProductDetails.PricingPhase> ph = o.getPricingPhases().getPricingPhaseList();
                        ProductDetails.PricingPhase p = ph.get(ph.size() - 1);
                        out.put("yearly", new JSONObject().put("price", p.getFormattedPrice())
                                .put("micros", p.getPriceAmountMicros()).put("currency", p.getPriceCurrencyCode()));
                    }
                }
                ProductDetails l = products.get(SKU_LIFETIME);
                if (l != null && l.getOneTimePurchaseOfferDetails() != null) {
                    ProductDetails.OneTimePurchaseOfferDetails p = l.getOneTimePurchaseOfferDetails();
                    out.put("lifetime", new JSONObject().put("price", p.getFormattedPrice())
                            .put("micros", p.getPriceAmountMicros()).put("currency", p.getPriceCurrencyCode()));
                }
                reply(cb, out);
            } catch (Exception e) { fail(cb, "Could not load prices"); }
        });
    }

    private void buy(String sku, String cb) {
        ensureProducts(() -> {
            ProductDetails pd = products.get(sku);
            if (pd == null) { fail(cb, "This plan is not available yet"); return; }
            BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
            if (SKU_YEARLY.equals(sku)) {
                ProductDetails.SubscriptionOfferDetails o = baseOffer(pd);
                if (o == null) { fail(cb, "This plan is not available yet"); return; }
                item.setOfferToken(o.getOfferToken());
            }
            final BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(item.build())).build();
            runOnUiThread(() -> {
                pendingBuyCb = cb; pendingBuySku = sku;
                BillingResult r = billing.launchBillingFlow(this, flow);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    pendingBuyCb = null;
                    fail(cb, "Could not open Google Play (" + r.getResponseCode() + ")");
                }
            });
        });
    }

    private void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        String cb = pendingBuyCb; pendingBuyCb = null;
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handlePurchase(p, cb);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            fail(cb, "Purchase cancelled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            try { reply(cb, new JSONObject().put("ok", true).put("sku", pendingBuySku)); } catch (Exception ignored) { }
        } else {
            fail(cb, "Purchase not completed (" + code + ")");
        }
    }

    private void handlePurchase(Purchase p, String cb) {
        try {
            String sku = p.getProducts().isEmpty() ? pendingBuySku : p.getProducts().get(0);
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                acknowledge(p);
                reply(cb, new JSONObject().put("ok", true).put("sku", sku));
            } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                fail(cb, "Payment pending — Premium unlocks as soon as it completes");
            }
        } catch (Exception ignored) { }
    }

    /** Google refunds purchases that are not acknowledged within 3 days – done here, on the phone. */
    private void acknowledge(Purchase p) {
        if (p.isAcknowledged()) return;
        AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build();
        billing.acknowledgePurchase(ack, result -> { });
    }

    private void restore(String cb) {
        final List<String> owned = Collections.synchronizedList(new ArrayList<>());
        final AtomicInteger left = new AtomicInteger(2);
        final Runnable finish = () -> {
            if (left.decrementAndGet() > 0) return;
            try { reply(cb, new JSONObject().put("ok", true).put("skus", new JSONArray(owned))); } catch (Exception ignored) { }
        };
        for (String type : new String[]{BillingClient.ProductType.INAPP, BillingClient.ProductType.SUBS}) {
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build(), (result, list) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null)
                    for (Purchase p : list) if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        acknowledge(p);
                        owned.addAll(p.getProducts());
                    }
                finish.run();
            });
        }
    }
}
