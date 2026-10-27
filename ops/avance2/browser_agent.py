import asyncio, json, os, pathlib, subprocess, re
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

async def main():
    home=pathlib.Path(os.environ['HOME']); home.mkdir(parents=True, exist_ok=True)
    nss=home/'.pki'/'nssdb'; nss.mkdir(parents=True, exist_ok=True)
    if not (nss/'cert9.db').exists(): subprocess.run(['certutil','-N','--empty-password','-d','sql:'+str(nss)],check=True)
    subprocess.run(['certutil','-A','-d','sql:'+str(nss),'-n','Prospector Local CA','-t','C,,','-i','/certs/ca.crt'],check=True)
    subprocess.Popen(['Xvfb',':99','-screen','0','1440x1000x24','-ac'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    subprocess.Popen(['x11vnc','-display',':99','-forever','-shared','-nopw','-localhost','-rfbport','5900'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.Popen(['websockify','--web=/usr/share/novnc','6080','127.0.0.1:5900'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    pw=await async_playwright().start()
    context=await pw.chromium.launch_persistent_context(str(home/'profile'),headless=False,viewport={'width':1365,'height':900},ignore_https_errors=False,args=['--no-sandbox'])
    page=context.pages[0] if context.pages else await context.new_page()
    traffic=[]
    page.on('request',lambda r: traffic.append({'method':r.method,'url':r.url.split('?')[0]}))
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    async def semantics():
        try:
            item=page.locator('flt-semantics-placeholder')
            if await item.count(): await item.evaluate('(e)=>e.click()')
        except Exception: pass
        await asyncio.sleep(.3)
    async def action(data):
        kind=data.get('action','snapshot')
        if kind=='goto':
            url=data.get('url',os.environ.get('START_URL','https://localhost:18443/'))
            u=urlsplit(url)
            if u.scheme!='https' or u.hostname not in ('localhost','127.0.0.1'): raise ValueError('Only isolated local HTTPS permitted')
            await page.goto(url,wait_until='domcontentloaded',timeout=90000); await asyncio.sleep(2); await semantics()
        elif kind=='fill':
            locator=page.get_by_role('textbox',name=data['name']) if data.get('by')=='role' else page.get_by_label(data['name'])
            await locator.click(timeout=15000)
            await locator.press('ControlOrMeta+A')
            await locator.press_sequentially(data['value'],delay=30)
            await locator.press('Tab')
            await asyncio.sleep(.4)
        elif kind=='click':
            if data.get('selector'): locator=page.locator(data['selector'])
            else: locator=page.get_by_role(data.get('role','button'),name=data['name'],exact=data.get('exact',False))
            await locator.click(timeout=15000); await asyncio.sleep(data.get('wait',.6)); await semantics()
        elif kind=='file':
            async with page.expect_file_chooser(timeout=15000) as chosen:
                await page.get_by_role('button',name='Seleccionar CSV',exact=True).click()
            chooser=await chosen.value
            await chooser.set_files({'name':'synthetic.csv','mimeType':'text/csv','buffer':data['csv'].encode()})
            await asyncio.sleep(1)
        elif kind=='fetch':
            return await page.evaluate('''async (d)=> {const r=await fetch(d.path,{method:d.method||'GET',headers:d.headers||{},body:d.body?JSON.stringify(d.body):undefined});return {status:r.status,body:await r.json()};}''',data)
        elif kind=='screenshot':
            name=data.get('name','ui.png')
            if not re.fullmatch(r'[a-zA-Z0-9_-]+[.]png',name): raise ValueError('Bad filename')
            await page.screenshot(path='/evidence/'+name,full_page=True)
            return {'file':name}
        elif kind=='traffic': return {'requests':traffic[-300:],'errors':errors}
        elif kind=='wait': await asyncio.sleep(min(data.get('seconds',1),20))
        await semantics()
        return {'url':page.url,'aria':await page.locator('body').aria_snapshot(),'errors':errors}
    async def handler(reader,writer):
        try:
            header=await reader.readuntil(b'\r\n\r\n')
            headers=header.decode().split('\r\n'); length=next((int(h.split(':',1)[1]) for h in headers if h.lower().startswith('content-length:')),0)
            payload=await reader.readexactly(length) if length else b'{}'
            result=await action(json.loads(payload)); body=json.dumps({'ok':True,'data':result}).encode()
        except Exception as e:
            body=json.dumps({'ok':False,'error':type(e).__name__+': '+str(e)[:300]}).encode()
        writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+str(len(body)).encode()+b'\r\nConnection: close\r\n\r\n'+body); await writer.drain();writer.close()
    server=await asyncio.start_server(handler,'127.0.0.1',6090)
    print('TRUSTED_BROWSER_READY',flush=True)
    try: await action({'action':'goto'})
    except Exception as e: print('INITIAL_PAGE_ERROR '+str(e)[:200],flush=True)
    async with server: await server.serve_forever()

asyncio.run(main())
