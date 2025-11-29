import fetch from 'node-fetch';
import common from '../../../lib/common/common.js';
import lodash from 'lodash';
import { yaml, makeForwardMsg, sleep } from '#xhh';
const name_list = {
  gs: '原神',
  sr: '崩铁',
  zzz: '绝区零',
  bh3: '崩坏3',
  by: '崩缘',
  xbgd: '星布谷地'
}
//手动触发，只回复当前聊天
export class video extends plugin {
  constructor(e) {
    super({
      name: '[小花火]米哈游最新视频',
      dsc: '',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '#最新视频$',
          fnc: 'video',
        },
      ],
    });
    this.task = {
      cron: '30 0/3 * * * ? ',
      name: '[小花火]米哈游视频',
      fnc: () => vid(),
      log: false,
    };
  }

  async video(e) {
    await redis.del('xhh_vid:gs');
    await redis.del('xhh_vid:sr');
    await redis.del('xhh_vid:zzz');
    if (getother().bh3) await redis.del('xhh_vid:bh3');
    if (getother().by) await redis.del('xhh_vid:by');
    if (getother().xbgd) await redis.del('xhh_vid:xbgd');
    vid(e);
  }
}

async function vid(e) {
  let groups = (await yaml.get('./plugins/xhh/config/config.yaml')).groups;
  if (!groups.length && !e?.reply) return true;
  //原神，星铁，绝区零
  let urls = {
    gs: 75276539,
    sr: 288909600,
    zzz: 152039148,
  };
  //崩三？？？
  if (getother().bh3) urls.bh3 = 73565430;
  //崩缘？？？
  if (getother().by) urls.by = 448340772;
  //崩缘？？？
  if (getother().xbgd) urls.xbgd = 378227988;
  //啊～量有点多
  let list,
    p,
    size,
    time = 1,
    subject,
    content,
    img,
    vid_url,
    res,
    vod_list,
    url,
    name,
    ti,
    msgs = [],
    msgs_indexs = {},
    names = '',
    path;
  //遍历游戏官号
  for (let i in urls) {
    let msg;
    //游戏名字
    name = name_list[i];
    url = 'https://bbs-api.miyoushe.com/post/wapi/userPost?size=20&uid=' + urls[i];
    res = await fetch(url).then(res => res.json());
    list = res.data.list;
    ti = await redis.get(`xhh_vid:${i}`);
    //遍历最新发的20个帖子
    for (let n in list) {
      vod_list = list[n].vod_list[0]?.resolutions;
      //发布是否为视频
      if (vod_list) {
        if (!ti) {
          await redis.set(`xhh_vid:${i}`, time);
          logger.info(`初始化${name}最新视频记录`);
          ti = 1;
        }
        //发布时间戳10位
        time = list[n].post.created_at;
        if (ti >= time) break;
        await redis.set(`xhh_vid:${i}`, time);
        //地址
        vid_url = vod_list[vod_list.length - 1].url;
        //画质
        p = vod_list[vod_list.length - 1].label;
        //大小
        size = '约' + Math.ceil(Number(vod_list[vod_list.length - 1].size) / 1024 / 1024) + 'MB';

        // 转换时间戳为年月日时分秒
        const date = new Date(time * 1000);
        // const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 月份加1后补0
        const day = date.getDate().toString().padStart(2, '0'); // 日期补0
        const hours = date.getHours().toString().padStart(2, '0'); // 小时补0
        const minutes = date.getMinutes().toString().padStart(2, '0'); // 分钟补0
        // const seconds = date.getSeconds().toString().padStart(2, '0') // 秒补0
        // 拼接成年月日时分秒
        time = `${month}月${day}号 ${hours}:${minutes}`;

        //标题
        subject = list[n].post.subject;

        //文本内容
        const content_list = JSON.parse(list[n].post.structured_content);
        content = content_list
          .map(item => {
            if (typeof item.insert == 'string') return item.insert;
          })
          .join('');

        // content=JSON.parse(list[n].post.structured_content)[0].insert

        //封面
        img = list[n].post.cover;
        //QQ不支持直接发https://upload-bbs.miyoushe.com/
        if (img.includes('https://upload-bbs.miyoushe.com/')) {
          path = `./plugins/xhh/temp/${name}视频封面.jpg`;
          //封面图是否原图
          if (getother().cover) await common.downFile(img, path);
          else
            await common.downFile(
              img + '?x-oss-process=image//resize,p_30',
              path
            );
        }
        img = segment.image(path);
        //我们合体(˃ ⌑ ˂
        msg = [
          `游戏：${name}\n\n`,
          `标题：${subject}\n\n`,
          `发布时间：${time}\n\n`,
          `画质大小：${p}  ${size}\n\n`,
          `封面：\n`,
          img,
          `\n\n视频链接(点击即可观看)：\n${vid_url}`,
        ];
        //处理内容过长
        msgs_indexs[i] = []
        if (content.length < 600) {
          msg.push(`\n文本内容：\n${content}`);
          msgs.push(msg);
          msgs_indexs[i].push(msgs.length - 1)
        } else {
          msgs.push(msg);
          msgs_indexs[i].push(msgs.length - 1)
          msgs.push([`${name}文本内容：\n${content}`]);
          msgs_indexs[i].push(msgs.length - 1)
        }
        names = names + name + ' ';
        break;
      } else {
        continue;
      }
    }
  }

  if (!msgs.length) return;

  //主动触发，直接处理群号屏蔽设置
  if (e?.isGroup) {
    const obj = MsgsByGroupConfig(names, e.group_id, msgs, msgs_indexs)
    if (!obj.msgs.length) return;
    msgs = obj.msgs
    names = obj.dec
  }

  //不制作合并转发消息
  if (!getother().forwardMsg) {
    if (e?.reply) {
      for (const text of msgs) {
        await e.reply(text);
        await sleep(200);
      }
    } else {
      for (let group of groups) {
        const obj = MsgsByGroupConfig(names, group, msgs, msgs_indexs)
        const _msgs = obj.msgs
        if (!_msgs.length) continue;
        for (const text of _msgs) {
          Bot.pickGroup(group).sendMsg(text);
          await sleep(200);
        }
        //多个群，随机延迟10~20秒发送
        await sleep(lodash.random(10000, 20000));
      }
    }
    return true;
  }

  //制作合并转发消息
  const dec = `${names}发布了新视频，一起来看看吧！`;
  let msg
  if (e?.reply) {
    msg = await makeForwardMsg('', msgs, dec, e.group_id);
    e.reply(msg);
  } else {
    for (let group of groups) {
      const obj= MsgsByGroupConfig(dec, group, msgs, msgs_indexs)
      if (!obj.msgs.length) continue
      msg = await makeForwardMsg('', obj.msgs, obj.dec, group);
      Bot.pickGroup(group).sendMsg(msg);
      //多个群，随机延迟10~20秒发送
      await sleep(lodash.random(10000, 20000));
    }
  }
  return true;
}

