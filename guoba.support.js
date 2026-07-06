import yaml from './system/yaml.js'

const _path = './plugins/xhh/config/'

function getCfg() {
  return yaml.get(_path + 'config.yaml') || {}
}

function getOther() {
  return yaml.get(_path + 'other.yaml') || {}
}

function getSign() {
  return yaml.get(_path + 'sign.yaml') || {}
}

function getBh3Remind() {
  return yaml.get(_path + 'bh3_remind.yaml') || {}
}

const defaultBh3GuideSources = {
  abyss: [
    '寂灭|11956740|0,1,3,4,5,6,7,8,9,10,11,12,13,14,15|残月',
    '红莲|11956740|0,1,3,4,5,6,7,8,9,10,11,12,13,14,15|残月',
    '红莲|15491760|0,1,3,4,5,6,7,8,9,10,11,12,13,14,15|墨之羽',
    '红莲|30269990|0,1,3,4,5,6,7,8,9,10,11,12,13,14,15|朔守',
  ].join('\n'),
  battlefield: [
    '记忆战场|11956740|0,1,2,3,4,5,6,7,8,9|残月',
    '战场作业|15491760|0,1,2,3,4,5,6,7,8,9|墨之羽',
    '终极区战场|30269990|0,1,2,3,4,5,6,7,8,9|朔守',
  ].join('\n'),
  godwar: [
    '往世乐土|11956740|0,1,2,3,4,5,6,7,8,9|残月',
    '乐土攻略|15491760|0,1,2,3,4,5,6,7,8,9|墨之羽',
    '乐土因子|30269990|0,1,2,3,4,5,6,7,8,9|朔守',
  ].join('\n'),
  zzzDefense: [
    '式舆防卫战|4068738|0,1,2,3,4,5,6,7,8,9|洗礼酱',
    '防卫战攻略|285802042|0,1,2,3,4,5|HoYo青枫',
  ].join('\n'),
  zzzDeadly: [
    '危局强袭战|4068738|0,1,2,3,4,5,6,7,8,9|洗礼酱',
    '危局攻略|285802042|0,1,2,3,4,5|HoYo青枫',
  ].join('\n'),
}

