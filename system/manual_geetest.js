import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import { config, sleep } from '#xhh';

const tasks = new Map();
let server = null;
let startedPort = 0;

function getManualCfg() {
  const cfg = config() || {};
  return {
    enable: cfg.manual_gt_enable !== false,
    host: cfg.manual_gt_host || '0.0.0.0',
    port: Number(cfg.manual_gt_port || 3000),
    publicUrl: String(cfg.manual_gt_public_url || '').replace(/\/+$/, ''),
    path: String(cfg.manual_gt_path || '/xhh-gt').replace(/\/+$/, ''),
    timeout: Number(cfg.manual_gt_timeout || 120),
  };
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { return resolve(JSON.parse(raw || '{}')); } catch (_) { return resolve({}); }
      }
      const params = new URLSearchParams(raw);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      resolve(obj);
    });
  });
}

function page(key) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>小花火手动验证</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1c2438,#41245a);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#fff}.card{width:min(92vw,420px);padding:28px;border-radius:22px;background:rgba(255,255,255,.12);box-shadow:0 18px 60px rgba(0,0,0,.35);backdrop-filter:blur(12px);text-align:center}.title{font-size:24px;font-weight:800;margin-bottom:10px}.sub{opacity:.82;margin-bottom:22px;line-height:1.7}.btn{border:0;border-radius:999px;padding:13px 24px;background:#7cf3d0;color:#102236;font-weight:800;font-size:16px}.wait{display:none;margin:18px 0}.tip{margin-top:18px;font-size:14px;opacity:.78}.ok{font-size:22px;font-weight:800;color:#7cf3d0}</style></head><body><div class="card"><div class="title">小花火手动验证</div><div class="sub" id="sub">米游社签到遇到验证码，请点击下方按钮完成验证。</div><div id="captcha" data-key="${key}"><button class="btn" id="btn">点击验证</button><div class="wait" id="wait">验证码加载中...</div></div><div class="tip">完成后可以回到 QQ 等待签到结果。</div></div><script src="https://static.geetest.com/static/tools/gt.js"></script><script>
const btn=document.getElementById('btn'),wait=document.getElementById('wait'),sub=document.getElementById('sub'),key=document.getElementById('captcha').dataset.key;let captcha=null;
function done(){btn.style.display='none';wait.style.display='none';sub.innerHTML='<div class="ok">验证成功</div>可以关闭本页面了';}
function load(){btn.style.display='none';wait.style.display='block';fetch('./register/'+key).then(r=>r.json()).then(d=>{if(d.status||!d.data){sub.textContent=d.message||'验证信息不存在或已失效';wait.style.display='none';return}const c=d.data;initGeetest({gt:c.gt,challenge:c.challenge,new_captcha:c.new_captcha||1,offline:!c.success,product:'bind',width:'100%'},obj=>{captcha=obj;wait.style.display='none';obj.onReady(()=>obj.verify());obj.onSuccess(()=>{const v=obj.getValidate();fetch('./validate/'+key,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(v)}).then(done).catch(done)});obj.onClose(()=>{btn.style.display='inline-block'});obj.onError(()=>{btn.style.display='inline-block';sub.textContent='验证码加载失败，请重试'})})}).catch(()=>{sub.textContent='网络错误，请重试';wait.style.display='none';btn.style.display='inline-block'})}
btn.onclick=()=>captcha?captcha.verify():load();
</script></body></html>`;
}

function cleanup(key) {
  const item = tasks.get(key);
  if (item?.timer) clearTimeout(item.timer);
  tasks.delete(key);
}

function ensureServer() {
  const cfg = getManualCfg();
  if (!cfg.enable) return false;
  if (server && startedPort === cfg.port) return true;
  if (server) try { server.close(); } catch (_) {}
  server = http.createServer(async (req, res) => {
    const cfg = getManualCfg();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const base = cfg.path;
    if (!url.pathname.startsWith(base + '/')) return sendJson(res, { status: 1, message: 'Not Found' }, 404);
    const rest = url.pathname.slice(base.length + 1).split('/').filter(Boolean);
    const [action, key] = rest.length === 1 ? ['index', rest[0]] : rest;
    if (!key || !tasks.has(key)) return sendJson(res, { status: 1, message: '验证信息不存在或已失效' }, 404);
    const task = tasks.get(key);
    if (req.method === 'GET' && action === 'index') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page(key));
    }
    if (req.method === 'GET' && action === 'register') return sendJson(res, { status: 0, message: 'OK', data: task.data });
    if (req.method === 'POST' && action === 'validate') {
      const body = await readBody(req);
      task.result = body;
      task.doneAt = Date.now();
      return sendJson(res, { status: 0, message: 'OK', data: {} });
    }
    if (req.method === 'GET' && action === 'validate') return sendJson(res, { status: task.result ? 0 : 1, message: task.result ? 'OK' : 'WAIT', data: task.result || null });
    return sendJson(res, { status: 1, message: 'Not Found' }, 404);
  });
  server.on('error', err => logger.error(`[xhh][manual_gt] 服务启动失败: ${err.message}`));
  server.listen(cfg.port, cfg.host, () => logger.mark(`[xhh][manual_gt] 手动验证码服务启动: ${cfg.host}:${cfg.port}${cfg.path}`));
  startedPort = cfg.port;
  return true;
}

export async function manualGeetest(e, data = {}, title = '米游社签到') {
  const cfg = getManualCfg();
  if (!cfg.enable || !data.gt || !data.challenge) return false;
  if (!ensureServer()) return false;
  const key = crypto.randomBytes(4).toString('hex');
  const base = cfg.publicUrl || `http://127.0.0.1:${cfg.port}`;
  const link = `${base}${cfg.path}/${key}`;
  tasks.set(key, {
    data: { gt: data.gt, challenge: data.challenge, new_captcha: data.new_captcha || 1, success: data.success ?? 1, uid: data.uid || '' },
    result: null,
    timer: setTimeout(() => cleanup(key), cfg.timeout * 1000),
  });
  await e.reply(`${title}遇到验证码，请打开地址并完成验证：\n${link}\n验证有效期 ${cfg.timeout} 秒，完成后小花火会自动重试。`, true, { recallMsg: cfg.timeout });
  for (let i = 0; i < cfg.timeout; i += 2) {
    const task = tasks.get(key);
    if (task?.result?.geetest_validate) {
      const v = task.result;
      cleanup(key);
      return {
        gt: data.gt,
        challenge: v.geetest_challenge,
        validate: v.geetest_validate,
        seccode: v.geetest_seccode || `${v.geetest_validate}|jordan`,
      };
    }
    await sleep(2000);
  }
  cleanup(key);
  return false;
}

export default { manualGeetest, ensureServer };
