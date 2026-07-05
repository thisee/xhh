<h1>小花火插件</h1>

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](LICENSE)

## v2 分支维护说明

本仓库当前 `v2` 分支为 YUYUYUYU2147 维护/适配版本，原作者 README 内容会在下方继续保留，方便追溯项目来源与原始用法。

本分支主要围绕 TRSS-Yunzai / OneBot 环境做功能补充与样式适配，包含但不限于：

- 崩坏3体力、深渊、战场、乐土、主页、水晶手账等查询与图片模板优化；
- 崩坏3抽卡记录、出金记录、历史补给/卡池查询；
- 崩坏3与绝区零 Wiki 图鉴扩展，含角色、武器/音擎、圣痕/驱动盘、人偶/邦布等查询；
- 原神、星铁、绝区零、崩坏3卡池图片化展示与米游社官方公告卡池解析；
- 四游戏体力聚合查询：原神 / 星铁 / 绝区零 / 崩坏3；
- 米游社游戏签到与社区签到、群聊白名单、崩三周期提醒等；
- 锅巴配置适配：常用开关、优先级、提醒群、签到白名单、卡池立绘来源等；
- 多处字体、罕见字、图片布局和移动端截图显示问题修复。

> 说明：本分支是在原项目基础上的二次维护版本。原作者信息、原 README 与 GPL-2.0 开源协议均会保留。若你基于本分支继续修改或分发，请同样保留来源与协议。

## 快速安装

### GitHub 直连安装

在云崽根目录执行：

```bash
git clone -b v2 https://github.com/YUYUYUYU2147/xhh.git ./plugins/xhh/
cd ./plugins/xhh
pnpm i
```

### 使用 GitHub 加速前缀安装

如果服务器访问 GitHub 慢或超时，可以在仓库地址前加 GitHub 代理/加速前缀。下面以 `<加速前缀>` 作为占位，请替换成你当前可用的加速地址：

```bash
git clone -b v2 <加速前缀>https://github.com/YUYUYUYU2147/xhh.git ./plugins/xhh/
cd ./plugins/xhh
pnpm i
```

示例格式：

```bash
git clone -b v2 https://gh-proxy.com/https://github.com/YUYUYUYU2147/xhh.git ./plugins/xhh/
```

> 加速服务可能会失效或更换域名；如果 clone 失败，请换一个可用前缀，或改用直连。

### 已安装后的换源

如果已经安装过 xhh，可以进入插件目录修改远程仓库地址：

```bash
cd ./plugins/xhh

# 查看当前远程仓库
git remote -v

# 换成 YUYUYUYU2147 维护版 GitHub 源
git remote set-url origin https://github.com/YUYUYUYU2147/xhh.git

# 如果需要使用加速前缀，也可以这样设置
git remote set-url origin <加速前缀>https://github.com/YUYUYUYU2147/xhh.git

# 拉取最新代码
git fetch origin
```

### 切换到 v2 分支

如果本地已经 clone 了仓库，但不在 `v2` 分支，可以执行：

```bash
cd ./plugins/xhh

# 拉取远程分支信息
git fetch origin

# 切换到 v2 分支；如果本地没有 v2，会自动基于 origin/v2 创建
git checkout -B v2 origin/v2

# 更新到远程最新提交
git pull origin v2

# 安装/更新依赖
pnpm i
```

如果你使用原作者仓库，请参考下方“原作者 README（保留）”。

## 常用命令补充

| 命令 | 说明 |
| --- | --- |
| `#小花火帮助` | 查看当前分支整理后的帮助图 |
| `#体力` / `#小花火体力` | 四游戏体力聚合查询 |
| `#崩三体力` | 崩坏3体力卡片 |
| `#崩三深渊` | 崩坏3深渊/量子流形信息 |
| `#崩三战场` | 崩坏3战场信息 |
| `#崩三乐土` | 崩坏3乐土挑战记录 |
| `#崩三卡池` / `#崩三xx卡池` | 崩坏3当前/角色历史补给 |
| `#绝区零卡池` / `#绝区零xx卡池` | 绝区零当前/历史卡池 |
| `#原神卡池` / `#星铁卡池` | 原神/星铁当前卡池 |
| `#官方卡池` / `#原神官方卡池` | 米游社官方公告卡池汇总/单游戏查询 |
| `#崩三xx图鉴` | 崩坏3角色、武器、圣痕、人偶等图鉴 |
| `#绝区零xx图鉴` | 绝区零代理人、音擎、驱动盘、邦布等图鉴 |
| `#小花火签到` / `#米游社全部签到` | 游戏签到/社区签到 |

