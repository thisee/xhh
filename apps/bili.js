import fs from 'fs'
import { bili, config } from '#xhh'
import fetch from "node-fetch"


export class bilibili extends plugin {
  constructor(e) {
    super({
      name: '[小花火]bili',
      dsc: '',
      event: 'message',
      priority: -120,
      rule: [
        {
          reg: '^#*(小花火)?清(空|除)(b站|B站|哔哩哔哩|bili|bilibili)缓存$',
          fnc: 'ggg',
          permission: 'master',
        },
        {
          reg: '^#*(小花火)?(强制刷新|刷新|删除)(b站|B站|哔哩哔哩|bili|bilibili)ck$',
          fnc: 'sx',
        }, {
          reg: '^#*(小花火)?(查看)*(我的)*(b站|B站|哔哩哔哩|bili|bilibili)账号$',
          fnc: 'zh',
        }, {
          reg: '^#*(小花火)?(b站|B站|哔哩哔哩|bili|bilibili)(扫码)?登(录|路|陆)$',
          fnc: 'sm',
        }, {
          reg: '',
          fnc: 'b',
          log: false
        }
      ]
    })
    this.task = {
      cron: "0 0 4 * * *", //Cron表达式，(秒 分 时 日 月 星期)
      name: "[小花火]清空bilibili缓存",
      fnc: () => this.ggg(),
    }
  }

  sm(e) {
    if (!this.Check() || !e.isMaster) return false
    return bili.sm(e)
  }

  zh(e) {
    if (!this.Check() || !e.isMaster) return false
    return bili.zhanghao(e)
  }