export const supportGuoba = () => ({
  pluginInfo: {
    name: 'xhh',
    title: '小花火(xhh)',
    description: '多功能辅助插件，支持米游社签到、B站解析、攻略查询等',
    author: '@dknyxhh',
    authorLink: 'https://github.com/dknyxhh',
    link: 'https://github.com/dknyxhh/xhh',
    isV3: true,
    isV2: false,
    showInMenu: 'auto',
    icon: 'mdi:fire',
    iconColor: '#ff6b35',
  },
  configInfo: {
    schemas: [
      {
        component: 'SOFT_GROUP_BEGIN',
        label: '基本设置',
      },
      {
        field: 'update',
        label: '凌晨自动更新',
        helpMessage: '凌晨3:30强制更新（会覆盖文件）',
        component: 'Switch',
      },
      {
        field: 'img_quality',
        label: '图片渲染精度',
        helpMessage: '数字，单位%',
        component: 'InputNumber',
        componentProps: { min: 1, max: 100, step: 1 },
      },
      {
        field: 'wiki',
        label: '小花火图鉴启用',
        component: 'Switch',
      },
      {
        field: 'bdsb',
        label: '使用xhh绑定设备',
        helpMessage: '作用于genshin/StarRail/ZZZ-Plugin',
        component: 'Switch',
      },
      {
        component: 'Divider',
        label: '塔罗牌',
      },
      {
        field: 'tlp',
        label: '塔罗牌开关',
        component: 'Switch',
      },
      {
        field: 'tlpcs',
        label: '塔罗牌每天上限次数',
        component: 'InputNumber',
        componentProps: { min: 1, max: 99, step: 1 },
      },
      {
        component: 'Divider',
        label: '游戏攻略',
      },
      {
        field: 'sr_strategy',
        label: '星铁攻略开关',
        component: 'Switch',
      },
      {
        field: 'gs_logs',
        label: '原神历史卡池',
        component: 'Switch',
      },
      {
        field: 'sr_logs',
        label: '星铁历史卡池',
        component: 'Switch',
      },
      {
        field: 'all_voice',
        label: '原神/星铁语音',
        component: 'Switch',
      },
      {
        field: 'huobi_num',
        label: '星铁战绩显示数量',
        helpMessage: '取1-3，避免图太长',
        component: 'Select',
        componentProps: {
          options: [
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
          ],
        },
      },
      {
        component: 'Divider',
        label: '签到设置',
      },
      {
        field: 'sign',
        label: '签到功能',
        helpMessage: '自动签到在sign.yaml配置',
        component: 'Switch',
      },
      {
        field: 'zd_sign',
        label: '自动签到',
        helpMessage: '0关闭 1开启',
        component: 'RadioGroup',
        componentProps: {
          options: [
            { label: '关闭', value: 0 },
            { label: '开启', value: 1 },
          ],
        },
      },
      {
        field: 'sbai',
        label: '签到失败@提醒',
        helpMessage: '自动签到结束后@失败用户',
        component: 'Switch',
      },
      {
        field: 'sign_group',
        label: '游戏签到白名单群',
        helpMessage: '多个群号用英文逗号分隔，留空则不限制',
        component: 'InputTextArea',
      },
      {
        field: 'bbs_sign_group',
        label: '社区签到白名单群',
        helpMessage: '米游社社区/全部签到可用群，多个群号用英文逗号分隔，留空则不限制',
        component: 'InputTextArea',
      },
      {
        field: 'manual_gt_enable',
        label: '签到手动验证码',
        helpMessage: '游戏签到遇验证码时生成手动验证网页，完成后自动重试',
        component: 'Switch',
      },
      {
        field: 'manual_gt_public_url',
        label: '手动验证公网地址',
        helpMessage: '例如 http://你的域名:3000；群友需要能访问，留空则用127.0.0.1仅本机可用',
        component: 'InputTextArea',
      },
      {
        field: 'manual_gt_port',
        label: '手动验证端口',
        helpMessage: '默认3000，修改后需重启Bot',
        component: 'InputNumber',
        componentProps: { min: 1, max: 65535, step: 1 },
      },
      {
        field: 'manual_gt_timeout',
        label: '手动验证超时秒',
        helpMessage: '默认120秒',
        component: 'InputNumber',
        componentProps: { min: 30, max: 600, step: 10 },
      },
      {
        component: 'Divider',
        label: '米游社',
      },
      {
        field: 'groups',
        label: '米游社视频播报群',
        helpMessage: '多个群号用英文逗号/换行分隔；也可用“添加播报群”命令维护',
        component: 'InputTextArea',
      },
      {
        field: 'forwardMsg',
        label: '播报合并转发',
        helpMessage: '米游社视频播报是否用合并转发发送',
        component: 'Switch',
      },
      {
        field: 'bh3',
        label: '播报崩坏3',
        helpMessage: '米游社视频播报是否包含崩坏3',
        component: 'Switch',
      },
      {
        field: 'by',
        label: '播报崩坏因缘精灵',
        helpMessage: '米游社视频播报是否包含崩坏因缘精灵',
        component: 'Switch',
      },
      {
        field: 'xbgd',
        label: '播报星布谷地',
        helpMessage: '米游社视频播报是否包含星布谷地',
        component: 'Switch',
      },
      {
        field: 'cover',
        label: '播报封面原图',
        helpMessage: '开启后米游社视频播报封面尽量使用原图下载',
        component: 'Switch',
      },
      {
        field: 'group_config',
        label: '群播报屏蔽配置',
        helpMessage: '每行一个群：群号=gs,sr,zzz,bh3,by,xbgd；表示该群屏蔽这些游戏播报',
        component: 'InputTextArea',
      },
      {
        field: 'sm',
        label: '米游社扫码绑定',
        component: 'Switch',
      },
      {
        field: 'sm_cd',
        label: '扫码绑定CD',
        helpMessage: '单位：秒',
        component: 'InputNumber',
        componentProps: { min: 0, max: 3600, step: 10 },
      },
      {
        component: 'Divider',
        label: 'B站设置',
      },
      {
        field: 'bilibili',
        label: 'B站功能开关',
        component: 'Switch',
      },
      {
        field: 'list_num',
        label: '评论区显示条数',
        helpMessage: '1-20条',
        component: 'InputNumber',
        componentProps: { min: 1, max: 20, step: 1 },
      },
      {
        field: 'qn',
        label: '视频下载清晰度',
        component: 'Select',
        componentProps: {
          options: [
            { label: '360P', value: 0 },
            { label: '480P', value: 1 },
            { label: '720P', value: 2 },
            { label: '1080P', value: 3 },
            { label: '1080P+高码率', value: 4 },
            { label: '4K超清', value: 5 },
          ],
        },
      },
      {
        field: 'dow_size',
        label: '自动下载大小阈值',
        helpMessage: '小于此MB数自动下载，0代表不自动下载，最大99',
        component: 'InputNumber',
        componentProps: { min: 0, max: 99, step: 1 },
      },
      {
        field: 'b_lj',
        label: '解析时弹出原链接',
        component: 'Switch',
      },
      {
        field: 'b_cd',
        label: '同视频/动态3分钟CD',
        component: 'Switch',
      },
      {
        field: 'b_img_num',
        label: '图片合并阈值',
        helpMessage: '小于几张图片时不合并消息，0表示始终合并',
        component: 'InputNumber',
        componentProps: { min: 0, max: 20, step: 1 },
      },
      {
        field: 'emoji',
        label: 'Emoji CDN渲染',
        helpMessage: '浏览器不支持emoji时用CDN渲染',
        component: 'Switch',
      },
      {
        component: 'Divider',
        label: '卡池/图鉴外观',
      },
      {
        field: 'gacha_art_source',
        label: '卡池立绘来源',
        helpMessage: '自定义=优先本地/插件额外图；官方=优先游戏官方资源，影响顶部立绘和UP小图',
        component: 'Select',
        componentProps: {
          options: [
            { label: '自定义立绘', value: 'custom' },
            { label: '官方立绘', value: 'official' },
          ],
        },
      },
      {
        component: 'Divider',
        label: '崩坏3扩展',
      },
      {
        field: 'bh3_all_note_enable',
        label: '四游戏体力聚合',
        helpMessage: '原神/星铁/绝区零/崩三体力一键查询',
        component: 'Switch',
      },
      {
        field: 'bh3_all_note_groups',
        label: '四游戏体力推送群',
        helpMessage: '多个群号用英文逗号分隔',
        component: 'InputTextArea',
      },
      {
        field: 'bh3_remind_enable',
        label: '崩三周期提醒',
        helpMessage: '深渊/战场/乐土开始和结算提醒',
        component: 'Switch',
      },
      {
        field: 'bh3_remind_groups',
        label: '崩三提醒群',
        helpMessage: '多个群号用英文逗号分隔，也可群内发送 #小花火开启崩三提醒',
        component: 'InputTextArea',
      },
      {
        field: 'bh3_remind_at_mode',
        label: '崩三提醒艾特',
        helpMessage: '控制深渊/战场/乐土提醒是否艾特全体或指定成员',
        component: 'Select',
        componentProps: {
          options: [
            { label: '不艾特', value: 'none' },
            { label: '艾特全体', value: 'all' },
            { label: '艾特指定QQ', value: 'users' },
          ],
        },
      },
      {
        field: 'bh3_remind_at_users',
        label: '崩三提醒指定QQ',
        helpMessage: '艾特指定QQ时生效，多个QQ用英文逗号/换行分隔',
        component: 'InputTextArea',
      },
      {
        field: 'bh3_remind_image',
        label: '崩三提醒附图',
        helpMessage: '支持网络图片URL或本地图片路径，留空则不发送图片',
        component: 'InputTextArea',
      },
      {
        component: 'Divider',
        label: '崩坏3攻略源',
      },
      {
        field: 'mys_global_guide_search',
        label: '攻略全站搜索兜底',
        helpMessage: '开启后攻略源作者搜不到时，会使用米游社全站搜索关键词兜底（类似 genshin 的 #米游社搜索）',
        component: 'Switch',
      },
      {
        field: 'bh3_guide_abyss_sources',
        label: '深渊攻略源',
        helpMessage: '每行：关键词|米游社UID|图片序号|作者名；如 红莲|11956740|0,1,3|残月',
        component: 'InputTextArea',
      },
      {
        field: 'bh3_guide_battlefield_sources',
        label: '战场攻略源',
        helpMessage: '每行：关键词|米游社UID|图片序号|作者名；按顺序搜索，搜不到会回退通用源',
        component: 'InputTextArea',
      },
      {
        field: 'bh3_guide_godwar_sources',
        label: '乐土攻略源',
        helpMessage: '每行：关键词|米游社UID|图片序号|作者名；支持定向搜索角色/装甲名',
        component: 'InputTextArea',
      },
      {
        component: 'Divider',
        label: '绝区零攻略源',
      },
      {
        field: 'zzz_guide_defense_sources',
        label: '防卫战攻略源',
        helpMessage: '每行：关键词|米游社UID|图片序号|作者名；如 式舆防卫战|4068738|0,1,2|洗礼酱',
        component: 'InputTextArea',
      },
      {
        field: 'zzz_guide_deadly_sources',
        label: '危局强袭战攻略源',
        helpMessage: '每行：关键词|米游社UID|图片序号|作者名；危局会优先识别当前Boss',
        component: 'InputTextArea',
      },
      {
        component: 'Divider',
        label: '原神/星铁深渊速报',
      },
      {
        field: 'abyss_report_repos',
        label: '深渊速报图片仓库',
        helpMessage: '每行一个raw仓库地址；用于原神深渊/剧诗/幽境与星铁混沌/虚构/末日图片',
        component: 'InputTextArea',
      },
      {
        field: 'abyss_report_gs_version',
        label: '原神默认速报版本',
        helpMessage: '留空自动读取Nanoka live版本，如 6.7',
        component: 'Input',
      },
      {
        field: 'abyss_report_sr_version',
        label: '星铁默认速报版本',
        helpMessage: '留空自动读取Nanoka live版本，如 4.3',
        component: 'Input',
      },
      {
        component: 'Divider',
        label: '插件优先级（修改后需重启Bot）',
      },
      {
        field: 'tl_priority',
        label: '体力小组件(TL)',
        helpMessage: '默认 -99',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'sign_priority',
        label: '签到(sign)',
        helpMessage: '默认 -26',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'user_priority',
        label: '扫码绑定(user)',
        helpMessage: '默认 -9999999999',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'wiki_priority',
        label: '图鉴(wiki)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_remind_priority',
        label: '崩三提醒(bh3_remind)',
        helpMessage: '默认 -1000001（提醒拦截）',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_note_priority',
        label: '崩三体力(bh3_note)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_abyss_priority',
        label: '崩三深渊(bh3_abyss)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_battlefield_priority',
        label: '崩三战场(bh3_battlefield)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_godwar_priority',
        label: '崩三乐土(bh3_godwar)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_profile_priority',
        label: '崩三主页(bh3_profile)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_all_note_priority',
        label: '四体力聚合(bh3_all_note)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_gacha_priority',
        label: '崩三抽卡(bh3_gacha)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'bh3_ledger_priority',
        label: '崩三水晶(bh3_ledger)',
        helpMessage: '默认 100',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        field: 'abyss_report_priority',
        label: '原神/星铁深渊速报(abyss_report)',
        helpMessage: '默认 100，修改后需重启',
        component: 'InputNumber',
        componentProps: { min: -9999999999, max: 9999999999, step: 1 },
      },
      {
        component: 'Divider',
        label: '其他',
      },
      {
        field: 'wt',
        label: '查委托必须带#前缀',
        component: 'Switch',
      },
      {
        field: 'Tl',
        label: '小花火体力为默认',
        component: 'Switch',
      },
      {
        field: 'hbxx',
        label: '修复合并消息报错',
        helpMessage: '解决某些适配器的合并消息内嵌报错',
        component: 'Switch',
      },
      {
        field: 'debug',
        label: '调试模式',
        helpMessage: '输出水晶查询/扫码绑定的详细日志',
        component: 'Switch',
      },
    ],
    getConfigData() {
      const cfg = getCfg()
      const other = getOther()
      const sign = getSign()
      const bh3Remind = getBh3Remind()
      return {
        update: !!cfg.update,
        img_quality: cfg.img_quality ?? 80,
        wiki: !!cfg.wiki,
        bdsb: !!cfg.bdsb,
        tlp: !!cfg.tlp,
        tlpcs: cfg.tlpcs ?? 3,
        sr_strategy: !!cfg.sr_strategy,
        gs_logs: !!cfg.gs_logs,
        sr_logs: !!cfg.sr_logs,
        all_voice: !!cfg.all_voice,
        huobi_num: cfg.huobi_num ?? 2,
        sign: !!cfg.sign,
        zd_sign: sign.zd_sign ?? 0,
        sbai: !!sign.sbai,
        sign_group: (sign.sign_group || []).join(','),
        bbs_sign_group: (sign.bbs_sign_group || []).join(','),
        manual_gt_enable: cfg.manual_gt_enable !== false,
        manual_gt_public_url: cfg.manual_gt_public_url || '',
        manual_gt_port: cfg.manual_gt_port ?? 3000,
        manual_gt_timeout: cfg.manual_gt_timeout ?? 120,
        groups: (Array.isArray(cfg.groups) ? cfg.groups : []).join(','),
        forwardMsg: other.forwardMsg !== false,
        bh3: !!other.bh3,
        by: !!other.by,
        xbgd: !!other.xbgd,
        cover: !!other.cover,
        group_config: formatGroupConfig(other.group_config),
        sm: !!cfg.sm,
        sm_cd: cfg.sm_cd ?? 60,
        bilibili: !!cfg.bilibili,
        list_num: cfg.list_num ?? 12,
        qn: cfg.qn ?? 3,
        dow_size: cfg.dow_size ?? 0,
        b_lj: !!cfg.b_lj,
        b_cd: !!cfg.b_cd,
        b_img_num: cfg.b_img_num ?? 0,
        emoji: !!cfg.emoji,
        wt: !!cfg.wt,
        Tl: !!cfg.Tl,
        hbxx: !!cfg.hbxx,
        debug: !!cfg.debug,
        gacha_art_source: cfg.gacha_art_source || 'custom',
        tl_priority: cfg.tl_priority ?? -99,
        sign_priority: cfg.sign_priority ?? -26,
        user_priority: cfg.user_priority ?? -9999999999,
        wiki_priority: other.wiki ?? 100,
        bh3_remind_priority: cfg.bh3_remind_priority ?? -1000001,
        bh3_note_priority: cfg.bh3_note_priority ?? 100,
        bh3_abyss_priority: cfg.bh3_abyss_priority ?? 100,
        bh3_battlefield_priority: cfg.bh3_battlefield_priority ?? 100,
        bh3_godwar_priority: cfg.bh3_godwar_priority ?? 100,
        bh3_profile_priority: cfg.bh3_profile_priority ?? 100,
        bh3_all_note_priority: cfg.bh3_all_note_priority ?? 100,
        bh3_gacha_priority: cfg.bh3_gacha_priority ?? 100,
        bh3_ledger_priority: cfg.bh3_ledger_priority ?? 100,
        bh3_remind_enable: !!bh3Remind.enable,
        bh3_all_note_enable: !!cfg.bh3_all_note_enable,
        bh3_all_note_groups: (cfg.bh3_all_note_groups || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean).join(','),
        bh3_remind_groups: (bh3Remind.groups || []).join(','),
        bh3_remind_at_mode: bh3Remind.at_mode || 'none',
        bh3_remind_at_users: (bh3Remind.at_users || []).join(','),
        bh3_remind_image: bh3Remind.image || '',
        mys_global_guide_search: cfg.mys_global_guide_search !== false,
        bh3_guide_abyss_sources: cfg.bh3_guide_abyss_sources || defaultBh3GuideSources.abyss,
        bh3_guide_battlefield_sources: cfg.bh3_guide_battlefield_sources || defaultBh3GuideSources.battlefield,
        bh3_guide_godwar_sources: cfg.bh3_guide_godwar_sources || defaultBh3GuideSources.godwar,
        zzz_guide_defense_sources: cfg.zzz_guide_defense_sources || defaultBh3GuideSources.zzzDefense,
        zzz_guide_deadly_sources: cfg.zzz_guide_deadly_sources || defaultBh3GuideSources.zzzDeadly,
        abyss_report_repos: cfg.abyss_report_repos || 'https://cnb.cool/JIUXJIU/Abyss/-/git/raw/main\nhttps://cnb.cool/JIUXJIU/AbyssBeta/-/git/raw/main',
        abyss_report_gs_version: cfg.abyss_report_gs_version || '',
        abyss_report_sr_version: cfg.abyss_report_sr_version || '',
        abyss_report_priority: cfg.abyss_report_priority ?? 100,
      }
    },
    setConfigData(data, { Result }) {
      const boolMap = {
        update: data.update,
        wiki: data.wiki,
        bdsb: data.bdsb,
        tlp: data.tlp,
        sr_strategy: data.sr_strategy,
        gs_logs: data.gs_logs,
        sr_logs: data.sr_logs,
        all_voice: data.all_voice,
        sign: data.sign,
        sm: data.sm,
        bilibili: data.bilibili,
        b_lj: data.b_lj,
        b_cd: data.b_cd,
        emoji: data.emoji,
        wt: data.wt,
        Tl: data.Tl,
        hbxx: data.hbxx,
        debug: data.debug,
        bh3_remind_enable: data.bh3_remind_enable,
        bh3_all_note_enable: data.bh3_all_note_enable,
        manual_gt_enable: data.manual_gt_enable,
        forwardMsg: data.forwardMsg,
        bh3: data.bh3,
        by: data.by,
        xbgd: data.xbgd,
        cover: data.cover,
      }
      for (const [k, v] of Object.entries(boolMap)) {
        const target = ['forwardMsg', 'bh3', 'by', 'xbgd', 'cover'].includes(k) ? 'other.yaml' : 'config.yaml'
        yaml.set(_path + target, k, !!v)
      }

      const numMap = {
        img_quality: data.img_quality,
        tlpcs: data.tlpcs,
        huobi_num: data.huobi_num,
        sm_cd: data.sm_cd,
        list_num: data.list_num,
        qn: data.qn,
        dow_size: data.dow_size,
        b_img_num: data.b_img_num,
        manual_gt_port: data.manual_gt_port,
        manual_gt_timeout: data.manual_gt_timeout,
      }
      for (const [k, v] of Object.entries(numMap)) {
        if (v != null) yaml.set(_path + 'config.yaml', k, Number(v))
      }

      if (data.gacha_art_source) yaml.set(_path + 'config.yaml', 'gacha_art_source', data.gacha_art_source === 'official' ? 'official' : 'custom')
      yaml.set(_path + 'config.yaml', 'manual_gt_public_url', String(data.manual_gt_public_url || '').trim())

      yaml.set(_path + 'sign.yaml', 'zd_sign', Number(data.zd_sign) ?? 0)
      yaml.set(_path + 'sign.yaml', 'sbai', !!data.sbai)
      const signGroups = String(data.sign_group || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
      yaml.set(_path + 'sign.yaml', 'sign_group', signGroups)
      const bbsSignGroups = String(data.bbs_sign_group || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
      yaml.set(_path + 'sign.yaml', 'bbs_sign_group', bbsSignGroups)
      const broadcastGroups = parseList(data.groups)
        .map(v => Number(v))
        .filter(v => Number.isSafeInteger(v) && v > 0)
      yaml.set(_path + 'config.yaml', 'groups', broadcastGroups)
      yaml.set(_path + 'other.yaml', 'group_config', parseGroupConfig(data.group_config))

      yaml.set(_path + 'bh3_remind.yaml', 'enable', !!data.bh3_remind_enable)
      yaml.set(_path + 'config.yaml', 'bh3_all_note_enable', !!data.bh3_all_note_enable)
      const groups = String(data.bh3_remind_groups || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
      yaml.set(_path + 'bh3_remind.yaml', 'groups', groups)
      yaml.set(_path + 'bh3_remind.yaml', 'at_mode', ['all', 'users', 'none'].includes(data.bh3_remind_at_mode) ? data.bh3_remind_at_mode : 'none')
      const remindAtUsers = String(data.bh3_remind_at_users || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
      yaml.set(_path + 'bh3_remind.yaml', 'at_users', remindAtUsers)
      yaml.set(_path + 'bh3_remind.yaml', 'image', String(data.bh3_remind_image || '').trim())
      const allNoteGroups = String(data.bh3_all_note_groups || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
      yaml.set(_path + 'bh3_remind.yaml', 'all_note_groups', allNoteGroups)

      yaml.set(_path + 'config.yaml', 'bh3_guide_abyss_sources', String(data.bh3_guide_abyss_sources || '').trim())
      yaml.set(_path + 'config.yaml', 'mys_global_guide_search', data.mys_global_guide_search !== false)
      yaml.set(_path + 'config.yaml', 'bh3_guide_battlefield_sources', String(data.bh3_guide_battlefield_sources || '').trim())
      yaml.set(_path + 'config.yaml', 'bh3_guide_godwar_sources', String(data.bh3_guide_godwar_sources || '').trim())
      yaml.set(_path + 'config.yaml', 'zzz_guide_defense_sources', String(data.zzz_guide_defense_sources || '').trim())
      yaml.set(_path + 'config.yaml', 'zzz_guide_deadly_sources', String(data.zzz_guide_deadly_sources || '').trim())
      yaml.set(_path + 'config.yaml', 'abyss_report_repos', String(data.abyss_report_repos || '').trim())
      yaml.set(_path + 'config.yaml', 'abyss_report_gs_version', String(data.abyss_report_gs_version || '').trim())
      yaml.set(_path + 'config.yaml', 'abyss_report_sr_version', String(data.abyss_report_sr_version || '').trim())

      const priorityFields = [
        'tl_priority', 'sign_priority', 'user_priority', 'wiki_priority',
        'bh3_remind_priority', 'bh3_note_priority', 'bh3_abyss_priority',
        'bh3_battlefield_priority', 'bh3_godwar_priority', 'bh3_profile_priority',
        'bh3_all_note_priority', 'bh3_gacha_priority', 'bh3_ledger_priority', 'abyss_report_priority',
      ]
      for (const f of priorityFields) {
        if (data[f] != null) yaml.set(_path + 'config.yaml', f, Number(data[f]))
      }
      // wiki优先级在other.yaml
      if (data.wiki_priority != null) yaml.set(_path + 'other.yaml', 'wiki', Number(data.wiki_priority))

      return Result.ok({}, '保存成功，部分配置需重启生效')
    },
  },
})

function parseList(value) {
  return String(value || '').split(/[,，\s]+/).map(v => v.trim()).filter(Boolean)
}

function formatGroupConfig(groupConfig = {}) {
  if (!groupConfig || typeof groupConfig !== 'object') return ''
  return Object.entries(groupConfig)
    .map(([group, games]) => `${group}=${Array.isArray(games) ? games.join(',') : games}`)
    .join('\n')
}

function parseGroupConfig(value = '') {
  const result = {}
  for (const line of String(value || '').split(/\n+/)) {
    const text = line.trim()
    if (!text) continue
    const [group, gamesText = ''] = text.split(/[=：:]/)
    const gid = group?.trim()
    if (!/^\d+$/.test(gid || '')) continue
    const games = parseList(gamesText).filter(v => ['gs', 'sr', 'zzz', 'bh3', 'by', 'xbgd'].includes(v))
    if (games.length) result[gid] = games
  }
  return result
}
