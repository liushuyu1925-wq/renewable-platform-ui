(function () {
  function draw(canvas) {
    var context = canvas.getContext("2d");
    var ratio = window.devicePixelRatio || 1;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    var start = performance.now();

    function frame(now) {
      var t = (now - start) / 1000;
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1.15;
      for (var line = 0; line < 3; line += 1) {
        context.beginPath();
        var alpha = 0.09 - line * 0.018;
        context.strokeStyle = "rgba(33, 136, 245, " + alpha + ")";
        for (var x = 0; x <= width; x += 16) {
          var y = height * (0.42 + line * 0.07) +
            Math.sin(x / 78 + t * 0.42 + line) * (18 + line * 3) +
            Math.cos(x / 146 + t * 0.28) * 10;
          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      }
      context.fillStyle = "rgba(114, 216, 248, 0.08)";
      for (var i = 0; i < 20; i += 1) {
        var px = (i * 127 + t * 5) % Math.max(width, 1);
        var py = height * 0.18 + ((i * 53) % Math.max(height * 0.62, 1));
        context.beginPath();
        context.arc(px, py + Math.sin(t * 0.35 + i) * 4, 1.2, 0, Math.PI * 2);
        context.fill();
      }
      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  function init() {
    var canvas = document.getElementById("platform-background-canvas");
    if (!canvas || canvas.dataset.backgroundReady === "true") {
      return;
    }
    canvas.dataset.backgroundReady = "true";
    draw(canvas);
  }

  window.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  window.addEventListener("resize", init);
  new MutationObserver(init).observe(document.documentElement, { childList: true, subtree: true });
})();
