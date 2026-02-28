import fs from 'fs';
import fetch from 'node-fetch';
import {
    QR,
    render,
    yaml,
    sleep,
    makeForwardMsg,
    config,
    splitImage
} from '#xhh';
import moment from 'moment';
import crypto from 'node:crypto';
import md5 from 'md5';
import {
    execSync
} from 'child_process';

let path = './plugins/xhh/config/config.yaml';
let path_ = './plugins/xhh/config/bili_group.yaml';
let headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    Referer: 'https://www.bilibili.com/',
};

let Download = false;

const qn_list = {
    0: 16,
    1: 32,
    2: 64,
    3: 80,
    4: 112,
    5: 120
}

const hz = {
    16: '360p',
    32: '480p',
    64: '720P',
    80: '1080p',
    112: '1080P+ 高码率',
    120: '4K 超清'
}

class bili {
    //扫码登录
    async sm(e) {
        let url =
            'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
        let res;
        try {
            res = await (await fetch(url, {
                method: 'get',
                headers
            })).json();
        } catch (e) {
            logger.error('二维码请求失败');
        }
        if (res?.code != 0) return false;
        let qrcode_url = res.data.url;
        let qrcode_key = res.data.qrcode_key;
        let img = segment.image(
            (await QR.toDataURL(qrcode_url)).replace(
                'data:image/png;base64,',
                'base64://'
            )
        );
        let re = await e.reply(['请在120秒内使用bilibili扫码登录', img], true, {
            recallMsg: 120,
        });
        if (re.data?.message_id) re.message_id = re.data.message_id;
        //扫码状态
        let zt = false,
            s_ing;
        let ck, e_;
        if (e.isGroup) {
            e_ = e.group;
        } else {
            e_ = e.friend;
        }
        await sleep(5000);
        for (let n = 1; n < 150; n++) {
            await sleep(1000);
            res = await fetch(
                'https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' +
                qrcode_key, {
                    method: 'get',
                    headers,
                }
            );
            let data = (await res.json()).data;
            if (data.code == 86090 && zt == false) {
                s_ing = await e.reply('二维码已被扫，请确定登录！');
                if (s_ing.data?.message_id) s_ing.message_id = s_ing.data.message_id;
                e_.recallMsg(re.message_id);
                zt = true;
            }
            if (data.code == 86038) {
                e.reply('b站登录二维码已失效!', true);
                return true;
            }

            if (data.code == 0) {
                let refresh_token = data.refresh_token;
                ck = res.headers.get('set-cookie');
                ck = await this.b_(ck);
                e_.recallMsg(s_ing.message_id);
                res = await this.xx(ck);
                const csrf = ck.match('bili_jct=([\\w]+);')[1];
                getBiliTicket(csrf);
                await yaml.set(path, 'bili_ck', ck);
                await yaml.set(path, 'refresh_token', refresh_token);
                e.reply([
                    `B站登录成功🍀\n`,
                    segment.image(res.face),
                    `\n账号：${res.uname}
          \n用户等级：Lv.${res.level_info.current_level}
          \n硬币：${res.money}`,
                ]);
                return true;
            }
        }
        await e.reply('b站登录二维码已失效,请重新获取！');
        return true;
    }

    //简介
    async jj(e, msg_id) {
        if (!fs.existsSync(`./plugins/xhh/temp/bili/${msg_id}.json`)) return false;
        let data = JSON.parse(
            fs.readFileSync(`./plugins/xhh/temp/bili/${msg_id}.json`, 'utf-8')
        );
        render('bilibili/video_', data, {
            e,
            ret: true
        });
    }

