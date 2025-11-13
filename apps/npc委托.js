import fs from 'fs';
import { yaml, makeForwardMsg } from '#xhh';

export class Npcwt extends plugin {
  constructor(e) {
    super({
      name: '[小花火]原神npc委托成就',
      dsc: '',
      event: 'message',
      priority: 1234,
      rule: [
        {
          reg: '',
          fnc: 'wt',
          log: false,
        },
      ],
    });
  }
  async wt(e) {
    if (!e.msg) return false;
    let kg = await yaml.get('./plugins/xhh/config/config.yaml');
    if (kg.wt) {
      //必须带#
      if (!e.msg.includes('#')) return false;
    }
    let name = e.msg
      .replace(/#|＃|？|。|,|，|·|!|！|—|《|》|…|「|」|『|』|、|\.|\?/g, '')
      .trim();
    let data = JSON.parse(
      fs.readFileSync('./plugins/xhh/system/default/NPCwt.json', 'utf-8')
    );
    for (let i = 0; i < data.length; i++) {
      let v = data[i];
      let name_ = v.name
        .replace(/#|＃|？|。|,|，|·|!|！|—|《|》|…|「|」|『|』|、|\.|\?/g, '')
        .trim();
      if (name == name_) {
        let msg;
        if (v.miaosu) {
          msg = `委托名：${v.name}\n地区：${v.diqu}\n\n成就名：${v.cj}\n\n重点描述：\n${v.miaosu}\n\n影月月：${v.yueyue}`;
          msg = await makeForwardMsg(e, msg, `成就：${v.cj}`);
        } else {
          msg = `${v.diqu}委托，${v.cj}`;
        }
        e.reply(msg);
        break; 
      }
    }
    return false;
  }
}
