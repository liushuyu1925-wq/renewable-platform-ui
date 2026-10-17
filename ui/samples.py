"""Invented presentation fixtures, unrelated to any model or research dataset."""

from math import cos, sin

import plotly.graph_objects as go


ROUTES = {
    "windcast": "/prediction/windcast",
    "pv": "/prediction/pv",
    "blade": "/diagnosis/blade",
    "inverter": "/diagnosis/inverter",
}
TITLES = {
    "windcast": "WindCAST 风电功率预测",
    "pv": "光伏功率预测与气象校正",
    "blade": "风机叶片缺陷检测",
    "inverter": "光伏逆变器健康诊断",
}


def figure(module: str, scenario: str = "smooth") -> go.Figure:
    x = list(range(48))
    variation = 0.025 if scenario == "smooth" else 0.1
    if module == "pv":
        a = [max(0, sin((i - 7) * 3.14159 / 35)) * 0.8 for i in x]
    elif module == "inverter":
        a = [0.24 + 0.07 * sin(i / 4) + variation * cos(i / 2) for i in x]
    else:
        a = [0.5 + 0.19 * sin(i / 7) + variation * cos(i / 2) for i in x]
    b = [v + 0.035 * sin(i / 3 + 0.8) for i, v in enumerate(a)]
    chart = go.Figure()
    chart.add_trace(go.Scatter(x=x, y=a, name="模拟序列 A", line={"color": "#243755", "width": 2.5}))
    chart.add_trace(go.Scatter(x=x, y=b, name="模拟序列 B", line={"color": "#2188F5", "width": 2.5}))
    chart.update_layout(
        title="模拟数据 · 非模型输出",
        template="plotly_white",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": "Segoe UI, Microsoft YaHei, sans-serif", "color": "#243755"},
        margin={"l": 55, "r": 24, "t": 60, "b": 80, "autoexpand": False},
        height=360,
        legend={"orientation": "h", "y": -0.2},
        xaxis_title="示例点序号（无真实时间戳）",
        xaxis_automargin=False,
        yaxis_automargin=False,
        uirevision=module,
    )
    return chart


def example_tasks() -> list[dict]:
    return [
        {"id": f"demo-{key}", "module": key, "title": title, "route": ROUTES[key]}
        for key, title in TITLES.items()
    ]
