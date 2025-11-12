import fetch from 'node-fetch';
import common from '../../../lib/common/common.js';
import lodash from 'lodash';
import { yaml, makeForwardMsg, sleep } from '#xhh';

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
    names = '',
    path;
  //遍历游戏官号
  for (let i in urls) {
    let msg;
    //游戏名字
    name =
      i == 'gs'
        ? '原神'
        : i == 'sr'
          ? '崩坏星穹铁道'
          : i == 'zzz'
            ? '绝区零'
            : i == 'bh3'
              ? '崩坏3'
              : i == 'by'
                ? '崩坏因缘精灵' : '星布谷地';
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
        size =
          '约' +
          Math.ceil(Number(vod_list[vod_list.length - 1].size) / 1024 / 1024) +
          'MB';

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
        if (content.length < 600) {
          msg.push(`\n文本内容：\n${content}`);
          msgs.push(msg);
        } else {
          msgs.push(msg);
          msgs.push([`${name}文本内容：\n${content}`]);
        }
        names = names + name + ' ';
        break;
      } else {
        continue;
      }
    }
  }

  if (!msgs.length) return;

  //不制作合并转发消息
  if (!getother().forwardMsg) {
    if (e?.reply) {
      for (const text of msgs) {
        await e.reply(text);
        await sleep(200);
      }
    } else {
      for (let group of groups) {
        for (const text of msgs) {
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
  let msg = await makeForwardMsg('', msgs, dec);
  if (e?.reply) {
    e.reply(msg);
    return true;
  } else {
    for (let group of groups) {
      Bot.pickGroup(group).sendMsg(msg);
      //多个群，随机延迟10~20秒发送
      await sleep(lodash.random(10000, 20000));
    }
  }
}

function getother() {
  return yaml.get('./plugins/xhh/config/other.yaml');
}
