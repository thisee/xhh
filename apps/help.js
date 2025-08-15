import {yaml,render} from '#xhh'

export class help extends plugin {
  constructor (e) {
    super({
      name: '[小花火]帮助',
      dsc: '帮助',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#*小花火(命令|帮助|菜单|help|说明|功能|指令|使用说明)$',
          fnc: 'help'
        }
      ]
    })
  }

  async help (e) {
    let data = await yaml.get('./plugins/xhh/system/default/help.yaml')
    if (!data) return
   let au = false
   if (e.isMaster) au=true
   this.img(e,data,au)
  }

 img(e,data,au) {
 let _data_={
  data,
  au
    }
  render('help/help',_data_,{e,pct:3,ret:true})
  }
}
