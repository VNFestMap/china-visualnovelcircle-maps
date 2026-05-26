from astrbot.api.all import *
import asyncio
import aiohttp
import json
import os
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple


COMMAND_NAMES = ("gal地图", "/gal地图", "galmap", "/galmap")

COUNTRY_LABELS = {
    "china": "中国",
    "japan": "日本",
    "all": "全部",
}

TYPE_LABELS = {
    "school": "高校同好会",
    "region": "地区同好会",
    "vnfest": "VNFest",
}

STATUS_LABELS = {
    "planning": "筹备中",
    "writing": "征稿中",
    "editing": "编辑中",
    "published": "已发布",
    "approved": "已通过",
    "pending": "待审核",
    "draft": "草稿",
}

JOIN_METHOD_LABELS = {
    "school_no_code": "本校成员申请加入（未有绑定码）",
    "school_code": "本校成员申请（有绑定码）",
    "external_exchange": "外校成员交流申请",
}

ROLE_LABELS = {
    "external": "外交成员（IEM）",
    "member": "成员",
    "manager": "管理员",
    "representative": "负责人",
    "super_admin": "超级管理员",
}

CHINA_REGION_ALIASES = {
    "京": "北京", "北京": "北京", "北京市": "北京",
    "津": "天津", "天津": "天津", "天津市": "天津",
    "沪": "上海", "上海": "上海", "上海市": "上海",
    "渝": "重庆", "重庆": "重庆", "重庆市": "重庆",
    "冀": "河北", "河北": "河北", "河北省": "河北",
    "晋": "山西", "山西": "山西", "山西省": "山西",
    "蒙": "内蒙古", "内蒙古": "内蒙古", "内蒙古自治区": "内蒙古",
    "辽": "辽宁", "辽宁": "辽宁", "辽宁省": "辽宁",
    "吉": "吉林", "吉林": "吉林", "吉林省": "吉林",
    "黑": "黑龙江", "黑龙江": "黑龙江", "黑龙江省": "黑龙江",
    "苏": "江苏", "江苏": "江苏", "江苏省": "江苏",
    "浙": "浙江", "浙江": "浙江", "浙江省": "浙江",
    "皖": "安徽", "安徽": "安徽", "安徽省": "安徽",
    "闽": "福建", "福建": "福建", "福建省": "福建",
    "赣": "江西", "江西": "江西", "江西省": "江西",
    "鲁": "山东", "山东": "山东", "山东省": "山东",
    "豫": "河南", "河南": "河南", "河南省": "河南",
    "鄂": "湖北", "湖北": "湖北", "湖北省": "湖北",
    "湘": "湖南", "湖南": "湖南", "湖南省": "湖南",
    "粤": "广东", "广东": "广东", "广东省": "广东",
    "琼": "海南", "海南": "海南", "海南省": "海南",
    "川": "四川", "蜀": "四川", "四川": "四川", "四川省": "四川",
    "黔": "贵州", "贵": "贵州", "贵州": "贵州", "贵州省": "贵州",
    "滇": "云南", "云": "云南", "云南": "云南", "云南省": "云南",
    "陕": "陕西", "秦": "陕西", "陕西": "陕西", "陕西省": "陕西",
    "甘": "甘肃", "陇": "甘肃", "甘肃": "甘肃", "甘肃省": "甘肃",
    "青": "青海", "青海": "青海", "青海省": "青海",
    "宁": "宁夏", "宁夏": "宁夏", "宁夏回族自治区": "宁夏",
    "新": "新疆", "新疆": "新疆", "新疆维吾尔自治区": "新疆",
    "藏": "西藏", "西藏": "西藏", "西藏自治区": "西藏",
    "桂": "广西", "广西": "广西", "广西壮族自治区": "广西",
    "港": "香港", "香港": "香港", "香港特别行政区": "香港",
    "澳": "澳门", "澳门": "澳门", "澳门特别行政区": "澳门",
    "台": "台湾", "台湾": "台湾", "台湾省": "台湾",
    "海外": "海外",
}

JAPAN_PREFECTURE_ALIASES = {
    "北海道": "北海道",
    "青森": "青森県", "青森县": "青森県", "青森縣": "青森県", "青森県": "青森県",
    "岩手": "岩手県", "岩手县": "岩手県", "岩手縣": "岩手県", "岩手県": "岩手県",
    "宮城": "宮城県", "宫城": "宮城県", "宫城县": "宮城県", "宮城县": "宮城県", "宮城県": "宮城県",
    "秋田": "秋田県", "秋田县": "秋田県", "秋田縣": "秋田県", "秋田県": "秋田県",
    "山形": "山形県", "山形县": "山形県", "山形縣": "山形県", "山形県": "山形県",
    "福島": "福島県", "福岛": "福島県", "福岛县": "福島県", "福島県": "福島県",
    "茨城": "茨城県", "茨城县": "茨城県", "茨城県": "茨城県",
    "栃木": "栃木県", "枥木": "栃木県", "栃木县": "栃木県", "枥木县": "栃木県", "栃木県": "栃木県",
    "群馬": "群馬県", "群马": "群馬県", "群马县": "群馬県", "群馬県": "群馬県",
    "埼玉": "埼玉県", "埼玉县": "埼玉県", "埼玉県": "埼玉県",
    "千葉": "千葉県", "千叶": "千葉県", "千叶县": "千葉県", "千葉県": "千葉県",
    "東京": "東京都", "东京": "東京都", "东京都": "東京都", "東京都": "東京都",
    "神奈川": "神奈川県", "神奈川县": "神奈川県", "神奈川県": "神奈川県",
    "新潟": "新潟県", "新潟县": "新潟県", "新潟県": "新潟県",
    "富山": "富山県", "富山县": "富山県", "富山県": "富山県",
    "石川": "石川県", "石川县": "石川県", "石川県": "石川県",
    "福井": "福井県", "福井县": "福井県", "福井県": "福井県",
    "山梨": "山梨県", "山梨县": "山梨県", "山梨県": "山梨県",
    "長野": "長野県", "长野": "長野県", "长野县": "長野県", "長野県": "長野県",
    "岐阜": "岐阜県", "岐阜县": "岐阜県", "岐阜県": "岐阜県",
    "静岡": "静岡県", "静冈": "静岡県", "静冈县": "静岡県", "静岡県": "静岡県",
    "愛知": "愛知県", "爱知": "愛知県", "爱知县": "愛知県", "愛知県": "愛知県",
    "三重": "三重県", "三重县": "三重県", "三重県": "三重県",
    "滋賀": "滋賀県", "滋贺": "滋賀県", "滋贺县": "滋賀県", "滋賀県": "滋賀県",
    "京都": "京都府", "京都府": "京都府",
    "大阪": "大阪府", "大阪府": "大阪府",
    "兵庫": "兵庫県", "兵库": "兵庫県", "兵库县": "兵庫県", "兵庫県": "兵庫県",
    "奈良": "奈良県", "奈良县": "奈良県", "奈良県": "奈良県",
    "和歌山": "和歌山県", "和歌山县": "和歌山県", "和歌山県": "和歌山県",
    "鳥取": "鳥取県", "鸟取": "鳥取県", "鸟取县": "鳥取県", "鳥取県": "鳥取県",
    "島根": "島根県", "岛根": "島根県", "岛根县": "島根県", "島根県": "島根県",
    "岡山": "岡山県", "冈山": "岡山県", "冈山县": "岡山県", "岡山県": "岡山県",
    "広島": "広島県", "广岛": "広島県", "广岛县": "広島県", "広島県": "広島県",
    "山口": "山口県", "山口县": "山口県", "山口県": "山口県",
    "徳島": "徳島県", "德岛": "徳島県", "德岛县": "徳島県", "徳島県": "徳島県",
    "香川": "香川県", "香川县": "香川県", "香川県": "香川県",
    "愛媛": "愛媛県", "爱媛": "愛媛県", "爱媛县": "愛媛県", "愛媛県": "愛媛県",
    "高知": "高知県", "高知县": "高知県", "高知県": "高知県",
    "福岡": "福岡県", "福冈": "福岡県", "福冈县": "福岡県", "福岡県": "福岡県",
    "佐賀": "佐賀県", "佐贺": "佐賀県", "佐贺县": "佐賀県", "佐賀県": "佐賀県",
    "長崎": "長崎県", "长崎": "長崎県", "长崎县": "長崎県", "長崎県": "長崎県",
    "熊本": "熊本県", "熊本县": "熊本県", "熊本県": "熊本県",
    "大分": "大分県", "大分县": "大分県", "大分県": "大分県",
    "宮崎": "宮崎県", "宫崎": "宮崎県", "宫崎县": "宮崎県", "宮崎県": "宮崎県",
    "鹿児島": "鹿児島県", "鹿儿岛": "鹿児島県", "鹿儿岛县": "鹿児島県", "鹿児島県": "鹿児島県",
    "沖縄": "沖縄県", "冲绳": "沖縄県", "冲绳县": "沖縄県", "沖縄県": "沖縄県",
}


