import fs from 'node:fs'
import yaml from './system/yaml.js'
logger.info('\x1B[31m---------៷>ᴗ<៷---------\x1B[0m')
logger.info('\x1B[31m小花火插件正在载入...\x1B[0m')
logger.info('\x1B[31m-------------------------\x1B[0m')
var paths=['./plugins/xhh/config/','./plugins/xhh/temp/','./plugins/xhh/data','./plugins/xhh/data/fp/','./plugins/xhh/data/Stoken/']
paths.map((path)=>{          
if (!fs.existsSync(path)) {
  fs.mkdirSync(path)
}})
let paths_=['config.yaml','sign.yaml']
for(const _path of paths_){
if (!fs.existsSync('./plugins/xhh/config/'+_path)) {
fs.cpSync('./plugins/xhh/system/default/'+_path,'./plugins/xhh/config/'+_path)
}
let cfg=yaml.get('./plugins/xhh/config/'+_path)
let def_cfg=yaml.get('./plugins/xhh/system/default/'+_path)

if(Object.keys(cfg).length!= Object.keys(def_cfg).length){
fs.cpSync('./plugins/xhh/system/default/'+_path,'./plugins/xhh/config/'+_path)
for(let v in cfg){
if(Object.keys(def_cfg).includes(v)) yaml.set('./plugins/xhh/config/'+_path,v,cfg[v])
}
}
}

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

const files = fs.readdirSync('./plugins/xhh/apps').filter(file => file.endsWith('.js'))

let ret = []

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }
