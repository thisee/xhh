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
        component: 'Divider',
        label: '米游社',
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
    ],
    getConfigData() {
      const cfg = getCfg()
      const other = getOther()
      const sign = getSign()
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
      }
      for (const [k, v] of Object.entries(boolMap)) {
        yaml.set(_path + 'config.yaml', k, !!v)
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
      }
      for (const [k, v] of Object.entries(numMap)) {
        if (v != null) yaml.set(_path + 'config.yaml', k, Number(v))
      }

      yaml.set(_path + 'sign.yaml', 'zd_sign', Number(data.zd_sign) ?? 0)
      yaml.set(_path + 'sign.yaml', 'sbai', !!data.sbai)

      return Result.ok({}, '保存成功，部分配置需重启生效')
    },
  },
})
