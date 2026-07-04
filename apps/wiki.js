import { yaml, render, mys, config, reply_recallMsg } from '#xhh';
import fs from 'fs';
import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
const DOMParser = window.DOMParser;


function collectWikiValues(input, nameOnly = false, out = []) {
  if (input === undefined || input === null) return out;
  if (typeof input === 'string') {
    if (nameOnly) {
      const text = input.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (text) out.push(text);
    } else {
      const links = input.match(/https?:\/\/[^\s"'<>\)]+/g) || [];
      out.push(...links);
      const srcs = [...input.matchAll(/(?:src|data-src)=['"]([^'"]+)['"]/g)].map(m => m[1]);
      out.push(...srcs);
    }
    return out;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectWikiValues(item, nameOnly, out);
    return out;
  }
  if (typeof input === 'object') {
    const keys = nameOnly
      ? ['name', 'title', 'label', 'text', 'value', 'desc', 'nickname']
      : ['icon', 'img', 'image', 'url', 'src', 'avatar', 'file', 'value'];
    for (const key of keys) {
      if (typeof input[key] === 'string' && input[key]) out.push(input[key]);
    }
    for (const val of Object.values(input)) {
      if (val && typeof val === 'object') collectWikiValues(val, nameOnly, out);
    }
  }
  return out;
}

function extractUnique(input = [], nameOnly = false) {
  const seen = new Set();
  const values = collectWikiValues(input, nameOnly, [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .map(v => nameOnly ? v.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : v);
  return values.filter(v => {
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function extractElements(arr = [], indexes = []) {
  if (!Array.isArray(arr)) return [];
  return indexes.map(i => arr[i]).filter(v => v !== undefined && v !== null && v !== '');
}

function extractUniqueHttpsLinks(text = '') {
  const links = String(text || '').match(/https?:\/\/[^\s"'<>\)]+/g) || [];
  return [...new Set(links)];
}

function extractChineseWords(text = '') {
  return String(text || '').match(/[\u4e00-\u9fa5·・（）()]+/g) || [];
}

function extractHonkaiStarRailData(html = '') {
  const text = String(html || '').replace(/<br\s*\/?\>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const clean = text.replace(/\s+/g, ' ').trim();
  return {
    img: extractUniqueHttpsLinks(html)[0] || '',
    fate: clean.match(/命途\s*([^\s]+)/)?.[1] || '',
    rarity: clean.match(/稀有度\s*([^\s]+)/)?.[1] || '',
    desc: clean,
    jineng: ['', clean]
  };
}

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
          reg: '^#*(星铁|绝区零|ZZZ|崩坏3|崩坏三|崩三|BH3)?\\s*(.+)图鉴$',
          fnc: 'illustrated_book',
        },
        {
          reg: '^#*(星铁|绝区零|ZZZ|崩坏3|崩坏三|崩三|BH3)?\\s*图鉴\\s*(.+)$',
          fnc: 'illustrated_book',
        },
      ],
    });
  }

  getWikiIcon(text = '') {
    text = String(text || '');
    const iconMap = {
      '星尘': 'bh3_星尘.svg', '星辰': 'bh3_星尘.svg',
      '生物': 'bh3_生物.svg', '异能': 'bh3_异能.svg', '机械': 'bh3_机械.svg', '量子': 'bh3_量子.svg', '虚数': 'bh3_虚数.svg',
      '物理': 'bh3_物理.svg', '火伤': 'bh3_火.svg', '火焰': 'bh3_火.svg', '火': 'bh3_火.svg',
      '冰伤': 'bh3_冰.svg', '冰冻': 'bh3_冰.svg', '冰': 'bh3_冰.svg',
      '雷伤': 'bh3_雷.svg', '雷电': 'bh3_雷.svg', '雷': 'bh3_雷.svg',
      '界域共鸣': '星环特性.svg', '星影偕行': '星环特性.svg', '复盈相生': '星环特性.svg', '星之环特性': '星环特性.svg',
      '天衍之杯': '星环分野.svg', '星之环分野': '星环分野.svg',
      '输出': '定位.svg', '辅助': '定位.svg', '定位': '定位.svg'
    };
    for (const [key, icon] of Object.entries(iconMap)) {
      if (text.includes(key)) return icon;
    }
    if (text.includes('星')) return 'bh3_星尘.svg';
    return '';
  }

  async illustrated_book(e) {
    if (!config().wiki) return false;
    const isSr = e.msg.includes('星铁');
    const isZZZ = e.msg.includes('绝区零') || e.msg.includes('ZZZ');
    const isBH3 = e.msg.includes('崩坏3') || e.msg.includes('崩坏三') || e.msg.includes('崩三') || e.msg.includes('BH3');
    let name = e.msg
      .replace(/^#*/, '')
      .replace(/星铁|绝区零|ZZZ|崩坏3|崩坏三|崩三|BH3/gi, '')
      .trim();
    name = name.startsWith('图鉴') ? name.replace(/^图鉴/, '') : name.replace(/图鉴$/, '');
    name = name.replace(/^[:：\s]+|[:：\s]+$/g, '').trim();
    if (!name) return false;
    const hasBh3ExclusiveWords = /(专武|专属武器|专属圣痕|专属套|毕业圣痕|圣痕套)/.test(name);
    const hasZzzExclusiveWords = /(专武|专属武器|专属音擎|签名音擎|专属驱动盘|推荐驱动盘|驱动盘套|驱动套)/.test(name);
    if (isBH3 && hasBh3ExclusiveWords) {
      if (await this.bh3ExclusiveEquip(e, name)) return true;
    }
    if (isZZZ && hasZzzExclusiveWords) {
      if (await this.zzzExclusiveEquip(e, name)) return true;
    }
    // 没写游戏前缀时也支持“艾莲专武图鉴 / 希儿专武图鉴”。
    // 先按绝区零代理人匹配，再按崩三装甲匹配；都没命中时继续走普通图鉴。
    if (!isSr && !isZZZ && !isBH3) {
      if (hasZzzExclusiveWords && await this.zzzExclusiveEquip(e, name)) return true;
      if (hasBh3ExclusiveWords && await this.bh3ExclusiveEquip(e, name)) return true;
    }
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
      // 未写游戏前缀时，也兜底尝试绝区零，支持“安比图鉴 / 图鉴安比”这类写法。
      for (const { method, args } of checkTypes) {
        if (await this[method](...args, false, true)) return true;
      }
      if (await this.bangboo(e, name)) return true;
    }
    //最后查总列表
    if (/角色|武器|大剑|双手剑|单手剑|法器|长枪|弓箭|弓|光锥|圣遗物|遗器|音擎|驱动盘|邦布|圣痕|人偶|协同者/.test(name)) return this.list(e, name, isSr, isZZZ, isBH3);
    return false;
  }

  async list(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    if (/光锥|遗器|虚无|巡猎|物理|量子|虚数|毁灭|智识|同谐|存护|丰饶|记忆/.test(name)) isSr = true;
    if (/音擎|驱动盘|邦布|以太|强攻|击破|防护|支援|异常/.test(name)) isZZZ = true;
    if (/圣痕|人偶|协同者|生物|机械|量子|虚数|星尘|星辰|异能|火焰|冰冻|雷电/.test(name)) isBH3 = true;

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
        case '星辰':
        case '星尘系':
        case '星辰系':
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
    data = data.map(item => ({
      ...item,
      badges: [item.ji, item.yuanshu, item.wuqi]
        .filter(v => v && v !== '未知' && v !== 'false')
        .map(v => ({ text: v, icon: this.getWikiIcon(v) }))
    }));
    data = {
      name: _name,
      data: data,
    };
    return render('wiki/list', data, { e, ret: true });
  }



  normalizeZzzKey(text = '') {
    return String(text || '').replace(/[\s·・\-—_「」『』《》【】\[\]（）()]/g, '').toLowerCase();
  }

  async getZzzWikiEntries(channelId = 43) {
    if (!this._zzzObcIconCache) this._zzzObcIconCache = {};
    if (!this._zzzObcIconCache[channelId]) {
      try {
        const url = `https://api-takumi-static.mihoyo.com/common/blackboard/zzz_wiki/v1/home/content/list?app_sn=zzz_wiki&channel_id=${channelId}`;
        const res = await fetch(url).then(r => r.json());
        const root = res?.data?.list?.[0];
        let list = Array.isArray(root?.list) ? root.list : [];
        if (!list.length && Array.isArray(root?.children)) {
          const child = root.children.find(v => Number(v.id) === Number(channelId)) || root.children[0];
          list = Array.isArray(child?.list) ? child.list : [];
        }
        this._zzzObcIconCache[channelId] = list.map(item => ({
          title: String(item.title || '').replace(/\s/g, ''),
          alias: String(item.alias_name || '').replace(/\s/g, ''),
          aliases: String(item.alias_name || '')
            .split(/[、,，/|；;\s]+/)
            .map(v => v.trim())
            .filter(Boolean),
          icon: item.icon || ''
        }));
      } catch (err) {
        globalThis.logger?.warn?.('[xhh][wiki] 获取绝区零官方图标失败:', err);
        this._zzzObcIconCache[channelId] = [];
      }
    }
    return this._zzzObcIconCache[channelId];
  }

  async resolveZzzWikiName(name = '', channelId = 43) {
    const key = this.normalizeZzzKey(name);
    if (!key) return name;
    const list = await this.getZzzWikiEntries(channelId);
    const keysOf = item => [item.title, item.alias, ...(item.aliases || [])].map(v => this.normalizeZzzKey(v)).filter(Boolean);
    let hit = list.find(item => keysOf(item).some(v => v === key));
    if (!hit) hit = list.find(item => keysOf(item).some(v => v.includes(key) || key.includes(v)));
    return hit?.title || name;
  }

  async getZzzObcIcon(name = '', channelId = 43) {
    if (!name) return '';
    const list = await this.getZzzWikiEntries(channelId);
    const key = this.normalizeZzzKey(name);
    const hit = list.find(item => {
      const keys = [item.title, item.alias, ...(item.aliases || [])].map(v => this.normalizeZzzKey(v)).filter(Boolean);
      return keys.some(v => v === key || v.includes(key) || key.includes(v));
    });
    return hit?.icon || '';
  }

  zzzCleanText(text = '', len = 120) {
    text = String(text || '')
      .replace(/<color=[^>]+>/g, '')
      .replace(/<\/color>/g, '')
      .replace(/<IconMap:[^>]+>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    return text.length > len ? `${text.slice(0, len)}…` : text;
  }

  zzzFirstValue(obj = {}) {
    return Object.values(obj || {})[0] || '';
  }

  // 绝区零代理人专属音擎/推荐驱动盘快捷查询
  async zzzExclusiveEquip(e, rawName = '') {
    const wantDrive = /(专属驱动盘|推荐驱动盘|驱动盘套|驱动套)/.test(rawName);
    const wantWeapon = /(专武|专属武器|专属音擎|签名音擎)/.test(rawName);
    let roleQuery = String(rawName || '')
      .replace(/专属武器|专属音擎|签名音擎|专武|专属驱动盘|推荐驱动盘|驱动盘套|驱动套/g, '')
      .replace(/图鉴/g, '')
      .trim();
    if (!roleQuery || (!wantWeapon && !wantDrive)) return false;

    const roleName = await this.resolveZzzWikiName(roleQuery, 43);
    const detail = await this.getZzzRoleDetail(roleName);
    if (!detail) return false;

    if (wantDrive) {
      const drives = await this.findZzzRecommendDrives(detail);
      if (!drives.length) {
        await e.reply(`未找到「${roleName}」的推荐驱动盘信息，建议直接发送具体驱动盘名图鉴。`);
        return true;
      }
      for (const name of drives) {
        if (await this.syw_yiqi(e, name, false, true, false)) return true;
      }
      await e.reply(`已识别「${roleName}」推荐驱动盘：${drives.join(' / ')}，但图鉴别名暂未命中。可以直接用完整驱动盘名查询。`);
      return true;
    }

    const weapon = await this.findZzzSignatureWeapon(roleName, detail);
    if (!weapon) {
      await e.reply(`未找到「${roleName}」的专属音擎信息，建议直接发送具体音擎名图鉴。`);
      return true;
    }
    if (await this.weapon(e, weapon, false, true, false)) return true;
    await e.reply(`已识别「${roleName}」专属音擎：${weapon}，但图鉴别名暂未命中。可以直接用完整音擎名查询。`);
    return true;
  }

  async getZzzRoleDetail(roleName = '') {
    try {
      const name = await this.resolveZzzWikiName(roleName, 43);
      const ret = await mys.data(name, 'js', false, true);
      const id = Array.isArray(ret) ? ret.find(v => v?.title === name)?.id || ret[0]?.id : ret?.id;
      if (!id) return null;
      return await mys.detail(id, false, true);
    } catch (err) {
      globalThis.logger?.debug?.(`[xhh] ZZZ专属装备获取代理人详情失败: ${roleName} ${err?.message || err}`);
      return null;
    }
  }

  async findZzzRecommendDrives(detail = {}) {
    const list = await this.getZzzWikiEntries(46);
    const text = JSON.stringify(detail.content || {});
    const hits = [];
    for (const item of list) {
      if (item.title && text.includes(item.title)) hits.push(item.title);
    }
    return [...new Set(hits)].slice(0, 2);
  }

  async findZzzSignatureWeapon(roleName = '', detail = {}) {
    const direct = await this.findZzzWeaponInRoleDetail(detail);
    if (direct) return direct;
    const c = detail.content || {};
    const aliases = [roleName, c.name, c.code_name, c.partner_info?.full_name]
      .flatMap(v => String(v || '').split(/[、,，/|；;\s]+/))
      .map(v => v.trim())
      .filter(v => v && v.length >= 2);
    const full = String(c.partner_info?.full_name || '');
    if (full.includes('·')) aliases.push(full.split('·')[0], full.split('·').slice(-1)[0]);

    const mapPath = './plugins/ZZZ-Plugin/resources/map/WeaponId2Data.json';
    if (!fs.existsSync(mapPath)) return '';
    let weaponMap = {};
    try { weaponMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8')); } catch (_) { return ''; }

    let best = { name: '', score: 0 };
    for (const item of Object.values(weaponMap)) {
      const name = item?.Name || item?.name || '';
      const desc = `${item?.Desc || ''}\n${item?.Desc2 || ''}\n${item?.Desc3 || ''}`;
      if (!name || !desc) continue;
      let score = 0;
      for (const alias of [...new Set(aliases)]) {
        if (!alias) continue;
        if (desc.includes(`是${alias}惯用`)) score += 120;
        if (desc.includes(`${alias}惯用`)) score += 100;
        if (desc.includes(`对于${alias}来说`)) score += 80;
        if (desc.includes(`——${alias}`) || desc.includes(`—${alias}`)) score += 35;
        if (desc.includes(alias)) score += 15;
      }
      if (score > best.score) best = { name, score };
    }
    return best.score >= 15 ? best.name : '';
  }

  async findZzzWeaponInRoleDetail(detail = {}) {
    const list = await this.getZzzWikiEntries(45);
    const text = JSON.stringify(detail.content || {});
    const hit = list.find(item => item.title && text.includes(item.title));
    return hit?.title || '';
  }

  async zzz_role_pictures(e, data) {
    const c = data.content || {};
    const partner = c.partner_info || {};
    const rarity = c.rarity === 4 ? 'S' : c.rarity === 3 ? 'A' : `${c.rarity || '?'}星`;
    const element = this.zzzFirstValue(c.element_type) || this.zzzFirstValue(c.special_element_type) || '未知属性';
    const type = this.zzzFirstValue(c.weapon_type) || '未知特性';
    const camp = this.zzzFirstValue(c.camp) || '未知阵营';
    const hit = this.zzzFirstValue(c.hit_type) || '未知攻击类型';
    const maxLv = c.level?.['6'] || {};
    const base = c.stats || {};
    const passiveMax = Object.values(c.passive?.level || {}).slice(-1)[0] || {};
    const skills = Object.entries(c.skill || {}).slice(0, 5).map(([key, val]) => {
      const first = (val.description || []).find(v => v?.desc) || {};
      return {
        name: first.name || ({ basic: '普通攻击', dodge: '闪避', special: '特殊技', chain: '连携技', assist: '支援技' }[key] || key),
        desc: this.zzzCleanText(first.desc, 110)
      };
    }).filter(v => v.name || v.desc);
    if (passiveMax.name?.length) {
      skills.unshift({ name: passiveMax.name[0], desc: this.zzzCleanText(passiveMax.desc?.[0], 110) });
      if (passiveMax.name[1]) skills.unshift({ name: passiveMax.name[1], desc: this.zzzCleanText(passiveMax.desc?.[1], 110) });
    }
    const talents = Object.values(c.talent || {}).slice(0, 6).map(v => ({
      level: v.level,
      name: v.name,
      desc: this.zzzCleanText(v.desc, 88)
    }));
    const fr = c.fairy_recommend || {};
    const recommend = [
      { key: '4号位', value: fr.part4?.name },
      { key: '5号位', value: fr.part5?.name },
      { key: '6号位', value: fr.part6?.name },
      { key: '副词条', value: fr.part_sub?.name }
    ].filter(v => v.value);
    // 档案简介是图鉴核心内容，不做字数截断；之前 260 字会在部分角色末尾显示“…”。
    const profile = this.zzzCleanText(partner.profile_desc || c.desc || '', 9999);
    const obcIcon = await this.getZzzObcIcon(c.name, 43);
    const view = {
      name: c.name || '未知代理人',
      avatar_img: obcIcon,
      code_name: c.code_name || '',
      full_name: partner.full_name || '',
      avatar_text: (c.name || '?').slice(0, 1),
      tags: [
        { text: rarity, primary: true },
        { text: element, primary: true },
        { text: type },
        { text: camp },
        { text: hit }
      ].filter(v => v.text),
      profile,
      info: [
        { key: '全名', value: partner.full_name || c.name },
        { key: '生日', value: partner.birthday || '-' },
        { key: '性别', value: partner.gender || '-' },
        { key: '阵营', value: camp },
        { key: '属性', value: element },
        { key: '特性', value: type }
      ],
      stats: [
        { key: '生命', value: (base.hp_max || 0) + (maxLv.hp_max || 0) },
        { key: '攻击', value: (base.attack || 0) + (maxLv.attack || 0) },
        { key: '防御', value: (base.defence || 0) + (maxLv.defence || 0) },
        { key: '冲击力', value: base.break_stun || '-' },
        { key: '异常掌控', value: base.element_abnormal_power || '-' },
        { key: '异常精通', value: base.element_mystery || '-' },
        { key: '暴击率', value: base.crit ? `${base.crit / 100}%` : '-' },
        { key: '暴击伤害', value: base.crit_damage ? `${base.crit_damage / 100}%` : '-' }
      ],
      strategy: (c.strategy || []).map(v => this.zzzCleanText(v, 90)).filter(Boolean),
      skills: skills.slice(0, 6),
      talents,
      recommend
    };
    return render('wiki/zzz_role', view, { e, ret: true });
  }

  async zzz_wq_pictures(e, data) {
    const c = data.content || {};
    const obcIcon = await this.getZzzObcIcon(c.name, 45);
    const view = {
      name: c.name || '未知音擎',
      avatar_img: obcIcon,
      code_name: c.code_name || '',
      avatar_text: '音',
      tags: [
        { text: c.rarity === 4 ? 'S' : c.rarity === 3 ? 'A' : `${c.rarity || '?'}星`, primary: true },
        { text: this.zzzFirstValue(c.weapon_type) || '音擎', primary: true },
        { text: c.base_property?.name },
        { text: c.rand_property?.name }
      ].filter(v => v.text),
      profile: this.zzzCleanText(c.desc || c.desc3 || '', 260),
      info: [
        { key: '类型', value: this.zzzFirstValue(c.weapon_type) || '-' },
        { key: '基础属性', value: `${c.base_property?.name || '-'} ${c.base_property?.value || ''}` },
        { key: '副属性', value: `${c.rand_property?.name || '-'} ${c.rand_property?.value || ''}` },
        { key: '适用说明', value: c.desc2 || '-' }
      ],
      stats: [], strategy: [], skills: [], talents: [], recommend: []
    };
    return render('wiki/zzz_role', view, { e, ret: true });
  }

  async zzz_syw_pictures(e, data) {
    const c = data.content || {};
    const obcIcon = await this.getZzzObcIcon(c.name, 46);
    const view = {
      name: c.name || '未知驱动盘',
      avatar_img: obcIcon,
      code_name: 'Drive Disc',
      avatar_text: '盘',
      tags: [{ text: '驱动盘', primary: true }, { text: '2件套' }, { text: '4件套' }],
      profile: this.zzzCleanText(c.story || '', 220),
      info: [
        { key: '2件套', value: this.zzzCleanText(c.desc2, 120) },
        { key: '4件套', value: this.zzzCleanText(c.desc4, 160) }
      ],
      stats: [], strategy: [], skills: [], talents: [], recommend: []
    };
    return render('wiki/zzz_role', view, { e, ret: true });
  }

  async zzz_yq_pictures(e, data) {
    const c = data.content || {};
    const base = c.stats || {};
    const obcIcon = await this.getZzzObcIcon(c.name, 44);
    const view = {
      name: c.name || '未知邦布',
      avatar_img: obcIcon,
      code_name: c.code_name || '',
      avatar_text: '布',
      tags: [{ text: c.rarity === 4 ? 'S' : c.rarity === 3 ? 'A' : `${c.rarity || '?'}星`, primary: true }, { text: '邦布', primary: true }],
      profile: this.zzzCleanText(c.desc || '', 220),
      info: [{ key: '代号', value: c.code_name || '-' }, { key: '稀有度', value: c.rarity || '-' }],
      stats: [
        { key: '生命', value: base.hp_max || '-' },
        { key: '攻击', value: base.attack || '-' },
        { key: '防御', value: base.defence || '-' },
        { key: '冲击力', value: base.break_stun || '-' },
        { key: '异常掌控', value: base.element_abnormal_power || '-' }
      ],
      strategy: [],
      skills: Object.values(c.skill || {}).slice(0, 5).map(v => ({ name: v.name, desc: this.zzzCleanText(v.desc, 100) })).filter(v => v.name || v.desc),
      talents: [], recommend: []
    };
    return render('wiki/zzz_role', view, { e, ret: true });
  }

  async bangboo(e, name) {
    name = await this.resolveZzzWikiName(name, 44);
    const ret = await mys.data(name, 'yq', false, true);
    if (!ret?.id) return false;
    const data = await mys.detail(ret.id, false, true);
    if (!data) return false;
    return this.zzz_yq_pictures(e, data);
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
  async syw_yiqi(e, name, isSr = false, isZZZ = false, isBH3 = false, roleName = '') {
    if (isZZZ) {
      name = await this.resolveZzzWikiName(name, 46);
      const ret = await mys.data(name, 'syw', false, true);
      if (!ret?.id) return false;
      const data = await mys.detail(ret.id, false, true);
      if (!data) return false;
      this.zzz_syw_pictures(e, data);
      return true;
    }
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
      if (Array.isArray(data)) {
        data = data.find(v => v.title == name);
        if (!data) return false;
      }
      if (isZZZ) {
        this.zzz_syw_pictures(e, data);
      } else if (isBH3) {
        const id = data?.id || data?.content_id;
        const detail = id ? await mys.detail(id, false, false, true) : data;
        if (!detail) return false;
        this.bh3_syw_pictures(e, detail, roleName);
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
  async weapon(e, name, isSr = false, isZZZ = false, isBH3 = false, roleName = '') {
    if (isZZZ) {
      name = await this.resolveZzzWikiName(name, 45);
      const ret = await mys.data(name, 'wq', false, true);
      if (!ret?.id) return false;
      const data = await mys.detail(ret.id, false, true);
      if (!data) return false;
      this.zzz_wq_pictures(e, data);
      return true;
    }
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
      else if (isBH3) this.bh3_wq_pictures(e, data, roleName);
      else if (isSr) this.sr_gz_pictures(e, data);
      else this.gs_wq_pictures(e, data);
      return true;
    }
    return false;
  }

  //角色
  async role(e, name, isSr = false, isZZZ = false, isBH3 = false) {
    if (isZZZ) {
      name = await this.resolveZzzWikiName(name, 43);
      const ret = await mys.data(name, 'js', false, true);
      if (!ret?.id) return false;
      const data = await mys.detail(ret.id, false, true);
      if (!data) return false;
      this.zzz_role_pictures(e, data);
      return true;
    }
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
    const rawHtml = content.match(
      /<img src=(.*?)基础介绍(.*?)命途(.*?)稀有度(.*?)技能(.*?)光锥描述(.*?)<img/g
    );
    const cn = extractChineseWords(material);
    material = extractUniqueHttpsLinks(material);
    let mat = [0, 6, 12, 2, 5, 11, 1].map(index => material[index]); //重新排序，提取
    if (cn[2] === cn[5])
      mat = [0, 5, 11, 3, 6, 12, 1].map(index => material[index]); //另一种排版
    let mat_num = [20, 20, 14, 4, 12, 15, '89.3w'];
    content = extractHonkaiStarRailData(rawHtml[0]);
    content.jineng[1] = content.jineng[1].replace(
      /【([\d.%/]+)】/g,
      '<p class="lan">【$1】</p>'
    );
    if (content.rarity == '4星') mat_num = [15, 15, 12, 3, 9, 12, '70.7w'];
    let miaoshu = '';
    const descMatch = rawHtml[0].match(/光锥描述(.*?)<img/);
    if (descMatch) {
      miaoshu = descMatch[1]
        .replace(/<br\s*\/?\>/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    data = {
      name,
      ...content,
      mingtu: content.fate,
      xiyoudu: content.rarity,
      miaoshu,
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
// 崩坏3角色专武/专属圣痕快捷查询
  async bh3ExclusiveEquip(e, rawName = '') {
    const wantStigma = /(专属圣痕|专属套|毕业圣痕|圣痕套)/.test(rawName);
    const wantWeapon = /(专武|专属武器)/.test(rawName);
    let roleQuery = String(rawName || '')
      .replace(/专属武器|专武|专属圣痕|专属套|毕业圣痕|圣痕套/g, '')
      .replace(/图鉴/g, '')
      .trim();
    if (!roleQuery || (!wantWeapon && !wantStigma)) return false;

    const roleName = this.resolveBh3RoleAlias(roleQuery);
    if (!roleName) return false;
    const detail = await this.getBh3RoleDetail(roleName);
    if (!detail) return false;
    const equips = this.extractBh3ExclusiveEquips(detail);
    const target = wantStigma ? equips.stigma : equips.weapon;
    if (!target) {
      await e.reply(`未找到「${roleName}」的${wantStigma ? '专属圣痕' : '专武'}信息，建议直接发送具体装备名图鉴。`);
      return true;
    }

    const names = Array.isArray(target) ? target : [target];
    for (const name of names) {
      if (!name) continue;
      const ok = wantStigma
        ? await this.syw_yiqi(e, name, false, false, true, roleName)
        : await this.weapon(e, name, false, false, true, roleName);
      if (ok) return true;
    }
    await e.reply(`已识别「${roleName}」${wantStigma ? '专属圣痕' : '专武'}：${names.filter(Boolean).join(' / ')}，但图鉴别名暂未命中。可以直接用完整装备名查询。`);
    return true;
  }

  resolveBh3RoleAlias(name = '') {
    const roleNames = yaml.get('./plugins/xhh/system/default/bh3_js_names.yaml') || {};
    if (roleNames[name]) return name;
    const clean = String(name || '').replace(/[\s·・!！♪♥☆★「」『』:：-]/g, '').toLowerCase();
    let first = '';
    for (const [role, aliases] of Object.entries(roleNames)) {
      const list = [role, ...(Array.isArray(aliases) ? aliases : [])];
      for (const alias of list) {
        const a = String(alias || '').replace(/[\s·・!！♪♥☆★「」『』:：-]/g, '').toLowerCase();
        if (!a) continue;
        if (a === clean) return role;
        if (!first && (a.includes(clean) || clean.includes(a))) first = role;
      }
    }
    return first;
  }

  async getBh3RoleDetail(roleName = '') {
    try {
      const ret = await mys.data(roleName, 'js', false, false, true);
      const id = Array.isArray(ret) ? ret.find(v => v?.title === roleName)?.id || ret[0]?.id : ret?.id;
      if (!id) return null;
      return await mys.detail(id, false, false, true);
    } catch (err) {
      globalThis.logger?.debug?.(`[xhh] BH3专属装备获取角色详情失败: ${roleName} ${err?.message || err}`);
      return null;
    }
  }

  extractBh3ExclusiveEquips(data = {}) {
    const content = data.content || {};
    const parts = [];
    for (const section of content.contents || []) {
      const text = String(section.text || '');
      const matches = text.matchAll(/data-data="([^"]+)"/g);
      for (const match of matches) {
        try {
          const arr = JSON.parse(decodeURIComponent(match[1]));
          if (Array.isArray(arr)) parts.push(...arr);
        } catch (_) {}
      }
    }
    const equipPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'equipmentRecommendation')?.data || {};
    const groups = equipPart.equipment || [];
    const all = [];
    for (const group of groups) {
      for (const eq of group.equips || []) {
        const title = String(eq.title || eq.name || '').trim();
        if (title) all.push(title);
      }
    }
    const cleanName = (name = '') => String(name)
      .replace(/\((上|中|下)\)|（(上|中|下)）|·(上|中|下)$|-(上|中|下)$/g, '')
      .trim();
    const isStigma = name => /(圣痕|上\)|中\)|下\)|（上）|（中）|（下）|·上|·中|·下|-上|-中|-下)/.test(name) || this.hasBh3StigmaName(cleanName(name));
    const weapon = all.find(name => !isStigma(name));
    const stigmaNames = [...new Set(all.filter(isStigma).map(cleanName).filter(Boolean))];
    return { weapon, stigma: stigmaNames[0] || '' };
  }

  hasBh3StigmaName(name = '') {
    const names = yaml.get('./plugins/xhh/system/default/bh3_syw_names.yaml') || {};
    if (names[name]) return true;
    return Object.values(names).some(list => Array.isArray(list) && list.includes(name));
  }

// 崩坏3角色
  async bh3_role_pictures(e, data) {
    const content = data.content || {};
    const title = content.title;
    const icon = content.icon || '';

    const stripHtml = (text = '') => String(text)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    const shortText = (text = '', len = 96) => {
      text = stripHtml(text).replace(/\n{2,}/g, '\n');
      return text.length > len ? `${text.slice(0, len)}…` : text;
    };
    const uniquePush = (list, item, key = 'key') => {
      if (!item || !item[key]) return;
      if (!list.some(v => v[key] === item[key])) list.push(item);
    };
    const parseTmplParts = () => {
      const parts = [];
      for (const section of content.contents || []) {
        const text = String(section.text || '');
        const matches = text.matchAll(/data-data="([^"]+)"/g);
        for (const match of matches) {
          try {
            const arr = JSON.parse(decodeURIComponent(match[1]));
            if (Array.isArray(arr)) parts.push(...arr);
          } catch (err) {
            globalThis.logger?.debug?.(`[xhh] BH3 wiki模板解析失败: ${title}`);
          }
        }
      }
      return parts;
    };

    let basic_info = content.basic_info || {};
    try {
      const ext = JSON.parse(content.ext || '{}');
      const filters = JSON.parse(ext.c_18?.filter?.text || '[]');
      for (const item of filters) {
        const [key, value] = item.split('/');
        if (key && value) basic_info[key] = basic_info[key] ? `${basic_info[key]}、${value}` : value;
      }
    } catch (_) {}

    const parts = parseTmplParts();
    const basicPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'basicIntroduction')?.data || {};
    const equipPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'equipmentRecommendation')?.data || {};
    const skillPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'skill')?.data || {};
    const advanceGeneralPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'advanceGeneral')?.data || {};
    const advanceDataPart = parts.find(p => p?.tmplKey === 'valkyrie' && p?.partKey === 'advanceData')?.data || {};

    const introFields = [];
    for (const item of basicPart.mainFields || []) {
      uniquePush(introFields, { key: item.nameL, value: item.valueL });
      uniquePush(introFields, { key: item.nameR, value: item.valueR });
      if (item.nameL && item.valueL && !basic_info[item.nameL]) basic_info[item.nameL] = item.valueL;
      if (item.nameR && item.valueR && !basic_info[item.nameR]) basic_info[item.nameR] = item.valueR;
    }
    const subFields = (basicPart.subFields || [])
      .map(item => ({ key: item.name, value: shortText(item.value, 120) }))
      .filter(item => item.key && item.value);

    const element = basic_info['属性'] || basic_info['角色属性'] || '未知';
    const character_name = basic_info['角色'] || '';
    const rarity = basic_info['初始阶级'] || 'S';
    const type = basic_info['装甲特性'] || basic_info['角色定位'] || '未知';

    const element_icon_map = {
      '物理': 'bh3_物理.svg',
      '火': 'bh3_火.svg',
      '火焰': 'bh3_火.svg',
      '火伤': 'bh3_火.svg',
      '冰': 'bh3_冰.svg',
      '冰冻': 'bh3_冰.svg',
      '冰伤': 'bh3_冰.svg',
      '雷': 'bh3_雷.svg',
      '雷电': 'bh3_雷.svg',
      '雷伤': 'bh3_雷.svg',
      '生物': 'bh3_生物.svg',
      '量子': 'bh3_量子.svg',
      '虚数': 'bh3_虚数.svg',
      '异能': 'bh3_异能.svg',
      '机械': 'bh3_机械.svg',
      '星尘': 'bh3_星尘.svg',
      '星辰': 'bh3_星尘.svg',
      '星尘属性': 'bh3_星尘.svg',
      '星辰属性': 'bh3_星尘.svg',
      '界域共鸣': '星环特性.svg',
      '星影偕行': '星环特性.svg',
      '复盈相生': '星环特性.svg',
      '星之环特性': '星环特性.svg',
      '天衍之杯': '星环分野.svg',
      '星之环分野': '星环分野.svg',
      '角色定位': '定位.svg',
      '输出': '定位.svg',
      '辅助': '定位.svg'
    };

    const img = (basicPart.avatar || icon || '').startsWith('http') ? (basicPart.avatar || icon) : `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${basicPart.avatar || icon}`;
    const element_icon = element_icon_map[element] || (String(element).includes('星') ? 'bh3_星尘.svg' : 'bh3_物理.svg');
    const getAttrIcon = (key = '', value = '') => {
      const text = `${key} ${value}`;
      for (const [k, icon] of Object.entries(element_icon_map)) {
        if (text.includes(k)) return icon;
      }
      if (text.includes('星')) return 'bh3_星尘.svg';
      return '';
    };

    for (const item of introFields) item.icon = getAttrIcon(item.key, item.value);
    for (const item of subFields) item.icon = getAttrIcon(item.key, item.value);

    const attr = Object.entries(basic_info)
      .filter(([key, value]) => key && value)
      .map(([key, value]) => ({ key, value, icon: getAttrIcon(key, value) }));

    const hexagon = (basicPart.hexagon || []).map(item => ({
      key: item.key,
      value: Number(item.value || 0),
      level: item.level || ''
    })).filter(item => item.key);

    const equipment = (equipPart.equipment || []).slice(0, 3).map(group => ({
      name: group.name_ || group.name || '推荐装备',
      equips: (group.equips || []).slice(0, 4).map(eq => ({
        title: eq.title || eq.name || '',
        icon: eq.icon || ''
      })).filter(eq => eq.title || eq.icon),
      attackPoint: group.attackPoint,
      functionPoint: group.functionPoint,
      matchingDegree: group.matchingDegree,
      reason: shortText(group.reason, 110)
    })).filter(group => group.equips.length || group.reason);

    const skills = (skillPart.items || []).slice(0, 6).map(item => {
      const first = (item.list || []).find(v => v?.desc || v?.name) || {};
      return {
        name: item.name_ || item.name || first.name || '技能',
        icon: item.img || first.icon || '',
        desc: first.name ? `${first.name}：${shortText(first.desc, 96)}` : shortText(first.desc || item.desc, 96)
      };
    }).filter(item => item.name || item.desc);

    const advance = (advanceGeneralPart.advanceGeneral || []).map(item => {
      const cost = String(item.cost || '').trim();
      return {
        icon: item.icon || '',
        cost,
        costLabel: /^[ABSSS]+$/i.test(cost) ? `晋升至 ${cost}` : `消耗 ${cost || '-'}`,
        desc: shortText(String(item.desc || '').replace(/提高高/g, '提高'), 78)
      };
    }).filter(item => item.desc || item.icon);

    const maxRankData = (advanceDataPart.advanceData || []).slice(-1)[0] || {};
    const maxStats = [
      { key: '生命', value: maxRankData.life },
      { key: '能量', value: maxRankData.energy },
      { key: '攻击', value: maxRankData.attack },
      { key: '防御', value: maxRankData.defense },
      { key: '会心', value: maxRankData.understanding }
    ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');

    data = {
      name: title,
      star: rarity === 'S' ? 5 : 4,
      attribute: element,
      specialty: type,
      specialty_icon: getAttrIcon('装甲特性', type),
      character: character_name,
      summary: content.summary || '',
      img,
      attr,
      introFields,
      subFields,
      hexagon,
      equipment,
      skills,
      advance,
      maxStats,
      attr_icon: element_icon,
      material: []
    };
    return render('wiki/bh3_role', data, { e, ret: true });
  }

  // 崩坏3武器
  async bh3_wq_pictures(e, data, roleName = '') {
    if (!data || !data.content) {
      globalThis.logger?.debug?.('[xhh] BH3武器详情数据为空');
      await e.reply(`未获取到武器详情，请稍后重试。`);
      return false;
    }
    const content = data.content;
    const title = content.title || '未知武器';

    const decodeHtml = (text = '') => String(text || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const stripHtml = (text = '') => decodeHtml(text)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    const absImg = (url = '') => {
      if (!url) return '';
      if (/^https?:/i.test(url)) return url;
      if (url.startsWith('//')) return `https:${url}`;
      return `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${url}`;
    };
    const cleanRich = (html = '') => decodeHtml(html)
      .replace(/<span[^>]*data-type="详情"[\s\S]*?<\/span>/g, '')
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
      .replace(/<table[\s\S]*?<\/table>/g, m => m.length > 1600 ? '' : m)
      .replace(/style="[^"]*"/g, '')
      .replace(/class="[^"]*"/g, '')
      .replace(/<p>\s*<\/p>/g, '')
      .trim();
    const parseTmplParts = () => {
      const parts = [];
      for (const section of content.contents || []) {
        const text = String(section.text || '');
        for (const match of text.matchAll(/data-data="([^"]+)"/g)) {
          try {
            const arr = JSON.parse(decodeURIComponent(match[1]));
            if (Array.isArray(arr)) parts.push(...arr);
          } catch (err) {
            globalThis.logger?.debug?.(`[xhh] BH3武器模板解析失败: ${title} ${err?.message || err}`);
          }
        }
      }
      return parts;
    };

    const parts = parseTmplParts();
    const weaponPart = parts.find(p => p?.tmplKey === 'weapon');
    const info = weaponPart?.data || {};
    const skillData = parts.find(p => p?.tmplKey === 'weapon' && p?.partKey === 'skill')?.data || {};
    const forgingData = parts.find(p => p?.tmplKey === 'weapon' && p?.partKey === 'forging')?.data || {};
    const materialData = parts.find(p => p?.partKey === 'material')?.data || {};

    let type = '未知';
    let star = info.starValue || 5;
    try {
      const ext = JSON.parse(content.ext || '{}');
      const filters = JSON.parse(ext.c_20?.filter?.text || ext.filter?.text || '[]');
      for (const item of filters) {
        if (String(item).includes('武器类型/')) type = String(item).replace('武器类型/', '');
        if (String(item).includes('武器星级/')) {
          const v = String(item).replace('武器星级/', '');
          if (/超限/.test(v)) star = 6;
          else if (/\d/.test(v)) star = v.match(/\d+/)?.[0] || star;
        }
      }
    } catch (_) {}

    let attr = Array.isArray(info.attr) ? info.attr.map(a => ({ key: a.key, value: stripHtml(a.value) })).filter(a => a.key && a.value) : [];
    if (type !== '未知' && !attr.some(a => a.key === '武器类型')) attr.unshift({ key: '武器类型', value: type });
    if (star && !attr.some(a => a.key === '星级')) attr.unshift({ key: '星级', value: `${star}星` });
    const atk = attr.find(a => /攻击|攻击力/.test(a.key))?.value || (attr.length > 0 ? '-' : '未知');
    const sub = attr.find(a => !/攻击|武器类型|星级/.test(a.key)) || { key: '副属性', value: attr.length > 0 ? '-' : '未知' };

    const skillRows = [
      ...(Array.isArray(skillData.attr) ? skillData.attr : [])
    ].filter(v => v?.key || v?.name);
    let richText = skillRows.map(s => {
      const key = s.key || s.name || '技能';
      const value = cleanRich(s.value || s.desc || '');
      return `<div class="bh3-skill"><h3>${key}</h3><div>${value || '-'}</div></div>`;
    }).join('');
    if (!richText && info.desc) {
      richText = `<div class="bh3-skill"><h3>武器介绍</h3><div>${cleanRich(info.desc)}</div></div>`;
    } else if (info.desc) {
      richText = `<div class="bh3-skill intro"><h3>武器介绍</h3><div>${cleanRich(info.desc)}</div></div>` + richText;
    }
    if (!richText && content.summary) {
      richText = `<div class="bh3-skill"><h3>武器介绍</h3><div>${content.summary}</div></div>`;
    }

    const materialSource = []
      .concat(forgingData.materials || forgingData.attr || [])
      .concat(materialData.materials || materialData.attr || []);
    const materials = materialSource.map(m => ({
      name: stripHtml(m.name || m.key || m.title || m.text || ''),
      icon: absImg(m.icon || m.img || ''),
      count: m.count || m.num || m.value || ''
    })).filter(m => m.name || m.icon);

    let week = 'Wiki收录';
    for (const gm of info.gainMethods || []) {
      if (gm.key === '获取途径' && gm.value) week = stripHtml(gm.value);
    }

    const img = absImg(info.icon || content.icon);
    const view = {
      name: title,
      type,
      star: `${star || 5}星`,
      img,
      rich_text: richText || '<p>暂无武器技能详情，请稍后刷新 Wiki 数据。</p>',
      attr,
      materials,
      atk,
      attr_: { key: sub.key || '副属性', value: sub.value || '未知' },
      week,
      roleName
    };
    return render('wiki/bh3_wq', view, { e, ret: true });
  }

  // 崩坏3圣痕
  async bh3_syw_pictures(e, data, roleName = '') {
    if (!data || !data.content) {
      globalThis.logger?.debug?.('[xhh] BH3圣痕详情数据为空');
      await e.reply('未获取到圣痕详情，请稍后重试或使用完整圣痕名称查询。');
      return false;
    }

    const stripHtml = (text = '') => String(text || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    const parseContent = (cnt) => {
      const parts = [];
      for (const section of cnt.contents || []) {
        for (const match of String(section.text || '').matchAll(/data-data="([^"]+)"/g)) {
          try {
            const arr = JSON.parse(decodeURIComponent(match[1]));
            if (Array.isArray(arr)) parts.push(...arr);
          } catch (_) {}
        }
      }
      return {
        main: parts.find(p => p?.tmplKey === 'stigmata' && p?.partKey === 'main')?.data || {},
        role: parts.find(p => p?.tmplKey === 'stigmata' && p?.partKey === 'role')?.data || {},
        basic: parts.find(p => p?.tmplKey === 'stigmata' && p?.partKey === 'basicAttr')?.data || {},
        equip: parts.find(p => p?.tmplKey === 'stigmata' && p?.partKey === 'equipmentRecommendation')?.data || {}
      };
    };

    const absImg = (url = '') => {
      if (!url) return '';
      if (/^https?:/i.test(url)) return url;
      if (url.startsWith('//')) return `https:${url}`;
      return `https://api-takumi-static.mihoyo.com/hoyowiki/bh3_wiki${url}`;
    };

    const extractId = (url = '') => {
      const m = url.match(/\/content\/(\d+)\/detail/);
      return m ? m[1] : null;
    };

    const buildPiece = (cnt) => {
      const parsed = parseContent(cnt);
      const pos = (parsed.main.subFields || []).find(s => s.name === '位置')?.value || '';
      const skillList = (parsed.role.attr || []).map(a => stripHtml(a.value || '')).filter(Boolean);
      const attrList = Array.isArray(parsed.basic.attr) ? parsed.basic.attr.map(a => ({ key: a.key, value: String(a.value ?? '') })) : [];
      const comment = stripHtml(parsed.basic.comment || '');
      return {
        name: cnt.title || '未知',
        position: pos,
        icon: absImg(parsed.main.avatar || cnt.icon),
        skill: skillList.join('\n') || '无',
        attr: attrList,
        comment
      };
    };

    const firstContent = data.content;
    const firstParsed = parseContent(firstContent);
    const firstMain = firstParsed.main;
    const setInfo = (firstMain.subFields || []).find(s => s.name === '所属套装');
    const setName = setInfo?.value || '';
    const relatives = firstMain.relatives || [];
    const equipRec = firstParsed.equip;

    // Collect all piece content_ids: current + relatives
    const ids = [firstContent.id];
    for (const rel of relatives) {
      const rid = extractId(rel.url);
      if (rid && !ids.includes(rid)) ids.push(rid);
    }

    // Fetch all pieces in parallel
    const allData = await Promise.all(ids.map(id => mys.detail(id, false, false, true)));
    const pieces = allData.filter(Boolean).map(d => buildPiece(d.content || d));

    const setDesc = (equipRec.equipment || []).map(g => stripHtml(g.reason || '')).filter(Boolean).join('\n')
      || pieces.map(p => p.comment).filter(Boolean).join('\n')
      || pieces.map(p => p.skill).join('\n');

    data = {
      setName,
      pieces,
      setDesc: setDesc || '无',
      star: 5,
      roleName
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
