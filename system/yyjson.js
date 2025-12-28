import fetch from 'node-fetch';
import { yaml } from '#xhh'
class yyjson {
    // async gs_download(id) {
    //     let url = `https://api-takumi-static.mihoyo.com/hoyowiki/genshin/wapi/entry_page?app_sn=ys_obc&entry_page_id=${id}`;
    //     let data = await (await fetch(url)).json();
    //     let n = 14;
    //     if (
    //         id == '505542' ||
    //         id == '505527'
    //     ) {
    //         n = 0;
    //     }
    //     data = data.data.page.modules[n].components[0].data;
    //     data = JSON.parse(data);
    //     let list = data.list;
    //     return list;
    // }
    // async sr_download(id) {
    //     let url = `https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/content/info?app_sn=sr_wiki&content_id=${id}`;
    //     let SRdata_ = await (await fetch(url)).json();
    //     // SRdata.data.content.contents[0].text
    //     let SRdata = SRdata_.data.content.contents;
    //     let data = false;
    //     let s;
    //     for (let i of SRdata) {
    //         s = i.text.replace(/[ ]|[\r\n]|\"/g, '');
    //         data = s.match(
    //             /<lidata-target=voiceTab.attrdata-index=(\d)class=obc-tmpl__switch-item>(.*?)<\/li>/g
    //         );
    //         if (data) {
    //             break;
    //         }
    //     }
    //     if (!data) {
    //         SRdata =
    //             SRdata_.data.content.rpg_new_tmp_content.modules[9].components[0].data;
    //         if (!SRdata)
    //             return logger.error('该角色的语音还没有人上传，过几天再试试吧~');
    //         SRdata = JSON.parse(SRdata);
    //         let list = SRdata.list;
    //         let table = [],
    //             sr_yy = [],
    //             v = 0;
    //         for (let i of list[0].table) {
    //             table[v] = {};
    //             table[v]['name'] = i.name;
    //             table[v]['content'] = i.content;
    //             v++;
    //         }
    //         for (let n in list) {
    //             sr_yy[n] = [];
    //             for (let k in list[n].table) {
    //                 sr_yy[n][k] = list[n].table[k].audioUrl;
    //             }
    //         }
    //         let sr = {
    //             table,
    //             sr_yy,
    //         };
    //         return sr;
    //     }
    //     if (!data) return logger.error('该角色的语音还没有人上传，过几天再试试吧~');
    //     let conent = [];
    //     let name = data[0].match(/__voice-content>(.*?)<\/span>/g);
    //     let table = [];
    //     let v = 0;
    //     let k = 0;
    //     for (let i of name) {
    //         i = i.replace(/__voice-content>|<\/span>/g, '');
    //         table[v] = {};
    //         table[v]['name'] = i;
    //         v++;
    //         if (v == name.length / 2) break;
    //     }
    //     k = v;
    //     let name_ = data[4].match(/__voice-content>(.*?)<\/span>/g);
    //     for (let i of name_) {
    //         i = i.replace(/__voice-content>|<\/span>/g, '');
    //         table[v] = {};
    //         table[v]['name'] = i;
    //         v++;
    //         if (v == k + name_.length / 2) break;
    //     }
    //     v = 0;
    //     let content = data[0].match(/__voice-bottom>(.*?)<\/td><\/tr>/g);
    //     for (let i of content) {
    //         i = i.replace(/__voice-bottom>|<\/td><\/tr>/g, '');
    //         table[v]['content'] = i;
    //         v++;
    //     }
    //     let content_ = data[4].match(/__voice-bottom>(.*?)<\/td><\/tr>/g);
    //     for (let i of content_) {
    //         i = i.replace(/__voice-bottom>|<\/td><\/tr>/g, '');
    //         table[v]['content'] = i;
    //         v++;
    //     }
    //     let sr_yy = [];
    //     let n;
    //     if (
    //         !data[0].match(
    //             /sourcesrc=https:\/\/act-upload.mihoyo.com\/sr-wiki\/(.*?)wav><\/audio><\/div>/g
    //         )
    //     ) {
    //         return logger.error('该角色的语音还没有人上传，过几天再试试吧~');
    //     }
    //     for (let i = 0; i < 4; i++) {
    //         sr_yy[i] = data[i].match(
    //             /sourcesrc=https:\/\/act-upload.mihoyo.com\/sr-wiki\/(.*?)wav><\/audio><\/div>/g
    //         );
    //         sr_yy[i].splice(k - 1, k);
    //         n = i + 4;
    //         sr_yy[i] = sr_yy[i].concat(
    //             data[n].match(
    //                 /sourcesrc=https:\/\/act-upload.mihoyo.com\/sr-wiki\/(.*?)wav><\/audio><\/div>/g
    //             )
    //         );
    //     }
    //     let sr = {
    //         table,
    //         sr_yy,
    //     };
    //     return sr;
    // }