    //展开评论区
    async reply_(e, n, msg_id) {
        if (!fs.existsSync(`./plugins/xhh/temp/bili/${msg_id}.json`)) return false;
        let data = JSON.parse(
            fs.readFileSync(`./plugins/xhh/temp/bili/${msg_id}.json`, 'utf-8')
        );
        if (!n) n = 1;
        let img,
            pic,
            pl_kg = true;
        if (data.pls && data.pls[n - 1]) {
            if (data.pls[1]?.xh == 1) n = Number(n) + 1;
            let data_ = await this.zpl(
                data.bv || data.pl_id,
                data.pls[n - 1].rpid,
                data.pl_type
            );
            data.pls[n - 1]['reply'] = data_;
            img = await render('bilibili/reply', data.pls[n - 1], {
                e,
                ret: false
            });
            pic = {
                n: n,
                msg_id: msg_id,
            };
            data.pls[n - 1]['pic'] = pic;
            data = data.pls[n - 1];
        } else if (data.reply && data.reply[n - 1]) {
            data = data.reply[n - 1];
            img = await render('bilibili/reply_', data, {
                e,
                ret: false
            });
            pl_kg = false;
        } else {
            return e.reply('序号不对哟~');
        }
        let re = await e.reply(img);
        // await redis.set(`xhh:bili:${re.message_id}`,JSON.stringify(pic), { EX: 600 })
        if (pl_kg) {
            await this.temp();
            if (re.data?.message_id) re.message_id = re.data.message_id; //onebot
            re.message_id = re.message_id.toString().replace(/\//g, '');
            fs.writeFileSync(
                `./plugins/xhh/temp/bili/${re.message_id}.json`,
                JSON.stringify(data),
                'utf-8'
            );
        }
        return true;
    }

    //下载视频封面
    async fm(e, msg_id, bv = '') {
        let data;
        if (msg_id) {
            if (!fs.existsSync(`./plugins/xhh/temp/bili/${msg_id}.json`))
                return false;
            data = fs.readFileSync(`./plugins/xhh/temp/bili/${msg_id}.json`, 'utf-8');
            data = JSON.parse(data).pic;
        } else if (bv) {
            data = await this.sp_(bv);
            if (!data) return false;
            data = data.pic;
        }
        e.reply(segment.image(data));
        return true;
    }

    //下载评论区图片
    async tu(e, msg_id) {
        if (!fs.existsSync(`./plugins/xhh/temp/bili/${msg_id}.json`)) return false;
        let data = fs.readFileSync(
            `./plugins/xhh/temp/bili/${msg_id}.json`,
            'utf-8'
        );
        data = JSON.parse(data).pic;
        msg_id = data.msg_id;
        if (!msg_id) return false;
        let n = data.n;
        n--;
        data = JSON.parse(
            fs.readFileSync(`./plugins/xhh/temp/bili/${msg_id}.json`, 'utf-8')
        );
        let pic = data.pls[n].pic;
        if (!pic.length) return false;
        let msg = [];
        // pic.map(img => {
        // msg.push(segment.image(img));
        // });

        //处理图片过长
        for (const t of pic) {
            msg.push(...(await splitImage(t)));
        }
        msg = msg.map(item => segment.image(item))
        e.reply(msg);
        return true;
    }

    //主页
    async video(e, bv, _pl_, dow, _re, like_hf = true) {
        let data = await this.sp_(bv);
        if (!data) return false;
        /*
    bv: bvid
   分p数：videos
    原创?：copyright(1原创，2转载)
    封面：pic
    标题: title
    标签：desc
    用户上传时间戳：ctime
    稿件发布时间戳：pubdate
    稿件总时长(秒)：duration
    up主：owner{
       id:mid
      名字: name
      头像: face
    }
    视频状态数：stat{
      播放量：view
      弹幕数：danmaku
      评论：reply
      收藏：favorite
      分享：share
      点赞：like
      投币：coin
    }
    获取第一个分p视频的cid用于获取在线观看人数
    pages[0].cid
    */
        let cid = data.pages[0].cid;
        let online = await this.online(cid, bv);

        /*
        获取up主信息
          粉丝数量：fans
          等级：level_info.current_level
          是否关注: is_gz
          是否互关：is_hg
          是否拉黑：is_lh
         lv.6是否有小闪电：is_senior_member:0 or 1
        */
        let up_data = await this.up_xx(false, data.owner.mid);
        /*
        判断视频是否点赞，投币，收藏       like,coins,favoured
        */
        let san = await this.san_(bv);
        if (!up_data || !san) return false;

        if (up_data.is_lh && !e.jiexi) return e.reply(`该up[${data.owner.name}]已入黑名单，无法自动解析其B站`)

        if (up_data.is_hg && !san.like && like_hf) {
            await e.reply('互粉用户！正在自动点赞中...', true)
            return this.dz(e, bv, true, false)
        }

        let list_num = config().list_num || 10;
        let pls = (await this.pl(bv)).slice(0, list_num);

        let plsl = zh(data.stat.reply);
        if (_pl_) {
            plsl = Number(String(plsl).replace(/,/g, '')) + 1;
            //重复就删除
            for (let i in pls) {
                if (pls[i].rpid == _pl_.rpid) {
                    pls.splice(i, 1);
                    plsl--;
                    break;
                }
            }
            plsl = zh(plsl);
            pls = [_pl_, ...pls];
        }
        let sp_time = data.duration;
        data = {
            // 'p': data.videos,
            bv: data.bvid,
            // 'copyright': data.copyright,
            pic: data.pic,
            title: data.title,
            desc: data.desc,
            // 'ctime':moment(new Date(data.ctime*1000)).format("YY-MM-DD HH:mm"),
            pubdate: moment(new Date(data.pubdate * 1000)).format('YY-MM-DD HH:mm'),
            time: formatSeconds(sp_time),
            name: data.owner.name,
            tx: data.owner.face,
            up_id: data.owner.mid,
            fans: zh(up_data.fans),
            is_gz: up_data.is_gz,
            is_hg: up_data.is_hg,
            is_lh: up_data.is_lh,
            lv: up_data.level_info.current_level,
            lv_6: up_data.is_senior_member,
            online: online,
            pls: pls,
            view: zh(data.stat.view),
            danmaku: zh(data.stat.danmaku),
            reply: plsl,
            favorite: zh(data.stat.favorite),
            share: zh(data.stat.share),
            like: zh(data.stat.like),
            coin: zh(data.stat.coin),
            is_like: san.like,
            is_coin: san.coins,
            is_sc: san.favoured,
            pl_type: 1,
        };
        //视频画质
        let qn = config().qn
        qn = qn_list[qn] || 80;

        const params = {
            bvid: bv,
            cid,
            fnval: 4048,
            fourk: 1,
            fnver: 0,
        };
        headers = await this.getHeaders();
        if (!headers) return false
        let query = await WBI(headers, params);
        let url = `https://api.bilibili.com/x/player/wbi/playurl?` + query;
        let res = await (await fetch(url, {
            method: 'get',
            headers
        })).json();

        if (res.code == 0) {
            for (let v of res.data.dash.video) {
                if (v.id <= qn) {
                    url = v.baseUrl;
                    logger.mark('[小花火bili]选中画质：' + hz[v.id])
                    break;
                }
            }
            const url1 = res.data.dash.audio[0].baseUrl;

            //视频大小
            const sp = await fetch(url, {
                method: 'get',
                headers
            })
            const sp_size = parseInt(sp.headers.get('Content-Length'), 10)
            logger.mark('[小花火bili]视频大小：' + sp_size)

            //音频大小
            const yp = await fetch(url1, {
                method: 'get',
                headers
            })
            const yp_size = parseInt(yp.headers.get('Content-Length'), 10)
            logger.mark('[小花火bili]音频大小：' + yp_size)

            //总大小（实际有误差，但忽略不计）
            const size = sp_size + yp_size
            logger.mark('[小花火bili]总大小：约' + (size / 1048576).toFixed(2) + 'MB')

            data['size'] = Math.ceil(size / 1048576) + 'MB';
            //dow是否需要下载视频，_re是否需要回复链接消息
            if (!config().b_lj) _re = false //链接设置
            if (dow) {
                this.Download_(e, bv, res, _re, size);
            }
        }

        let img = await render('bilibili/video', data, {
            e,
            ret: false
        });
        let re = await e.reply(img);
        await this.temp();
        if (re.data?.message_id) re.message_id = re.data.message_id; //onebot
        re.message_id = re.message_id.toString().replace(/\//g, '');
        fs.writeFileSync(
            `./plugins/xhh/temp/bili/${re.message_id}.json`,
            JSON.stringify(data),
            'utf-8'
        );

        return true;
    }

    //处理自动下载视频
    async Download_(e, bv, res, _re, size) {
        const kg = Number(size / 1048576) < Number(config().dow_size) //判断视频大小是否小于配置的自动下载大小
        let video;
        if (kg) video = await this.Download(e, bv, false, res, true);
        let msgs;
        if (_re) {
            if (video) {
                msgs = await makeForwardMsg(e, [
                    `b站链接：https://b23.tv/${bv}`,
                    video,
                ]);
            } else {
                msgs = `b站链接：https://b23.tv/${bv}`;
            }
            e.reply(msgs);
        } else {
            if (video) e.reply(video);
        }
    }

    //获取视频基础信息
    async sp_(bv) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/web-interface/wbi/view?bvid=${bv}`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code == 62012) return logger.mark('稿件仅UP主自己可见');
        if (res.code != 0) {
            const ck = await this.getck();
            this.Check(ck);
            logger.mark(`B站视频：${res.message}`);
            return false;
        }
        return res.data;
    }

    //获取动态详细
    async dt(id, e, send = true, _pl_ = false) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${id}&timezone_offset=-480&features=itemOpusStyle,opusBigCover,onlyfansVote,endFooterHidden,decorationCard,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,commentsNewVersion`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        let basic,
            module_dynamic,
            module_stat,
            desc,
            author,
            up_data,
            pls,
            forward,
            like,
            pics = [],
            msgs = [],
            title,
            desc_,
            zhuanfa = {},
            zhuanlan;
        if (res.data?.item) {
            basic = res.data.item.basic; //comment_type类型，comment_id_str评论区id
            module_dynamic = res.data.item.modules.module_dynamic;
            module_stat = res.data.item.modules.module_stat;
            desc = module_dynamic.desc;
            author = res.data.item.modules.module_author;
            //获取up信息
            up_data = await this.up_xx(false, author.mid);
            //评论数量
            pls = module_stat.comment.count;
            //分享数量
            forward = module_stat.forward.count;
            //点赞数量
            like = module_stat.like.count;
            if (
                (basic.comment_type == 11 && desc) ||
                (basic.comment_type == 17 && desc)
            ) {
                //动态的图片
                if (module_dynamic.major) {
                    var items = module_dynamic.major.draw.items;
                    items.map(v => {
                        pics.push(v.src);
                    });
                }
                //动态的emoji和一些需要改成蓝色的文本（@xx）
                let em = [],
                    blue = [];
                //可能需要改成蓝色的节点类型
                let types = [
                    'RICH_TEXT_NODE_TYPE_AT',
                    'RICH_TEXT_NODE_TYPE_LOTTERY',
                    'RICH_TEXT_NODE_TYPE_VOTE',
                    'RICH_TEXT_NODE_TYPE_TOPIC',
                    'RICH_TEXT_NODE_TYPE_GOODS',
                    'RICH_TEXT_NODE_TYPE_BV',
                    'RICH_TEXT_NODE_TYPE_WEB',
                    'RICH_TEXT_NODE_TYPE_MAIL',
                    'RICH_TEXT_NODE_TYPE_OGV_SEASON',
                ];
                if (desc.rich_text_nodes?.length) {
                    desc.rich_text_nodes.map(v => {
                        if (v.emoji) {
                            em.push({
                                text: v.emoji.text,
                                url: v.emoji.icon_url,
                            });
                        }
                        if (types.includes(v.type)) {
                            blue.push(v.orig_text);
                        }
                    });
                }
                //动态的文本
                let msg = desc.text;
                if (em.length) {
                    em.map(v => {
                        msg = msg.replace(v.text, `❥【表情》${v.url}❥`);
                    });
                }
                if (blue.length) {
                    blue.map(v => {
                        msg = msg.replace(v, `❥【蓝色》${v}❥`);
                    });
                }
                msgs = msg.split('❥');
                msgs.push('\n');
                if (pics.length) {
                    pics.map(v => {
                        msgs.push(v);
                    });
                }

                //动态转发动态
                if (res.data.item.type == 'DYNAMIC_TYPE_FORWARD') {

                    let orig = res.data.item.orig;

                    msgs.push(`【蓝色》@${orig.modules.module_author.name}`);

                    //转发的up名字和头像
                    zhuanfa.name = orig.modules.module_author.name
                    zhuanfa.face = orig.modules.module_author.face

                    //转发的投稿视频
                    if (orig.type == 'DYNAMIC_TYPE_AV') {
                        //视频封面
                        zhuanfa.cover = orig.modules.module_dynamic.major.archive.cover;
                        //视频标题
                        zhuanfa.title = orig.modules.module_dynamic.major.archive.title;
                        //视频播放数
                        zhuanfa.bf = orig.modules.module_dynamic.major.archive.stat.play
                        //视频弹幕数
                        zhuanfa.dm = orig.modules.module_dynamic.major.archive.stat.danmaku
                    }

                    //转发图文动态
                    else if (orig.type == 'DYNAMIC_TYPE_DRAW' || orig.type == 'DYNAMIC_TYPE_WORD') {
                        const pic_arr = orig.modules.module_dynamic.major.opus.pics
                        zhuanfa.pics = []
                        pic_arr.map(v => {
                            zhuanfa.pics.push(v.url) //图片数组
                        })
                        //动态的emoji和一些需要改成蓝色的文本（话题，tag，链接等等）
                        let em = [],
                            blue = [];
                        //可能需要改成蓝色的节点类型
                        let types = [
                            'RICH_TEXT_NODE_TYPE_AT',
                            'RICH_TEXT_NODE_TYPE_LOTTERY',
                            'RICH_TEXT_NODE_TYPE_VOTE',
                            'RICH_TEXT_NODE_TYPE_TOPIC',
                            'RICH_TEXT_NODE_TYPE_GOODS',
                            'RICH_TEXT_NODE_TYPE_BV',
                            'RICH_TEXT_NODE_TYPE_WEB',
                            'RICH_TEXT_NODE_TYPE_MAIL',
                            'RICH_TEXT_NODE_TYPE_OGV_SEASON',
                        ];
                        if (orig.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes?.length) {
                            for (let v of orig.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes) {
                                if (v.emoji) {
                                    em.push({
                                        text: v.emoji.text,
                                        url: v.emoji.icon_url,
                                    });
                                }
                                if (types.includes(v.type)) {
                                    blue.push(v.orig_text);
                                }
                            }
                        }
                        //转发动态的文本
                        let msg = orig.modules.module_dynamic.major.opus.summary.text;
                        if (em.length) {
                            em.map(v => {
                                msg = msg.replace(v.text, `❥【表情》${v.url}❥`);
                            });
                        }
                        if (blue.length) {
                            blue.map(v => {
                                msg = msg.replace(v, `❥【蓝色》${v}❥`);
                            });
                        }
                        zhuanfa.msg = msg.split('❥');
                        zhuanfa.msg.push('\n');
                        if (zhuanfa.pics.length) {
                            zhuanfa.pics.map(v => {
                                zhuanfa.msg.push(v);
                            });
                        }

                    } else if (orig.type == 'DYNAMIC_TYPE_ARTICLE') { //转发专栏动态简单处理了
                        zhuanfa.msg = orig.modules.module_dynamic.major.opus.summary.text + '......';
                    }

                }
            }
            //图文动态
            else if (
                res.data.item.type == 'DYNAMIC_TYPE_DRAW' &&
                module_dynamic.major.type == 'MAJOR_TYPE_OPUS'
            ) {
                //动态标题
                title = module_dynamic.major.opus.title;
                //动态图片
                var items = module_dynamic.major.opus.pics;
                items.map(v => {
                    pics.push(v.url);
                });
                //动态的emoji和一些需要改成蓝色的文本（话题，tag，链接等等）
                let em = [],
                    blue = [];
                //可能需要改成蓝色的节点类型
                let types = [
                    'RICH_TEXT_NODE_TYPE_AT',
                    'RICH_TEXT_NODE_TYPE_LOTTERY',
                    'RICH_TEXT_NODE_TYPE_VOTE',
                    'RICH_TEXT_NODE_TYPE_TOPIC',
                    'RICH_TEXT_NODE_TYPE_GOODS',
                    'RICH_TEXT_NODE_TYPE_BV',
                    'RICH_TEXT_NODE_TYPE_WEB',
                    'RICH_TEXT_NODE_TYPE_MAIL',
                    'RICH_TEXT_NODE_TYPE_OGV_SEASON',
                ];
                if (module_dynamic.major.opus.summary.rich_text_nodes?.length) {
                    module_dynamic.major.opus.summary.rich_text_nodes.map(v => {
                        if (v.emoji) {
                            em.push({
                                text: v.emoji.text,
                                url: v.emoji.icon_url,
                            });
                        }
                        if (types.includes(v.type)) {
                            blue.push(v.orig_text);
                        }
                    });
                }
                //动态的文本
                let msg = module_dynamic.major.opus.summary.text;
                if (em.length) {
                    em.map(v => {
                        msg = msg.replace(v.text, `❥【表情》${v.url}❥`);
                    });
                }
                if (blue.length) {
                    blue.map(v => {
                        msg = msg.replace(v, `❥【蓝色》${v}❥`);
                    });
                }
                msgs = msg.split('❥');
                msgs.push('\n');
                if (pics.length) {
                    pics.map(v => {
                        msgs.push(v);
                    });
                }
            }
            //专栏动态，简单处理了
            else if (res.data.item.type == 'DYNAMIC_TYPE_ARTICLE') {
                title = module_dynamic.major.opus.title;
                msgs.push(module_dynamic.major.opus.pics[0].url);
                msgs.push('\n' + module_dynamic.major.opus.summary.text + '......');
                zhuanlan = true;
            }
            //视频动态直接转成视频解析
            else if (res.data.item.type == 'DYNAMIC_TYPE_AV') {
                if (module_dynamic.major?.archive?.bvid) return this.video(e, module_dynamic.major.archive.bvid, false, true, true);
                return false
            } else {
                return false;
            }
        } else {
            url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${id}`;
            res = await fetch(url, {
                method: 'get',
                headers
            }).then(res =>
                res.json()
            );
            if (!res.data?.card?.desc) return false;
            desc_ = res.data.card.desc;
            if (desc_.type != 2) return false;
            //获取up信息
            up_data = await this.up_xx(false, desc_.uid);
            //评论数量
            pls = desc_.comment;
            //分享数量
            forward = desc_.repost;
            //点赞数量
            like = desc_.like;
            let card = JSON.parse(res.data.card.card);
            let msg = card.item.description;
            let em = res.data.card.display.emoji_info.emoji_details;
            if (em) {
                em.map(v => {
                    msg = msg.replace(v.emoji_name, `❥【表情》${v.url}❥`);
                });
            }
            msgs = msg.split('❥');
        }

        if (up_data.is_lh && !e.jiexi) return e.reply(`该up[${author?.name || desc_.user_profile.info.uname}]已入黑名单，无法自动解析其B站`)

        //获取评论区
        let pinglun = basic ?
            await this.pl(basic.comment_id_str, basic.comment_type) :
            await this.pl(desc_.rid, 11);
        let list_num = config().list_num || 10;
        pinglun = pinglun.slice(0, list_num);

        if (_pl_) {
            pls = pls + 1;
            //重复就删除
            for (let i in pinglun) {
                if (pinglun[i].rpid == _pl_.rpid) {
                    pinglun.splice(i, 1);
                    pls--;
                    break;
                }
            }
            pinglun = [_pl_, ...pinglun];
        }
        //合并数据
        let data = {
            //动态id
            dt_id: id,
            //评论区id
            pl_id: basic ? basic.comment_id_str : desc_.rid,
            //评论区类型
            pl_type: basic ? basic.comment_type : 11,
            //发稿时间
            pub_time: author ?
                author.pub_time.replace(/年|月/g, '-').replace(/日/g, '') : moment(new Date(desc_.timestamp * 1000)).format('YY-MM-DD HH:mm'),
            //up名字
            name: author?.name || desc_.user_profile.info.uname,
            //up头像
            tx: author?.face || desc_.user_profile.info.face,
            //粉丝数量
            fans: zh(up_data.fans),
            //是否关注
            is_gz: up_data.is_gz,
            //等级
            lv: up_data.level_info.current_level,
            //小闪电？
            lv_6: up_data.is_senior_member,
            title: title,
            uid: author?.mid || desc_.uid,
            pl: zh(pls),
            forward: zh(forward),
            like: zh(like),
            msg: msgs,
            pic: pics,
            pls: pinglun,
            //转发？
            zhuanfa,
            //是否为专栏
            zhuanlan: zhuanlan,
        };

        let img = await render('bilibili/dt', data, {
            e,
            ret: false
        });

        if (send && pics.length) {
            var pic_ = [];
            // pics.map(v => {
            //   pic_.push(segment.image(v));
            // });

            //处理过长图片
            for (const t of pics) {
                pic_.push(...(await splitImage(t)));
            }
            pic_ = pic_.map(item => segment.image(item))

            let msg_
            if (config().b_img_num > pic_.length) msg_ = pic_
            else msg_ = await makeForwardMsg(e, pic_, '发布的图片');
            e.reply(msg_);
        }

        let re = await e.reply(img);
        await this.temp();
        if (re.data?.message_id) re.message_id = re.data.message_id; //onebot
        re.message_id = re.message_id.toString().replace(/\//g, '');
        fs.writeFileSync(
            `./plugins/xhh/temp/bili/${re.message_id}.json`,
            JSON.stringify(data),
            'utf-8'
        );
    }

    //通过dt_id获取up的mid或者评论区id+评论区类型
    async dt_mid(dt_id, is_pl_id = false) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${dt_id}`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (!res.data?.item) {
            url = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dt_id}`;
            res = await fetch(url, {
                method: 'get',
                headers
            }).then(res =>
                res.json()
            );
            if (!res.data?.card?.desc) return false;
            let desc_ = res.data.card.desc;
            if (desc_.type != 2) return false;
            if (is_pl_id) return {
                pl_id: desc_.rid,
                pl_type: 11
            };
            return desc_.uid;
        }
        if (is_pl_id)
            return {
                pl_id: res.data.item.basic.comment_id_str,
                pl_type: res.data.item.basic.comment_type,
            };
        return res.data.item.modules.module_author.mid;
    }

    //视频是否点赞,投币，收藏
    async san_(bv) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/web-interface/archive/has/like?bvid=${bv}`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code != 0) {
            const ck = await this.getck();
            this.Check(ck);
            return logger.error(res.message);
        }
        let like, coins, favoured;
        if (res.data == 1) like = true;
        url = `https://api.bilibili.com/x/web-interface/archive/coins?bvid=${bv}`;
        res = await fetch(url, {
            method: 'get',
            headers
        }).then(res => res.json());
        if (res.data.multiply != 0) coins = true;
        url = `https://api.bilibili.com/x/v2/fav/video/favoured?aid=${bv}`;
        res = await fetch(url, {
            method: 'get',
            headers
        }).then(res => res.json());
        favoured = res.data.favoured;
        return {
            like,
            coins,
            favoured
        };
    }

    //获取在线观看人数
    async online(cid, bv) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/player/online/total?bvid=${bv}&cid=${cid}`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code != 0) {
            const ck = await this.getck();
            this.Check(ck);
            return logger.error(res.message);
        }
        return res.data.total;
    }

    //获取评论区(子评论同理)
    async pl(oid, type = 1) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/v2/reply?oid=${oid}&type=${type}&sort=1&nohot=0&ps=20&pn=1`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code == 12002) return logger.mark('评论区已关闭');
        let data = res.data?.replies || []
        if (res.code != 0) {
            const ck = await this.getck();
            this.Check(ck);
            logger.mark('b站评论区获取失败');
            return []
        }
        data = await this.getpl(data);
        //置顶评论
        if (res.data.upper?.top) {
            let top = [];
            top.push(res.data.upper.top);
            top = await this.getpl(top);
            data = [...top, ...data];
            //去除重复评论
            data = data.filter((item, index, array) => {
                // 查找当前rpid第一次出现的位置
                const firstIndex = array.findIndex(element => element.rpid === item.rpid);
                // 只保留第一次出现的元素
                return index === firstIndex;
            });
            data[0]['zhiding'] = true;
        }
        let n = 0;
        data.map(v => {
            n++;
            v['xh'] = n;
        });
        return data;
    }

    //获取评论区的评论的子评论
    async zpl(oid, rpid, type = 1) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let url = `https://api.bilibili.com/x/v2/reply/reply?oid=${oid}&root=${rpid}&type=${type}&ps=20&pn=1`;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        let data = res.data.replies;
        if (res.code != 0) {
            const ck = await this.getck();
            this.Check(ck);
            return logger.mark('b站评论区获取失败');
        }
        data = await this.getpl(data, false);
        let n = 0;
        data.map(v => {
            n++;
            v['xh'] = n;
        });
        return data;
    }

    //给视频点赞,取消点赞,投币,收藏
    async dz(e, bv, re, reply = true) {
        headers = await this.getHeaders();
        if (!headers) return false;
        headers.Accept = 'application/x-www-form-urlencoded';
        let ck = await this.getck();
        let csrf = ck.match('bili_jct=([\\w]+);')[1];
        let like = 1; //默认是点赞
        if (e.msg == '取消点赞') like = 2;
        let url = `https://api.bilibili.com/x/web-interface/archive/like?csrf=${csrf}&bvid=${bv}&like=${like}`;
        let n;
        if (e.msg.includes('投币')) {
            n = await / \d + /.exec(e.msg);
            if (!n) n = 2;
            url = `https://api.bilibili.com/x/web-interface/coin/add?bvid=${bv}&multiply=${n}&select_like=1&csrf=${csrf}`;
            like = 3;
        }
        if (e.msg.includes('收藏')) {
            let aid = (await this.sp_(bv)).aid; //bv号转成aid
            let media_id = await this.media_id(); //拿收藏夹id
            url = `https://api.bilibili.com/x/v3/fav/resource/deal?rid=${aid}&type=2&add_media_ids=${media_id}&csrf=${csrf}`;
            like = 4;
            if (e.msg.includes('取消')) {
                url = `https://api.bilibili.com/x/v3/fav/resource/deal?rid=${aid}&type=2&del_media_ids=${media_id}&csrf=${csrf}`;
                like = 5;
            }
        }
        if (e.msg == '三连') {
            let aid = (await this.sp_(bv)).aid; //bv号转成aid
            url = `https://api.bilibili.com/x/web-interface/archive/like/triple?&aid=${aid}&csrf=${csrf}`;
            like = 6;
        }
        let res = await fetch(url, {
            method: 'post',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code == 0) {
            e.reply(
                `[bilibili]${like == 1 ? '点赞' : like == 2 ? '取消点赞' : like == 3 ? '点赞+投币(' + n + '个)' : like == 4 ? '收藏' : like == 5 ? '取消收藏' : '三连'}成功！`
            );
            await sleep(3500); //等待3.5秒
            if (re) return this.video(e, bv, false, true, true, false);
            return this.video(e, bv);
        }
        if (res.code == 65006 && like == 1)
            return e.reply('[bilibili]这个视频已经点过赞了哟~');
        if (res.code == 65004 && like == 2)
            return e.reply('[bilibili]取消点赞失败，可能没点过赞呢~');
        if (like == 3 && res.code == -104)
            return e.reply('˃̣̣̥᷄⌓˂̣̣̥᷅穷得叮当响，我已经没有硬币了！');
        if (like == 3 && res.code == 34005)
            return e.reply('超过投币上限，应该可以已经投过币了哟~');
        //另一个接口https://api.bilibili.com/medialist/gateway/coll/resource/deal
        // if((like==4||like==5)&&res.code != 0){
        // switch (res.code) {
        // case 11201:
        // return e.reply('该视频已经收藏过了！')
        // case 11202:
        // return e.reply('该视频已经没有收藏过！')
        // case 11203:
        // return e.reply('这个收藏夹达到收藏上限，请换个收藏夹吧')
        // }
        // }
        if ([-111, -101, -403].includes(res.code)) {
            if (reply) e.reply('b站ck可能过期，请重新登录或刷新ck');
            else logger.error('b站ck可能过期，请重新登录或刷新ck')
            return
        }
        if (res.code != 0) return logger.error('code:' + res.code, res.message);
    }

    //关注，取消关注，拉黑，取消拉黑
    async user(e, id, id_, isbv) {
        headers = await this.getHeaders();
        if (!headers) return false;
        headers.Accept = 'application/x-www-form-urlencoded';
        let ck = await this.getck();
        let csrf = ck.match('bili_jct=([\\w]+);')[1];
        let n = 1;
        switch (e.msg) {
            case '取消关注':
                n = 2;
                break;
            case '拉黑':
                n = 5;
                break;
            case '取消拉黑':
                n = 6;
        }
        const url = `https://api.bilibili.com/x/relation/modify?fid=${id}&act=${n}&re_src=14&csrf=${csrf}`;
        let res = await fetch(url, {
            method: 'post',
            headers
        }).then(res =>
            res.json()
        );
        let msg;
        switch (res.code) {
            case 0:
                msg = '[bilibili]' + e.msg + '成功';
                break;
            case 22002:
                msg = '因对方隐私设置，还不能关注';
                break;
            case 22003:
                msg = '关注失败了，这家伙在黑名单里！';
                break;
            case 22014:
                msg = '已经关注过了哟~';
                break;
            case 22120:
                msg = '这家伙本来就在黑名单里！！！';
                break;
            default:
                logger.error('code：' + res.code, res.message);
        }
        if (res.code == 0 && /关注/.test(e.msg)) {
            e.reply(msg);
            await sleep(2000);
            if (isbv) return this.video(e, id_);
            else return this.dt(id_, e, false);
        }
        if (msg) return e.reply(msg);
    }

    //发评论
    async bili_reply(e, oid, type = 1, dt_id = '') {
        headers = await this.getHeaders();
        if (!headers) return false;
        headers.Accept = 'application/x-www-form-urlencoded';
        let ck = await this.getck();
        let csrf = ck.match('bili_jct=([\\w]+);')[1];
        let msg = e.msg.replace('评论', '');
        let url = `https://api.bilibili.com/x/v2/reply/add?type=${type}&oid=${oid}&message=${msg}&csrf=${csrf}`;
        let res = await fetch(url, {
            method: 'post',
            headers
        }).then(res =>
            res.json()
        );
        switch (res.code) {
            case 0:
                /*
      头像
      名称
      评论时间
      地址
      等级
      是否有lv6闪电
      评论文本
      */
                //有时候会卡评论，所以直接照着写一个放在开头
                let _pl_ = {};
                _pl_['rpid'] = res.data.reply.rpid;
                _pl_['tx'] = res.data.reply.member.avatar;
                _pl_['name'] = res.data.reply.member.uname;
                _pl_['time'] = '刚刚';
                _pl_['sex'] = res.data.reply.member.sex;
                _pl_['ip'] = res.data.reply.reply_control.location ?
                    res.data.reply.reply_control.location.replace('IP属地：', '') :
                    '';
                _pl_['lv'] = res.data.reply.member.level_info.current_level;
                _pl_['lv_6'] = res.data.reply.member.is_senior_member;
                if (res.data.reply.content.emote) {
                    for (let u in res.data.reply.content.emote) {
                        res.data.reply.content.emote[u] =
                            res.data.reply.content.emote[u].url;
                    }
                }
                _pl_['em'] = res.data.reply.content.emote || '';
                if (_pl_.em) {
                    let bqs = res.data.reply.content.message.match(/\[(.*?)\]/g);
                    bqs.map(bq => {
                        if (Object.keys(_pl_.em).includes(bq)) {
                            res.data.reply.content.message =
                                res.data.reply.content.message.replace(bq, `,${_pl_.em[bq]},`);
                        }
                    });
                }
                _pl_['msg'] = res.data.reply.content.message.split(',');
                e.reply(`[bilibili]评论〖${msg}〗成功！`);
                if (type == 1) this.video(e, oid, _pl_);
                if (type != 1) this.dt(dt_id, e, false, _pl_);
                break;
            case 12025:
                e.reply('[bilibili]评论的字数太多了！！！');
                break;
            case 12002:
            case 12052:
            case 12003:
                e.reply('[bilibili]评论区已经关闭！');
                break;
            case -101:
            case -111:
            case -403:
                e.reply('[bilibili]ck可能失效，请重新登录或刷新ck');
                break;
            default:
                logger.error('code:' + res.code, res.message);
        }
        return;
    }

    //处理评论信息
    getpl(data, no_zpl = true) {
        let pls = [];
        if (data && data.length != 0) {
            //如果不是子评论区，由评论点赞数从高到低重新排序
            if (no_zpl) {
                data = data.sort(compare('like'));
            }
            data.map(v => {
                let pl = {};
                //rpid
                pl['rpid'] = v.rpid;
                //名称
                pl['name'] = v.member.uname;
                //性别
                pl['sex'] = v.member.sex;
                //头像
                pl['tx'] = v.member.avatar;
                //等级
                pl['lv'] = v.member.level_info.current_level;
                //lv.6是否有小闪电
                pl['lv_6'] = v.member.is_senior_member;
                //点赞数量
                pl['num'] = zh(v.like);
                //xx条回复
                pl['reply_num'] = v.reply_control.sub_reply_entry_text;
                //评论时间
                pl['time'] = v.reply_control.time_desc.replace('发布', '');
                //评论时的ip属地
                pl['ip'] = v.reply_control.location ?
                    v.reply_control.location.replace('IP属地：', '') :
                    '';
                //评论图片(arr)
                let pic = [];
                if (v.content.pictures?.length) {
                    v.content.pictures.map(p => {
                        pic.push(p.img_src);
                    });
                }
                pl['pic'] = pic;
                //评论表情
                if (v.content.emote) {
                    for (let u in v.content.emote) {
                        v.content.emote[u] = v.content.emote[u].url;
                    }
                }
                pl['em'] = v.content.emote || '';
                if (pl.em) {
                    let bqs = v.content.message.match(/\[(.*?)\]/g);
                    bqs.map(bq => {
                        if (Object.keys(pl.em).includes(bq)) {
                            v.content.message = v.content.message.replace(
                                bq,
                                `❥${pl.em[bq]}❥`
                            );
                        }
                    });
                }

                //处理@xxx，将( @xxx)变成一个标签
                const at_name = v.content.at_name_to_mid || v.content.at_name_to_mid_str
                if (at_name) {
                    const atnames = Object.keys(at_name)
                    for (const atname of atnames) {
                        v.content.message = v.content.message.replace(
                            `@${atname}`,
                            `❥(标签➩)@${atname}❥`
                        );
                    }
                }

                //评论文本
                pl['msg'] = v.content.message.split('❥');

                if (pic.length) {
                    pl.msg.push(' [图片]');
                }
                pls.push(pl);
            });
        }
        return pls;
    }

    //拿收藏夹id
    async media_id() {
        let n = config().mlid_n || 1;
        const ck = await this.getck();
        let mid = (await this.xx(ck)).mid; //用户id
        headers = await this.getHeaders();
        let url = `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}`;
        let res = await (await fetch(url, {
            method: 'get',
            headers
        })).json();
        if (res.code != 0) return logger.error('code：' + res.code, res.message);
        const id = res.data.list[n - 1].id;
        return id;
    }

    //下载视频
    // vo：是否直接发送视频，send：是否回复消息，res：传入已有的视频信息
    async Download(e, bv, send = true, res, vo) {
        if (Download) {
            if (send) e.reply('有其他视频在下载中，请等待！', true);
            return false;
        }
        const headers = await this.getHeaders();
        if (!headers) return false

        if (!res) {
            // const  n = await (/\d+/).exec(e.msg) || 0
            const cid = await this.player(bv, 0);
            const params = {
                bvid: bv,
                cid,
                fnval: 4048,
                fourk: 1,
                fnver: 0,
            };

            let query = await WBI(headers, params);
            const url = `https://api.bilibili.com/x/player/wbi/playurl?` + query;

            res = await (await fetch(url, {
                method: 'get',
                headers
            })).json();
            if (res.code != 0) return logger.error(res.message);
        }


        //画质, 视频大小
        let qn = config().qn
        qn = qn_list[qn] || 80;
        let url
        for (let v of res.data.dash.video) {
            if (v.id <= qn) {
                url = v.baseUrl;
                break;
            }
        }
        const url1 = res.data.dash.audio[0].baseUrl;
        //视频大小
        const sp = await fetch(url, {
            method: 'get',
            headers
        })
        const sp_size = parseInt(sp.headers.get('Content-Length'), 10)
        //音频大小
        const yp = await fetch(url1, {
            method: 'get',
            headers
        })
        const yp_size = parseInt(yp.headers.get('Content-Length'), 10)
        //总大小（实际有误差，但忽略不计）
        const size = sp_size + yp_size

        if (size > 103809024) {
            if (send) e.reply('视频大于99MB,下不了一点！！！');
            return false;
        }

        Download = true;
        let re;
        if (send)
            re = await e.reply(
                `开始下载bilibili视频，视频大小约为${Math.ceil(size / 1048576)}MB，请稍等！`,
                true
            );
        if (re?.data?.message_id) re.message_id = re.data.message_id

        //下载ing
        const v_path = './plugins/xhh/temp/bili/video.m4s'
        const v_path1 = './plugins/xhh/temp/bili/audio.m4s'
        let sp_path = './plugins/xhh/temp/bili/temp.mp4'
        await this.temp();
        logger.mark('[小花火bili]:开始下载视频和音频');
        const data = Buffer.from(await sp.arrayBuffer());
        const data1 = Buffer.from(await yp.arrayBuffer());
        fs.writeFileSync(v_path, data);
        fs.writeFileSync(v_path1, data1);
        logger.mark('[小花火bili]:视频和音频下载完成');
        logger.mark('[小花火bili]:合并视频和音频中');
        execSync(`cd plugins/xhh/temp/bili/ && ffmpeg -i video.m4s -i audio.m4s -c:v copy -c:a copy -f mp4 -y -loglevel error temp.mp4`);
        logger.mark('[小花火bili]:视频和音频合并完成');
        let v_re,
            video = segment.video(sp_path);
        if (!vo) v_re = await e.reply(video);
        if (v_re?.data?.message_id) v_re.message_id = v_re.data.message_id

        // icqq0.6.10：视频太大，发出去容易失效，故撤回重发一次
        if (
            size > 31457280 &&
            (
                (Bot.version?.name + Bot.version?.version) == 'ICQQv0.6.10' ||
                (!Bot[Number(Bot.uin)].version && (Bot.pkg?.name + Bot.pkg?.version).includes('icqq0.6.10'))
            )
        ) {
            if (e.isGroup) e.group.recallMsg(v_re.message_id);
            else e.friend.recallMsg(v_re.message_id);
            sleep(1500)
            await e.reply(video);
        }
        
        if (send) {
            if (e.isGroup) await e.group.recallMsg(re.message_id);
            else await e.friend.recallMsg(re.message_id);
        }
        Download = false;
        if (vo) return video;
        return true;
    }


    //获取视频cid
    async player(bv, n = 0) {
        const url = `https://api.bilibili.com/x/player/pagelist?bvid=${bv}`;
        let res = await fetch(url, {
            method: 'get'
        }).then(res => res.json());
        // if(res.data.length>1) logger.mark('这个视频有分p')
        return res.data[n].cid;
    }

    //查询投稿视频
    async tougao(mid) {
        headers = await this.getHeaders();
        if (!headers) return false;
        const params = {
            mid: mid,
        };
        let query = await WBI(headers, params);
        let url = 'https://api.bilibili.com/x/space/wbi/arc/search?' + query;
        let res = await (await fetch(url, {
            method: 'get',
            headers
        })).json();
        if (res.code != 0) {
            logger.error('小花火[bilibili]:' + res.code + ' ' + res.message);
            return false;
        }
        let data = res.data.list.vlist[0];
        if (!data) return false;
        //最新视频时间戳
        const time = data.created;
        //bv号
        const bv = data.bvid;
        //封面
        const pic = data.pic;
        //标题
        const title = data.title;
        return {
            time,
            bv,
            pic,
            title
        };
    }

    //推送设置
    async tuis(e, mid, group_id) {
        let data = (await yaml.get(path_)) || {};
        let up = await this.up_xx(e, mid);
        if (!up) return false;
        mid = mid.toString();
        const msg = [segment.image(up.face), '\nup名字：', up.name, '\n'];
        if (
            e.msg.includes('取消') ||
            e.msg.includes('关闭') ||
            e.msg.includes('删除')
        ) {
            if (!data[mid] || data[mid].indexOf(group_id) == -1)
                return e.reply([...msg, '\n本群没有添加过该up主的视频推送！']);
            await yaml.del(path_, mid, group_id);
            return e.reply([...msg, '\n取消该up主的视频推送成功！']);
        } else {
            if (!data[mid]) await yaml.set(path_, mid, []);
            if (data[mid] && data[mid].indexOf(group_id) != -1)
                return e.reply([...msg, '\n本群已经添加了该up主的视频推送']);
            await yaml.add(path_, mid, group_id);
            return e.reply([...msg, '\n添加该up主的视频推送成功！']);
        }
    }

    //通过mid找up主的信息
    async up_xx(e, mid) {
        let url = 'https://api.bilibili.com/x/web-interface/card?mid=' + mid;
        headers = await this.getHeaders();
        if (!headers) return false;
        let res = await fetch(url, {
            method: 'get',
            headers
        }).then(res =>
            res.json()
        );
        if (res.code != 0) {
           if(e) e.reply('up主的信息没找到，可能是uid不对或者B站Cookie已失效。。。');
           else logger.mark('up主的信息没找到，可能是uid不对或者B站Cookie已失效。。。')
            return false;
        }
        url = 'https://api.bilibili.com/x/web-interface/relation?mid=' + mid;
        const res2 = await fetch(url, {
            method: 'get',
            headers
        }).then(res => res.json())
        res.data.card['is_hg'] = res2.data?.relation?.attribute == 6 //是否互关
        res.data.card['is_lh'] = res2.data?.relation?.attribute == 128 //是否已拉黑
        res.data.card['is_gz'] = res.data.following //是否关注
        return res.data.card;
    }

    //登录信息
    async xx(ck) {
        headers = await this.getHeaders(ck);
        //登录基本信息
        let res;
        try {
            res = await (
                await fetch('https://api.bilibili.com/x/web-interface/nav', {
                    method: 'get',
                    headers,
                })
            ).json();
        } catch (err) {
            logger.error(err);
        }
        if (res?.code != 0) return false;
        return res.data;
    }

    //ck拼接buvid
    async b_(ck) {
        headers = await this.getHeaders(ck);
        //buvid3 4
        let res;
        try {
            res = await (
                await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
                    method: 'get',
                    headers,
                })
            ).json();
        } catch (err) {
            logger.error(err);
        }
        if (res?.code != 0) return false;
        let buvid3 = res.data.b_3;
        let buvid4 = res.data.b_4;
        ck = `buvid3=${buvid3};buvid4=${buvid4};` + ck;
        ck = ck.replace(/\n/g, '');
        return ck;
    }
    //获取ck
    async getck() {
        let ck = config().bili_ck;
        if (!ck) {
            logger.mark('未配置b站ck，请发送：小花火b站登录');
            return false;
        }
        const bili_ticket = await redis.get('xhh_bili_ticket');
        if (bili_ticket) {
            ck = `bili_ticket=${bili_ticket};` + ck;
        } else {
            let csrf = ck.match('bili_jct=([\\w]+);')[1];
            getBiliTicket(csrf);
        }
        return ck;
    }

    //简单查下？
    async Check(ck) {
        let check = await this.xx(ck);
        if (!check) {
            logger.error('[小花火]B站ck可能已失效......');
            return false;
        }
        return true;
    }

    async getHeaders(ck) {
        if (!ck) ck = await this.getck();
        if (!ck) return false;
        headers['Cookie'] = ck;
        return headers;
    }

    temp() {
        if (!fs.existsSync('./plugins/xhh/temp/bili/')) {
            fs.mkdirSync('./plugins/xhh/temp/bili/', {
                recursive: true
            });
        }
    }

    //刷新ck(一通乱写，也不知道有没有用。。。)
    async sx_ck(e, qz = false) {
        headers = await this.getHeaders();
        if (!headers) return false;
        let ck = await this.getck();
        let csrf = ck.match('bili_jct=([\\w]+);')[1];
        let refresh_token = config().refresh_token;
        //检查是否需要刷新ck
        let url =
            'https://passport.bilibili.com/x/passport-login/web/cookie/info?csrf=' +
            csrf;
        let res;
        try {
            res = await (
                await fetch(url, {
                    method: 'get',
                    headers,
                })
            ).json();
        } catch (err) {
            logger.error(err);
        }
        if (res.code != 0)
            return res.message == '账号未登录' ?
                e.reply('刷新失败token已经过期，请重新b站登录') :
                logger.error(res.message);
        if (!res.data.refresh && !qz)
            return e.reply(
                '当前b站ck，无需刷新！如有问题，请重新b站登录或者发送：强制刷新b站ck'
            );
        let timestamp = res.data.timestamp;
        //通过返回的时间戳算出签名
        const correspondPath = await getCorrespondPath(timestamp);
        //获取refresh_csrf
        url = `https://www.bilibili.com/correspond/1/${correspondPath}`;
        res = await (await fetch(url, {
            method: 'get',
            headers
        })).text();
        const refresh_csrf = res.match('id="1-name">([\\w]+)</div>')[1];
        //刷新ck
        url = `https://passport.bilibili.com/x/passport-login/web/cookie/refresh?csrf=${csrf}&source=main_web&refresh_csrf=${refresh_csrf}&refresh_token=${refresh_token}`;
        headers.Accept = 'application/x-www-form-urlencoded';
        res = await fetch(url, {
            method: 'post',
            headers
        });
        let data = (await res.json()).data;
        //新ck处理
        ck = res.headers.get('set-cookie');
        ck = await this.b_(ck);
        let new_refresh_token = data.refresh_token;
        csrf = ck.match('bili_jct=([\\w]+);')[1];
        headers = await this.getHeaders(ck);
        headers.Accept = 'application/x-www-form-urlencoded';
        //确认刷新(让旧的刷新口令失效)
        url = `https://passport.bilibili.com/x/passport-login/web/confirm/refresh?csrf=${csrf}&refresh_token=${refresh_token}`;
        fetch(url, {
            method: 'post',
            headers
        });
        //保存ck和刷新口令
        res = await this.xx(ck);
        getBiliTicket(csrf);
        yaml.set(path, 'bili_ck', ck);
        yaml.set(path, 'refresh_token', new_refresh_token);
        return e.reply([
            `B站刷新ck成功🍀\n`,
            segment.image(res.face),
            `\n账号：${res.uname}
          \n用户等级：Lv.${res.level_info.current_level}
          \n硬币：${res.money}`,
        ]);
    }

    //删除ck
    async sc_ck(e) {
        let ck = await this.getck();
        if (!ck) return false;
        let res = await this.xx(ck);
        await yaml.set(path, 'bili_ck', '');
        await yaml.set(path, 'refresh_token', '');
        e.reply(`B站账号：${res.uname}\n删除完成`);
    }
    //账号
    async zhanghao(e) {
        let ck = await this.getck();
        if (!ck) return false;
        let res = await this.xx(ck);
        e.reply([
            segment.image(res.face),
            `\n账号：${res.uname}
          \nuid：${res.mid}
          \n用户等级：Lv.${res.level_info.current_level}
          \n硬币：${res.money}`,
        ]);
    }
}

