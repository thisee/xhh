import { yaml, render, mys, config, reply_recallMsg } from '#xhh';
import fs from 'fs';
import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
const DOMParser = window.DOMParser;

const pr = yaml.get('./plugins/xhh/config/other.yaml').wiki;
export class Wiki extends plugin {
  constructor(e) {
    super({
      name: '[小花火]图鉴',
      dsc: '图鉴',
      event: 'message',
      priority: pr || -99,
      rule: [
        {
          reg: '^#*(星铁|绝区零|ZZZ|崩坏3|崩坏三|崩三|BH3)*(.*)图鉴$',
          fnc: 'illustrated_book',
        },
      ],
    });
  }

  async illustrated_book(e) {
    if (!config().wiki) return false;
    const isSr = e.msg.includes('星铁');
    const isZZZ = e.msg.includes('绝区零') || e.msg.includes('ZZZ');
    const isBH3 = e.msg.includes('崩坏3') || e.msg.includes('崩坏三') || e.msg.includes('崩三') || e.msg.includes('BH3');
    const name = e.msg.replace(/#|星铁|绝区零|ZZZ|崩坏3|崩坏三|崩三|BH3|图鉴/g, '').trim();
    // 统一处理角色/武器/遗器查询
    const checkTypes = [
      { method: 'role', args: [e, name] },
      { method: 'weapon', args: [e, name] },
      { method: 'syw_yiqi', args: [e, name] },
    ];
    if (isZZZ) {
      for (const { method, args } of checkTypes) {
        if (await this[method](...args, false, true)) return true;
      }
      // 绝区零特有: 邦布
      if (await this.bangboo(e, name)) return true;
    } else if (isBH3) {
      for (const { method, args } of checkTypes) {
        if (await this[method](...args, false, false, true)) return true;
      }
    } else if (isSr) {
      for (const { method, args } of checkTypes) {
        if (await this[method](...args, true)) return true;
      }
    } else {
      for (const { method, args } of checkTypes) {
        if (await this[method](...args)) return true;
        if (await this[method](...args, true)) return true;
      }
    }
    //最后查总列表
    if (/角色|武器|大剑|双手剑|单手剑|法器|长枪|弓箭|弓|光锥|圣遗物|遗器|音擎|驱动盘|邦布|圣痕|人偶|协同者/.test(name)) return this.list(e, name, isSr, isZZZ, isBH3);
    return false;
  }

  async list(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    if (/光锥|遗器|虚无|巡猎|物理|量子|虚数|毁灭|智识|同谐|存护|丰饶|记忆/.test(name)) isSr = true;
    if (/音擎|驱动盘|邦布|以太|强攻|击破|防护|支援|异常/.test(name)) isZZZ = true;
    if (/圣痕|人偶|协同者|生物|机械|量子|虚数|星尘|异能|火焰|冰冻|雷电/.test(name)) isBH3 = true;

    let type, _name
    
    if (name=='遗器') type = 'yq', _name = '遗器';
    if (name=='圣遗物') type = 'syw', _name = '圣遗物';
    if (/武器|大剑|双手剑|单手剑|法器|长枪|弓箭|弓/.test(name)) type = 'wq', _name = '武器';
    if (name.includes('光锥')) type = 'gz', _name = '光锥';
    if (name.includes('音擎')) type = 'wq', _name = '音擎';
    if (name.includes('驱动盘')) type = 'syw', _name = '驱动盘';
    if (name.includes('邦布')) type = 'yq', _name = '邦布';
    if (name.includes('圣痕')) type = 'syw', _name = '圣痕';
    if (name.includes('人偶')) type = 'yq', _name = '人偶';
    if (name.includes('协同者')) type = 'yq', _name = '协同者';
    if (name.includes('角色')) type = 'js', _name = '角色';

    if(!_name) return false;
    
    let data = await mys.data('', type, isSr, isZZZ, isBH3);

    let condition = name.replace(/崩坏3|崩坏三|崩三|角色|武器|光锥|音擎|驱动盘|邦布|圣痕|人偶|协同者/g, '');

    if (!isSr && !isZZZ && !isBH3) {
      switch (condition) {
        case '五星':
        case '5星':
          data = data.filter(item => item.ji === '五星');
          _name = '五星角色';
          if (type = 'wq') _name = '五星武器';
          break;
        case '四星':
        case '4星':
          data = data.filter(item => item.ji === '四星');
          _name = '四星角色';
          if (type = 'wq') _name = '四星武器';
          break;
        case '水系':
        case '水':
          data = data.filter(item => item.yuanshu === '水');
          _name = '水系角色';
          break;
        case '火系':
        case '火':
          data = data.filter(item => item.yuanshu === '火');
          _name = '火系角色';
          break;
        case '冰系':
        case '冰':
          data = data.filter(item => item.yuanshu === '冰');
          _name = '冰系角色';
          break;
        case '雷系':
        case '雷':
          data = data.filter(item => item.yuanshu === '雷');
          _name = '雷系角色';
          break;
        case '风系':
        case '风':
          data = data.filter(item => item.yuanshu === '风');
          _name = '风系角色';
          break;
        case '岩系':
        case '岩':
          data = data.filter(item => item.yuanshu === '岩');
          _name = '岩系角色';
          break;
        case '草系':
        case '草':
          data = data.filter(item => item.yuanshu === '草');
          _name = '草系角色';
          break;
        case '单手剑':
          data = data.filter(item => item.wuqi === '单手剑');
          _name = '单手剑武器';
          break;
        case '双手剑':
        case '大剑':
          data = data.filter(item => item.wuqi === '双手剑');
          _name = '双手剑武器';
          break;
        case '长柄':
        case '长枪':
          data = data.filter(item => item.wuqi === '长柄武器');
          _name = '长柄武器';
          break;
        case '弓系':
        case '弓箭':
        case '弓':
          data = data.filter(item => item.wuqi === '弓');
          _name = '弓武器';
          break;
        case '法器':
          data = data.filter(item => item.wuqi === '法器');
          _name = '法器武器';
          break;
      }
} else if (isBH3) {
      switch (condition) {
        case '五星':
        case '5星':
          data = data.filter(item => item.ji === '五星');
          _name = '五星角色';
          if (type = 'wq') _name = '五星武器';
          if (type = 'syw') _name = '五星圣痕';
          break;
        case '四星':
        case '4星':
          data = data.filter(item => item.ji === '四星');
          _name = '四星角色';
          if (type = 'wq') _name = '四星武器';
          if (type = 'syw') _name = '四星圣痕';
          break;
        case '物理':
        case '物理系':
          data = data.filter(item => item.yuanshu === '物理');
          _name = '物理角色';
          break;
        case '火':
        case '火系':
        case '火焰':
          data = data.filter(item => item.yuanshu === '火' || item.yuanshu === '火焰');
          _name = '火系角色';
          break;
        case '冰':
        case '冰系':
        case '冰冻':
          data = data.filter(item => item.yuanshu === '冰' || item.yuanshu === '冰冻');
          _name = '冰系角色';
          break;
        case '雷':
        case '雷系':
        case '雷电':
          data = data.filter(item => item.yuanshu === '雷' || item.yuanshu === '雷电');
          _name = '雷系角色';
          break;
        case '生物':
        case '生物系':
          data = data.filter(item => item.yuanshu === '生物');
          _name = '生物角色';
          break
        case '量子':
        case '量子系':
          data = data.filter(item => item.yuanshu === '量子');
          _name = '量子角色';
          break;
        case '虚数':
        case '虚数系':
          data = data.filter(item => item.yuanshu === '虚数');
          _name = '虚数角色';
          break;
        case '异能':
        case '异能系':
          data = data.filter(item => item.yuanshu === '异能');
          _name = '异能角色';
          break;
        case '机械':
        case '机械系':
          data = data.filter(item => item.yuanshu === '机械');
          _name = '机械角色';
          break;
        case '星尘':
        case '星尘系':
          data = data.filter(item => item.yuanshu === '星尘');
          _name = '星尘角色';
          break;
      }
    }
    const ratingOrder = { 五星: 1, 四星: 2, 三星: 3, 二星: 4, 一星: 5 };
    //重新排序（5星排在顶部）
    data = data.sort((a, b) => {
      return ratingOrder[a.ji] - ratingOrder[b.ji];
    });
    //根据name去重（主角只需要显示一个）
    data = data.filter(
      (item, index, self) => index === self.findIndex(t => t.name === item.name)
    );

    if (data.length > 50)
      reply_recallMsg(e, `正在获取${_name}列表中,请等待...`, 30);
    data = {
      name: _name,
      data: data,
    };
    return render('wiki/list', data, { e, ret: true });
  }

  //遗器图
  async yiqi_pictures(e, data) {
    let ext = JSON.parse(data.ext).c_30;
    data = {
      name: data.title,
      pic: ext.picture.list,
      table: ext.table.list,
    };
    render('wiki/yiqi', data, { e, ret: true });
  }

  //圣遗物图
  async syw_pictures(e, data) {
    let ext = JSON.parse(data.ext).c_218;
    data = {
      name: data.title,
      icon: data.icon,
      table: ext.table.list,
    };
    render('wiki/syw', data, { e, ret: true });
  }

  //圣遗物和遗器
  async syw_yiqi(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    const path = isZZZ
      ? './plugins/xhh/system/default/zzz_syw_names.yaml'
      : isBH3
      ? './plugins/xhh/system/default/bh3_syw_names.yaml'
      : isSr
      ? './plugins/xhh/system/default/yiqi.yaml'
      : './plugins/xhh/system/default/syw.yaml';
    const _name = yaml.get(path);
    for (let i in _name) {
      if (_name[i].includes(name)) {
        name = i;
        break;
      }
    }
    if (Object.keys(_name).includes(name)) {
      let data = await mys.data(name, isZZZ ? 'syw' : isBH3 ? 'syw' : isSr ? 'yq' : 'syw', isSr, isZZZ, isBH3);
      if (!data) return false;
      data.map(v => {
        if (v.title == name) data = v;
      });
      if (isZZZ) {
        this.zzz_syw_pictures(e, data);
      } else if (isBH3) {
        this.bh3_syw_pictures(e, data);
      } else if (isSr) {
        this.yiqi_pictures(e, data);
      } else {
        this.syw_pictures(e, data);
      }
      return true;
    }
    return false;
  }

  //武器
  async weapon(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    const path = isZZZ
      ? './plugins/xhh/system/default/zzz_wq_names.yaml'
      : isBH3
      ? './plugins/xhh/system/default/bh3_wq_names.yaml'
      : !isSr
      ? './plugins/xhh/system/default/wqname.yaml'
      : './plugins/xhh/system/default/gz_names.yaml';
    const wq_name = yaml.get(path);
    for (let i in wq_name) {
      if (wq_name[i].includes(name)) {
        name = i;
        break;
      }
    }
    if (Object.keys(wq_name).includes(name)) {
      const { id } = await mys.data(name, isZZZ ? 'wq' : isBH3 ? 'wq' : isSr ? 'gz' : 'wq', isSr, isZZZ, isBH3);
      if (!id) return false;
      let data = await mys.detail(id, isSr, isZZZ, isBH3);
      if (isZZZ) this.zzz_wq_pictures(e, data);
      else if (isBH3) this.bh3_wq_pictures(e, data);
      else if (isSr) this.sr_gz_pictures(e, data);
      else this.gs_wq_pictures(e, data);
      return true;
    }
    return false;
  }

  //角色
  async role(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    const path = isZZZ
      ? './plugins/xhh/system/default/zzz_js_names.yaml'
      : isBH3
      ? './plugins/xhh/system/default/bh3_js_names.yaml'
      : isSr
      ? './plugins/xhh/system/default/sr_js_names.yaml'
      : './plugins/xhh/system/default/gs_js_names.yaml';
    const role_name = yaml.get(path);
    for (let i in role_name) {
      if (role_name[i].includes(name)) {
        name = i;
        break;
      }
    }
    if (Object.keys(role_name).includes(name)) {
      const { id } = await mys.data(name, 'js', isSr, isZZZ, isBH3);
      if (!id) return false;
      let data = await mys.detail(id, isSr, isZZZ, isBH3);
      if (isZZZ) this.zzz_role_pictures(e, data);
      else if (isBH3) this.bh3_role_pictures(e, data);
      else if (isSr) this.sr_role_pictures(e, data);
      else this.gs_role_pictures(e, data);
      return true;
    }
    return false;
  }

  //星铁角色
  async sr_role_pictures(e, data) {
    const userinfo = data.content.rpg_new_tmp_content?.base?.userInfo;
    const modules = data.content.rpg_new_tmp_content?.modules;
    let text = JSON.parse(data.content.ext);
    text = JSON.parse(text.c_18.filter.text);
    let attribute, fate, rarity;
    text.map(v => {
      if (v.includes('属性')) {
        attribute = v.replace(/属性\//, '');
      }
      if (v.includes('命途')) {
        fate = v.replace(/命途\//, '');
      }
      if (v.includes('星级')) {
        rarity = v.replace(/星级\//, '');
      }
    });
    let character,
      character_material,
      attr = [];
    if (modules) {
      modules.forEach(module => {
        if (module.name === '角色信息') {
          character = JSON.parse(module.components[0].data).list;
        }
        if (module.name === '角色晋阶') {
          character_material = JSON.parse(module.components[0].data).list[0]
            .materials;
        }
      });
      character.forEach(v => {
        attr.push({
          key: v.rightKey,
          value: v.rightValue,
        });
      });
    } else {
      const js = JSON.parse(
        fs.readFileSync(
          `./plugins/miao-plugin/resources/meta-sr/character/${data.content.title}/data.json`,
          'utf-8'
        )
      );
      attr.push({ key: '阵营', value: js.allegiance });
      attr.push({ key: '命途/属性', value: fate + '/' + attribute });
      attr.push({ key: '中文cv', value: js.cncv });
    }
    data = {
      name: userinfo?.name || data.content.title,
      //级
      star: userinfo?.rarity || rarity == '五星' ? 5 : 4,
      //属性
      attribute: attribute,
      //命途
      fate: fate,
      //封面链接
      img:
        userinfo?.figurePath ||
        `../../../../../plugins/miao-plugin/resources/meta-sr/character/${data.content.title}/imgs/splash.webp`,
      //角色标签
      attr: attr,
      attr_: userinfo ? true : false,
      //突破材料(另一个排版没有,懒得写了)
      material: character_material,
    };
    render('wiki/sr_role', data, { e, ret: true });
  }

  //原神角色
  async gs_role_pictures(e, data) {
    const modules = data.page.modules;
    const role_attribute = {
      '#378383': '风',
      '#5FACC1': '冰',
      '#6455A6': '雷',
      '#518ABB': '水',
      '#B8584B': '火',
      '#6D9840': '草',
      '#C09257': '岩',
    };
    let character, character_material, character_talent;
    modules.forEach(module => {
      if (module.name === '基础信息') {
        character = JSON.parse(module.components[0].data);
      }
      if (module.name === '角色突破') {
        character_material = JSON.parse(module.components[0].data);
      }
      if (module.name === '天赋') {
        character_talent = JSON.parse(module.components[0].data).list[0].attr
          .row;
      }
    });

    //计算天赋材料
    character_talent = character_talent[character_talent.length - 1];
    //取3,4,11的图片,重新排序一下
    let pngs = [
      ...extractUnique(character_talent[2]),
      ...extractUnique(character_talent[3]),
      ...extractUnique(character_talent[10]),
    ];
    let png_names = [
      ...extractUnique(character_talent[2], true),
      ...extractUnique(character_talent[3], true),
      ...extractUnique(character_talent[10], true),
    ];
    const pngs_ = extractElements(pngs, [1, 3, 5]);
    const png_names_ = extractElements(png_names, [1, 3, 5]);
    pngs = [...pngs_, ...pngs];
    png_names = [...png_names_, ...png_names];
    png_names[0] += ' x18';
    png_names[1] += ' x66';
    png_names[2] += ' x93';
    const weeks = {
      '周一/四/日': ['自由', '繁荣', '浮世', '诤言', '公平', '角逐', '月光'],
      '周二/五/日': ['抗争', '勤劳', '风雅', '巧思', '正义', '焚燔', '乐园'],
      '周三/六/日': ['诗文', '黄金', '天光', '笃行', '秩序', '纷争', '浪迹'],
    };
    let week;
    for (const k in weeks) {
      weeks[k].map(v => {
        if (png_names[3].includes(v)) week = k;
      });
      if (week) break;
    }
    png_names[3] += ' x9';
    png_names[4] += ' x63';
    png_names[5] += ' x114';
    png_names[6] += ' x18';
    png_names[7] += ' x3';
    pngs.splice(3, 0, pngs.splice(6, 1)[0]);
    png_names.splice(3, 0, png_names.splice(6, 1)[0]);

    //计算成长属性
    let grow = character_material.list[character_material.list.length - 1];
    grow = grow.attr[grow.attr.length - 1];
    grow.value = grow.value[0].replace(/<p>(.*)<\/p>/, '$1').trim();
    if (grow.key == '暴击伤害') {
      grow.value = '38.4%';
    } else if (grow.key == '暴击率') {
      grow.value = '19.2%';
    }
    character_material = character_material.list[0].materials;
    data = {
      name: character.name,
      //级
      star: character.star,
      //元素标志
      attribute: role_attribute[character.role_attribute],
      //封面链接
      img: character.avatar_pc,
      //角色标签
      attr: character.attr,
      //突破材料
      material: character_material,
      //成长属性
      grow: grow.key + ' ' + grow.value,
      //天赋材料图片
      pngs: pngs,
      //天赋材料
      png_names: png_names,
      //天赋材料周几
      week: week,
    };
    render('wiki/gs_role', data, { e, ret: true });
  }

  //原神武器
  async gs_wq_pictures(e, data) {
    const modules = data.page.modules;
    let wq, description, numeric_value;
    modules.forEach((v, i) => {
      if (i == 0) wq = JSON.parse(v.components[0].data);
      if (v.name == '装备描述') description = JSON.parse(v.components[0].data);
      if (v.name == '成长数值')
        numeric_value = JSON.parse(v.components[0].data).list;
    });
    const rich_text = description.rich_text;
    description.attr.map((v, i, arr) => {
      arr[i].value = v.value[0];
    });
    const attr = description.attr;
    //材料
    const materials = numeric_value[0].materials;
    //数值
    const numeric_ = numeric_value[numeric_value.length - 1].attr[0].value[0];
    //如果喵有图就调用
    // const path_img = this.getpath(wq.name)

    const arr = numeric_
      .match(/<p>(.*?)<\/p>/g)
      .map(m => m.replace(/<p>|<\/p>/g, ''));
    const atk = arr[0].replace(/基础攻击力/g, '').replace(/:|：/g, '')

    const attr_ = {
      key: arr[1].split(/[:：]/)[0],
      value: arr[1].split(/[:：]/)[1],
    };
    //材料周几
    const weeks = {
      '周一/四/日': [
        '高塔孤王',
        '孤云寒林',
        '远海夷地',
        '谧林涓露',
        '悠古弦音',
        '贡祭炽心',
        '奇巧秘器'
      ],
      '周二/五/日': [
        '凛风奔狼',
        '雾海云间',
        '鸣神御灵',
        '绿洲花园',
        '纯圣露滴',
        '谵妄圣主',
        '长夜燧火'
      ],
      '周三/六/日': [
        '狮牙斗士',
        '漆黑陨铁',
        '今昔剧画',
        '烈日威权',
        '无垢之海',
        '神合秘烟',
        '终北遗嗣'
      ],
    };
    let week;
    for (const k in weeks) {
      weeks[k].map(v => {
        if (materials[0].nickname.includes(v)) week = k;
      });
      if (week) break;
    }
    data = {
      name: wq.name,
      type: wq.category,
      //级
      star: wq.star + '星',
      //图片
      img: wq.image,
      rich_text,
      attr,
      materials,
      // path_img,
      //基础攻击力
      atk,
      //武器副属性
      attr_,
      week,
    };
    render('wiki/wq', data, { e, ret: true });
  }

  //星铁光锥
  async sr_gz_pictures(e, data) {
    let content = data.content.contents[0].text;
    const name = data.content.title;
    let grow = content.match(/80级<\/td>(.*?)<\/table>/g)[0].match(/\d+/g);
    let material = content.match(/晋阶材料(.*)信用点/g)[0];
    content = content.match(
      /<img src=(.*?)基础介绍(.*?)命途(.*?)稀有度(.*?)技能(.*?)光锥描述(.*?)<img/g
    );
    const cn = extractChineseWords(material);
    material = extractUniqueHttpsLinks(material);
    let mat = [0, 6, 12, 2, 5, 11, 1].map(index => material[index]); //重新排序，提取
    if (cn[2] === cn[5])
      mat = [0, 5, 11, 3, 6, 12, 1].map(index => material[index]); //另一种排版
    let mat_num = [20, 20, 14, 4, 12, 15, '89.3w'];
    content = extractHonkaiStarRailData(content[0]);
    content.jineng[1] = content.jineng[1].replace(
      /【([\d.%/]+)】/g,
      '<p class="lan">【$1】</p>'
    );
    if (content.xiyoudu == '4星') mat_num = [15, 15, 12, 3, 9, 12, '70.7w'];
    data = {
      name,
      ...content,
      grow,
      mat,
      mat_num,
    };
    render('wiki/gz', data, { e, ret: true });
  }

  /*
    getpath(name) {
        let path = './plugins/miao-plugin/resources/meta-gs/weapon/'
        const path_arr = fs.readdirSync(path).filter(file => {
            try {
                return fs.lstatSync(`${path}/${file}`).isDirectory();
            } catch {
                return false;
            }
        })
        let _path = false
        path_arr.map(v => {
            const path_ = path + v + '/' + name + '/gacha.webp'
            if (fs.existsSync(path_)) return _path = path_
})
        return _path
    }
*/
// 崩坏3角色
  async bh3_role_pictures(e, data) {
    const content = data.content || {};
    const title = content.title;
    const icon = content.icon || '';

    let basic_info = content.basic_info || {};
    try {
      const ext = JSON.parse(content.ext || '{}');
      const filters = JSON.parse(ext.c_18?.filter?.text || '[]');
      for (const item of filters) {
        const [key, value] = item.split('/');
        if (key && value) basic_info[key] = value;
      }
    } catch (_) {}

    const element = basic_info['属性'] || '未知';
    const character_name = basic_info['角色'] || '';
    const rarity = basic_info['初始阶级'] || 'S';
    const type = basic_info['装甲特性'] || '未知';

    const element_icon_map = {
      '物理': '物理.png',
      '火': '火.png',
      '火焰': '火.png',
      '火伤': '火.png',
      '冰': '冰.png',
      '冰冻': '冰.png',
      '冰伤': '冰.png',
      '雷': '雷.png',
      '雷电': '雷.png',
      '雷伤': '雷.png',
      '生物': '生物.png',
      '量子': '量子.png',
      '虚数': '虚数.png',
      '异能': '异能.png',
      '机械': '机械.png',
      '星尘': '星尘.png'
    };

    const attr = Object.entries(basic_info)
      .filter(([key, value]) => key && value)
      .map(([key, value]) => ({ key, value }));

    const img = icon.startsWith('http') ? icon : `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${icon}`;
    const element_icon = element_icon_map[element] || '物理.png';

    data = {
      name: title,
      star: rarity === 'S' ? 5 : 4,
      attribute: element,
      specialty: type,
      character: character_name,
      img,
      attr,
      attr_icon: element_icon,
      material: []
    };
    return render('wiki/bh3_role', data, { e, ret: true });
  }

  // 崩坏3武器
  async bh3_wq_pictures(e, data) {
    const content = data.content;
    const title = content.title;
    const weapon_data = content.weapon_data || {};
    const info = weapon_data.info || {};
    const skills = weapon_data.skills || [];
    const materials = weapon_data.materials || [];
    const gainMethods = weapon_data.gainMethods || [];
    const roles = weapon_data.roles || [];
    
    const type = info.attr?.find(a => a.key === '武器类型')?.value || '未知';
    const star = info.starValue || 5;
    const atk = info.attr?.find(a => a.key === '攻击力')?.value || '未知';
    const sub_attr = info.attr?.find(a => a.key !== '攻击力' && a.key !== '武器类型')?.value || '未知';
    
    let week = '未知';
    for (const gm of gainMethods) {
      if (gm.key === '获取途径') {
        week = gm.value;
        break;
      }
    }
    
    const img = `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${info.icon}`;
    
    data = {
      name: title,
      type: type,
      star: star + '星',
      img: img,
      rich_text: skills.map(s => `${s.key}: ${s.value}`).join('\n\n'),
      attr: info.attr || [],
      materials: materials.map(m => ({ name: m.name, icon: m.icon, count: m.count })),
      atk: atk,
      attr_: { key: '副属性', value: sub_attr },
      week: week
    };
    render('wiki/bh3_wq', data, { e, ret: true });
  }

  // 崩坏3圣痕
  async bh3_syw_pictures(e, data) {
    const content = data.content;
    const title = content.title;
    const stigma_data = content.stigma_data || {};
    const info = stigma_data.info || {};
    const basicAttr = stigma_data.basicAttr || {};
    const setSkills = stigma_data.setSkills || [];
    const stigmaSkill = stigma_data.stigmaSkill || {};
    const roles = stigma_data.roles || [];
    const materials = stigma_data.materials || [];
    const gainMethods = stigma_data.gainMethods || [];
    
    const desc2 = stigmaSkill.value || '无';
    const desc4 = setSkills.map(s => `${s.key}: ${s.value}`).join('\n') || '无';
    const icon = info.avatar || content.icon;
    
    let table = [];
    if (basicAttr.attr) {
      table = basicAttr.attr.map(a => ({ key: a.key, value: a.value }));
    }
    if (basicAttr.comment) {
      table.push({ key: '备注', value: basicAttr.comment });
    }
    
    data = {
      name: title,
      icon: `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${icon}`,
      desc2: desc2,
      desc4: desc4,
      table: table,
      star: 5
    };
    render('wiki/bh3_syw', data, { e, ret: true });
  }

  // 崩坏3人偶/协同者
  async bh3_yq_pictures(e, data) {
    const content = data.content;
    const title = content.title;
    const icon = content.icon;
    const summary = content.summary || '无';
    
    data = {
      name: title,
      desc: summary,
      icon: `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${icon}`
    };
    render('wiki/bh3_yq', data, { e, ret: true });

}

}