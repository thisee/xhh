import fs from 'node:fs';
import yaml from './system/yaml.js';

logger.info('\x1B[31m---------៷>ᴗ<៷---------\x1B[0m');
logger.info('\x1B[31m小花火插件正在载入...\x1B[0m');
logger.info('\x1B[31m-------------------------\x1B[0m');

var paths = ['config/', 'temp/', 'data/', 'data/fp/', 'data/Stoken/'];

paths.map(path => {
  if (!fs.existsSync('./plugins/xhh/' + path)) {
    fs.mkdirSync('./plugins/xhh/' + path);
  }
});

let paths_ = ['config.yaml', 'sign.yaml', 'other.yaml', 'bh3_remind.yaml'];

for (const _path of paths_) {
  const cfg_path = './plugins/xhh/config/' + _path;
  const def_cfg_path = './plugins/xhh/system/default/default_config/' + _path;
  if (!fs.existsSync(cfg_path)) {
    fs.cpSync(def_cfg_path, cfg_path);
    continue;
  }

  let cfg = yaml.get('./plugins/xhh/config/' + _path);
  let def_cfg = yaml.get(def_cfg_path);

  if (Object.keys(cfg).length != Object.keys(def_cfg).length) {
    fs.cpSync(def_cfg_path, cfg_path);
    for (let v in cfg) {
      if (Object.keys(def_cfg).includes(v)) yaml.set(cfg_path, v, cfg[v]);
    }
  }
}

const files = fs
  .readdirSync('./plugins/xhh/apps')
  .filter(file => file.endsWith('.js'));

let ret = [];

const cacheKey = Date.now();
files.forEach(file => {
  // TRSS 的插件热重载只给 index.js 加 cache bust；apps 子模块也要带版本号，
  // 否则 #重启/#热重载 后仍可能使用旧的 ESM 缓存。
  ret.push(import(`./apps/${file}?v=${cacheKey}`));
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in files) {
  let name = files[i].replace('.js', '');

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`);
    logger.error(ret[i].reason);
    continue;
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

export { apps };