export default new bili();

// 排序
function compare(property) {
    return function(a, b) {
        var value1 = a[property];
        var value2 = b[property];
        return value2 - value1;
    };
}

//数字格式化
function zh(sz) {
    sz = sz.toString();
    sz = sz.replace(/\B(?=(\d{4})+$)/g, ',');
    return sz;
}

//  秒数转化为时分秒
function formatSeconds(value) {
    //  秒
    let second = parseInt(value);
    //  分
    let minute = 0;
    //  小时
    let hour = 0;
    //  天
    //  let day = 0
    //  如果秒数大于60，将秒数转换成整数
    if (second > 60) {
        //  获取分钟，除以60取整数，得到整数分钟
        minute = parseInt(second / 60);
        //  获取秒数，秒数取佘，得到整数秒数
        second = parseInt(second % 60);
        //  如果分钟大于60，将分钟转换成小时
        if (minute > 60) {
            //  获取小时，获取分钟除以60，得到整数小时
            hour = parseInt(minute / 60);
            //  获取小时后取佘的分，获取分钟除以60取佘的分
            minute = parseInt(minute % 60);
            //  如果小时大于24，将小时转换成天
            //  if (hour > 23) {
            //    //  获取天数，获取小时除以24，得到整天数
            //    day = parseInt(hour / 24)
            //    //  获取天数后取余的小时，获取小时除以24取余的小时
            //    hour = parseInt(hour % 24)
            //  }
        }
    }

    let result = '' + parseInt(second) + '秒';
    if (minute > 0) {
        result = '' + parseInt(minute) + '分' + result;
    }
    if (hour > 0) {
        result = '' + parseInt(hour) + '小时' + result;
    }
    //  if (day > 0) {
    //    result = '' + parseInt(day) + '天' + result
    //  }
    return result;
}

