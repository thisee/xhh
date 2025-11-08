import { yaml, render, config } from '#xhh';

const path = '../../../../..';

export class sr_logs extends plugin {
  constructor(e) {
    super({
      name: '[小花火]星铁历史卡池',
      dsc: '',
      event: 'message',
      priority: -88,
      rule: [
        {
          reg: '^#*(\\*|星铁)?(.*)(卡池|跃迁)$',
          fnc: 'sr',
        },
      ],
    });
  }

  async sr(e) {
    if (!config().sr_logs) return false;
    let name = e.msg.replace(/#|\*|星铁|卡池|跃迁|,|，|!|！|」|「/g, '');
    let srlogs = await yaml.get('./plugins/xhh/system/default/sr_logs.yaml');
    let data = [],
      m = 0;
    if (!name.includes('.') && name != '联动') {
      //角色，光锥
      let js_names = await yaml.get(
        './plugins/xhh/system/default/sr_js_names.yaml'
      ); //角色别名
      for (let i in js_names) {
        if (js_names[i].includes(name)) {
          name = i;
          m = 1;
          break;
        }
      }
      if (!m) {
        let gz_names = await yaml.get(
          './plugins/xhh/system/default/gz_names.yaml'
        ); //光锥别名
        for (let i in gz_names) {
          if (gz_names[i].includes(name)) {
            name = i;
            m = 1;
            break;
          }
        }
      }
      name = name.replace(/,|，|!|！|」|「/g, '');
      srlogs.map(v => {
        if (
          v.js_five.includes(name) ||
          v.js_four.includes(name) ||
          this.cl(v.gz_five).includes(name) ||
          this.cl(v.gz_four).includes(name)
        ) {
          data.push(this.v_(v));
        }
      });
    } else if (name == '联动') {
      //联动
      for (let v of srlogs) {
        if (v.ver.includes('联动')) {
          data.push(this.v_(v));
          break;
        }
      }
    } else if (e.msg.includes('*') || e.msg.includes('星铁')) {
      if (name.includes('上半') || name.includes('下半')) {
        //根据版本
        for (let v of srlogs) {
          if (v.ver == name) {
            data.push(this.v_(v));
            break;
          }
        }
      } else {
        for (let v of srlogs) {
          if (v.ver == `${name}上半` || v.ver == `${name}下半`) {
            //根据版本
            data.push(this.v_(v));
          }
          if (data.length == 2) break;
        }
      }
      name = name.replace(/上半|下半/g, '');
      name = Number(name);
      if (name >= 3.4) {
        for (let v of srlogs) {
          if (v.ver.includes('联动')) {
            data.push(this.v_(v));
            break;
          }
        }
      }
    }

    if (!data.length) return false;

    let _data_ = {
      data,
      js_path: `${path}/plugins/miao-plugin/resources/meta-sr/character/`,
      gz_path: `${path}/plugins/miao-plugin/resources/meta-sr/weapon/`,
    };
    render('srlogs/logs', _data_, { e, ret: true });
  }
  //处理
  cl(arr) {
    let arr_ = [];
    arr.map(v => {
      v = v.replace(
        /\/|智识|记忆|虚无|同谐|丰饶|毁灭|巡猎|存护|，|,|!|！|」|「/g,
        ''
      );
      arr_.push(v);
    });
    return arr_;
  }

  v_(v) {
    return {
      s: Math.ceil(Math.random() * 4),
      ver: v.ver,
      time: v.time,
      js_five: v.js_five,
      js_four: v.js_four,
      gz_five: v.gz_five,
      gz_four: v.gz_four,
    };
  }
}