## 开源与二次分发说明

本项目基于 GNU General Public License v2.0（GPL-2.0）协议开源。

你可以自由使用、学习、修改本项目代码；但如果你对本项目或本分支进行二次修改、打包分发、公开发布或传播修改版，必须：

1. 保留原作者与本分支维护者相关署名和版权声明；
2. 保留 GPL-2.0 开源协议；
3. 公开对应修改版源码；
4. 不得将修改版闭源分发；
5. 不得删除项目来源信息或冒充原创。

如果只是个人本地自用且不分发，GPL-2.0 通常不强制公开修改源码。

---

## 原作者 README（保留）

<img src="resources/help/xhh.gif" alt="小花火" width = "400">

<h2>不懂的，就问Ai吧  ◍⁰ᯅ⁰◍ .ᐟ.ᐟ  </h2>

## cd到云崽的根目录，然后↘↓↙

```
git clone https://gitee.com/this_e/xhh.git ./plugins/xhh/
```

<details>
  <summary>Github</summary>
  
```
git clone https://github.com/thisee/xhh.git ./plugins/xhh/
```

</details>

## 安装依赖

```
pnpm i
```

---

| 命令              | 说明                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| xx语音            | 原神星铁角色四国语音                                                            |
| xx卡池            | 原神星铁历代卡池                                                                |
| 货币战争            | 星铁货币战争战绩                                                                |
| 母带            | 绝区零存货                                                                |
| xx攻略            | 星铁角色攻略                                                                    |
| 塔罗牌            | 占卜                                                                            |
| (自动播报)        | 米家3游戏的最新视频,设置群号后会自动播报                                        |
| (每日npc委托名)   | 查询每日委托是否有成就                                                          |
| (bilibili解析)    | bilibili分享自动解析：卡片，链接(都可)                                          |
| 点赞,投币,拉黑... | 对bilibili视频的一些操作                                                        |
| 扫码绑定          | 扫码绑定米游社stoken                                                            |
| 设备(+设备信息)          | 绑定常用设备                                                           |
| 刷新ck            | 用stoken重新绑定ck                                                              |
| xx图鉴            | 图鉴查询（原神和星铁）                                                          |
| 体力              | 查询树脂、开拓力、电池                                                          |
| 签到              | 米家3游戏每日签到                                                               |
| 小花火设置        | 查看设置,具体文件在xhh/config/config.yaml,大部分功能都是默认关闭的,自己按需开启 |
| 小花火帮助        | 命令列表                                                                        |

<details>
  <summary>QQ群</summary>
  
  [小花火测试群](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=xu76qObVHhXQDCyMqQlloAWMHlj6r1jo&authKey=XPlThtHq9NXc8i05MKCLrr1swYMERRLoLe645jC0sngAav%2FoIR1dKpE9BbzuXEDI&noverify=0&group_code=975723770)

</details>

# 声明

1. 请勿传播至视频平台，如：bilibili
2. 请尊重Yunzai本体及其他插件作者的努力，勿将Yunzai及其他插件用于以盈利为目的的场景
3. 代码，如有错误的地方，欢迎指正！
4. 我是菜鸟，我什么也不懂(ó﹏ò｡) ,非本插件的问题，我都不知道！

## 星铁攻略图源

|                     星铁攻略图的作者大大                      |
| :-----------------------------------------------------------: |
|  [HoYo青枫](https://m.miyoushe.com/dby/#/collection/1998324)  |
| [紫喵Azunya](https://m.miyoushe.com/dby/#/collection/2145977) |