//	使用当前毫秒时间戳生成的签名
async function getCorrespondPath(timestamp) {
    const publicKey = await crypto.subtle.importKey(
        'jwk', {
            kty: 'RSA',
            n: 'y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE',
            e: 'AQAB',
        }, {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        },
        true,
        ['encrypt']
    );
    const data = new TextEncoder().encode(`refresh_${timestamp}`);
    const encrypted = new Uint8Array(
        await crypto.subtle.encrypt({
            name: 'RSA-OAEP'
        }, publicKey, data)
    );
    return encrypted.reduce(
        (str, c) => str + c.toString(16).padStart(2, '0'),
        ''
    );
}

//生成BiliTicket，拼接上ck，可降低风控概率
function hmacSha256(key, message) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(message);
    return hmac.digest('hex');
}
async function getBiliTicket(csrf) {
    const ts = Math.floor(Date.now() / 1000);
    const hexSign = hmacSha256('XgwSnGZ1p', `ts${ts}`);
    const url =
        'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket';
    const params = new URLSearchParams({
        key_id: 'ec02',
        hexsign: hexSign,
        'context[ts]': ts,
        csrf: csrf || '',
    });
    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'POST',
            headers,
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        await redis.set('xhh_bili_ticket', data.data.ticket, {
            EX: 259200
        });
        return logger.mark('[小花火]生成并保存BiliTicket成功！');
    } catch (e) {
        throw error;
    }
}

