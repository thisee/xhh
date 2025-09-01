import {config} from '#xhh'
async function render(path,data_,cfg){
  let tplFile=data_.tplFile || process.cwd()+'/plugins/xhh/resources/'+path+'.html'
  let {e}=cfg
   if (!e.runtime) {
      logger.error('未找到e.runtime')
    }
  if(path.includes('bilibili')){
    data_.emoji=config().emoji
  }
  return e.runtime.render('小花火',path, data_,{
      retType:cfg.ret ? 'default' : 'base64',
      beforeRender ({ data }) { 
      return{
        sys: {scale:`style=transform:scale(${cfg.pct || config().img_quality/100 * 2.4 || 2.4*0.8 })`},
        ...data_,
       ppath: data_.ppath || '../../../../../plugins/xhh/resources/',
       tplFile:tplFile,
       saveId:path.split('/')[path.split('/').length-1]
          }
      }
  })
}
export default render