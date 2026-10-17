import ast
from pathlib import Path
import unittest

from app import app, content_for_path, render_page
from ui.samples import ROUTES, example_tasks, figure


ROOT = Path(__file__).resolve().parents[1]


class ShowcaseTests(unittest.TestCase):
    def test_no_private_model_or_service_imports(self):
        allowed = {"__future__", "dash", "plotly", "math", "ui"}
        for path in [ROOT / "app.py", *(ROOT / "ui").glob("*.py")]:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    modules = [alias.name.split(".")[0] for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    modules = [(node.module or "").split(".")[0]]
                else:
                    continue
                for module in modules:
                    self.assertIn(module, allowed, f"Unexpected import in {path.name}")

    def test_all_routes_render_and_carry_showcase_notice(self):
        for route in ["/overview", "/tasks", *ROUTES.values(), "/missing"]:
            self.assertIsNotNone(content_for_path(route))
            rendered = render_page(route)
            self.assertIn("UI SHOWCASE", str(rendered))

    def test_synthetic_samples_are_deterministic_and_switch_scenario(self):
        a = figure("windcast", "smooth")
        b = figure("windcast", "variable")
        self.assertEqual(a.to_json(), figure("windcast", "smooth").to_json())
        self.assertNotEqual(list(a.data[0].y), list(b.data[0].y))
        self.assertIn("模拟数据", a.layout.title.text)

    def test_sample_tasks_link_to_all_four_interfaces(self):
        self.assertEqual({t["route"] for t in example_tasks()}, set(ROUTES.values()))
        self.assertTrue(all(t["id"].startswith("demo-") for t in example_tasks()))

    def test_no_artifact_upload_or_business_routes(self):
        routes = {str(rule) for rule in app.server.url_map.iter_rules()}
        self.assertFalse(any("platform-artifacts" in route or "/api/" in route for route in routes))
        client = app.server.test_client()
        self.assertEqual(client.get("/_dash-layout").status_code, 200)
        self.assertEqual(client.get("/_dash-dependencies").status_code, 200)


if __name__ == "__main__":
    unittest.main()