def _string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).replace("，", ",").split(",") if item.strip()]


def _clip(text: str, limit: int = 2000) -> str:
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 18)] + "\n...内容过长已截断"


def _label(value: Any, mapping: Dict[str, str]) -> str:
    text = str(value or "").strip()
    return mapping.get(text, text)


def _format_count_map(value: Any, mapping: Dict[str, str]) -> str:
    if not isinstance(value, dict) or not value:
        return "无"
    parts = []
    for key, count in value.items():
        parts.append(f"{_label(key, mapping)} {count}")
    return "，".join(parts)


def _safe_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on", "enable", "enabled"}:
        return True
    if text in {"0", "false", "no", "off", "disable", "disabled"}:
        return False
    return default


def _is_valid_unified_origin(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    parts = text.split(":")
    return len(parts) >= 3 and all(part.strip() for part in parts[:3])


def _origin_preview(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return "空"
    if len(text) <= 44:
        return text
    return text[:18] + "..." + text[-18:]


def _looks_like_club_key(value: str) -> bool:
    text = value.strip().lower()
    if text.isdigit():
        return True
    if ":" in text or "-" in text:
        prefix = text.split(":", 1)[0].split("-", 1)[0]
        return prefix in {"china", "japan"}
    return False


@register("galgamemap", "VNFest", "GalgameMap 私用查询", "v0.2.1", "https://www.map.vnfest.top")
class GalgameMapPlugin(Star):
    def __init__(self, context: Context, config: Optional[Dict[str, Any]] = None):
        super().__init__(context)
        self.config = config or self.context.get_config() or {}
        self.api_base_url = str(self.config.get("api_base_url", "https://www.map.vnfest.top")).strip().rstrip("/")
        self.api_url = self._build_api_url(self.api_base_url)
        self.bot_api_key = str(self.config.get("bot_api_key", "")).strip()
        self.cache_ttl = _safe_int(self.config.get("cache_ttl", 3600), 3600, 0, 86400)
        self.max_results = _safe_int(self.config.get("max_results", 20), 20, 1, 50)
        self.owner_ids = set(_string_list(self.config.get("owner_ids", [])))
        self.full_access_group_ids = set(_string_list(self.config.get("full_access_group_ids", [])))
        self.sync_enabled = _safe_bool(self.config.get("sync_enabled", False), False)
        self.sync_auto_enable_on_bind = _safe_bool(self.config.get("sync_auto_enable_on_bind", True), True)
        self.sync_interval_seconds = _safe_int(self.config.get("sync_interval_seconds", 120), 120, 30, 86400)
        self.sync_first_run_silence = _safe_bool(self.config.get("sync_first_run_silence", True), True)
        self.sync_max_items_per_tick = _safe_int(self.config.get("sync_max_items_per_tick", 10), 10, 1, 50)
        self.auto_approve_on_sync = _safe_bool(self.config.get("auto_approve_on_sync", False), False)
        self.sync_group_bindings = self._normalize_sync_bindings(self.config.get("sync_group_bindings", []))
        self.super_admin_sync_origins = _string_list(self.config.get("super_admin_sync_origins", []))
        self._cache: Dict[Tuple[str, Tuple[Tuple[str, str], ...]], Tuple[float, Dict[str, Any]]] = {}
        self._sync_state = self._load_sync_state()
        self._sync_task: Optional[asyncio.Task] = None
        if self._sync_active():
            self._start_sync_task()

    def _normalize_sync_bindings(self, value: Any) -> List[Dict[str, Any]]:
        if not isinstance(value, list):
            return []
        bindings = []
        for item in value:
            if not isinstance(item, dict):
                continue
            club_key = str(item.get("club_key", "")).strip()
            origin = str(item.get("unified_msg_origin", "")).strip()
            if not club_key or not origin:
                continue
            bindings.append({
                "club_key": club_key,
                "name": str(item.get("name") or club_key).strip(),
                "unified_msg_origin": origin,
                "enabled": _safe_bool(item.get("enabled", True), True),
            })
        return bindings

    def _state_file(self) -> str:
        for method_name in ("get_data_dir", "get_plugin_data_dir"):
            method = getattr(self.context, method_name, None)
            if callable(method):
                try:
                    path = method()
                    if path:
                        os.makedirs(str(path), exist_ok=True)
                        return os.path.join(str(path), "galgamemap_sync_state.json")
                except Exception:
                    pass
        return os.path.join(os.path.dirname(__file__), "sync_state.json")

    def _load_sync_state(self) -> Dict[str, Any]:
        path = self._state_file()
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                    if isinstance(data, dict):
                        return data
        except Exception as exc:
            logger.warning(f"GalgameMap sync state load failed: {exc}")
        return {
            "bindings": {},
            "disabled_club_keys": [],
            "disabled_binding_keys": [],
            "disabled_super_origins": [],
            "super_admin_sync_origins": [],
            "last_seen": {},
            "item_signatures": {},
            "first_run_done": {},
            "sync_runtime_enabled": False,
            "sync_runtime_disabled": False,
        }

    def _save_sync_state(self) -> None:
        path = self._state_file()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp_path = path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as fp:
                json.dump(self._sync_state, fp, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        except Exception as exc:
            logger.warning(f"GalgameMap sync state save failed: {exc}")

    def _start_sync_task(self) -> None:
        if self._sync_task and not self._sync_task.done():
            return
        try:
            loop = asyncio.get_running_loop()
            self._sync_task = loop.create_task(self._sync_loop())
        except Exception as exc:
            logger.warning(f"GalgameMap sync task start failed: {exc}")

    async def initialize(self):
        if self._sync_active():
            self._start_sync_task()

    def _ensure_sync_task(self) -> None:
        if self._sync_active() and (not self._sync_task or self._sync_task.done()):
            self._start_sync_task()

    def _sync_active(self) -> bool:
        if _safe_bool(self._sync_state.get("sync_runtime_disabled", False), False):
            return False
        return self.sync_enabled or _safe_bool(self._sync_state.get("sync_runtime_enabled", False), False)

    def _set_sync_runtime(self, enabled: bool) -> None:
        self._sync_state["sync_runtime_enabled"] = bool(enabled)
        self._sync_state["sync_runtime_disabled"] = not bool(enabled)
        self._save_sync_state()
        if enabled:
            self._start_sync_task()
        elif self._sync_task and not self._sync_task.done():
            self._sync_task.cancel()

    async def terminate(self):
        if self._sync_task:
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
        self._save_sync_state()

    def _build_api_url(self, base_url: str) -> str:
        if base_url.endswith("/api/bot.php"):
            return base_url
        if base_url.endswith("/api"):
            return f"{base_url}/bot.php"
        return f"{base_url}/api/bot.php"

    def _normalize_region(self, value: str) -> str:
        text = value.strip()
        if not text:
            return ""
        return JAPAN_PREFECTURE_ALIASES.get(text, CHINA_REGION_ALIASES.get(text, text))

    def _identity_values(self, event: AstrMessageEvent, names: Iterable[str]) -> List[str]:
        values = []
        for name in names:
            attr = getattr(event, name, None)
            try:
                value = attr() if callable(attr) else attr
            except Exception:
                value = None
            if value is not None:
                values.append(str(value))
        return values

    def _is_full_context(self, event: AstrMessageEvent) -> bool:
        sender_values = self._identity_values(event, ["get_sender_id", "get_user_id", "sender_id", "user_id"])
        group_values = self._identity_values(event, ["get_group_id", "group_id"])
        if any(value in self.owner_ids for value in sender_values):
            return True
        if any(value in self.full_access_group_ids for value in group_values):
            return True
        return False

    def _is_owner(self, event: AstrMessageEvent) -> bool:
        sender_values = self._identity_values(event, ["get_sender_id", "get_user_id", "sender_id", "user_id"])
        return bool(sender_values) and any(value in self.owner_ids for value in sender_values)

    def _message_text(self, event: AstrMessageEvent) -> str:
        for name in ("get_message_str", "get_plain_text", "message_str", "message"):
            attr = getattr(event, name, None)
            try:
                value = attr() if callable(attr) else attr
            except Exception:
                continue
            if value:
                return str(value).strip()
        return ""

    def _parse_parts(self, event: AstrMessageEvent, args: str = "") -> List[str]:
        text = str(args or "").strip()
        raw_text = self._message_text(event)
        for command_name in COMMAND_NAMES:
            if raw_text == command_name:
                text = ""
                break
            prefix = command_name + " "
            if raw_text.startswith(prefix):
                text = raw_text[len(prefix):].strip()
                break
        return [part.strip() for part in text.split() if part.strip()]

    def _clear_cache(self) -> int:
        count = len(self._cache)
        self._cache.clear()
        return count

    async def _api(self, action: str, use_cache: bool = True, **params: Any) -> Dict[str, Any]:
        if not self.bot_api_key:
            return {"success": False, "error": "插件未配置 bot_api_key"}

        clean_params = {"action": action}
        for key, value in params.items():
            if value is None or value == "":
                continue
            clean_params[key] = str(value)

        cache_key = (action, tuple(sorted(clean_params.items())))
        now = time.time()
        cached = self._cache.get(cache_key)
        if use_cache and cached and now - cached[0] < self.cache_ttl:
            return cached[1]

        url = self.api_url
        headers = {"Authorization": f"Bearer {self.bot_api_key}"}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=clean_params, headers=headers, timeout=12) as resp:
                    body = await resp.text()
                    content_type = resp.headers.get("Content-Type", "")
                    try:
                        data = json.loads(body) if body.strip() else {}
                    except json.JSONDecodeError:
                        preview = body[:160].replace("\n", " ").replace("\r", " ")
                        logger.error(
                            f"GalgameMap API 非 JSON 响应: HTTP {resp.status}, content-type={content_type}, action={action}, body={preview}"
                        )
                        return {"success": False, "error": f"API 返回非 JSON 响应：HTTP {resp.status}，请检查站点 api/bot.php"}
                    if resp.status != 200:
                        message = data.get("error") or data.get("message") or f"HTTP {resp.status}"
                        if resp.status == 401:
                            message = "Bot API 密钥无效或未配置"
                        return {"success": False, "error": message}
                    if not data:
                        logger.error(f"GalgameMap API 空响应: HTTP {resp.status}, action={action}")
                        return {"success": False, "error": "API 返回空响应，请检查站点 api/bot.php"}
                    if use_cache and self.cache_ttl > 0:
                        self._cache[cache_key] = (now, data)
                    return data
        except Exception as exc:
            logger.error(f"GalgameMap API 请求失败: {exc}")
            return {"success": False, "error": "数据加载失败，请稍后再试"}

    def _event_origin(self, event: AstrMessageEvent) -> str:
        value = getattr(event, "unified_msg_origin", None)
        if value and _is_valid_unified_origin(value):
            return str(value)
        return ""

    def _state_bindings(self) -> Dict[str, Dict[str, Any]]:
        bindings = self._sync_state.setdefault("bindings", {})
        return bindings if isinstance(bindings, dict) else {}

    def _binding_key(self, club_key: str, origin: str) -> str:
        return f"{club_key}@{origin}"

    def _disabled_binding_keys(self) -> set:
        return set(_string_list(self._sync_state.get("disabled_binding_keys", [])))

    def _all_sync_bindings(self) -> List[Dict[str, Any]]:
        disabled = set(_string_list(self._sync_state.get("disabled_club_keys", [])))
        disabled_binding_keys = self._disabled_binding_keys()
        merged: Dict[str, Dict[str, Any]] = {}
        for item in self.sync_group_bindings:
            key = str(item.get("club_key", "")).strip()
            origin = str(item.get("unified_msg_origin", "")).strip()
            binding_key = self._binding_key(key, origin)
            if key and _is_valid_unified_origin(origin) and key not in disabled and binding_key not in disabled_binding_keys and _safe_bool(item.get("enabled", True), True):
                merged[binding_key] = dict(item)
        for stored_key, item in self._state_bindings().items():
            if not isinstance(item, dict) or not _safe_bool(item.get("enabled", True), True):
                continue
            key = str(item.get("club_key") or stored_key).split("@", 1)[0].strip()
            origin = str(item.get("unified_msg_origin", "")).strip()
            binding_key = self._binding_key(key, origin)
            if key and _is_valid_unified_origin(origin) and key not in disabled and binding_key not in disabled_binding_keys:
                merged[binding_key] = dict(item)
        return list(merged.values())

    def _all_super_origins(self) -> List[str]:
        origins = []
        disabled = set(_string_list(self._sync_state.get("disabled_super_origins", [])))
        for value in self.super_admin_sync_origins + _string_list(self._sync_state.get("super_admin_sync_origins", [])):
            if _is_valid_unified_origin(value) and value not in disabled and value not in origins:
                origins.append(value)
        return origins

    def _invalid_sync_targets(self) -> List[str]:
        invalid = []
        for item in self.sync_group_bindings:
            if not isinstance(item, dict) or not _safe_bool(item.get("enabled", True), True):
                continue
            origin = str(item.get("unified_msg_origin", "")).strip()
            if origin and not _is_valid_unified_origin(origin):
                invalid.append(f"配置同好会绑定 {item.get('club_key') or item.get('name') or '未知'}：{_origin_preview(origin)}")
        for key, item in self._state_bindings().items():
            if not isinstance(item, dict) or not _safe_bool(item.get("enabled", True), True):
                continue
            origin = str(item.get("unified_msg_origin", "")).strip()
            if origin and not _is_valid_unified_origin(origin):
                invalid.append(f"本地同好会绑定 {item.get('club_key') or key}：{_origin_preview(origin)}")
        for origin in self.super_admin_sync_origins:
            if origin and not _is_valid_unified_origin(origin):
                invalid.append(f"配置超管同步：{_origin_preview(origin)}")
        for origin in _string_list(self._sync_state.get("super_admin_sync_origins", [])):
            if origin and not _is_valid_unified_origin(origin):
                invalid.append(f"本地超管同步：{_origin_preview(origin)}")
        return invalid

    def _last_seen_key(self, scope: str, target: str) -> str:
        return f"{scope}:{target}"

    def _get_last_seen(self, key: str) -> int:
        try:
            return int((self._sync_state.get("last_seen") or {}).get(key, 0))
        except Exception:
            return 0

    def _set_last_seen(self, key: str, value: int) -> None:
        last_seen = self._sync_state.setdefault("last_seen", {})
        if isinstance(last_seen, dict):
            last_seen[key] = max(int(value), self._get_last_seen(key))

    def _target_signatures(self, key: str) -> Dict[str, str]:
        root = self._sync_state.setdefault("item_signatures", {})
        if not isinstance(root, dict):
            self._sync_state["item_signatures"] = {}
            root = self._sync_state["item_signatures"]
        target = root.setdefault(key, {})
        if not isinstance(target, dict):
            root[key] = {}
            target = root[key]
        return target

    def _application_signature(self, item: Dict[str, Any]) -> str:
        fields = {
            "id": item.get("id"),
            "club_key": item.get("club_key"),
            "status": item.get("status"),
            "join_method": item.get("join_method"),
            "apply_role": item.get("apply_role"),
            "role_label": item.get("role_label"),
            "applicant_name": item.get("applicant_name"),
            "username": item.get("username"),
            "user_id": item.get("user_id"),
            "contact_account": item.get("contact_account"),
            "qq_account": item.get("qq_account"),
            "external_club_name": item.get("external_club_name"),
            "external_club_role": item.get("external_club_role"),
            "apply_reason": item.get("apply_reason"),
            "created_at": item.get("created_at") or item.get("joined_at"),
        }
        return json.dumps(fields, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

    def _first_run_done(self, key: str) -> bool:
        done = self._sync_state.setdefault("first_run_done", {})
        return bool(isinstance(done, dict) and done.get(key))

    def _mark_first_run_done(self, key: str) -> None:
        done = self._sync_state.setdefault("first_run_done", {})
        if isinstance(done, dict):
            done[key] = True

    async def _sync_loop(self) -> None:
        await asyncio.sleep(3)
        while True:
            try:
                await self._sync_once(force=False)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(f"GalgameMap sync tick failed: {exc}")
            await asyncio.sleep(self.sync_interval_seconds)

    async def _sync_once(self, force: bool = False) -> Tuple[int, int]:
        pushed = 0
        checked = 0
        for binding in self._all_sync_bindings():
            checked += 1
            club_key = str(binding.get("club_key", "")).strip()
            origin = str(binding.get("unified_msg_origin", "")).strip()
            if not club_key or not origin:
                continue
            state_key = self._last_seen_key("club", club_key + "@" + origin)
            pushed += await self._sync_target(
                state_key=state_key,
                origin=origin,
                title="【GalgameMap】新的同好会申请",
                scope="club",
                club_key=club_key,
                force=force,
            )
        for origin in self._all_super_origins():
            checked += 1
            state_key = self._last_seen_key("super", origin)
            pushed += await self._sync_target(
                state_key=state_key,
                origin=origin,
                title="【GalgameMap】全站申请同步",
                scope="all",
                club_key="",
                force=force,
            )
        if pushed or checked:
            self._save_sync_state()
        return pushed, checked

    async def _sync_target(self, state_key: str, origin: str, title: str, scope: str, club_key: str, force: bool) -> int:
        since_id = self._get_last_seen(state_key)
        params: Dict[str, Any] = {
            "scope": scope,
            "status": "pending",
            "order": "desc",
            "limit": self.sync_max_items_per_tick,
        }
        if since_id > 0:
            params["since_id"] = str(since_id)
        if scope == "club":
            params["club_key"] = club_key
        payload = await self._api("membership_applications", use_cache=False, **params)
        if not payload.get("success"):
            logger.warning(f"GalgameMap sync API failed: scope={scope}, club_key={club_key or '-'}, error={payload.get('error')}")
            return 0
        items = payload.get("data") or []
        if not isinstance(items, list) or not items:
            self._mark_first_run_done(state_key)
            return 0
        signatures = self._target_signatures(state_key)
        valid_items = []
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = int(item.get("id") or 0)
            if item_id <= 0:
                continue
            signature = self._application_signature(item)
            previous = signatures.get(str(item_id))
            if item_id > since_id or (previous is not None and previous != signature):
                valid_items.append(item)
            elif previous is None:
                signatures[str(item_id)] = signature
        if self.sync_first_run_silence and not force and not self._first_run_done(state_key) and since_id <= 0:
            seen_ids = []
            for item in items:
                if isinstance(item, dict) and int(item.get("id") or 0) > 0:
                    item_id = int(item.get("id") or 0)
                    seen_ids.append(item_id)
                    signatures[str(item_id)] = self._application_signature(item)
            if seen_ids:
                self._set_last_seen(state_key, max(seen_ids))
            self._mark_first_run_done(state_key)
            return 0
        if not valid_items:
            self._mark_first_run_done(state_key)
            return 0
        sent = 0
        sent_ids = []
        for item in sorted(valid_items, key=lambda x: int(x.get("id") or 0), reverse=True):
            message = self._render_application_message(item, title)
            if await self._send_text(origin, message):
                sent += 1
                item_id = int(item.get("id") or 0)
                sent_ids.append(item_id)
                signatures[str(item_id)] = self._application_signature(item)
        # Auto-approve valid items if configured
        if self.auto_approve_on_sync:
            for item in valid_items:
                try:
                    await self._api("auto_approve", use_cache=False, membership_id=item.get("id"))
                except Exception as exc:
                    logger.warning(f"GalgameMap auto-approve failed for membership {item.get('id')}: {exc}")
        if sent_ids and len(sent_ids) == len(valid_items):
            self._set_last_seen(state_key, max(sent_ids))
        self._mark_first_run_done(state_key)
        return sent

    async def _send_text(self, origin: str, text: str) -> bool:
        if not _is_valid_unified_origin(origin):
            logger.warning(
                f"GalgameMap active message skipped: invalid unified_msg_origin={_origin_preview(origin)}. "
                "请在目标群/会话重新执行 /gal地图 同步绑定 或 /gal地图 同步超管。"
            )
            return False
        candidates = []
        try:
            candidates.append(MessageChain().message(text))
        except Exception:
            pass
        try:
            candidates.append(MessageChain([Plain(text)]))
        except Exception:
            pass
        try:
            candidates.append([Plain(text)])
        except Exception:
            pass
        candidates.append(text)
        last_error = None
        for chain in candidates:
            try:
                await self.context.send_message(origin, chain)
                return True
            except Exception as exc:
                last_error = exc
        logger.warning(
            f"GalgameMap active message send failed: origin={_origin_preview(origin)}, error={last_error}. "
            "如提示 session 字符串不合法，请在目标群/会话重新执行同步绑定。"
        )
        return False

    def _render_application_message(self, item: Dict[str, Any], title: str) -> str:
        contact = item.get("contact_account") or item.get("qq_account") or "未填写"
        lines = [
            title,
            f"同好会：{item.get('club_name') or item.get('club_key')}",
            f"申请方式：{item.get('join_method_label') or JOIN_METHOD_LABELS.get(item.get('join_method'), item.get('join_method') or '未标注')}",
            f"申请身份：{item.get('role_label') or ROLE_LABELS.get(item.get('apply_role'), item.get('apply_role') or '成员')}",
            f"申请人：{item.get('applicant_name') or item.get('username') or item.get('user_id')}",
            f"QQ/Discord：{contact}",
        ]
        if item.get("external_club_name"):
            lines.append(f"所属同好会：{item.get('external_club_name')}")
        if item.get("external_club_role"):
            lines.append(f"所属身份：{item.get('external_club_role')}")
        reason = str(item.get("apply_reason") or "").strip()
        if reason:
            lines.append("申请理由：" + _clip(reason, 260))
        if item.get("created_at"):
            lines.append(f"提交时间：{item.get('created_at')}")
        lines.append("请前往同好会管理后台处理。")
        return _clip("\n".join(lines), 1800)

    def _render_sync_status(self) -> str:
        bindings = self._all_sync_bindings()
        origins = self._all_super_origins()
        invalid = self._invalid_sync_targets()
        lines = [
            "GalgameMap 申请同步状态",
            f"同步开关：{'开启' if self._sync_active() else '关闭'}（配置：{'开' if self.sync_enabled else '关'}，运行时：{'开' if _safe_bool(self._sync_state.get('sync_runtime_enabled', False), False) else '关'}）",
            f"检测间隔：{self.sync_interval_seconds}s",
            f"同好会绑定：{len(bindings)} 个",
        ]
        for item in bindings[:10]:
            lines.append(f"- {item.get('club_key')} => {item.get('name') or item.get('unified_msg_origin')}")
        lines.append(f"超管同步会话：{len(origins)} 个")
        if invalid:
            lines.append(f"非法 session：{len(invalid)} 个，已跳过发送")
            for item in invalid[:6]:
                lines.append(f"- {item}")
            lines.append("修复：请在目标群/私聊重新执行 /gal地图 同步绑定 <同好会名> 或 /gal地图 同步超管。不要手填纯 QQ 群号。")
        return _clip("\n".join(lines))

    def _club_key_from_item(self, item: Dict[str, Any]) -> str:
        key = str(item.get("key") or "").strip()
        if key:
            return key
        country = str(item.get("country") or "china").strip() or "china"
        club_id = str(item.get("id") or "").strip()
        return f"{country}:{club_id}" if club_id else ""

    def _club_name_from_item(self, item: Dict[str, Any]) -> str:
        return str(item.get("name") or item.get("short_name") or item.get("display_name") or self._club_key_from_item(item)).strip()

    def _club_candidate_line(self, item: Dict[str, Any]) -> str:
        key = self._club_key_from_item(item)
        name = self._club_name_from_item(item)
        parts = [str(item.get("school") or "").strip(), str(item.get("region") or "").strip(), _label(item.get("country"), COUNTRY_LABELS)]
        detail = " / ".join(part for part in parts if part)
        return f"- {key} {name}" + (f"（{detail}）" if detail else "")

    def _exact_club_candidates(self, query: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        text = str(query or "").strip().lower()
        if not text:
            return []
        exact = []
        for item in candidates:
            values = [
                self._club_key_from_item(item),
                str(item.get("name") or ""),
                str(item.get("short_name") or ""),
                str(item.get("display_name") or ""),
                str(item.get("school") or ""),
            ]
            if any(str(value).strip().lower() == text for value in values if value):
                exact.append(item)
        return exact

    async def _resolve_club_candidates(self, query: str) -> List[Dict[str, Any]]:
        text = str(query or "").strip()
        if not text:
            return []
        candidates: List[Dict[str, Any]] = []
        seen = set()

        async def add_payload(payload: Dict[str, Any]) -> None:
            if not payload.get("success"):
                return
            data = payload.get("data")
            rows = data if isinstance(data, list) else [data]
            for row in rows:
                if not isinstance(row, dict):
                    continue
                key = self._club_key_from_item(row)
                if key and key not in seen:
                    seen.add(key)
                    candidates.append(row)

        if _looks_like_club_key(text):
            await add_payload(await self._api("club", use_cache=False, id=text, q=text, limit=1, full=0))
            return candidates

        await add_payload(await self._api("search", use_cache=False, q=text, limit=5, full=0))
        if not candidates:
            await add_payload(await self._api("club", use_cache=False, id=text, q=text, limit=1, full=0))
        return candidates[:5]

    def _render_club_candidates(self, query: str, candidates: List[Dict[str, Any]]) -> str:
        if not candidates:
            return f"未找到“{query}”对应的同好会。可以先用 /gal地图 搜索 {query} 查看关键词是否正确。"
        lines = [f"“{query}”匹配到多个同好会，请用 key 重新绑定："]
        for item in candidates:
            lines.append(self._club_candidate_line(item))
        lines.append("示例：/gal地图 同步绑定 china:2")
        return _clip("\n".join(lines))

    async def _resolve_single_club_for_sync(self, query: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        candidates = await self._resolve_club_candidates(query)
        if len(candidates) == 1:
            return candidates[0], None
        exact = self._exact_club_candidates(query, candidates)
        if len(exact) == 1:
            return exact[0], None
        return None, self._render_club_candidates(query, candidates)

    async def _render_sync_search(self, query: str) -> str:
        candidates = await self._resolve_club_candidates(query)
        if not candidates:
            return f"未找到“{query}”对应的同好会。"
        lines = [f"同步绑定候选：{query}"]
        for item in candidates:
            lines.append(self._club_candidate_line(item))
        lines.append("绑定示例：/gal地图 同步绑定 " + self._club_key_from_item(candidates[0]))
        return _clip("\n".join(lines))

    async def _bind_sync_origin(self, event: AstrMessageEvent, query: str, name: str = "") -> str:
        origin = self._event_origin(event)
        if not origin:
            return "无法识别当前会话的合法 unified_msg_origin，不能建立同步绑定。请在需要接收提醒的群/私聊里直接执行本命令，不要在配置中手填 QQ 群号。"
        club, error = await self._resolve_single_club_for_sync(query)
        if error:
            return error
        if not club:
            return f"未找到“{query}”对应的同好会。"
        club_key = self._club_key_from_item(club)
        display_name = name or self._club_name_from_item(club)
        if not club_key:
            return "未能解析同好会 key，请使用 /gal地图 同步搜索 <关键词> 后用候选 key 绑定。"
        bindings = self._state_bindings()
        binding_key = self._binding_key(club_key, origin)
        bindings[binding_key] = {
            "club_key": club_key,
            "name": display_name,
            "unified_msg_origin": origin,
            "enabled": True,
        }
        disabled = set(_string_list(self._sync_state.get("disabled_club_keys", [])))
        disabled.discard(club_key)
        self._sync_state["disabled_club_keys"] = list(disabled)
        disabled_bindings = self._disabled_binding_keys()
        disabled_bindings.discard(binding_key)
        self._sync_state["disabled_binding_keys"] = list(disabled_bindings)
        if self.sync_auto_enable_on_bind:
            self._sync_state["sync_runtime_enabled"] = True
            self._sync_state["sync_runtime_disabled"] = False
        self._save_sync_state()
        if self.sync_auto_enable_on_bind:
            self._start_sync_task()
        return f"已绑定 {club_key}（{display_name}）到当前会话，申请同步已开启。"

    async def _sync_check_single_club(self, event: AstrMessageEvent, query: str) -> str:
        origin = self._event_origin(event)
        if not origin:
            return "无法识别当前会话的合法 unified_msg_origin，不能执行单同好会同步检测。请在目标群/私聊中执行。"
        club, error = await self._resolve_single_club_for_sync(query)
        if error:
            return error
        if not club:
            return f"未找到“{query}”对应的同好会。"
        club_key = self._club_key_from_item(club)
        club_name = self._club_name_from_item(club)
        state_key = self._last_seen_key("club", club_key + "@" + origin)
        before = self._get_last_seen(state_key)
        pushed = await self._sync_target(
            state_key=state_key,
            origin=origin,
            title="【GalgameMap】新的同好会申请",
            scope="club",
            club_key=club_key,
            force=True,
        )
        after = self._get_last_seen(state_key)
        self._save_sync_state()
        return f"单同好会同步检测完成：{club_key}（{club_name}），发送 {pushed} 条，last_seen {before} -> {after}。"

    async def _unbind_sync_origin(self, event: AstrMessageEvent, query: str) -> str:
        origin = self._event_origin(event)
        if not origin:
            return "无法识别当前会话的合法 unified_msg_origin，不能解绑当前会话。"
        bindings = self._state_bindings()
        text = str(query or "").strip()
        current = []
        for item in self._all_sync_bindings():
            if str(item.get("unified_msg_origin", "")).strip() != origin:
                continue
            club_key = str(item.get("club_key") or "").strip()
            name = str(item.get("name") or "").strip()
            haystack = f"{club_key} {name}".lower()
            if text.lower() in haystack or haystack in text.lower():
                current.append((club_key, name))
        if not current:
            candidates = await self._resolve_club_candidates(text)
            if len(candidates) == 1:
                current.append((self._club_key_from_item(candidates[0]), self._club_name_from_item(candidates[0])))
        if not current:
            return f"当前会话没有匹配“{text}”的同步绑定。"
        dedup = []
        seen = set()
        for club_key, name in current:
            if club_key and club_key not in seen:
                seen.add(club_key)
                dedup.append((club_key, name))
        if len(dedup) > 1:
            lines = [f"“{text}”匹配到多个当前会话绑定，请用 key 解绑："]
            for club_key, name in dedup:
                lines.append(f"- {club_key} {name}")
            return "\n".join(lines)
        club_key, name = dedup[0]
        binding_key = self._binding_key(club_key, origin)
        bindings.pop(binding_key, None)
        disabled_bindings = self._disabled_binding_keys()
        disabled_bindings.add(binding_key)
        self._sync_state["disabled_binding_keys"] = list(disabled_bindings)
        self._save_sync_state()
        return f"已解绑 {club_key}（{name or club_key}）的申请同步。"

    def _bind_super_origin(self, event: AstrMessageEvent) -> str:
        origin = self._event_origin(event)
        if not origin:
            return "无法识别当前会话的合法 unified_msg_origin，不能建立超管同步。请在目标会话中执行本命令，不要手填 QQ 号。"
        origins = _string_list(self._sync_state.get("super_admin_sync_origins", []))
        if origin not in origins:
            origins.append(origin)
        self._sync_state["super_admin_sync_origins"] = origins
        disabled = set(_string_list(self._sync_state.get("disabled_super_origins", [])))
        disabled.discard(origin)
        self._sync_state["disabled_super_origins"] = list(disabled)
        if self.sync_auto_enable_on_bind:
            self._sync_state["sync_runtime_enabled"] = True
            self._sync_state["sync_runtime_disabled"] = False
        self._save_sync_state()
        if self.sync_auto_enable_on_bind:
            self._start_sync_task()
        return "已将当前会话加入超级管理员全站申请同步，申请同步已开启。"

    def _unbind_super_origin(self, event: AstrMessageEvent) -> str:
        origin = self._event_origin(event)
        if not origin:
            return "无法识别当前会话的合法 unified_msg_origin，不能取消超管同步。"
        origins = [item for item in _string_list(self._sync_state.get("super_admin_sync_origins", [])) if item != origin]
        self._sync_state["super_admin_sync_origins"] = origins
        disabled = set(_string_list(self._sync_state.get("disabled_super_origins", [])))
        disabled.add(origin)
        self._sync_state["disabled_super_origins"] = list(disabled)
        self._save_sync_state()
        return "已取消当前会话的超级管理员全站申请同步。"

    def _render_sync_config(self, event: AstrMessageEvent) -> str:
        origin = getattr(event, "unified_msg_origin", None)
        valid = _is_valid_unified_origin(origin)
        lines = [
            "GalgameMap 同步配置助手",
            f"当前会话 session：{'可用于主动发送' if valid else '不可用于主动发送'}",
            f"同步状态：{'开启' if self._sync_active() else '关闭'}",
            f"自动启用：{'开启' if self.sync_auto_enable_on_bind else '关闭'}",
            "推荐流程：",
            "1. 在目标群/私聊执行 /gal地图 同步绑定 <中文同好会名>",
            "2. 全站同步执行 /gal地图 同步超管",
            "3. 用 /gal地图 同步检测 手动检查一次",
            "不要在配置里填写纯 QQ 群号；高级配置必须使用 AstrBot unified_msg_origin。",
        ]
        if origin:
            lines.append(f"当前 origin 摘要：{_origin_preview(origin)}")
        return "\n".join(lines)

    def _help(self) -> str:
        return (
            "GalgameMap 查询\n"
            "用法：\n"
            "/gal地图 地区 广东\n"
            "/gal地图 東京都\n"
            "/gal地图 搜索 关键词\n"
            "/gal地图 详情 china:123\n"
            "/gal地图 刊物 [关键词或状态]\n"
            "/gal地图 活动 [关键词]\n"
            "/gal地图 wiki 关键词\n"
            "/gal地图 星图 [关键词]\n"
            "/gal地图 萌战 [关键词]\n"
            "/gal地图 公告\n"
            "/gal地图 统计\n"
            "Owner: /gal地图 full <关键词或 id>，/gal地图 管理概览，/gal地图 同步绑定 <中文名或key>，/gal地图 同步状态，/gal地图 同步检测，/gal地图 诊断，/gal地图 清缓存\n"
            "别名：/galmap"
        )

    def _render_clubs(self, title: str, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        items = payload.get("data", [])
        if not items:
            return f"{title}\n暂无匹配同好会。"
        lines = [f"{title}：共返回 {len(items)} 条"]
        for item in items[: self.max_results]:
            name = item.get("name") or item.get("short_name") or "未命名同好会"
            region = item.get("region") or item.get("province") or item.get("prefecture") or ""
            school = item.get("school") or ""
            country = _label(item.get("country"), COUNTRY_LABELS)
            club_type = _label(item.get("type"), TYPE_LABELS)
            key = item.get("key") or f"{item.get('country', '')}:{item.get('id', '')}"
            contact = item.get("contact") or ("联系方式隐藏" if item.get("contact_hidden") else "")
            line = f"- {key} {name}"
            details = " / ".join(part for part in [country, club_type, school, region, contact] if part)
            if details:
                line += f" ({details})"
            lines.append(line)
        return _clip("\n".join(lines))

    def _render_club_detail(self, payload: Dict[str, Any], full: bool) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        item = payload.get("data") or {}
        lines = [
            f"{item.get('key', '')} {item.get('name') or item.get('short_name') or '未命名同好会'}",
            f"学校：{item.get('school') or '未填写'}",
            f"国家/地区：{_label(item.get('country'), COUNTRY_LABELS) or '未填写'}",
            f"地区：{item.get('region') or '未填写'}",
            f"类型：{_label(item.get('type'), TYPE_LABELS) or '未填写'} / 认证：{'是' if item.get('verified') else '否'}",
            f"成员数：{item.get('member_count', 0)}",
        ]
        contact = item.get("contact")
        if contact:
            lines.append(f"联系方式：{contact}")
        elif item.get("contact_hidden"):
            lines.append("联系方式：隐藏")
        if item.get("created_at"):
            lines.append(f"成立/登记：{item.get('created_at')}")
        if full and item.get("remark"):
            lines.append(f"备注：{item.get('remark')}")
        wiki = item.get("wiki")
        if wiki:
            lines.append(f"Wiki：{wiki.get('title', '')} {wiki.get('url', '')}".strip())
        moe_king = item.get("moe_king") or {}
        if moe_king:
            moe_name = moe_king.get("name_cn") or moe_king.get("name") or ""
            if moe_name:
                lines.append(f"萌王：{moe_name}")
        publications = item.get("publications") or []
        if publications:
            lines.append("关联刊物：" + "；".join((pub.get("title") or "") for pub in publications[:5] if pub.get("title")))
        members = item.get("members") or []
        if full and members:
            member_text = []
            for member in members[:10]:
                name = member.get("nickname") or member.get("username") or str(member.get("user_id", ""))
                role = member.get("role") or "member"
                member_text.append(f"{name}({member.get('role_label') or ROLE_LABELS.get(role, role)})")
            lines.append("成员：" + "，".join(member_text))
        return _clip("\n".join(lines))

    def _render_publications(self, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        items = payload.get("data", [])
        if not items:
            return "暂无匹配刊物。"
        lines = ["刊物查询："]
        for item in items[: self.max_results]:
            parts = [item.get("club_name", ""), _label(item.get("status"), STATUS_LABELS), item.get("deadline", "")]
            line = f"- {item.get('title') or '未命名刊物'}"
            detail = " / ".join(part for part in parts if part)
            if detail:
                line += f" ({detail})"
            if item.get("submit_contact"):
                line += f" 投稿：{item.get('submit_contact')}"
            elif item.get("submit_contact_hidden"):
                line += " 投稿方式隐藏"
            lines.append(line)
        return _clip("\n".join(lines))

    def _render_events(self, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        items = payload.get("data", [])
        if not items:
            return "暂无匹配活动。"
        lines = ["活动查询："]
        for item in items[: self.max_results]:
            line = f"- {item.get('title') or '未命名活动'}"
            if item.get("date"):
                line += f" ({item.get('date')})"
            if item.get("link"):
                line += f" {item.get('link')}"
            lines.append(line)
        return _clip("\n".join(lines))

    def _render_simple_list(self, title: str, payload: Dict[str, Any], name_keys: Iterable[str]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        items = payload.get("data", [])
        if not items:
            return f"{title}\n暂无匹配结果。"
        keys = list(name_keys)
        lines = [title]
        for item in items[: self.max_results]:
            name = next((str(item.get(key, "")).strip() for key in keys if item.get(key)), "未命名")
            details = []
            for key in ["region", "country", "status", "member_count", "updated_at", "url"]:
                if item.get(key) not in (None, ""):
                    value = item.get(key)
                    if key == "country":
                        value = _label(value, COUNTRY_LABELS)
                    elif key == "status":
                        value = _label(value, STATUS_LABELS)
                    labels = {
                        "region": "地区",
                        "country": "国家",
                        "status": "状态",
                        "member_count": "成员数",
                        "updated_at": "更新",
                        "url": "链接",
                    }
                    details.append(f"{labels.get(key, key)}: {value}")
            lines.append(f"- {name}" + (f" ({' / '.join(details)})" if details else ""))
        return _clip("\n".join(lines))

    def _render_stats(self, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        data = payload.get("data") or {}
        by_country = _format_count_map(data.get("by_country"), COUNTRY_LABELS)
        by_type = _format_count_map(data.get("by_type"), TYPE_LABELS)
        return "\n".join([
            "GalgameMap 统计",
            f"同好会：{data.get('total_clubs', 0)}",
            f"成员绑定：{data.get('total_members', 0)}",
            f"活动：{data.get('total_events', 0)}",
            f"刊物：{data.get('total_publications', 0)}",
            f"Wiki：{data.get('total_wiki_pages', 0)}",
            f"萌战：{data.get('total_moe_contests', 0)}",
            f"活跃用户：{data.get('active_users', 0)}",
            f"国家/地区：{by_country}",
            f"类型：{by_type}",
        ])

    def _render_admin_summary(self, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return payload.get("error", "查询失败")
        data = payload.get("data") or {}
        return "\n".join([
            "GalgameMap 管理概览",
            f"待审核同好会：{data.get('pending_club_submissions', 0)}",
            f"待审核刊物：{data.get('pending_publication_submissions', 0)}",
            f"待审核活动：{data.get('pending_event_submissions', 0)}",
            f"待处理反馈：{data.get('pending_feedback', 0)}",
            f"待审批绑定：{data.get('pending_memberships', 0)}",
            f"  - 本校申请：{data.get('pending_memberships_school_no_code', 0)}",
            f"  - 外交申请：{data.get('pending_memberships_external_exchange', 0)}",
            f"活动报名记录：{data.get('event_registrations', 0)}",
            f"活跃用户：{data.get('active_users', 0)}",
            f"同好会/刊物/活动/Wiki：{data.get('total_clubs', 0)}/{data.get('total_publications', 0)}/{data.get('total_events', 0)}/{data.get('total_wiki_pages', 0)}",
        ])

    def _render_diagnosis(self, payload: Dict[str, Any]) -> str:
        if not payload.get("success"):
            return "GalgameMap 诊断\nAPI：失败\n原因：" + payload.get("error", "未知错误")
        data = payload.get("data") or {}
        return "\n".join([
            "GalgameMap 诊断",
            "API：正常",
            f"站点：{self.api_base_url}",
            f"接口：{self.api_url}",
            f"缓存：{len(self._cache)} 项 / TTL {self.cache_ttl}s",
            f"单次展示：{self.max_results} 条",
            f"同好会：{data.get('total_clubs', 0)}",
            f"活动：{data.get('total_events', 0)}",
            f"刊物：{data.get('total_publications', 0)}",
        ])

    @command("gal地图")
    async def gal_map_command(self, event: AstrMessageEvent, args: str = ""):
        async for result in self._handle_command(event, args):
            yield result

    @command("galmap")
    async def galmap_command(self, event: AstrMessageEvent, args: str = ""):
        async for result in self._handle_command(event, args):
            yield result

    async def _handle_command(self, event: AstrMessageEvent, args: str = ""):
        self._ensure_sync_task()
        parts = self._parse_parts(event, args)
        if not parts:
            yield event.plain_result(self._help())
            return

        command = parts[0].lower()
        rest = " ".join(parts[1:]).strip()
        has_full_access = self._is_full_context(event)

        if command in ("同步绑定", "sync_bind"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            if not rest:
                yield event.plain_result("请提供同好会中文名、学校名或 key，例如：/gal地图 同步绑定 北大")
                return
            bind_parts = rest.split(maxsplit=1)
            bind_query = rest
            bind_name = ""
            if bind_parts and _looks_like_club_key(bind_parts[0]):
                bind_query = bind_parts[0]
                bind_name = bind_parts[1] if len(bind_parts) > 1 else ""
            yield event.plain_result(await self._bind_sync_origin(event, bind_query, bind_name))
            return

        if command in ("同步搜索", "sync_search"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            if not rest:
                yield event.plain_result("请提供搜索关键词，例如：/gal地图 同步搜索 北大")
                return
            yield event.plain_result(await self._render_sync_search(rest))
            return

        if command in ("同步解绑", "sync_unbind"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            if not rest:
                yield event.plain_result("请提供同好会中文名或 key，例如：/gal地图 同步解绑 北大")
                return
            yield event.plain_result(await self._unbind_sync_origin(event, rest))
            return

        if command in ("同步超管", "sync_super"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            yield event.plain_result(self._bind_super_origin(event))
            return

        if command in ("同步取消超管", "sync_unsuper"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            yield event.plain_result(self._unbind_super_origin(event))
            return

        if command in ("同步开启", "sync_on"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            self._set_sync_runtime(True)
            yield event.plain_result("申请同步已开启。")
            return

        if command in ("同步关闭", "sync_off"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            self._set_sync_runtime(False)
            yield event.plain_result("申请同步已关闭。")
            return

        if command in ("同步配置", "sync_config"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            yield event.plain_result(self._render_sync_config(event))
            return

        if command in ("同步状态", "sync_status"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            yield event.plain_result(self._render_sync_status())
            return

        if command in ("同步检测", "sync_check"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            if rest:
                yield event.plain_result(await self._sync_check_single_club(event, rest))
                return
            pushed, checked = await self._sync_once(force=True)
            yield event.plain_result(f"同步检测完成：检查 {checked} 个目标，发送 {pushed} 条申请提醒。")
            return

        if command in ("地区", "region"):
            if not rest:
                yield event.plain_result("请提供地区，例如：/gal地图 地区 广东")
                return
            region = self._normalize_region(rest)
            payload = await self._api("clubs", region=region, limit=self.max_results, full=1 if has_full_access else 0)
            yield event.plain_result(self._render_clubs(f"{region} 的同好会", payload))
            return

        if command in ("搜索", "search"):
            if not rest:
                yield event.plain_result("请提供搜索关键词，例如：/gal地图 搜索 北大")
                return
            payload = await self._api("search", q=rest, limit=self.max_results, full=1 if has_full_access else 0)
            yield event.plain_result(self._render_clubs(f"搜索 {rest}", payload))
            return

        if command in ("详情", "detail"):
            if not rest:
                yield event.plain_result("请提供同好会关键词或 ID，例如：/gal地图 详情 china:2")
                return
            payload = await self._api("club", id=rest, q=rest, limit=1, full=1 if has_full_access else 0)
            yield event.plain_result(self._render_club_detail(payload, has_full_access))
            return

        if command == "full":
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            if not rest:
                yield event.plain_result("请提供同好会关键词或 ID，例如：/gal地图 full china:2")
                return
            payload = await self._api("club", id=rest, q=rest, limit=1, full=1)
            yield event.plain_result(self._render_club_detail(payload, True))
            return

        if command in ("刊物", "publication", "publications"):
            params: Dict[str, Any] = {"limit": self.max_results, "full": 1 if has_full_access else 0}
            if rest in {"planning", "writing", "editing", "published", "approved", "pending"}:
                params["status"] = rest
            else:
                params["q"] = rest
            payload = await self._api("publications", **params)
            yield event.plain_result(self._render_publications(payload))
            return

        if command in ("活动", "event", "events"):
            payload = await self._api("events", q="" if rest == "近期" else rest, limit=self.max_results)
            yield event.plain_result(self._render_events(payload))
            return

        if command == "wiki":
            payload = await self._api("wiki", q=rest, limit=self.max_results)
            yield event.plain_result(self._render_simple_list("Wiki 查询：", payload, ["title", "club_name"]))
            return

        if command in ("星图", "star", "union", "unions"):
            payload = await self._api("star_unions", q=rest, limit=self.max_results)
            yield event.plain_result(self._render_simple_list("联合星图查询：", payload, ["name"]))
            return

        if command in ("萌战", "moe"):
            payload = await self._api("moe_contests", q=rest, limit=self.max_results)
            yield event.plain_result(self._render_simple_list("萌战查询：", payload, ["title"]))
            return

        if command in ("公告", "announcements"):
            payload = await self._api("announcements", limit=self.max_results)
            yield event.plain_result(self._render_simple_list("公告：", payload, ["title"]))
            return

        if command in ("统计", "stats"):
            payload = await self._api("stats")
            yield event.plain_result(self._render_stats(payload))
            return

        if command in ("管理概览", "admin", "admin_summary"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            payload = await self._api("admin_summary")
            yield event.plain_result(self._render_admin_summary(payload))
            return

        if command in ("诊断", "diagnose", "debug"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            payload = await self._api("stats")
            yield event.plain_result(self._render_diagnosis(payload))
            return

        if command in ("清缓存", "clear_cache", "cache"):
            if not self._is_owner(event):
                yield event.plain_result("该命令仅 owner 可用。")
                return
            count = self._clear_cache()
            yield event.plain_result(f"已清理 GalgameMap 插件缓存：{count} 项")
            return

        region = self._normalize_region(" ".join(parts))
        payload = await self._api("clubs", region=region, limit=self.max_results, full=1 if has_full_access else 0)
        yield event.plain_result(self._render_clubs(f"{region} 的同好会", payload))
