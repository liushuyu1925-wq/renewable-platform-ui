from __future__ import annotations

from dash import dcc, html




HERO_SUBTITLE = "界面展示版：浏览四个模块的页面与模拟示例，未连接模型或业务服务。"

HOME_MODULE_STATUS_LABELS = {
    "ready": "服务已接入",
    "pending": "仅界面 · 未连接模型",
    "offline": "服务未启动",
    "unknown": "状态待确认",
}

TASK_STATUS_LABELS = {
    "success": "已完成",
    "succeeded": "已完成",
    "failed": "失败",
    "running": "运行中",
    "offline": "服务未启动",
    "ready": "服务就绪",
    "unknown": "状态待确认",
}


def overview_page(modules: dict) -> html.Div:
    return html.Div(
        [
            html.Section(
                [
                    html.Canvas(id="platform-background-canvas", className="hero-canvas"),
                    html.Div(
                        [
                            html.Div("NEW ENERGY INTELLIGENCE", className="eyebrow"),
                            html.H1(["新能源场站智能预测", html.Br(), "与健康诊断平台"], className="system-hero-title"),
                            html.P(HERO_SUBTITLE, className="hero-slogan"),
                        ],
                        className="hero-copy",
                    ),
                ],
                className="platform-hero hero-section",
            ),
            html.Section(
                [
                    _capability_card(
                        "新能源功率预测",
                        "面向风电与光伏场站，提供短期功率预测与气象驱动误差校正能力。",
                        "/prediction/windcast",
                        [
                            ("风电功率预测", "WindCAST", "风电预测工作台布局；公开版只展示模拟曲线。", "/prediction/windcast", modules["windcast"]["status"]),
                            ("光伏功率预测与气象校正", "PV Forecasting", "结合运行数据与气象因素，开展光伏功率预测与误差校正。", "/prediction/pv", modules["pv_power_forecast"]["status"]),
                        ],
                    ),
                    _capability_card(
                        "设备健康诊断",
                        "面向关键设备运行状态，提供叶片缺陷识别、逆变器健康诊断与风险评估。",
                        "/diagnosis/blade",
                        [
                            ("风机叶片缺陷检测", "BladeVision", "识别叶片表面裂纹、腐蚀、孔洞与剥落等缺陷。", "/diagnosis/blade", modules["blade_detection"]["status"]),
                            ("光伏逆变器健康诊断", "PCMR", "基于运行数据识别设备异常状态并输出诊断建议。", "/diagnosis/inverter", modules["inverter_health"]["status"]),
                        ],
                    ),
                ],
                className="capability-grid",
            ),
            html.Section(
                [
                    html.Div(
                        [
                            html.Div("MODULE STATUS", className="eyebrow"),
                            html.H2("模块展示范围"),
                        ],
                        className="section-header compact-header",
                    ),
                    html.Div(
                        [
                            _status_row("WindCAST 风电功率预测", modules["windcast"]["status"]),
                            _status_row("光伏功率预测与气象校正", modules["pv_power_forecast"]["status"]),
                            _status_row("BladeVision 风机叶片缺陷检测", modules["blade_detection"]["status"]),
                            _status_row("PCMR 光伏逆变器健康诊断", modules["inverter_health"]["status"]),
                        ],
                        className="status-list glass-panel",
                    ),
                    _diagnosis_latest_summary(),
                ],
                className="content-section status-section",
            ),
        ],
        className="overview-page",
    )


def _capability_card(title: str, description: str, href: str, module_items: list[tuple[str, str, str, str, str]]) -> html.Div:
    return html.Div(
        [
            dcc.Link("", href=href, refresh=False, title=title, className="capability-card-hit-area"),
            html.Div([html.H2(title), html.P(description)], className="capability-copy"),
            html.Div([_module_entry(*item) for item in module_items], className="module-entry-list"),
        ],
        className="capability-card glass-panel",
    )


def _module_entry(name: str, service_id: str, detail: str, href: str, status: str) -> dcc.Link:
    return dcc.Link(
        [
            html.Div([html.Strong(name), html.Span(f"服务标识：{service_id}")], className="module-entry-title"),
            html.Span(detail, className="module-entry-detail"),
            html.Span(_module_status_label(status), className=f"status-pill status-{status}"),
        ],
        href=href,
        refresh=False,
        className="module-entry",
    )


def _status_row(label: str, status: str) -> html.Div:
    return html.Div(
        [
            html.Span("", className=f"status-dot status-{status}"),
            html.Strong(label),
            html.Span(_module_status_label(status)),
        ],
        className="status-row",
    )


def _diagnosis_latest_summary() -> html.Div:
    blade_task = None
    inverter_task = None

    return html.Div(
        [
            html.Div("DIAGNOSIS STATUS", className="eyebrow"),
            html.H3("健康诊断界面展示"),
            html.Div(
                [
                    _summary_item("风机叶片缺陷检测", "服务标识：BladeVision", _task_link(blade_task, "/diagnosis/blade")),
                    _summary_item("光伏逆变器健康诊断", "服务标识：PCMR", _task_link(inverter_task, "/diagnosis/inverter")),
                ],
                className="overview-diagnosis-grid",
            ),
        ],
        className="overview-diagnosis-summary glass-panel",
    )


def _module_status_label(status: str | None) -> str:
    return HOME_MODULE_STATUS_LABELS.get(status or "unknown", HOME_MODULE_STATUS_LABELS["unknown"])


def _task_status_label(status: str | None) -> str:
    return TASK_STATUS_LABELS.get(status or "unknown", TASK_STATUS_LABELS["unknown"])


def _summary_item(title: str, state: str, link) -> html.Div:
    return html.Div(
        [
            html.Strong(title),
            html.Span(state),
            link,
        ],
        className="overview-diagnosis-item",
    )


def _task_link(task: dict | None, base_href: str):
    if not task:
        return html.Span("未连接服务 · 无真实任务", className="muted-inline")
    return dcc.Link(
        f"最近任务：{_task_status_label(task.get('status'))}",
        href=f"{base_href}?task_id={task['task_id']}",
        refresh=False,
        className="inline-link",
    )