function getother() {
  return yaml.get('./plugins/xhh/config/other.yaml');
}



//处理消息数组，通过群号屏蔽设置，删掉对应的游戏消息，返回新的消息数组和新的合并消息描述
function MsgsByGroupConfig(dec, group, msgs, msgs_indexs) {
  //获取群号屏蔽设置
  const group_config = getother().group_config
  //获取该群的屏蔽游戏列表
  const games = group_config[group]
  if (!games) return { msgs, dec }
  let indexArray = []
  for (const game of games) {
    if (msgs_indexs[game]) {
      indexArray = indexArray.concat(msgs_indexs[game])
      dec = dec.replace(name_list[game] + ' ', '')
    }
  }
  msgs = removeElementsByIndex(msgs, indexArray)
  return { msgs, dec }
}




/**
 * 根据下标数组删除原数组中的对应元素
 * @param {Array} sourceArray - 原始数组
 * @param {Array} indexArray - 要删除的下标数组
 * @returns {Array} 删除元素后的新数组
 */
function removeElementsByIndex(sourceArray, indexArray) {

  // 将下标数组按降序排序，确保删除顺序正确
  const sortedIndexes = [...indexArray].sort((a, b) => b - a);

  // 从后往前删除，避免索引错乱
  for (const index of sortedIndexes) {
    // 检查下标是否有效
    if (index >= 0 && index < sourceArray.length) {
      sourceArray.splice(index, 1);
    }
  }
  return sourceArray;
}