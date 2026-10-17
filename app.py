"""Standalone UI showcase. Dash renders pages; no model or business backend exists."""

from dash import Dash, Input, Output, dcc, html

from ui.config import MODULES
from ui.navigation import build_top_nav
from ui.overview import overview_page
from ui.samples import ROUTES, TITLES, example_tasks, figure


NOTICE = "界面展示版 / UI SHOWCASE · 四个模块均未连接模型或业务后端 · 图表和任务均为模拟示例"
app = Dash(__name__, title="Renewable Platform · UI Showcase", suppress_callback_exceptions=True)
server = app.server
app.layout = html.Div(
    [
        dcc.Location(id="location", refresh=False),
        html.Div(build_top_nav(), id="top-nav-shell"),
        html.Main(id="main-content-container", className="main-content-container content-shell system-content-shell"),
    ],
    className="app-shell system-app-shell",
)


def notice():
    return html.Div(NOTICE, className="showcase-notice", role="note")


def heading(kicker, title, description):
    return html.Section(
        [html.Div(kicker, className="eyebrow"), html.H1(title), html.P(description)],
        className="page-hero compact-page-hero",
    )


def tabs(keys, active):
    return html.Div(
        [dcc.Link(TITLES[k], href=ROUTES[k], className="segmented-button" + (" is-active" if k == active else "")) for k in keys],
        className="segmented-control glass-panel",
    )


def workflow_card(kicker, title, children):
    return html.Div(
        [html.Div(kicker, className="block-kicker"), html.H3(title), *children],
        className="workflow-block glass-panel",
    )


def workspace(module):
    prediction = module in ("windcast", "pv")
    keys = ["windcast", "pv"] if prediction else ["blade", "inverter"]
    if module == "blade":
        result = html.Div(
            [
                html.Img(src="/assets/demo-blade.svg", alt="人工绘制的叶片示意图与示例框，不是真实巡检图像或检测结果", className="sample-blade"),
                html.P("人工绘制示意图 · 示例框为固定布局 · 未执行缺陷检测", className="demo-caption"),
            ]
        )
        controls = [html.P("仅展示图像工作区布局。公开版不接收文件，不读取图像，不调用检测模型。")]
    else:
        result = dcc.Graph(id="sample-chart", figure=figure(module), config={"displayModeBar": False, "responsive": True})
        controls = [
            html.Label("切换模拟曲线场景", htmlFor="sample-scenario"),
            dcc.Dropdown(
                id="sample-scenario",
                options=[{"label": "平稳示例", "value": "smooth"}, {"label": "波动示例", "value": "variable"}],
                value="smooth", clearable=False, searchable=False,
            ),
            html.P("选择仅改变数学函数生成的曲线，不执行训练、预测或诊断。"),
        ]
    return html.Div(
        [
            heading("POWER FORECAST" if prediction else "HEALTH DIAGNOSIS", "功率预测中心" if prediction else "装备健康诊断中心", "保留原平台的导航与工作流布局，仅演示界面交互。"),
            tabs(keys, module),
            html.Div(
                [
                    html.Div(
                        [html.Div([html.H2(TITLES[module]), html.P("界面预览 · 无模型、无服务、无真实业务数据")], className="panel-heading"), html.Span("仅界面", className="status-pill status-pending")],
                        className="panel-title-row glass-panel",
                    ),
                    html.Div(
                        [
                            workflow_card("输入区域", "示例场景", controls),
                            workflow_card("运行区域", "研究服务未包含", [html.P("所有真实模型、推理服务和接口适配代码均未包含在展示版中。"), html.Button("真实推理不可用", disabled=True, className="primary-button")]),
                        ],
                        className="workflow-grid",
                    ),
                    html.Div([html.Div("ILLUSTRATIVE SAMPLE ONLY", className="eyebrow"), html.P("所有数值均为无量纲模拟值；示意图不是实际检测结果。", className="demo-caption"), result], className="workflow-block glass-panel sample-result"),
                    html.Div([html.H3("示例任务记录"), html.P("这些固定示例不是实际执行记录。"), dcc.Link("前往任务中心", href="/tasks", className="inline-link")], className="workflow-block glass-panel"),
                ], className="module-workspace hub-panel",
            ),
        ], className="hub-page prediction-page" if prediction else "hub-page diagnosis-page",
    )


def task_center():
    rows = [
        html.Tr([html.Td(t["id"]), html.Td(t["title"]), html.Td("内置模拟示例"), html.Td("仅展示 · 未执行"), html.Td(dcc.Link("查看示例界面", href=t["route"], className="inline-link"))])
        for t in example_tasks()
    ]
    return html.Div(
        [
            heading("TASK CENTER", "任务中心", "固定的界面演示记录；无数据库、无任务执行、无历史业务记录。"),
            html.Div(html.Table([html.Thead(html.Tr([html.Th(t) for t in ["示例编号", "所属模块", "输入来源", "状态", "操作"]])), html.Tbody(rows)], className="system-table task-table"), className="glass-panel task-center-panel sample-table-scroll"),
        ], className="task-center-page",
    )


def content_for_path(path):
    path = (path or "/overview").rstrip("/") or "/overview"
    if path == "/overview":
        return overview_page(MODULES)
    if path == "/tasks":
        return task_center()
    aliases = {"/prediction": "windcast", "/diagnosis": "blade"}
    module = aliases.get(path) or next((key for key, route in ROUTES.items() if route == path), None)
    if module:
        return workspace(module)
    return html.Div([heading("PAGE NOT FOUND", "页面不存在", "请选择上方导航或返回首页。"), dcc.Link("返回首页", href="/overview", className="inline-link")])


@app.callback(Output("main-content-container", "children"), Input("location", "pathname"))
def render_page(path):
    return html.Div([notice(), content_for_path(path)], className="main-content-view")


@app.callback(Output("sample-chart", "figure"), Input("sample-scenario", "value"), Input("location", "pathname"))
def change_sample(scenario, path):
    module = next((key for key, route in ROUTES.items() if route == path), "windcast")
    return figure(module, scenario or "smooth")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8061, debug=False)
