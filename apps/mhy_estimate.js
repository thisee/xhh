import fetch from 'node-fetch';
import { makeForwardMsg } from '#xhh';

const SEARCH_API = 'https://bbs-api.miyoushe.com/painter/api/user_instant/search/list';

function pickGame(msg) {
  if (/原神|原石|gs/i.test(msg)) return 'gs';
  if (/星铁|星琼|sr/i.test(msg)) return 'sr';
  if (/绝区零|绝区|菲林|邦布券|邦布|zzz/i.test(msg)) return 'zzz';
  if (/崩坏三|崩三|水晶|bbb|bh3|！|前瞻/i.test(msg)) return 'bh3';
  if (/超弦|超炫|深渊/i.test(msg)) return 'abyss';
  if (/战场|记忆战场/i.test(msg)) return 'battlefield';
  if (/乐土|往世乐土/i.test(msg)) return 'godwar';
  if (/强袭|强袭战/i.test(msg)) return 'assault';
  return 'gs';
}

const presets = {
  gs: {
    name: '原神', tip: '原石统计获取中，请稍后...', none: '原神资源统计',
    custom: ['https://gitee.com/mingdiandianzhu/miaoresources/raw/master/predict/gs.jpg', '图片内作者'],
    args: [['原石资源统计', 285802042, [1], 'HoYo青枫']],
  },
  sr: {
    name: '崩坏：星穹铁道', tip: '星琼统计获取中，请稍后...', none: '星铁资源统计',
    custom: ['https://gitee.com/mingdiandianzhu/miaoresources/raw/master/predict/sr.jpg', '图片内作者'],
    args: [['星琼统计汇总', 137101761, [3], '祈鸢ya'], ['星琼资源统计', 285802042, [1], 'HoYo青枫']],
  },
  zzz: {
    name: '绝区零', tip: '菲林统计获取中，请稍后...', none: '绝区零资源统计',
    args: [['版本菲林汇总', 74642625, [0,1,2,3,4,5], '冰是真的菜QAQ'], ['菲林资源统计', 285802042, [0,1,2,3,4,5], 'HoYo青枫']],
  },
  bh3: {
    name: '崩坏3', tip: '水晶统计获取中，请稍后...', none: '崩坏3水晶统计',
    args: [['水晶统计', 80216695, [0,1], '五香麻辣小兔头']],
  },
  abyss: {
    name: '超弦空间', tip: '深渊攻略/速报获取中，请稍后...', none: '深渊攻略',
    args: [['寂灭', 11956740, [0,1,3,4,5,6,7,8,9,10,11,12,13,14,15], '残月'], ['红莲', 11956740, [0,1,3,4,5,6,7,8,9,10,11,12,13,14,15], '残月'], ['红莲', 15491760, [0,1,3,4,5,6,7,8,9,10,11,12,13,14,15], '墨之羽'], ['红莲', 30269990, [0,1,3,4,5,6,7,8,9,10,11,12,13,14,15], '朔守']],
  },
  battlefield: {
    name: '记忆战场', tip: '战场攻略/阵容速报获取中，请稍后...', none: '记忆战场攻略',
    args: [['记忆战场', 11956740, [0,1,2,3,4,5,6,7,8,9], '残月'], ['战场作业', 15491760, [0,1,2,3,4,5,6,7,8,9], '墨之羽'], ['终极区战场', 30269990, [0,1,2,3,4,5,6,7,8,9], '朔守']],
  },
  godwar: {
    name: '往世乐土', tip: '乐土攻略获取中，请稍后...', none: '往世乐土攻略',
    args: [['往世乐土', 11956740, [0,1,2,3,4,5,6,7,8,9], '残月'], ['乐土攻略', 15491760, [0,1,2,3,4,5,6,7,8,9], '墨之羽'], ['乐土因子', 30269990, [0,1,2,3,4,5,6,7,8,9], '朔守']],
  },
  assault: {
    name: '强袭战', tip: '强袭战速报获取中，请稍后...', none: '强袭战攻略',
    args: [['强袭战', 4068738, [0,1,3,4,5], '洗礼酱']],
  },
};

async function searchPost(keyword, uid, size = 20) {
  const url = `${SEARCH_API}?keyword=${encodeURIComponent(keyword)}&uid=${encodeURIComponent(uid)}&size=${size}&offset=0&sort_type=2`;
  const res = await fetch(url).then(r => r.json());
  return res?.data?.list?.[0]?.post?.post;
}

export class mhy_estimate extends plugin {
  constructor() {
    super({
      name: '[小花火]米游社资源预估与攻略取图',
      dsc: '原石/星琼/菲林/水晶预估，崩三深渊战场乐土攻略取图',
      event: 'message',
      priority: -Infinity,
      rule: [
        { reg: '^#?((原神|原石|gs)|(星铁|星琼|sr)|(崩坏三|崩三|水晶|bbb|bh3|！)|(绝区零|绝区|菲林|邦布券|邦布|zzz)|(超弦空间|超炫空间|深渊)|(战场|记忆战场)|(乐土|往世乐土)|(强袭|强袭战))?(前瞻信息|速报|预估|盘点|攻略)$', fnc: 'mysEstimate' },
        { reg: '^#?(崩三|崩坏3|崩坏三|BH3)(深渊|超弦|超弦空间|战场|记忆战场|乐土|往世乐土)(攻略|速报|作业)$', fnc: 'bh3Guide' },
      ],
    });
  }

  async bh3Guide(e) {
    return this.mysEstimate(e);
  }

  async mysEstimate(e) {
    const key = pickGame(e.msg || '');
    const cfg = presets[key] || presets.gs;
    await e.reply(cfg.tip, true);

    const msg = [];
    if (cfg.custom?.[0]) msg.push([`作者：${cfg.custom[1] || '自定义图片源'}`, segment.image(cfg.custom[0])]);

    for (const [keyword, uid, indexes, author] of cfg.args) {
      try {
        const post = await searchPost(keyword, uid);
        const images = post?.images || [];
        const imageSegments = indexes.filter(i => images[i]).slice(0, 12).map(i => segment.image(images[i]));
        if (imageSegments.length) msg.push([`作者：${author}\n${post.subject || keyword}`, ...imageSegments]);
      } catch (err) {
        logger.warn(`[xhh][estimate] 获取 ${keyword}/${uid} 失败: ${err?.message || err}`);
      }
    }

    if (!msg.length) return e.reply(`未找到${cfg.none || cfg.name}相关图片，请稍后再试！`, true);
    return e.reply(await makeForwardMsg(e, msg, `${cfg.name}来啦~\n如果出现图片错误，请忽略`));
  }
}
