from __future__ import annotations

from dash import dcc, html

from ui.config import APP_NAME, NAV_ITEMS



def nav_icon(icon_name: str) -> html.Span:
    return html.Span("", className=f"nav-icon nav-icon-{icon_name}", **{"aria-hidden": "true"})


def build_top_nav() -> html.Header:
    nav_links = [
        dcc.Link(
            [nav_icon(icon), html.Span(label, className="nav-link-label")],
            href=href,
            refresh=False,
            className="pill-nav-link",
        )
        for label, href, icon in NAV_ITEMS
    ]
    slider = html.Span(
        [
            html.Span(className="liquid-lens-base"),
            html.Span(
                [
                    html.Span(className="liquid-lens-track liquid-lens-track-main"),
                    html.Span(className="liquid-lens-track liquid-lens-track-edge"),
                ],
                className="liquid-lens-viewport liquid-lens-clip",
            ),
            html.Span(className="liquid-lens-edge-refraction"),
            html.Span(className="liquid-lens-highlight"),
        ],
        className="liquid-glass-slider active-glass-pill",
        **{"aria-hidden": "true"},
    )
    return html.Header(
        [
            dcc.Link(
                [
                    html.Span(
                        html.Img(src="/assets/summericon.png", alt=APP_NAME, className="nav-brand-logo"),
                        className="nav-mark",
                    ),
                    html.Span(APP_NAME, className="nav-brand-text"),
                ],
                href="/overview",
                refresh=False,
                className="nav-brand",
            ),
            html.Nav([slider] + nav_links, className="pill-nav-links", **{"aria-label": "平台导航"}),
        ],
        className="floating-pill-nav glass-panel",
    )