  async b(e) {
    if (!e.msg || !this.Check()) return false
    let msg, url, data, res, bv, user_id, id, dt_id, pl_id, pl_type
    //卡片分享
    if (e.raw_message == '[json消息]' || e.message[0]?.type == 'json') {
      id = await this.json_bv(e.msg.replace(/当前QQ版本不支持此应用，请升级/g, ''), e)
      if (!id) return false
      if (id.bv) return bili.video(e, id.bv, false, true, true)
      if (id.dt_id) return bili.dt(id.dt_id, e)
    }

    //b23.tv链接
    if (e.raw_message.includes('https://b23.tv/')) {
      url = e.raw_message.match('https://b23.tv/([\\w]+)')
      url = url[0]
      id = await this.getbv(url)
      if (!id) return false
      if (id.bv) return bili.video(e, id.bv, false, true)
      if (id.dt_id) return bili.dt(id.dt_id, e)
    }

    //视频链接and动态链接
    if (handleBilibiliLink(e)) return true

    //引用回复
    if (!e.source) return false

    let source = e.isGroup ? (await e.group.getChatHistory(e.source?.seq, 1)).pop() : (await e.friend.getChatHistory(e.source?.time , 1)).pop()
    source.message_id=source.message_id.toString().replace(/\//g, '')
    // if (source.message.length!=1&&(source.message[0]?.type!='image'||source.message[0]?.type!='json'))  return false
    if (source.message[0]?.type != 'image' && source.message[0]?.type != 'json') return false

    if (source.message[0].type == 'image') {
      //展开评论区
      if (e.msg.includes('展开')) {
        let n = await (/\d+/).exec(e.msg)
        return bili.reply_(e, n, source.message_id)
      }

      if (['获取图片', '下载图片', '图片'].includes(e.msg)) return bili.tu(e, source.message_id)

      try {
        data = JSON.parse(fs.readFileSync(`./plugins/xhh/temp/bili/${source.message_id}.json`, 'utf-8'))
      } catch (err) {
        return false
      }
      bv = data.bv
      if (['下载封面', '封面下载', '获取封面', '封面'].includes(e.msg) && bv) return bili.fm(e, source.message_id)
      dt_id = data.dt_id
      pl_id = data.pl_id
      pl_type = data.pl_type
      user_id = data.up_id || data.uid
      if (!bv && !dt_id) return false

    } else if (source.message[0].type == 'json') {
      msg = source.message[0].data
      id = await this.json_bv(msg)
      if (!id) return false
      bv = id.bv
      dt_id = id.dt_id
      if (['下载封面', '封面下载', '获取封面', '封面'].includes(e.msg) && bv) return bili.fm(e, false, bv)
    }


    if (['下载视频', '视频下载', '获取视频'].includes(e.msg) && bv) return bili.Download(e, bv)

    if (['点赞', '赞', '取消点赞', '点赞取消', '取消赞', '赞取消'].includes(e.msg) && bv) return bili.dz(e, bv)
    //去(#)
    msg = e.msg.replace(/#|b站|B站|哔哩哔哩|bili|bilibili/g, '')

    if (['添加推送', '取消推送', '关闭推送', '开启推送', '删除推送'].includes(msg) && e.isGroup && bv) {
      //主人权限，群主权限，管理员权限，推送在当前群聊
      if (!e.member.is_admin && !e.member.is_owner && !e.isMaster) {
        return false
      }
      if (!user_id) user_id = (await bili.sp_( bv)).owner.mid
      return bili.tuis(e, user_id, e.group_id)
    }

    //获取简介
    if (e.msg == '简介' && bv) return bili.jj(e, source.message_id)

    //主动解析卡片(emmm...一般都自动解析了)
    if (['解析', '解'].includes(e.msg) && source.message[0].type == 'json') {
      if (bv) return bili.video(e, bv)
      if (dt_id) return bili.dt(id.dt_id, e)
    }

    //下面的全要主人权限
    if (!e.isMaster) return false

    if (['投币', '投币1', '投币2', '收藏', '取消收藏', '三连'].includes(e.msg) && bv) return bili.dz(e, bv)

    if (['关注', '取消关注', '拉黑', '取消拉黑'].includes(e.msg)) {
      if (!user_id) {
        if (bv) user_id = (await bili.sp_(bv)).owner.mid
        if (dt_id) user_id = await bili.dt_mid(dt_id)
      }
      if (!user_id) return false
      return bili.user(e, user_id, bv || dt_id, bv ? true : false)
    }

    if (e.msg.substring(0, 2) == '评论') {
      if (bv) return bili.bili_reply(e, bv)
      if (pl_id && pl_type && dt_id) return bili.bili_reply(e, pl_id, pl_type, dt_id)
      if (dt_id && !pl_id && !pl_type) {
        let pl = await bili.dt_mid(dt_id, true)
        if (!pl) return false
        pl_id = pl.pl_id
        pl_type = pl.pl_type
        return bili.bili_reply(e, pl_id, pl_type, dt_id)
      }
    }
    return false
  }


  /**
  * 根据提供的URL获取Bilibili视频的信息
  *
  * @param {string} url - 提供的Bilibili视频URL
  * @returns {Object} - 包含视频信息的对象，如果解析失败则返回false
  *   - {string} bv - 视频的BV号
  *   - {string} dt_id - 视频的AV号或OPUS号
  */
  async getbv(url) {
    let res = await fetch(url)
    if (res.status != 200) return false
    url = res.url
    //  logger.mark(url)
    let id = url.match('https://www.bilibili.com/opus/([\\w]+)') || url.match('https://t.bilibili.com/([\\w]+)')
    if (id) id = id[1]
    let bv = url.match('https://www.bilibili.com/video/([\\w]+)')
    if (bv) bv = bv[1]
    if (!id && !bv) return false
    return { bv: bv, dt_id: id }
  }


  async json_bv(msg, e) {
    try {
      msg = JSON.parse(msg)
    } catch (err) {
      msg = e.message[0].data
      msg = JSON.parse(msg)
    }
    const url = msg.meta?.detail_1?.qqdocurl || msg.meta?.news?.jumpUrl
    if (!url?.includes('b23.tv')) return false

    let id = await this.getbv(url)
    return id
  }

  //清空缓存
  async ggg(e) {
    if (!this.Check()) return false
    try {
      fs.rmSync('./plugins/xhh/temp/bili/', { recursive: true })
    } catch (err) {
      return false
    }
    if (e) return e.reply('已清空bilibili缓存')
  }

  sx(e) {
    if (!this.Check() || !e.isMaster) return false
    const isRefresh = e.msg.includes('刷新')
    const isForce = e.msg.includes('强制')
    return isRefresh ? bili.sx_ck(e, isForce) : bili.sc_ck(e)
  }

  /**
  * 检查
  *
  * @returns 返回从配置文件中读取的bilibili配置对象
  */
  Check() {
    const bilibili = config().bilibili
    return bilibili
  }



}

function handleBilibiliLink(e) {
  const urlPatterns = [
    { pattern: /https?:\/\/www\.bilibili\.com\/video\/([\w]+)/, handler: (bv, e) => bili.video(e, bv, false, true) },
    { pattern: /https?:\/\/m\.bilibili\.com\/video\/([\w]+)/, handler: (bv, e) => bili.video(e, bv, false, true) },
    { pattern: /https?:\/\/www\.bilibili\.com\/opus\/([\w]+)/, handler: (dt_id, e) => bili.dt(dt_id, e) },
    { pattern: /https?:\/\/m\.bilibili\.com\/opus\/([\w]+)/, handler: (dt_id, e) => bili.dt(dt_id, e) },
    { pattern: /https?:\/\/t\.bilibili\.com\/([\w]+)/, handler: (dt_id, e) => bili.dt(dt_id, e) }
  ];

  for (const { pattern, handler } of urlPatterns) {
    const match = e.raw_message.match(pattern);
    if (match) {
      const id = match[1];
      handler(id, e);
      return true;
    }
  }

  return false;
}