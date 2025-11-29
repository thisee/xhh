import { yaml, makeForwardMsg } from '#xhh';

let xx = '小花火设置';
let path = './plugins/xhh/config/config.yaml';
export class config extends plugin {
  constructor() {
    super({
      name: '[小花火]配置',
      dsc: '',
      event: 'message',
      priority: 15,
      rule: [
        {
          reg: `^#*${xx}$`,
          fnc: 'f1',
          permission: 'master',
        },
        {
          reg: `^#*${xx}(塔罗牌|自动更新|自动视频|星铁攻略(图)?|b站|B站|哔哩哔哩|bili|bilibili)?(开启|关闭)((查)?委托前缀)?$`,
          fnc: 'f2',
          permission: 'master',
        },
        {
          reg: `^#*${xx}((塔罗牌(每日)?次数)|((图片)?渲染(精度)?))(\\d+)$`,
          fnc: 'f3',
          permission: 'master',
        },
        {
          reg: `^#*(小花火)?(设置)?(添加|删除)播报群(号)?(.*)$`,
          fnc: 'f6',
          permission: 'master',
        },
      ],
    });
  }
  async f1(e) {
    this.sz(e);
  }

  async f2(e) {
    const CLEAN_REGEX = /#|小花火|设置/g;
    const TYPE_MAP = {
      塔罗牌: 'tlp',
      星铁攻略: 'srstrategy',
      委托前缀: 'wt',
      'b站|B站|哔哩哔哩|bili|bilibili': 'bilibili',
      自动更新: 'update',
      自动视频: 'dow',
    };

    const type = e.msg.replace(CLEAN_REGEX, '');
    let key;

    for (const [pattern, value] of Object.entries(TYPE_MAP)) {
      if (new RegExp(pattern).test(type)) {
        key = value;
        break;
      }
    }

    if (!key) return false;

    const isEnable = e.msg.includes('开');
    await yaml.set(path, key, isEnable);
    this.sz(e);
  }

  async f3(e) {
    let num = e.msg.replace(
      /#|小花火设置|渲染|精度|图片|塔罗牌|次数|每日/g,
      ''
    );
    if (e.msg.includes('塔罗牌')) await yaml.set(path, 'tlpcs', Number(num));
    else if (e.msg.includes('渲染'))
      await yaml.set(path, 'img_quality', Number(num));
    this.sz(e);
  }

  async f6(e) {
    let group_id = await /\d+/.exec(e.msg);
    if (!group_id) {
      if (!e.isGroup) return e.reply('不是，你的群号呢？');
      group_id = e.group_id;
    }
    group_id = Number(group_id);
    let groups = (await yaml.get(path)).groups;
    if (e.msg.includes('添加')) {
      try {
        if (!Bot.pickGroup(group_id, true))
          return e.reply(`o(´^｀)o我可不在这个群里\n${group_id}`);
      } catch (err) {
        e.reply(`o(´^｀)o我可不在这个群里\n${group_id}`);
        return false;
      }
      if (groups.includes(group_id))
        return e.reply('这个群已经在播报群列表中了哟~', true);
      await yaml.add(path, 'groups', group_id);
    } else {
      if (!groups.includes(group_id))
        return e.reply('这个群不在播报群列表中呀！！！', true);
      await yaml.del(path, 'groups', group_id);
    }
    this.sz(e);
  }

  // async f8(e){
  // let cd=await (/\d+/).exec(e.msg)
  // await yaml.set(path,'mbCD',Number(cd))
  // this.sz(e)
  // }

  async sz(e) {
    let data = await yaml.get(path);
    let msg = [];
    msg.push(
      [
        '--------小花火设置状态--------',
        `塔罗牌：${data.tlp ? '已开启' : '已关闭'}`,
        `塔罗牌每日次数：${data.tlpcs}次`,
        `星铁攻略：${data.srstrategy ? '已开启' : '已关闭'}`,
        `查委托必须带#前缀：${data.wt ? '已开启' : '已关闭'}`,
        `b站相关功能：${data.bilibili ? '已开启' : '已关闭'}`,
        `b站视频小于30MB自动下载：${data.dow ? '已开启' : '已关闭'}`,
        `凌晨3:30自动更新xhh：${data.update ? '已开启' : '已关闭'}`,
        `图片渲染精度：${data.img_quality}%`,
        '米哈游视频播报群号：\n',
      ].join('\n')
    );
    for (let group of data.groups) {
      try {
        Bot.pickGroup(group, true);
      } catch (err) {
        await yaml.del(path, 'groups', group);
        logger.info(`检测到群号${group}已失效，已经自动删除`);
        continue;
      }
      let gname =
        Bot.pickGroup(group, true).info?.group_name ||
        Bot.pickGroup(group, true).group_name ||
        Bot.pickGroup(group, true).name;
      if (gname == undefined) {
        await yaml.del(path, 'groups', group);
        logger.info(`检测到群号${group}已失效，已经自动删除`);
        continue;
      }
      msg.push(
        segment.image(`https://p.qlogo.cn/gh/${group}/${group}/100`),
        '\n',
        gname,
        group.toString()
      );
    }
    let msg_ = [
      '--------设置指令列表--------',
      '1.塔罗牌：',
      '小花火设置塔罗牌开启',
      '小花火设置塔罗牌关闭\n',

      '2.塔罗牌每日次数：',
      '小花火设置塔罗牌次数(+数字)\n',

      '3.星铁攻略：',
      '小花火设置星铁攻略开启',
      '小花火设置星铁攻略关闭\n',

      '4.查委托是否必须带#前缀：',
      '开启委托前缀',
      '关闭委托前缀\n',

      '5.b站相关功能：',
      '小花火设置b站开启',
      '小花火设置b站关闭\n',

      '6.b站视频小于30MB自动下载：',
      '小花火设置自动视频开启',
      '小花火设置自动视频关闭\n',

      '7.小花火自动更新：',
      '小花火设置自动更新开启',
      '小花火设置自动更新关闭\n',

      '8.图片渲染精度：',
      '小花火设置渲染(+数字)\n',

      '9.米哈游视频播报群号：',
      '添加播报群(+群号)',
      '删除播报群(+群号)\n',

      '更多设置请查看xhh/config/config.yaml文件',
    ].join('\n');
    msg = [msg, msg_];
    msg = await makeForwardMsg(e, msg, '小花火设置');
    return e.reply(msg);
  }
}
