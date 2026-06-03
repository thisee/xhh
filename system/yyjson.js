import fetch from "node-fetch";
import { yaml } from "#xhh"
class yyjson {
    async gs_download(id) {
        try {
            let url = `https://api-takumi-static.mihoyo.com/hoyowiki/genshin/wapi/entry_page?app_sn=ys_obc&entry_page_id=${id}`;
            let res = await fetch(url).then(r => r.json());
            let modules = res?.data?.page?.modules;
            if (!modules) return false;

            // 自动寻找包含语音数据的模块
            let voiceModule = modules.find(m => m.name === "语音") || modules[14] || modules[0];
            let dataStr = voiceModule?.components?.[0]?.data;
            if (!dataStr) return false;

            let data = JSON.parse(dataStr);
            let rawList = data.list;
            if (!rawList || !rawList.length) return false;

            let cnTable = rawList.find(v => v.tab_name === "汉语" || v.tab_name === "中文") || rawList[0];
            let jpTable = rawList.find(v => v.tab_name === "日语");
            let enTable = rawList.find(v => v.tab_name === "英语");
            let krTable = rawList.find(v => v.tab_name === "韩语");

            let list = [];
            const getUrl = (obj) => {
                if (!obj) return "";
                let str = obj.audio_url || obj.audioUrl || "";
                let match = str.match(/https:\/\/[^"<>' ]+/);
                return match ? match[0] : str.replace(/sourcesrc=|><\/audio><\/div>/g, "");
            };

            for (let i = 0; i < cnTable.table.length; i++) {
                list.push({
                    title: cnTable.table[i].name,
                    dec: cnTable.table[i].content,
                    audio_cn: getUrl(cnTable.table[i]),
                    audio_jp: getUrl(jpTable?.table?.[i]),
                    audio_en: getUrl(enTable?.table?.[i]),
                    audio_kr: getUrl(krTable?.table?.[i])
                });
            }
            return { list, id };
        } catch (err) {
            return false;
        }
    }

    async sr_download(id) {
        try {
            let url = `https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/content/info?app_sn=sr_wiki&content_id=${id}`;
            let res = await fetch(url).then(r => r.json());
            let modules = res?.data?.content?.rpg_new_tmp_content?.modules;
            if (!modules) return false;

            let voiceModule = modules.find(m => m.name === "语音") || modules[9];
            let dataStr = voiceModule?.components?.[0]?.data;
            if (!dataStr) return false;

            let data = JSON.parse(dataStr);
            let rawList = data.list;
            if (!rawList || !rawList.length) return false;

            let cnTable = rawList.find(v => v.tab_name === "汉语" || v.tab_name === "中文") || rawList[0];
            let jpTable = rawList.find(v => v.tab_name === "日语");
            let enTable = rawList.find(v => v.tab_name === "英语");
            let krTable = rawList.find(v => v.tab_name === "韩语");

            let list = [];
            const getUrl = (obj) => {
                if (!obj) return "";
                let str = obj.audio_url || obj.audioUrl || "";
                let match = str.match(/https:\/\/[^"<>' ]+/);
                return match ? match[0] : str.replace(/sourcesrc=|><\/audio><\/div>/g, "");
            };

            for (let i = 0; i < cnTable.table.length; i++) {
                list.push({
                    title: cnTable.table[i].name,
                    dec: cnTable.table[i].content,
                    audio_cn: getUrl(cnTable.table[i]),
                    audio_jp: getUrl(jpTable?.table?.[i]),
                    audio_en: getUrl(enTable?.table?.[i]),
                    audio_kr: getUrl(krTable?.table?.[i])
                });
            }
            return { list, id };
        } catch (err) {
            return false;
        }
    }

    async gs_other_download(name) {
        const names = yaml.get("./plugins/xhh/system/default/gs_en_id.yaml")
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
        if (id == "playerboy") name = "hero"
        if (id == "playergirl") name = "heroine"
        for (let i = 0; i < ids.length; i++) {
            list.push({
                id: "https://gensh.honeyhunterworld.com/audio/quotes/" + name + "/" + ids[i] + "_",
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
        const names = yaml.get("./plugins/xhh/system/default/sr_en_id.yaml")
        if (!names[name]) return false
        const id = names[name]
        let data = await fetch(`https://starrail.honeyhunterworld.com/${id}/?lang=CN`).then(res => res.text())
        let arr = data.match(/Continuous RePlay(.*?)<section id="char_stories" class="tab-panel tab-panel-1">/)[1].replace("<tr>", "")
        const list = []
        const titles = arr.match(/<tr><td>(.*?)<\/td><td><div class="dialog_cont">/g).map(v => v.match(/<tr><td>(.*?)<\/td><td><div class="dialog_cont">/)[1])
        const ids = arr.match(/<script>dialog_data.push\({"start":(.*?),/g).map(v => v.match(/<script>dialog_data.push\({"start":(.*?),/)[1])
        const decs = arr.match(/{"from":"(.*?)","line":"(.*?)"/g).map(v => v.match(/{"from":"(.*?)","line":"(.*?)"/)[2])
        if (!ids[0]) return false
        for (let i = 0; i < ids.length; i++) {
            list.push({
                id: "https://starrail.honeyhunterworld.com/audio/hsr-audio/" + ids[i] + "_",
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