    async gs_other_download(name) {
        const names = yaml.get('./plugins/xhh/system/default/gs_en_id.yaml')
        if (!names[name]) return false
        const id = names[name]
        let data = await fetch(`https://gensh.honeyhunterworld.com/${id}/?lang=CHS`).then(res => res.text())
        let arr = data.match(/<td>VoiceOver<\/td>(.*?)<h2>Stories<\/h2>/)[1]
        const list = []
        const titles = arr.match(/<td>(.*?)<\/td><td><div class="dialog_cont">/g).map(v => v.match(/<td>(.*?)<\/td><td><div class="dialog_cont">/)[1])
        const ids = arr.match(/<script>dialog_data.push\({"start":"(.*?)",/g).map(v => v.match(/<script>dialog_data.push\({"start":"(.*?)",/)[1])
        const decs = arr.match(/{"from":"(.*?)","line":"(.*?)"/g).map(v => v.match(/{"from":"(.*?)","line":"(.*?)"/)[2])
        if (!ids[0]) return false
        name = id
        if (id == 'playerboy') name = 'hero'
        if (id == 'playergirl') name = 'heroine'
        for (let i = 0; i < ids.length; i++) {
            list.push({
                id: 'https://gensh.honeyhunterworld.com/audio/quotes/' + name + '/' + ids[i] + '_',
                title: titles[i],
                dec: decs[i].replace(/\\u([dD][89a-fA-F][0-9a-fA-F]{2})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                }).replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                })
            })
        }
        return { list, id }
    }

    async sr_other_download(name) {
        const names = yaml.get('./plugins/xhh/system/default/sr_en_id.yaml')
        if (!names[name]) return false
        const id = names[name]
        let data = await fetch(`https://starrail.honeyhunterworld.com/${id}/?lang=CN`).then(res => res.text())
        let arr = data.match(/Continuous RePlay(.*?)<section id="char_stories" class="tab-panel tab-panel-1">/)[1].replace('<tr>', '')
        const list = []
        const titles = arr.match(/<tr><td>(.*?)<\/td><td><div class="dialog_cont">/g).map(v => v.match(/<tr><td>(.*?)<\/td><td><div class="dialog_cont">/)[1])
        const ids = arr.match(/<script>dialog_data.push\({"start":(.*?),/g).map(v => v.match(/<script>dialog_data.push\({"start":(.*?),/)[1])
        const decs = arr.match(/{"from":"(.*?)","line":"(.*?)"/g).map(v => v.match(/{"from":"(.*?)","line":"(.*?)"/)[2])
        if (!ids[0]) return false
        for (let i = 0; i < ids.length; i++) {
            list.push({
                id: 'https://starrail.honeyhunterworld.com/audio/hsr-audio/' + ids[i] + '_',
                title: titles[i],
                dec: decs[i].replace(/\\u([dD][89a-fA-F][0-9a-fA-F]{2})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                }).replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                })
            })
        }
        return { list, id }
    }











}

export default new yyjson();