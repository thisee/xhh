import { yaml, render, mys, config } from '#xhh'
import fs from 'fs'
import { JSDOM } from 'jsdom'
const { window } = new JSDOM()
const DOMParser = window.DOMParser;


const pr = (yaml.get('./plugins/xhh/config/other.yaml')).wiki
export class Wiki extends plugin {
    constructor(e) {
        super({
            name: '[小花火]图鉴',
            dsc: '图鉴',
            event: 'message',
            priority: pr || -99,
            rule: [
                {
                    reg: '^#*(星铁)*(.*)图鉴$',
                    fnc: 'illustrated_book'
                }
            ]
        })
    }

    async illustrated_book(e) {
        if (!config().wiki) return false
        const isSr = e.msg.includes('星铁');
        const name = e.msg.replace(/#|星铁|图鉴/g, '').trim();
        if (/角色|武器|大剑|双手剑|单手剑|法器|长枪|弓箭|弓|光锥|圣遗物|遗器/.test(name)) return this.list(e, name, isSr)
        // 统一处理角色/武器/遗器查询
        const checkTypes = [
            { method: 'role', args: [e, name] },
            { method: 'weapon', args: [e, name] },
            { method: 'syw_yiqi', args: [e, name] }
        ]
        if (isSr) {
            for (const { method, args } of checkTypes) {
                if (await this[method](...args, true)) return true;
            }
        } else {
            for (const { method, args } of checkTypes) {
                if (await this[method](...args)) return true;
                if (await this[method](...args, true)) return true;
            }
        }
        return false;
    }


    async list(e, name, isSr = false) {
        if (/光锥|遗器|虚无|巡猎|物理|量子|虚数|毁灭|智识|同谐|存护|丰饶|记忆/.test(name)) isSr = true
        let type
        if (name.includes('遗器')) type = 'yq'
        if (name.includes('圣遗物')) type = 'syw'
        if (/武器|大剑|双手剑|单手剑|法器|长枪|弓箭|弓/.test(name)) type = 'wq'
        if (name.includes('光锥')) type = 'gz'
        if (name.includes('角色')) type = 'js'
        let data = await mys.data('', type, isSr)
        let condition = name.replace(/角色|武器|光锥|圣遗物|遗器/g, '')
        if (!isSr) {
            switch (condition) {
                case '五星':
                case '5星':
                    data = data.filter(item => item.ji === '五星')
                    break;
                case '四星':
                case '4星':
                    data = data.filter(item => item.ji === '四星')
                    break;
                case '水系':
                case '水':
                    data = data.filter(item => item.yuanshu === '水')
                    break;
                case '火系':
                case '火':
                    data = data.filter(item => item.yuanshu === '火')
                    break;
                case '冰系':
                case '冰':
                    data = data.filter(item => item.yuanshu === '冰')
                    break;
                case '雷系':
                case '雷':
                    data = data.filter(item => item.yuanshu === '雷')
                    break;
                case '风系':
                case '风':
                    data = data.filter(item => item.yuanshu === '风')
                    break;
                case '岩系':
                case '岩':
                    data = data.filter(item => item.yuanshu === '岩')
                    break;
                case '草系':
                case '草':
                    data = data.filter(item => item.yuanshu === '草')
                    break;
                case '单手剑':
                    data = data.filter(item => item.wuqi === '单手剑')
                    break;
                case '双手剑':
                case "大剑":
                    data = data.filter(item => item.wuqi === '双手剑')
                    break;
                case '长柄':
                case '长枪':
                    data = data.filter(item => item.wuqi === '长柄武器')
                    break;
                case '弓系':
                case '弓箭':
                case '弓':
                    data = data.filter(item => item.wuqi === '弓')
                    break;
                case '法器':
                    data = data.filter(item => item.wuqi === '法器')
                    break;
            }
        } else {
            switch (condition) {
                case '五星':
                case '5星':
                    data = data.filter(item => item.ji === '五星')
                    break;
                case '四星':
                case '4星':
                    data = data.filter(item => item.ji === '四星')
                    break;
                case '物理系':
                case '物理':
                    data = data.filter(item => item.shuxing === '物理')
                    break;
                case '火系':
                case '火':
                    data = data.filter(item => item.shuxing === '火')
                    break;
                case '冰系':
                case '冰':
                    data = data.filter(item => item.shuxing === '冰')
                    break;
                case '雷系':
                case '雷':
                    data = data.filter(item => item.shuxing === '雷')
                    break;
                case '风系':
                case '风':
                    data = data.filter(item => item.shuxing === '风')
                    break;
                case '量子系':
                case '量子':
                    data = data.filter(item => item.shuxing === '量子')
                    break;
                case '虚数系':
                case '虚数':
                    data = data.filter(item => item.shuxing === '虚数')
                    break;
                case '记忆系':
                case '记忆':
                    data = data.filter(item => item.mingtu === '记忆')
                    break;
                case '丰饶系':
                case '丰饶':
                    data = data.filter(item => item.mingtu === '丰饶')
                    break;
                case '存护系':
                case '存护':
                    data = data.filter(item => item.mingtu === '存护')
                    break;
                case '巡猎系':
                case '巡猎':
                    data = data.filter(item => item.mingtu === '巡猎')
                    break;
                case '虚无系':
                case '虚无':
                    data = data.filter(item => item.mingtu === '虚无')
                    break;
                case '同谐系':
                case '同谐':
                    data = data.filter(item => item.mingtu === '同谐')
                    break;
                case "智识系":
                case "智识":
                    data = data.filter(item => item.mingtu === '智识')
                    break;
                case '毁灭系':
                case '毁灭':
                    data = data.filter(item => item.mingtu === '毁灭')
                    break;
            }
        }
        const ratingOrder = { '五星': 1, '四星': 2, '三星': 3, '二星': 4, '一星': 5 };
        //重新排序（5星排在顶部）
        data = data.sort((a, b) => {
            return ratingOrder[a.ji] - ratingOrder[b.ji];
        })
        //根据name去重（主角只需要显示一个）
        data = data.filter((item, index, self) =>
            index === self.findIndex(t => t.name === item.name)
        )

        data = {
            name: name,
            data: data
        }
        return render('wiki/list', data, { e, ret: true })
    }








    //遗器图
    async yiqi_pictures(e, data) {
        let ext = JSON.parse(data.ext).c_30
        data = {
            name: data.title,
            pic: ext.picture.list,
            table: ext.table.list
        }
        render('wiki/yiqi', data, { e, ret: true })
    }

    //圣遗物图
    async syw_pictures(e, data) {
        let ext = JSON.parse(data.ext).c_218
        data = {
            name: data.title,
            icon: data.icon,
            table: ext.table.list
        }
        render('wiki/syw', data, { e, ret: true })
    }


    //圣遗物和遗器
    async syw_yiqi(e, name, isSr = false) {
        const path = isSr ? './plugins/xhh/system/default/yiqi.yaml' : './plugins/xhh/system/default/syw.yaml'
        const _name = yaml.get(path)
        for (let i in _name) {
            if (_name[i].includes(name)) {
                name = i
                break
            }
        }
        if (Object.keys(_name).includes(name)) {
            let data = await mys.data(name, isSr ? 'yq' : 'syw', isSr)
            if (!data) return false
            data.map(v => {
                if (v.title == name) data = v
            })
            if (isSr) {
                this.yiqi_pictures(e, data)
            } else {
                this.syw_pictures(e, data)
            }
            return true
        }
        return false
    }







    //武器
    async weapon(e, name, isSr = false) {
        const path = !isSr ? './plugins/xhh/system/default/wqname.yaml' : './plugins/xhh/system/default/gz_names.yaml'
        const wq_name = yaml.get(path)
        for (let i in wq_name) {
            if (wq_name[i].includes(name)) {
                name = i
                break
            }
        }
        if (Object.keys(wq_name).includes(name)) {
            const { id } = await mys.data(name, isSr ? 'gz' : 'wq', isSr)
            if (!id) return false
            let data = await mys.detail(id, isSr)
            if (isSr) this.sr_gz_pictures(e, data)
            else this.gs_wq_pictures(e, data)
            return true
        }
        return false
    }

    //角色
    async role(e, name, isSr = false) {
        const path = isSr ? './plugins/xhh/system/default/sr_js_names.yaml' : './plugins/xhh/system/default/gs_js_names.yaml'
        const role_name = yaml.get(path)
        for (let i in role_name) {
            if (role_name[i].includes(name)) {
                name = i
                break
            }
        }
        if (Object.keys(role_name).includes(name)) {
            const { id } = await mys.data(name, 'js', isSr)
            if (!id) return false
            let data = await mys.detail(id, isSr)
            if (isSr) this.sr_role_pictures(e, data)
            else this.gs_role_pictures(e, data)
            return true
        }
        return false
    }


    //星铁角色
    async sr_role_pictures(e, data) {
        const userinfo = data.content.rpg_new_tmp_content?.base?.userInfo
        const modules = data.content.rpg_new_tmp_content?.modules
        let text = JSON.parse(data.content.ext)
        text = JSON.parse(text.c_18.filter.text)
        let attribute, fate, rarity
        text.map(v => {
            if (v.includes('属性')) {
                attribute = v.replace(/属性\//, '')
            }
            if (v.includes('命途')) {
                fate = v.replace(/命途\//, '')
            }
            if (v.includes('星级')) {
                rarity = v.replace(/星级\//, '')
            }
        })
        let character, character_material, attr = []
        if (modules) {
            modules.forEach(module => {
                if (module.name === '角色信息') {
                    character = JSON.parse(module.components[0].data).list
                }
                if (module.name === '角色晋阶') {
                    character_material = JSON.parse(module.components[0].data).list[0].materials
                }
            })
            character.forEach(v => {
                attr.push({
                    key: v.rightKey,
                    value: v.rightValue
                })
            })
        } else {
            const js = JSON.parse(fs.readFileSync(`./plugins/miao-plugin/resources/meta-sr/character/${data.content.title}/data.json`, 'utf-8'))
            attr.push({ key: '阵营', value: js.allegiance })
            attr.push({ key: '命途/属性', value: fate + '/' + attribute })
            attr.push({ key: '中文cv', value: js.cncv })
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
            img: userinfo?.figurePath || `../../../../../plugins/miao-plugin/resources/meta-sr/character/${data.content.title}/imgs/splash.webp`,
            //角色标签
            attr: attr,
            attr_: userinfo ? true : false,
            //突破材料(另一个排版没有,懒得写了)
            material: character_material,
        }
        render('wiki/sr_role', data, { e, ret: true })
    }




    //原神角色
    async gs_role_pictures(e, data) {
        const modules = data.page.modules
        const role_attribute = {
            '#378383': '风',
            '#5FACC1': '冰',
            '#6455A6': '雷',
            '#518ABB': '水',
            '#B8584B': '火',
            '#6D9840': '草',
            '#C09257': '岩'
        }
        let character, character_material, character_talent
        modules.forEach(module => {
            if (module.name === '基础信息') {
                character = JSON.parse(module.components[0].data)
            }
            if (module.name === '角色突破') {
                character_material = JSON.parse(module.components[0].data)
            }
            if (module.name === '天赋') {
                character_talent = JSON.parse(module.components[0].data).list[0].attr.row
            }
        })
        //计算天赋材料
        character_talent = character_talent[character_talent.length - 1]
        //取3,4,11的图片,重新排序一下
        let pngs = [...extractUnique(character_talent[2]), ...extractUnique(character_talent[3]), ...extractUnique(character_talent[10])]
        let png_names = [...extractUnique(character_talent[2], true), ...extractUnique(character_talent[3], true), ...extractUnique(character_talent[10], true)]
        const pngs_ = extractElements(pngs, [1, 3, 5])
        const png_names_ = extractElements(png_names, [1, 3, 5])
        pngs = [...pngs_, ...pngs]
        png_names = [...png_names_, ...png_names]
        png_names[0] += ' x18'
        png_names[1] += ' x66'
        png_names[2] += ' x93'
        const weeks = {
            "周一/四/日": ['自由', '繁荣', '浮世', '诤言', '公平', '角逐'],
            "周二/五/日": ['抗争', '勤劳', '风雅', '巧思', '正义', '焚燔'],
            "周三/六/日": ['诗文', '黄金', '天光', '笃行', '秩序', '纷争']
        }
        let week
        for (const k in weeks) {
            weeks[k].map(v => {
                if (png_names[3].includes(v)) week = k
            })
            if (week) break
        }
        png_names[3] += ' x9'
        png_names[4] += ' x63'
        png_names[5] += ' x114'
        png_names[6] += ' x18'
        png_names[7] += ' x3'
        pngs.splice(3, 0, pngs.splice(6, 1)[0])
        png_names.splice(3, 0, png_names.splice(6, 1)[0])


        //计算成长属性
        let grow = character_material.list[character_material.list.length - 1]
        grow = grow.attr[grow.attr.length - 1]
        grow.value = grow.value[0].replace(/<p>(.*)<\/p>/, '$1').trim()
        if (grow.key == '暴击伤害') {
            grow.value = '38.4%'
        } else if (grow.key == '暴击率') {
            grow.value = '19.2%'
        }
        character_material = character_material.list[0].materials
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
            week: week
        }
        render('wiki/gs_role', data, { e, ret: true })
    }

    //原神武器
    async gs_wq_pictures(e, data) {
        const modules = data.page.modules
        let wq, description, numeric_value
        modules.forEach((v, i) => {
            if (i == 0) wq = JSON.parse(v.components[0].data)
            if (v.name == "装备描述") description = JSON.parse(v.components[0].data)
            if (v.name == "成长数值") numeric_value = JSON.parse(v.components[0].data).list
        })
        const rich_text = description.rich_text
        description.attr.map((v, i, arr) => {
            arr[i].value = v.value[0]
        })
        const attr = description.attr
        //材料
        const materials = numeric_value[0].materials
        //数值
        const numeric_ = numeric_value[numeric_value.length - 1].attr[0].value[0]
        //如果喵有图就调用
        const path_img = this.getpath(wq.name)

        const arr = numeric_.match(/<p>(.*?)<\/p>/g).map(m => m.replace(/<p>|<\/p>/g, ''))
        const atk = arr[0].replace(/基础攻击力: /g, '')

        const attr_ = {
            key: (arr[1].split(':'))[0],
            value: (arr[1].split(': '))[1]
        }
        //材料周几
        const weeks = {
            "周一/四/日": ['高塔孤王', '孤云寒林', '远海夷地', '谧林涓露', '悠古弦音', '贡祭炽心'],
            "周二/五/日": ['凛风奔狼', '雾海云间', '鸣神御灵', '绿洲花园', '纯圣露滴', '谵妄圣主'],
            "周三/六/日": ['狮牙斗士', '漆黑陨铁', '今昔剧画', '烈日威权', '无垢之海', '神合秘烟']
        }
        let week
        for (const k in weeks) {
            weeks[k].map(v => {
                if (materials[0].nickname.includes(v)) week = k
            })
            if (week) break
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
            path_img,
            //基础攻击力
            atk,
            //武器副属性
            attr_,
            week
        }
        render('wiki/wq', data, { e, ret: true })
    }

    //星铁光锥
    async sr_gz_pictures(e, data) {
        let content = data.content.contents[0].text
        const name = data.content.title
        let grow = content.match(/80级<\/td>(.*?)<\/table>/g)[0].match(/\d+/g)
        let material = content.match(/晋阶材料(.*)信用点/g)[0]
        content = content.match(/<img src=(.*?)基础介绍(.*?)命途(.*?)稀有度(.*?)技能(.*?)光锥描述(.*?)<img/g)
        const cn = extractChineseWords(material)
        material = extractUniqueHttpsLinks(material)
        let mat = [0, 6, 12, 2, 5, 11, 1].map(index => material[index])//重新排序，提取
        if (cn[2] === cn[5]) mat = [0, 5, 11, 3, 6, 12, 1].map(index => material[index])//另一种排版
        let mat_num = [20, 20, 14, 4, 12, 15, '89.3w']
        content = extractHonkaiStarRailData(content[0])
        content.jineng[1] = content.jineng[1].replace(/【([\d.%/]+)】/g, '<p class="lan">【$1】</p>')
        if (content.xiyoudu == '4星') mat_num = [15, 15, 12, 3, 9, 12, '70.7w']
        data = {
            name,
            ...content,
            grow,
            mat,
            mat_num
        }
        render('wiki/gz', data, { e, ret: true })
    }







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




}






function extractUnique(text, kg = false) {
    // 匹配标准正则表达式
    let Regex = /https(.*?).(png|jpg|webp|svg)/gi
    if (kg) {
        Regex = /data-entry-name="(.*?)"/gi
        return [...text.matchAll(Regex)].map(m => m[1])
    }
    // 提取所有匹配项并转为Set去重
    const matches = text.match(Regex) || [];
    const unique = [...new Set(matches)];

    return unique
}


/**
 * 从数组中提取指定索引元素并修改原数组
 * @param {Array} arr - 要处理的原数组
 * @param {Array<number>} indexes - 要提取的索引数组
 * @returns {Array} 提取出的元素组成的新数组
 */
function extractElements(arr, indexes) {
    // 验证
    if (!Array.isArray(arr) || !Array.isArray(indexes)) {
        logger.error('参数必须是数组类型');
    }

    // 去重并排序索引
    const sortedIndexes = [...new Set(indexes)]
        .sort((a, b) => b - a)
        .filter(i => i >= 0 && i < arr.length);

    // 提取元素
    const extracted = sortedIndexes.map(i => arr[i]);

    // 从原数组移除元素
    sortedIndexes.forEach(i => arr.splice(i, 1));

    return extracted.reverse()
}

function extractHonkaiStarRailData(htmlString) {
    // 创建DOM解析器
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 初始化结果对象
    const result = {
        img: '',
        mingtu: '',
        xiyoudu: '',
        jineng: ['', ''],
        miaoshu: ''
    };

    // 1. 提取图片链接
    const imgElement = doc.querySelector('img[src^="https://act-upload.mihoyo.com"]');
    if (imgElement) {
        result.img = imgElement.src;
    }

    // 2. 提取表格数据
    const mobileTable = doc.querySelector('.obc-tml-light-table--mobile');
    if (mobileTable) {
        const rows = mobileTable.querySelectorAll('tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const key = cells[0].textContent.trim();
            const valueCell = cells[1];

            switch (key) {
                case '命途':
                    result.mingtu = valueCell.textContent.trim();
                    break;

                case '稀有度':
                    result.xiyoudu = valueCell.textContent.trim();
                    break;

                case '技能':
                    // 提取技能名称
                    const skillName = valueCell.querySelector('h3 span')?.textContent.trim() || '';
                    result.jineng[0] = skillName;

                    // 提取技能描述（保留数字和中文）
                    const skillDesc = valueCell.querySelector('p')?.textContent
                        .replace(/\s+/g, ' ')
                        .trim() || '';
                    result.jineng[1] = skillDesc;
                    break;

                case '光锥描述':
                    // 提取所有段落并处理换行
                    const paragraphs = valueCell.querySelectorAll('p');
                    let fullDescription = '';

                    paragraphs.forEach(p => {
                        // 处理段落内容，将<br>转换为\n
                        let paragraphContent = p.innerHTML
                            .replace(/<br\s*\/?>/gi, '\n')  // 转换换行标签
                            .replace(/<\/?[^>]+>/g, '')    // 移除所有HTML标签
                            .trim();

                        fullDescription += paragraphContent + '\n';
                    });

                    // 移除最后的换行符并赋值
                    result.miaoshu = fullDescription.trim();
                    break;
            }
        });
    }

    return result;
}



function extractUniqueHttpsLinks(htmlString) {
    // 使用正则表达式匹配所有https://链接
    const httpsRegex = /https:\/\/[^\s"']+/g;
    const matches = htmlString.match(httpsRegex) || [];

    return matches;
}

function extractChineseWords(str) {
    // 匹配连续的中文字符（包含基本汉字和扩展区）
    const chineseRegex = /[\u4e00-\u9fa5\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b81f}\u{2b820}-\u{2ceaf}]+/gu;
    return str.match(chineseRegex) || [];
}