// 为请求参数进行 wbi 签名
function encWbi(params, img_key, sub_key) {
    const mixinKeyEncTab = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52,
    ];

    // 对 imgKey 和 subKey 进行字符顺序打乱编码
    const getMixinKey = orig =>
        mixinKeyEncTab
        .map(n => orig[n])
        .join('')
        .slice(0, 32);

    const mixin_key = getMixinKey(img_key + sub_key),
        curr_time = Math.round(Date.now() / 1000),
        chr_filter = /[!'()*]/g;

    Object.assign(params, {
        wts: curr_time
    }); // 添加 wts 字段
    // 按照 key 重排参数
    const query = Object.keys(params)
        .sort()
        .map(key => {
            // 过滤 value 中的 "!'()*" 字符
            const value = params[key].toString().replace(chr_filter, '');
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join('&');

    const wbi_sign = md5(query + mixin_key); // 计算 w_rid

    return query + '&w_rid=' + wbi_sign;
}

// 获取最新的 img_key 和 sub_key
async function getWbiKeys(headers) {
    const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers,
    });
    const {
        data: {
            wbi_img: {
                img_url,
                sub_url
            },
        },
    } = await res.json();

    return {
        img_key: img_url.slice(
            img_url.lastIndexOf('/') + 1,
            img_url.lastIndexOf('.')
        ),
        sub_key: sub_url.slice(
            sub_url.lastIndexOf('/') + 1,
            sub_url.lastIndexOf('.')
        ),
    };
}

async function WBI(headers, params) {
    const web_keys = await getWbiKeys(headers);
    let img_key = web_keys.img_key,
        sub_key = web_keys.sub_key;
    const query = encWbi(params, img_key, sub_key);
    return query;
}