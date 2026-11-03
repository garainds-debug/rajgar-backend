"""Connects to the debug WebView over DevTools, dumps page state and a renderer-side screenshot."""
import json, sys, base64, urllib.request
import websocket
name = sys.argv[1]
pages = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json', timeout=10))
pg = [p for p in pages if p.get('type') == 'page'][0]
ws = websocket.create_connection(pg['webSocketDebuggerUrl'], suppress_origin=True, timeout=20)
mid = 0
def call(method, **params):
    global mid; mid += 1
    ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
    while True:
        m = json.loads(ws.recv())
        if m.get('id') == mid: return m.get('result', m)
JS = r"""JSON.stringify({url:location.href,w:innerWidth,h:innerHeight,dpr:devicePixelRatio,
 sh:document.documentElement.scrollHeight,fonts:document.fonts.status,rm:matchMedia('(prefers-reduced-motion: reduce)').matches,
 ua:navigator.userAgent,errs:window.__rgErrs||[],text:document.body.innerText.slice(0,160),
 kids:[...document.body.children].map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
  return e.tagName+'#'+e.id+'.'+(e.className||'')+' top='+Math.round(r.top)+' h='+Math.round(r.height)+' op='+cs.opacity+' vis='+cs.visibility+' disp='+cs.display+' tr='+cs.transform+' anim='+cs.animationName+' ['+(e.getAnimations?e.getAnimations().map(a=>a.playState+'@'+Math.round(a.currentTime||0)).join(','):'')+']'})})"""
r = call('Runtime.evaluate', expression=JS, returnByValue=True)
open(name + '.json', 'w').write(json.dumps(json.loads(r['result']['value']), indent=1))
s = call('Page.captureScreenshot', format='png')
if 'data' in s: open(name + '-cdp.png', 'wb').write(base64.b64decode(s['data']))
print('diag', name, 'ok')
