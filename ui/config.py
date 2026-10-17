APP_NAME = "新能源场站智能预测与健康诊断平台"
NAV_ITEMS = [
    ("首页总览", "/overview", "home"),
    ("功率预测", "/prediction/windcast", "prediction"),
    ("健康诊断", "/diagnosis/blade", "diagnosis"),
    ("任务中心", "/tasks", "tasks"),
]

MODULES = {
    "windcast": {"status": "pending"},
    "pv_power_forecast": {"status": "pending"},
    "blade_detection": {"status": "pending"},
    "inverter_health": {"status": "pending"},
}
